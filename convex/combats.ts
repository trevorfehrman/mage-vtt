import { v } from "convex/values"
import { query } from "./_generated/server"
import { requireMember } from "./lib/auth"
import { enforcedMutation } from "./lib/enforce"
import {
  addParticipant as addParticipantFlow,
  endCombat as endCombatFlow,
  removeParticipant as removeParticipantFlow,
  rollCombatInitiative as rollCombatInitiativeFlow,
  spendTicks as spendTicksFlow,
  startCombat as startCombatFlow,
} from "../src/domain/flows/combat"

// The Combat clock through the enforcement seam (ADR-0004, issue #60).
// Storyteller conducting, the one-active-Combat invariant, the participant
// lanes, the initiative authority ladder, the hand-billed clock, and the
// typed refusals (ADR-0010) all live in the domain flows; this file supplies
// only the args.

export const start = enforcedMutation({
  args: { sessionId: v.id("sessions") },
  flow: startCombatFlow,
})

export const end = enforcedMutation({
  args: { sessionId: v.id("sessions") },
  flow: endCombatFlow,
})

// Two lanes, one door: a sheet-backed character reference or a hand-entered
// row (name + the four chain stats) — the flow refuses a mix.
export const addParticipant = enforcedMutation({
  args: {
    sessionId: v.id("sessions"),
    characterId: v.optional(v.id("characters")),
    name: v.optional(v.string()),
    dexterity: v.optional(v.number()),
    composure: v.optional(v.number()),
    wits: v.optional(v.number()),
    willpower: v.optional(v.number()),
  },
  flow: addParticipantFlow,
})

export const removeParticipant = enforcedMutation({
  args: { sessionId: v.id("sessions"), participantId: v.string() },
  flow: removeParticipantFlow,
})

// The initiative click: a player's own face plain, the ST in-stead
// Override-stamped, an NPC face the ST's plain roster act — the flow's
// ladder decides; the click is the same for everyone.
export const rollInitiative = enforcedMutation({
  args: { sessionId: v.id("sessions"), participantId: v.string() },
  flow: rollCombatInitiativeFlow,
})

// The clock's only door (ADR-0015: never auto-billed): preset, Aim/Dodge
// with a 1/2/3 sub-choice, or a free-typed cost.
export const spendTicks = enforcedMutation({
  args: {
    sessionId: v.id("sessions"),
    participantId: v.string(),
    action: v.optional(
      v.union(
        v.literal("attack"),
        v.literal("castSpell"),
        v.literal("move"),
        v.literal("useItem"),
        v.literal("aim"),
        v.literal("dodge"),
      ),
    ),
    count: v.optional(v.number()),
    cost: v.optional(v.number()),
  },
  flow: spendTicksFlow,
})

// The tracker's live read: the session's active Combat, or null — null is
// the legal no-Combat state, not an error. Member-gated (issue #37): a
// non-member gets the typed refusal, never an empty band.
export const getActive = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.sessionId)

    const rows = await ctx.db
      .query("combats")
      .withIndex("by_sessionId_status", (q) =>
        q.eq("sessionId", args.sessionId).eq("status", "active"),
      )
      .collect()
    // At most one active is the start flow's invariant; the oldest row is
    // "the" active Combat should it ever fork (mirrors the adapter's read).
    return rows[0] ?? null
  },
})
