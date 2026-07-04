import { v } from "convex/values"
import { query } from "./_generated/server"
import { requireUser } from "./lib/auth"
import { enforcedMutation } from "./lib/enforce"
import { createRoll } from "../src/domain/flows/rolls"
import { castSheetless as castSheetlessFlow } from "../src/domain/flows/sheetless-cast"

// Re-implemented through the enforcement seam (ADR-0004, ADR-0007). Auth,
// membership, the persistence mapping, the Activity-Log line, and error mapping
// all come from the seam; this file supplies only the args and the domain flow.
export const create = enforcedMutation({
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
    willpower: v.optional(v.object({ characterId: v.id("characters") })),
  },
  flow: createRoll,
})

// ST/Dev NPC opposition: a hand-declared pool, Hidden by default, zero sheet
// writes (PRD #11, issue #15). Sibling of `create`; authority and the typed
// refusal live in the domain flow.
export const castSheetless = enforcedMutation({
  args: {
    sessionId: v.id("sessions"),
    poolSize: v.number(),
    visibility: v.optional(v.union(v.literal("public"), v.literal("hidden"))),
  },
  flow: castSheetlessFlow,
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
