/**
 * Embed and upload ALL chunks to Convex:
 * - WoD core book chunks (data/wod-chunks.json)
 * - Fine-grained rule chunks (data/rule-chunks.json)
 *
 * The Mage book chunks are already in Convex from the first pipeline run.
 * This script adds the remaining sources. Re-runs are safe: insertRuleChunk
 * upserts by chunkId.
 *
 * Usage: bun scripts/embed-all.ts
 */

import OpenAI from "openai"
import { ConvexHttpClient } from "convex/browser"
import { Effect, Redacted, Schema } from "effect"
import { api } from "../convex/_generated/api"
import {
  embedAndUploadChunks,
  embeddingEnv,
  loadJson,
  RuleChunk,
  runScript,
} from "./lib/script-runtime"

const DATA_DIR = new URL("../data/", import.meta.url).pathname

const program = Effect.gen(function* () {
  // Env validates before any work starts (issue #38).
  const env = yield* embeddingEnv
  const openai = new OpenAI({ apiKey: Redacted.value(env.openaiKey) })
  const convex = new ConvexHttpClient(env.convexUrl)

  const wodChunks = yield* loadJson(
    `${DATA_DIR}wod-chunks.json`,
    Schema.Array(RuleChunk),
  )
  yield* embedAndUploadChunks({
    openai,
    convex,
    insertRuleChunk: api.ingest.insertRuleChunk,
    chunks: wodChunks,
    label: "WoD Core Rulebook",
  })

  const ruleChunks = yield* loadJson(
    `${DATA_DIR}rule-chunks.json`,
    Schema.Array(RuleChunk),
  )
  yield* embedAndUploadChunks({
    openai,
    convex,
    insertRuleChunk: api.ingest.insertRuleChunk,
    chunks: ruleChunks,
    label: "Fine-grained Rule Chunks",
  })

  const totalTokens =
    (wodChunks.reduce((s, c) => s + c.charCount, 0) +
      ruleChunks.reduce((s, c) => s + c.charCount, 0)) /
    4
  console.log(`\nTotal tokens embedded: ~${Math.round(totalTokens).toLocaleString()}`)
  console.log(`Estimated cost: ~$${((totalTokens / 1_000_000) * 0.02).toFixed(4)}`)
})

await runScript(program)
