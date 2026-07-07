import { v } from "convex/values"
import { query } from "./_generated/server"
import { requireMember } from "./lib/auth"
import { enforcedMutation } from "./lib/enforce"
import {
  closeScene as closeSceneFlow,
  openScene as openSceneFlow,
  setSceneWitnesses as setSceneWitnessesFlow,
} from "../src/domain/flows/scene"

// The Scene lifecycle through the enforcement seam (ADR-0004, issue #42).
// Storyteller authority, the one-active-Scene invariant, the typed refusals
// (ADR-0010), and the system Activity entries all live in the domain flows;
// this file supplies only the args.

export const open = enforcedMutation({
  args: { sessionId: v.id("sessions"), name: v.string() },
  flow: openSceneFlow,
})

export const close = enforcedMutation({
  args: { sessionId: v.id("sessions") },
  flow: closeSceneFlow,
})

// The Sleeper-witnesses default (issue #42): ST-only to change, visible to
// all on the strip, read later by the Paradox negotiation as an editable
// default (ADR-0015) — a quiet write, no Activity entry.
export const setWitnesses = enforcedMutation({
  args: { sessionId: v.id("sessions"), sleeperWitnesses: v.boolean() },
  flow: setSceneWitnessesFlow,
})

// The strip's live read: the session's active Scene, or null — null is the
// legal no-Scene state (downtime), not an error. Member-gated (issue #37):
// a non-member gets the typed refusal, never an empty room.
export const getActive = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.sessionId)

    const rows = await ctx.db
      .query("scenes")
      .withIndex("by_sessionId_status", (q) =>
        q.eq("sessionId", args.sessionId).eq("status", "active"),
      )
      .collect()
    // At most one active is the open flow's invariant; the oldest row is
    // "the" active Scene should it ever fork (mirrors the adapter's read).
    return rows[0] ?? null
  },
})
