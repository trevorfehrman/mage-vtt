/**
 * Stage 4: Embed Chunks + Upload to Convex
 *
 * Reads data/chunks.json, generates embeddings via OpenAI,
 * and uploads to Convex ruleChunks table.
 *
 * Also uploads structured data (spells, path-data, character-rules)
 * to their respective Convex tables.
 *
 * Usage: bun scripts/embed-and-upload.ts
 *
 * Resumable: tracks progress in data/embed-progress.json
 * Re-run safely — skips already-embedded chunks.
 */

import OpenAI from "openai"
import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api"

const DATA_DIR = new URL("../data/", import.meta.url).pathname
const BATCH_SIZE = 50 // OpenAI embedding batch size
const CONVEX_URL = process.env.VITE_CONVEX_URL!

if (!CONVEX_URL) {
  console.error("Missing VITE_CONVEX_URL in .env.local")
  process.exit(1)
}

const openai = new OpenAI()
const convex = new ConvexHttpClient(CONVEX_URL)

interface Chunk {
  id: string
  text: string
  chapter: string
  section: string
  contentType: string
  pageStart: number
  pageEnd: number
  charCount: number
  source: string
}

interface EmbedProgress {
  embeddedChunkIds: string[]
  totalEmbedded: number
  lastBatchAt: string
}

async function loadProgress(): Promise<EmbedProgress> {
  const file = Bun.file(`${DATA_DIR}embed-progress.json`)
  if (await file.exists()) return file.json()
  return { embeddedChunkIds: [], totalEmbedded: 0, lastBatchAt: "" }
}

async function saveProgress(progress: EmbedProgress) {
  await Bun.write(`${DATA_DIR}embed-progress.json`, JSON.stringify(progress, null, 2))
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  })
  return response.data.map((d) => d.embedding)
}

async function embedChunks() {
  console.log("=== Stage 4: Embed & Upload ===\n")

  // Load chunks
  const chunks: Chunk[] = await Bun.file(`${DATA_DIR}chunks.json`).json()
  console.log(`Loaded ${chunks.length} chunks`)

  // Load progress
  const progress = await loadProgress()
  const alreadyDone = new Set(progress.embeddedChunkIds)
  const remaining = chunks.filter((c) => !alreadyDone.has(c.id))
  console.log(`Already embedded: ${alreadyDone.size}, remaining: ${remaining.length}`)

  if (remaining.length === 0) {
    console.log("All chunks already embedded!")
    return
  }

  // Process in batches
  let batchNum = 0
  const totalBatches = Math.ceil(remaining.length / BATCH_SIZE)

  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    batchNum++
    const batch = remaining.slice(i, i + BATCH_SIZE)
    const texts = batch.map((c) => c.text)

    try {
      console.log(`  Batch ${batchNum}/${totalBatches} (${batch.length} chunks)...`)
      const embeddings = await embedBatch(texts)

      // Upload each chunk with its embedding to Convex
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j]
        const embedding = embeddings[j]

        await convex.mutation(api.ingest.insertRuleChunk, {
          chunkId: chunk.id,
          text: chunk.text,
          embedding,
          chapter: chunk.chapter,
          section: chunk.section,
          contentType: chunk.contentType,
          pageStart: chunk.pageStart,
          pageEnd: chunk.pageEnd,
          source: chunk.source,
        })

        progress.embeddedChunkIds.push(chunk.id)
        progress.totalEmbedded++
      }

      progress.lastBatchAt = new Date().toISOString()
      await saveProgress(progress)

      console.log(`    ✓ Embedded + uploaded (${progress.totalEmbedded}/${chunks.length} total)`)
    } catch (err) {
      console.error(`    ✗ Batch ${batchNum} failed:`, err)
      await saveProgress(progress)
      console.log(`    Progress saved. Re-run to resume from batch ${batchNum}.`)
      process.exit(1)
    }
  }

  console.log(`\nAll ${chunks.length} chunks embedded and uploaded to Convex!`)
  console.log(`Estimated cost: ~$${((chunks.reduce((s, c) => s + c.charCount, 0) / 4 / 1_000_000) * 0.02).toFixed(4)}`)
}

async function uploadStructuredData() {
  console.log("\n=== Uploading structured data ===\n")

  // Spells + Rotes
  const spells = await Bun.file(`${DATA_DIR}spells.json`).json()
  console.log(`Uploading ${spells.length} spells...`)

  // Clear rotes first (no upsert key)
  await convex.mutation(api.ingest.clearTable, { table: "rotes" })

  for (const spell of spells) {
    await convex.mutation(api.ingest.insertSpell, {
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
    })

    for (const rote of spell.rotes) {
      await convex.mutation(api.ingest.insertRote, {
        spellName: spell.name,
        spellArcanum: spell.arcanum,
        spellLevel: spell.level,
        order: rote.order,
        name: rote.name,
        dicePool: rote.dicePool,
      })
    }
  }
  console.log(`  ✓ ${spells.length} spells + ${spells.reduce((s: number, sp: any) => s + sp.rotes.length, 0)} rotes`)

  // Paths
  const pathData = await Bun.file(`${DATA_DIR}path-data.json`).json()
  console.log(`Uploading ${pathData.paths.length} paths and ${pathData.orders.length} orders...`)

  for (const path of pathData.paths) {
    await convex.mutation(api.ingest.insertPath, {
      name: path.name,
      realm: path.realm,
      rulingArcana: path.rulingArcana,
      commonArcana: path.commonArcana,
      inferiorArcanum: path.inferiorArcanum,
      resistanceBonusAttribute: path.resistanceBonus.attribute,
      resistanceBonusValue: path.resistanceBonus.bonus,
    })
  }

  for (const order of pathData.orders) {
    await convex.mutation(api.ingest.insertOrder, {
      name: order.name,
      roteSkills: order.roteSkills,
      description: order.description,
    })
  }
  console.log(`  ✓ ${pathData.paths.length} paths + ${pathData.orders.length} orders`)
}

async function main() {
  await embedChunks()
  await uploadStructuredData()
  console.log("\n=== Done! ===")
  console.log("Don't forget to rotate your OpenAI API key if you shared it!")
}

main()
