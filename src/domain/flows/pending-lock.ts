import { Effect, Schema } from "effect"
import { isUnresolved } from "../cast"
import { CastId } from "../ids"
import type { Membership } from "../membership"
import { GameStore } from "../ports/game-store"

/**
 * The pending-cast lock (issue #109): the server half of the roll zone's
 * exclusive posture — the UI's occupied felt is advisory until this refusal
 * holds the door. Its own module so every roll-producing flow (rolls,
 * covert casting, the vulgar draft) can import it without a cycle through
 * the ladder.
 */

// --- Errors (ADR-0010, co-located with the guard that raises them) ---

/**
 * Rules/precondition: the caster's own pending vulgar Cast freezes every
 * other roll of theirs — see it through or withdraw it. Keyed to the
 * member, not the sheet: the lock follows whoever the act would be
 * attributed to.
 */
export class CasterHasPendingCast extends Schema.TaggedErrorClass<CasterHasPendingCast>()(
  "CasterHasPendingCast",
  { pendingCastId: CastId },
) {}

/**
 * Rules/precondition: an unanswered draft in the wings holds the
 * Storyteller's own dice — engage or decline the offer first. Only drafts
 * lock: an engaged Cast is answered, and running the world against it may
 * need the ST's own rolls.
 */
export class OfferAwaitsAnswer extends Schema.TaggedErrorClass<OfferAwaitsAnswer>()(
  "OfferAwaitsAnswer",
  {
    draftCastId: CastId,
    casterName: Schema.String,
  },
) {}

/**
 * The guard, applied by every roll-producing flow outside the ladder itself
 * (dice rolls, covert casts, new drafts — the ladder's own beats are the
 * pending Cast playing out, never locked):
 *
 * - A member whose vulgar Cast is pending (declared, not yet withdrawn,
 *   voided, or resolved) makes no other roll of any kind.
 * - The Storyteller answers a waiting draft — the oldest offer — before
 *   rolling anything of their own.
 *
 * Keyed to the attributed member (ADR-0006): an ST rolling in a locked
 * caster's stead meets the caster's lock, Override or not.
 */
export const requireRollFreedom = Effect.fn("Flows.pendingLock.requireRollFreedom")(
  function* (member: Membership) {
    const store = yield* GameStore
    const casts = yield* store.listCasts(member.sessionId)

    const pending = casts.find(
      (c) => c.casterUserId === member.userId && isUnresolved(c.status),
    )
    if (pending) {
      return yield* new CasterHasPendingCast({ pendingCastId: pending.id })
    }

    if (member.role === "storyteller") {
      const waiting = casts.find((c) => c.status === "draft")
      if (waiting) {
        return yield* new OfferAwaitsAnswer({
          draftCastId: waiting.id,
          casterName: waiting.casterName,
        })
      }
    }
  },
)
