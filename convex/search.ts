import { action, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export const getChunkById = internalQuery({
  args: { id: v.id("ruleChunks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
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

    const docs: SearchResult[] = []
    for (const r of results) {
      const doc = await ctx.runQuery(internal.search.getChunkById, { id: r._id })
      docs.push({
        score: r._score,
        text: doc?.text?.slice(0, 300) ?? "",
        section: doc?.section ?? "",
        source: doc?.source ?? "",
        contentType: doc?.contentType ?? "",
      })
    }

    return docs
  },
})
