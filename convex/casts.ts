import { v } from "convex/values"
import { enforcedMutation } from "./lib/enforce"
import {
  cancelCast as cancelCastFlow,
  containParadox as containParadoxFlow,
  declineDraft as declineDraftFlow,
  draftCast as draftCastFlow,
  engageCast as engageCastFlow,
  killDraft as killDraftFlow,
  lockIntention as lockIntentionFlow,
  lockLiabilities as lockLiabilitiesFlow,
  rollCastDice as rollCastDiceFlow,
  rollParadox as rollParadoxFlow,
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

export const draft = enforcedMutation({
  args: {
    sessionId: v.id("sessions"),
    characterId: v.id("characters"),
    arcanum: v.string(),
    level: v.number(),
    intent: v.optional(v.string()),
    usesMagicalTool: v.optional(v.boolean()),
  },
  flow: draftCastFlow,
})

export const kill = enforcedMutation({ args: step, flow: killDraftFlow })

export const decline = enforcedMutation({ args: step, flow: declineDraftFlow })

export const engage = enforcedMutation({ args: step, flow: engageCastFlow })

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
