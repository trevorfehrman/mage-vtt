import { action, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// One round-trip for all of a search's result documents (issue #30); rows
// come back in ids order so the action can zip them with the scored hits.
export const getChunksByIds = internalQuery({
  args: { ids: v.array(v.id("ruleChunks")) },
  handler: async (ctx, args) => Promise.all(args.ids.map((id) => ctx.db.get(id))),
})

interface SearchResult {
  score: number
  text: string
  section: string
  source: string
  contentType: string
}

export const searchRules = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SearchResult[]> => {
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: args.query,
    })

    const results = await ctx.vectorSearch("ruleChunks", "by_embedding", {
      vector: embedding.data[0].embedding,
      limit: args.limit ?? 5,
    })

    const chunks = await ctx.runQuery(internal.search.getChunksByIds, {
      ids: results.map((r) => r._id),
    })

    return results.map((r, i) => {
      const doc = chunks[i]
      return {
        score: r._score,
        text: doc?.text?.slice(0, 300) ?? "",
        section: doc?.section ?? "",
        source: doc?.source ?? "",
        contentType: doc?.contentType ?? "",
      }
    })
  },
})
