import { v } from "convex/values"
import { query } from "./_generated/server"
import { requireMember } from "./lib/auth"
import { enforcedMutation } from "./lib/enforce"
import { isUnresolved, sceneParadoxPips } from "../src/domain/cast"
import {
  cancelCast as cancelCastFlow,
  containParadox as containParadoxFlow,
  declineDraft as declineDraftFlow,
  draftCast as draftCastFlow,
  editLiabilities as editLiabilitiesFlow,
  engageCast as engageCastFlow,
  killDraft as killDraftFlow,
  lockIntention as lockIntentionFlow,
  lockLiabilities as lockLiabilitiesFlow,
  rollCastDice as rollCastDiceFlow,
  rollParadox as rollParadoxFlow,
  setMagicalTool as setMagicalToolFlow,
  voidCast as voidCastFlow,
} from "../src/domain/flows/vulgar-cast"

// The Vulgar Cast ladder through the enforcement seam (ADR-0004, ADR-0016,
// issue #43): one mutation per dramatic beat, so every step lands as its own
// realtime event on every spectator's screen. Actor authority, status-order
// enforcement, the cardinality invariants, the typed refusals (ADR-0010), and
// the per-beat Activity entries all live in the domain flows; this file
// supplies only the args. The live Cast card reads through `activity.list` —
// the Cast document rides the feed as its own entry kind.

const step = { sessionId: v.id("sessions"), castId: v.id("casts") }

// Two lanes, one door (issue #47): an improvised declaration (arcanum +
// level) or a trained Rote (roteName, plus the "or"-pool pick) — the flow
// refuses a draft that names both lanes or neither.
export const draft = enforcedMutation({
  args: {
    sessionId: v.id("sessions"),
    characterId: v.id("characters"),
    arcanum: v.optional(v.string()),
    level: v.optional(v.number()),
    roteName: v.optional(v.string()),
    skillChoice: v.optional(v.string()),
    intent: v.optional(v.string()),
    usesMagicalTool: v.optional(v.boolean()),
  },
  flow: draftCastFlow,
})

export const kill = enforcedMutation({ args: step, flow: killDraftFlow })

export const decline = enforcedMutation({ args: step, flow: declineDraftFlow })

export const engage = enforcedMutation({ args: step, flow: engageCastFlow })

// The ST's liability buttons (issue #44): each press is one patch, one
// realtime reassembly of the pool on every screen. ST-only, `engaged`-only —
// the flow refuses everything else on the taxonomy.
export const editLiabilities = enforcedMutation({
  args: {
    ...step,
    witnessCount: v.optional(v.number()),
    priorParadoxRolls: v.optional(v.number()),
    discretionaryModifiers: v.optional(
      v.array(v.object({ source: v.string(), dice: v.number() })),
    ),
  },
  flow: editLiabilitiesFlow,
})

// The caster's side of the negotiation (issue #44): theirs until the ST locks.
export const setTool = enforcedMutation({
  args: { ...step, usesMagicalTool: v.boolean() },
  flow: setMagicalToolFlow,
})

export const lockLiabilities = enforcedMutation({
  args: step,
  flow: lockLiabilitiesFlow,
})

export const lockIntention = enforcedMutation({
  args: { ...step, manaMitigation: v.number() },
  flow: lockIntentionFlow,
})

export const cancel = enforcedMutation({ args: step, flow: cancelCastFlow })

export const rollParadox = enforcedMutation({ args: step, flow: rollParadoxFlow })

export const contain = enforcedMutation({
  args: { ...step, containedSuccesses: v.number() },
  flow: containParadoxFlow,
})

export const rollCast = enforcedMutation({ args: step, flow: rollCastDiceFlow })

// The repair door (ADR-0015): named for what it does, stamped for how it did it.
export const voidCast = enforcedMutation({ args: step, flow: voidCastFlow })

// The strip's per-caster Paradox pips (issue #44): who is pushing their luck
// this Scene, derived live from resolved Cast history through the same leaf
// the engage beat prefills defaults with (ADR-0012 — never a stored tally).
// Member-gated like the Scene read; empty in downtime.
// Whether a character already has an unresolved Cast (issue #68) — the same
// domain leaf the draft flow refuses `CastAlreadyPending` with, read plainly
// (ADR-0004) so the Draft Vulgar button can gate instead of round-tripping.
export const hasPending = query({
  args: { sessionId: v.id("sessions"), characterId: v.id("characters") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.sessionId)

    const casts = await ctx.db
      .query("casts")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect()
    return casts.some(
      (cast) =>
        cast.characterId === args.characterId && isUnresolved(cast.status),
    )
  },
})

export const paradoxPips = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.sessionId)

    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_sessionId_status", (q) =>
        q.eq("sessionId", args.sessionId).eq("status", "active"),
      )
      .collect()
    const scene = scenes[0]
    if (!scene) return []

    const casts = await ctx.db
      .query("casts")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect()
    return sceneParadoxPips(casts, scene._id)
  },
})
