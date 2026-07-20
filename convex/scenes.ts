import { v } from "convex/values"
import { query } from "./_generated/server"
import { requireMember } from "./lib/auth"
import { enforcedMutation } from "./lib/enforce"
import { ParadoxPoolModifier } from "../src/domain/paradox"
import { schemaToConvexValidator } from "../src/domain/schema-bridge"
import {
  closeScene as closeSceneFlow,
  editTides as editTidesFlow,
  openScene as openSceneFlow,
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

// The Tides (ADR-0022): the scene-owned ambient price of vulgar magic —
// witness head count and circumstance modifiers, ST-only to change, visible
// to all on the strip, fixed onto a Cast at the Tides rung — a quiet write, no
// Activity entry. The modifier shape derives from the domain Schema
// (ADR-0005), never hand-written beside it.
export const editTides = enforcedMutation({
  args: {
    sessionId: v.id("sessions"),
    witnessCount: v.optional(v.number()),
    circumstances: v.optional(
      v.array(schemaToConvexValidator(ParadoxPoolModifier)),
    ),
  },
  flow: editTidesFlow,
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
