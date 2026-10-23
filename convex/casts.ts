import { v } from "convex/values"
import { query } from "./_generated/server"
import { requireMember } from "./lib/auth"
import { enforcedMutation } from "./lib/enforce"
import { isUnresolved, sceneParadoxPips } from "../src/domain/cast"
import { ParadoxPoolModifier } from "../src/domain/paradox"
import { schemaToConvexValidator } from "../src/domain/schema-bridge"
import {
  adjustPrice as adjustPriceFlow,
  cancelCast as cancelCastFlow,
  commitCast as commitCastFlow,
  declineDraft as declineDraftFlow,
  draftCast as draftCastFlow,
  engageCast as engageCastFlow,
  killDraft as killDraftFlow,
  lockPrice as lockPriceFlow,
  releaseCast as releaseCastFlow,
  rollParadox as rollParadoxFlow,
  voidCast as voidCastFlow,
} from "../src/domain/flows/vulgar-cast"

// The Vulgar Cast ladder through the enforcement seam (ADR-0004, ADR-0016 as
// amended by ADR-0022, issue #43/#106): one mutation per commitment, so every
// commitment lands as its own realtime event on every spectator's screen —
// while drafting (the cockpit's box clicks) rides cheap seam-checked writes on
// the same document. Actor authority, status- and phase-order enforcement,
// the cardinality invariants, the typed refusals (ADR-0010), and the Activity
// entries all live in the domain flows; this file supplies only the args.
// The live Cast card reads through `activity.list` — the Cast document rides
// the feed as its own entry kind.

const step = { sessionId: v.id("sessions"), castId: v.id("casts") }

// The named ± modifier — one derived shape (ADR-0005) for the adjustment and
// circumstance lists, never hand-written beside the domain Schema.
const modifierValidator = schemaToConvexValidator(ParadoxPoolModifier)

// Two lanes, one door (issue #47): an improvised declaration (arcanum +
// level) or a trained Rote (roteName, plus the "or"-pool pick) — the flow
// refuses a draft that names both lanes or neither. `spendWillpower` is the
// blind precommitment (ADR-0022, WoD p. 133).
export const draft = enforcedMutation({
  args: {
    sessionId: v.id("sessions"),
    characterId: v.id("characters"),
    arcanum: v.optional(v.string()),
    level: v.optional(v.number()),
    roteName: v.optional(v.string()),
    skillChoice: v.optional(v.string()),
    // The bought floor and the rider (issue #107); the tool is the sheet's
    // standing fact — the flow stamps it, no arg carries it.
    potency: v.optional(v.number()),
    targets: v.optional(v.number()),
    extraManaCost: v.optional(v.number()),
    spendWillpower: v.optional(v.boolean()),
  },
  flow: draftCastFlow,
})

export const kill = enforcedMutation({ args: step, flow: killDraftFlow })

export const decline = enforcedMutation({ args: step, flow: declineDraftFlow })

export const engage = enforcedMutation({ args: step, flow: engageCastFlow })

// The ST's personal adjustments (ADR-0022): facts about this caster's
// situation, replace-not-merge, The Price's fluid phase only.
export const adjustPrice = enforcedMutation({
  args: { ...step, adjustments: v.array(modifierValidator) },
  flow: adjustPriceFlow,
})

// THE FIX (ADR-0022): the Tides seed stamps; the ST goes hands-off.
export const lockPrice = enforcedMutation({ args: step, flow: lockPriceFlow })

export const commit = enforcedMutation({
  args: { ...step, manaMitigation: v.number() },
  flow: commitCastFlow,
})

export const cancel = enforcedMutation({ args: step, flow: cancelCastFlow })

export const rollParadox = enforcedMutation({ args: step, flow: rollParadoxFlow })

// The one Cast click (ADR-0022): containment lands and the dice fly as a
// single commitment.
export const release = enforcedMutation({
  args: { ...step, containedSuccesses: v.number() },
  flow: releaseCastFlow,
})

// The repair door (ADR-0015): named for what it does, stamped for how it did it.
export const voidCast = enforcedMutation({ args: step, flow: voidCastFlow })

// The strip's per-caster Paradox pips (issue #44): who is pushing their luck
// this Scene, derived live from resolved Cast history through the same leaf
// the fix seeds the Tides with (ADR-0012 — never a stored tally).
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
