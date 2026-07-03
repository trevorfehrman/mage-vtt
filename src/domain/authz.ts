import { Effect, Schema } from "effect"
import type { CharacterSheet } from "./character"
import { CharacterId, PlayerId, SessionId } from "./ids"
import { Membership } from "./membership"
import { OverrideMarker, OverrideStamp } from "./override"
import { CurrentActor } from "./ports/current-actor"
import { GameStore } from "./ports/game-store"

/**
 * Authorization helpers (ADR-0004) and their errors.
 *
 * Errors live beside the code that raises them (ADR-0010): `NotAMember` and
 * `NotYourCharacter` are Authorization-category tags the client dispatches on —
 * distinct tags, not a stringly `Unauthorized { reason }`.
 */

export class NotAMember extends Schema.TaggedErrorClass<NotAMember>()("NotAMember", {
  sessionId: SessionId,
  userId: PlayerId,
}) {}

export class NotYourCharacter extends Schema.TaggedErrorClass<NotYourCharacter>()(
  "NotYourCharacter",
  {
    characterId: CharacterId,
    userId: PlayerId,
  },
) {}

/**
 * The authority ladder over a character sheet (ownership = the (user, session)
 * pair the sheet links). The owner passes unmarked; anyone else fails
 * `NotYourCharacter`. The Storyteller and Dev rungs — pass with an `Override`
 * marker (ADR-0006) — land with the authority-ladder slice.
 */
export const requireOwnedCharacter = Effect.fn("Authz.requireOwnedCharacter")(function* (
  sheet: CharacterSheet,
) {
  const actor = yield* CurrentActor
  if (actor.userId !== sheet.userId) {
    return yield* new NotYourCharacter({ characterId: sheet.id, userId: actor.userId })
  }
})

/**
 * Resolve the current actor's membership in a session, or fail `NotAMember`.
 *
 * The "authenticate → resolve membership + authorize" dance collapses to one line
 * at the call site. Returns the `Membership` mirror (proving existence and carrying
 * role + displayName). Membership success bends no rule, so it records no
 * `Override`.
 */
export const requireMember = Effect.fn("Authz.requireMember")(function* (
  sessionId: SessionId,
) {
  const actor = yield* CurrentActor
  const store = yield* GameStore
  return yield* store.getMembership(sessionId, actor.userId)
})

/**
 * Record that the current mutation bent a rule (ADR-0006), so the `GameStore`
 * write helpers stamp every record with the `Override` marker.
 *
 * Scaffold: present and wired end-to-end, but no flow in the tracer bullet calls
 * it — `rolls.create` never overrides. Future rule-bending flows invoke this
 * without re-plumbing the write path.
 */
export const recordBypass = Effect.fn("Authz.recordBypass")(function* (
  marker: OverrideMarker,
) {
  const stamp = yield* OverrideStamp
  yield* stamp.record(marker)
})

// Re-export for callers that only need the mirror type alongside the guard.
export { Membership }
