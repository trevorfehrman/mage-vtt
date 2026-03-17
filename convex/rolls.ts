import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { requireUser } from "./lib/auth"
import { runConvexEffect } from "./lib/effect"
import { buildPool, rollPool } from "../src/domain/dice"

export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    components: v.array(
      v.object({
        type: v.string(),
        name: v.string(),
        dots: v.number(),
      }),
    ),
    againThreshold: v.optional(v.number()),
    roteAction: v.optional(v.boolean()),
    visibility: v.optional(v.union(v.literal("public"), v.literal("hidden"))),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    // Verify membership
    const members = await ctx.db
      .query("sessionMembers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect()

    const member = members.find((m) => m.userId === user._id)
    if (!member) {
      throw new Error("Not a member of this session")
    }

    // Build pool and roll via Effect bridge
    const pool = await runConvexEffect(buildPool(args.components))
    const rollOptions: {
      visibility: "public" | "hidden"
      againThreshold?: number
      roteAction?: boolean
    } = { visibility: args.visibility ?? "public" }
    if (args.againThreshold != null) rollOptions.againThreshold = args.againThreshold
    if (args.roteAction != null) rollOptions.roteAction = args.roteAction

    const result = await runConvexEffect(rollPool(pool, rollOptions))

    const timestamp = Date.now()

    const rollId = await ctx.db.insert("diceRolls", {
      sessionId: args.sessionId,
      userId: user._id,
      displayName: member.displayName,
      components: args.components,
      poolSize: result.poolSize,
      rolls: [...result.rolls],
      explosions: [...result.explosions],
      roteRerolls: [...result.roteRerolls],
      successes: result.successes,
      isChanceDie: result.isChanceDie,
      isDramaticFailure: result.isDramaticFailure,
      isExceptionalSuccess: result.isExceptionalSuccess,
      visibility: result.visibility,
      againThreshold: result.againThreshold,
      isRoteAction: result.isRoteAction,
      timestamp,
    })

    // Insert system message about the roll
    const rollSummary = result.isDramaticFailure
      ? "a dramatic failure!"
      : result.isExceptionalSuccess
        ? `an exceptional success (${result.successes} successes)!`
        : `${result.successes} ${result.successes === 1 ? "success" : "successes"}`

    await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      senderId: user._id,
      senderName: member.displayName,
      text: `${member.displayName} rolled ${pool.size} dice and got ${rollSummary}`,
      visibilityType: result.visibility === "hidden" ? "system" : "system",
      timestamp,
    })

    return rollId
  },
})

export const list = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    const members = await ctx.db
      .query("sessionMembers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect()

    const member = members.find((m) => m.userId === user._id)
    const isStoryteller = member?.role === "storyteller"

    const rolls = await ctx.db
      .query("diceRolls")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(50)

    // Players don't see hidden rolls from others
    if (isStoryteller) return rolls

    return rolls.filter(
      (r) => r.visibility === "public" || r.userId === user._id,
    )
  },
})
