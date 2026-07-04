import { Effect, Option, Schema } from "effect"
import type { CharacterSheet } from "./character"
import { CharacterId, PlayerId, SessionId } from "./ids"
import { Membership } from "./membership"
import { OverrideMarker, OverrideStamp } from "./override"
import { CurrentActor } from "./ports/current-actor"
import { DocumentNotFound } from "./ports/errors"
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
 * The authority ladder over a character sheet (ADR-0006; ownership = the
 * (user, session) pair the sheet links):
 *
 * 1. Owner → pass, unmarked.
 * 2. The session's Storyteller → pass, `storyteller-action` Override recorded.
 * 3. A Dev (god-mode, any session) → pass, `godmode-action` Override recorded.
 * 4. Anyone else → `NotYourCharacter`.
 *
 * The marker fires on **bypass, not identity**: an ST or Dev casting their own
 * character takes rung 1 and stays unmarked. Recording goes through the
 * request-scoped `OverrideStamp`, so every record the mutation writes carries
 * the marker structurally — the flow author writes nothing by hand.
 */
export const requireOwnedCharacter = Effect.fn("Authz.requireOwnedCharacter")(function* (
  sheet: CharacterSheet,
) {
  const actor = yield* CurrentActor
  if (actor.userId === sheet.userId) return

  const store = yield* GameStore
  const actorMembership = yield* store
    .getMembership(sheet.sessionId, actor.userId)
    .pipe(Effect.option)

  if (
    Option.isSome(actorMembership) &&
    actorMembership.value.role === "storyteller"
  ) {
    return yield* recordBypass(
      new OverrideMarker({
        invokedByUserId: actor.userId,
        invokedByName: actorMembership.value.displayName,
        kind: "storyteller-action",
      }),
    )
  }

  if (actor.isDev) {
    return yield* recordBypass(
      new OverrideMarker({
        invokedByUserId: actor.userId,
        // A Dev may not be a member of the session at all; fall back to the id.
        invokedByName: Option.isSome(actorMembership)
          ? actorMembership.value.displayName
          : actor.userId,
        kind: "godmode-action",
      }),
    )
  }

  return yield* new NotYourCharacter({ characterId: sheet.id, userId: actor.userId })
})

/**
 * Resolve a character sheet as this session's flows see it, and walk the
 * authority ladder over it: the sheet is fetched, scoped to the session (a
 * character outside this session isn't there, as far as this session's flows
 * are concerned — `DocumentNotFound`, not a leak), and `requireOwnedCharacter`
 * guards who may act through it. The one door every sheet-funded action
 * shares (cast, Willpower spend, ...).
 */
export const requireSessionCharacter = Effect.fn("Authz.requireSessionCharacter")(
  function* (sessionId: SessionId, characterId: CharacterId) {
    const store = yield* GameStore
    const sheet = yield* store.getSheet(characterId)

    if (sheet.sessionId !== sessionId) {
      return yield* new DocumentNotFound({ table: "characters", id: characterId })
    }

    yield* requireOwnedCharacter(sheet)
    return sheet
  },
)

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
 * Exercised by `requireOwnedCharacter`'s Storyteller/Dev rungs; `rolls.create`
 * never overrides.
 */
export const recordBypass = Effect.fn("Authz.recordBypass")(function* (
  marker: OverrideMarker,
) {
  const stamp = yield* OverrideStamp
  yield* stamp.record(marker)
})

// Re-export for callers that only need the mirror type alongside the guard.
export { Membership }
