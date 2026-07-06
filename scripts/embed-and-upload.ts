/**
 * Stage 4: Embed Chunks + Upload to Convex
 *
 * Reads data/chunks.json, generates embeddings via OpenAI,
 * and uploads to Convex ruleChunks table.
 *
 * Also uploads structured data (spells, path-data) to their tables.
 *
 * Usage: bun scripts/embed-and-upload.ts
 *
 * Resumable: tracks progress in data/embed-progress.json. Transient API
 * failures retry (issue #38); a hard failure still leaves the progress
 * file current, so a re-run resumes where it stopped.
 */

import OpenAI from "openai"
import { ConvexHttpClient } from "convex/browser"
import { Effect, Redacted, Ref, Schema, Semaphore } from "effect"
import { api } from "../convex/_generated/api"
import {
  embedAndUploadChunks,
  embeddingEnv,
  loadJson,
  RuleChunk,
  runScript,
  tryApi,
} from "./lib/script-runtime"

const DATA_DIR = new URL("../data/", import.meta.url).pathname

// --- Input shapes (Schema-decoded, issue #38) ---

const SpellRecord = Schema.Struct({
  name: Schema.String,
  arcanum: Schema.String,
  level: Schema.Number,
  practice: Schema.String,
  action: Schema.String,
  duration: Schema.String,
  aspect: Schema.String,
  cost: Schema.String,
  description: Schema.String,
  pageStart: Schema.Number,
  rotes: Schema.Array(
    Schema.Struct({
      order: Schema.String,
      name: Schema.String,
      dicePool: Schema.String,
      // Mirrors convex/schema.ts's rotePoolValidator.
      pool: Schema.optionalKey(
        Schema.Struct({
          attribute: Schema.String,
          skills: Schema.Array(Schema.String),
          arcanum: Schema.String,
          vs: Schema.optionalKey(Schema.Array(Schema.String)),
        }),
      ),
    }),
  ),
})

const PathData = Schema.Struct({
  paths: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      realm: Schema.String,
      rulingArcana: Schema.Array(Schema.String),
      commonArcana: Schema.Array(Schema.String),
      inferiorArcanum: Schema.String,
      resistanceBonus: Schema.Struct({
        attribute: Schema.String,
        bonus: Schema.Number,
      }),
    }),
  ),
  orders: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      roteSkills: Schema.Array(Schema.String),
      description: Schema.String,
    }),
  ),
})

const EmbedProgress = Schema.Struct({
  embeddedChunkIds: Schema.Array(Schema.String),
  totalEmbedded: Schema.Number,
  lastBatchAt: Schema.String,
})
type EmbedProgress = typeof EmbedProgress.Type

const PROGRESS_PATH = `${DATA_DIR}embed-progress.json`

const loadProgress = Effect.fn("EmbedUpload.loadProgress")(function* () {
  const exists = yield* Effect.promise(() => Bun.file(PROGRESS_PATH).exists())
  if (!exists) {
    return { embeddedChunkIds: [], totalEmbedded: 0, lastBatchAt: "" } as EmbedProgress
  }
  return yield* loadJson(PROGRESS_PATH, EmbedProgress)
})

const embedChunks = Effect.fn("EmbedUpload.embedChunks")(function* (
  openai: OpenAI,
  convex: ConvexHttpClient,
) {
  console.log("=== Stage 4: Embed & Upload ===\n")

  const chunks = yield* loadJson(`${DATA_DIR}chunks.json`, Schema.Array(RuleChunk))
  console.log(`Loaded ${chunks.length} chunks`)

  const initial = yield* loadProgress()
  const alreadyDone = new Set(initial.embeddedChunkIds)
  const remaining = chunks.filter((c) => !alreadyDone.has(c.id))
  console.log(`Already embedded: ${alreadyDone.size}, remaining: ${remaining.length}`)

  if (remaining.length === 0) {
    console.log("All chunks already embedded!")
    return
  }

  // Resumable progress: batches complete concurrently, so the bookkeeping is
  // a Ref and the file write is serialized through a one-permit semaphore.
  const progress = yield* Ref.make(initial)
  const fileLock = yield* Semaphore.make(1)
  const recordBatch = Effect.fn("EmbedUpload.recordBatch")(function* (
    batch: ReadonlyArray<RuleChunk>,
  ) {
    yield* Semaphore.withPermits(
      fileLock,
      1,
    )(
      Effect.gen(function* () {
        const next = yield* Ref.updateAndGet(progress, (p) => ({
          embeddedChunkIds: [...p.embeddedChunkIds, ...batch.map((c) => c.id)],
          totalEmbedded: p.totalEmbedded + batch.length,
          lastBatchAt: new Date().toISOString(),
        }))
        yield* Effect.promise(() =>
          Bun.write(PROGRESS_PATH, JSON.stringify(next, null, 2)),
        )
      }),
    )
  })

  yield* embedAndUploadChunks({
    openai,
    convex,
    insertRuleChunk: api.ingest.insertRuleChunk,
    chunks: remaining,
    label: "Mage chunks",
    onBatchDone: recordBatch,
  })

  const final = yield* Ref.get(progress)
  console.log(`\nAll chunks embedded and uploaded (${final.totalEmbedded}/${chunks.length} total)`)
  console.log(
    `Estimated cost: ~$${((chunks.reduce((s, c) => s + c.charCount, 0) / 4 / 1_000_000) * 0.02).toFixed(4)}`,
  )
})

const uploadStructuredData = Effect.fn("EmbedUpload.uploadStructuredData")(function* (
  convex: ConvexHttpClient,
) {
  console.log("\n=== Uploading structured data ===\n")

  // Spells + Rotes
  const spells = yield* loadJson(`${DATA_DIR}spells.json`, Schema.Array(SpellRecord))
  console.log(`Uploading ${spells.length} spells...`)

  // Clear rotes first (no upsert key — several distinct rotes share a triple)
  yield* tryApi("convex ingest:clearTable", () =>
    convex.mutation(api.ingest.clearTable, { table: "rotes" }),
  )

  for (const spell of spells) {
    yield* tryApi("convex ingest:insertSpell", () =>
      convex.mutation(api.ingest.insertSpell, {
        name: spell.name,
        arcanum: spell.arcanum,
        level: spell.level,
        practice: spell.practice,
        action: spell.action,
        duration: spell.duration,
        aspect: spell.aspect,
        cost: spell.cost,
        description: spell.description,
        pageStart: spell.pageStart,
      }),
    )

    for (const rote of spell.rotes) {
      yield* tryApi("convex ingest:insertRote", () =>
        convex.mutation(api.ingest.insertRote, {
          spellName: spell.name,
          spellArcanum: spell.arcanum,
          spellLevel: spell.level,
          order: rote.order,
          name: rote.name,
          dicePool: rote.dicePool,
          ...(rote.pool !== undefined
            ? {
                pool: {
                  attribute: rote.pool.attribute,
                  skills: [...rote.pool.skills],
                  arcanum: rote.pool.arcanum,
                  ...(rote.pool.vs !== undefined ? { vs: [...rote.pool.vs] } : {}),
                },
              }
            : {}),
        }),
      )
    }
  }
  console.log(
    `  ✓ ${spells.length} spells + ${spells.reduce((s, sp) => s + sp.rotes.length, 0)} rotes`,
  )

  // Paths + Orders
  const pathData = yield* loadJson(`${DATA_DIR}path-data.json`, PathData)
  console.log(`Uploading ${pathData.paths.length} paths and ${pathData.orders.length} orders...`)

  for (const path of pathData.paths) {
    yield* tryApi("convex ingest:insertPath", () =>
      convex.mutation(api.ingest.insertPath, {
        name: path.name,
        realm: path.realm,
        rulingArcana: [...path.rulingArcana],
        commonArcana: [...path.commonArcana],
        inferiorArcanum: path.inferiorArcanum,
        resistanceBonusAttribute: path.resistanceBonus.attribute,
        resistanceBonusValue: path.resistanceBonus.bonus,
      }),
    )
  }

  for (const order of pathData.orders) {
    yield* tryApi("convex ingest:insertOrder", () =>
      convex.mutation(api.ingest.insertOrder, {
        name: order.name,
        roteSkills: [...order.roteSkills],
        description: order.description,
      }),
    )
  }
  console.log(`  ✓ ${pathData.paths.length} paths + ${pathData.orders.length} orders`)
})

const program = Effect.gen(function* () {
  // Env validates before any work starts (issue #38).
  const env = yield* embeddingEnv
  const openai = new OpenAI({ apiKey: Redacted.value(env.openaiKey) })
  const convex = new ConvexHttpClient(env.convexUrl)

  yield* embedChunks(openai, convex)
  yield* uploadStructuredData(convex)
  console.log("\n=== Done! ===")
})

await runScript(program)
