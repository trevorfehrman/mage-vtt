/**
 * Embed and upload ALL chunks to Convex:
 * - WoD core book chunks (data/wod-chunks.json)
 * - Fine-grained rule chunks (data/rule-chunks.json)
 *
 * The Mage book chunks are already in Convex from the first pipeline run.
 * This script adds the remaining sources.
 *
 * Usage: bun scripts/embed-all.ts
 */

import OpenAI from "openai"
import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api"

const DATA_DIR = new URL("../data/", import.meta.url).pathname
const BATCH_SIZE = 50
const CONVEX_URL = process.env.VITE_CONVEX_URL!

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
  domain?: string
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  })
  return response.data.map((d) => d.embedding)
}

async function uploadChunks(chunks: Chunk[], label: string) {
  console.log(`\n=== Uploading ${label}: ${chunks.length} chunks ===`)

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const texts = batch.map((c) => c.text)

    try {
      const embeddings = await embedBatch(texts)

      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j]
        await convex.mutation(api.ingest.insertRuleChunk, {
          chunkId: chunk.id,
          text: chunk.text,
          embedding: embeddings[j],
          chapter: chunk.chapter,
          section: chunk.section,
          contentType: chunk.contentType,
          pageStart: chunk.pageStart,
          pageEnd: chunk.pageEnd,
          source: chunk.source,
        })
      }

      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}: ✓`)
    } catch (err) {
      console.error(`  Batch failed:`, err)
      process.exit(1)
    }
  }

  console.log(`  Done: ${chunks.length} chunks uploaded`)
}

async function main() {
  // WoD chunks
  const wodChunks: Chunk[] = await Bun.file(`${DATA_DIR}wod-chunks.json`).json()
  await uploadChunks(wodChunks, "WoD Core Rulebook")

  // Fine-grained rule chunks
  const ruleChunks: Chunk[] = await Bun.file(`${DATA_DIR}rule-chunks.json`).json()
  await uploadChunks(ruleChunks, "Fine-grained Rule Chunks")

  const totalTokens = (wodChunks.reduce((s, c) => s + c.charCount, 0) +
    ruleChunks.reduce((s, c) => s + c.charCount, 0)) / 4
  console.log(`\nTotal tokens embedded: ~${Math.round(totalTokens).toLocaleString()}`)
  console.log(`Estimated cost: ~$${(totalTokens / 1_000_000 * 0.02).toFixed(4)}`)
}

main()
