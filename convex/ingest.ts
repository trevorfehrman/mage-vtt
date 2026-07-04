import { internalMutation, mutation } from "./_generated/server"
import { v } from "convex/values"
import { rotePoolValidator } from "./schema"
import { schemaToConvexValidator } from "../src/domain/schema-bridge"
import { CharacterData } from "../src/domain/tables"

export const insertRuleChunk = mutation({
  args: {
    chunkId: v.string(),
    text: v.string(),
    embedding: v.array(v.float64()),
    chapter: v.string(),
    section: v.string(),
    contentType: v.string(),
    pageStart: v.number(),
    pageEnd: v.number(),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    // Upsert: delete existing chunk with same ID, then insert
    const existing = await ctx.db
      .query("ruleChunks")
      .withIndex("by_chunkId", (q) => q.eq("chunkId", args.chunkId))
      .first()
    if (existing) {
      await ctx.db.delete(existing._id)
    }
    await ctx.db.insert("ruleChunks", args)
  },
})

export const insertSpell = mutation({
  args: {
    name: v.string(),
    arcanum: v.string(),
    level: v.number(),
    practice: v.string(),
    action: v.string(),
    duration: v.string(),
    aspect: v.string(),
    cost: v.string(),
    description: v.string(),
    pageStart: v.number(),
  },
  handler: async (ctx, args) => {
    // Upsert by name + arcanum
    const existing = await ctx.db
      .query("spells")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first()
    if (existing && existing.arcanum === args.arcanum) {
      await ctx.db.delete(existing._id)
    }
    await ctx.db.insert("spells", args)
  },
})

export const insertRote = mutation({
  args: {
    spellName: v.string(),
    spellArcanum: v.string(),
    spellLevel: v.number(),
    order: v.string(),
    name: v.string(),
    dicePool: v.string(),
    pool: v.optional(rotePoolValidator),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("rotes", args)
  },
})

export const insertPath = mutation({
  args: {
    name: v.string(),
    realm: v.string(),
    rulingArcana: v.array(v.string()),
    commonArcana: v.array(v.string()),
    inferiorArcanum: v.string(),
    resistanceBonusAttribute: v.string(),
    resistanceBonusValue: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("paths")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first()
    if (existing) await ctx.db.delete(existing._id)
    await ctx.db.insert("paths", args)
  },
})

export const insertOrder = mutation({
  args: {
    name: v.string(),
    roteSkills: v.array(v.string()),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("orders")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first()
    if (existing) await ctx.db.delete(existing._id)
    await ctx.db.insert("orders", args)
  },
})

/**
 * Dev-side character ingestion (issue #16): upsert a complete character —
 * identity, rated Traits, current state, known Rotes — for a session member.
 * An `internalMutation`, so it is unreachable from clients; the only caller is
 * `scripts/ingest-character.ts` through `bunx convex run` (CLI admin auth),
 * which is the Dev authority story — no UI, no public endpoint.
 *
 * Ownership binds to the (user, session) member pair. The upsert keys on that
 * member's character row and replaces it whole, so re-running the same payload
 * is idempotent and re-ingestion corrects earlier data.
 */
export const upsertCharacter = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    userId: v.string(),
    data: schemaToConvexValidator(CharacterData),
  },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("sessionMembers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect()
    const member = members.find((m) => m.userId === args.userId)
    if (!member) {
      throw new Error(
        `User ${args.userId} is not a member of session ${args.sessionId}`,
      )
    }

    const doc = {
      sessionMemberId: member._id,
      sessionId: args.sessionId,
      userId: args.userId,
      ...args.data,
    }

    const existing = await ctx.db
      .query("characters")
      .withIndex("by_sessionMemberId", (q) =>
        q.eq("sessionMemberId", member._id),
      )
      .unique()

    if (existing) {
      await ctx.db.replace(existing._id, doc)
      return existing._id
    }
    return await ctx.db.insert("characters", doc)
  },
})

export const clearTable = mutation({
  args: { table: v.string() },
  handler: async (ctx, args) => {
    if (args.table === "rotes") {
      const all = await ctx.db.query("rotes").collect()
      for (const row of all) await ctx.db.delete(row._id)
    }
  },
})
