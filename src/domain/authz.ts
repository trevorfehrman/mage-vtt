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
 * The Storyteller's door (issue #15): resolve the actor's membership and
 * require the storyteller role. A Dev member passes with a `godmode-action`
 * Override recorded (bypass, not identity — ADR-0006). Unlike
 * `requireOwnedCharacter`'s god-mode rung, a Dev who is NOT a member fails
 * `NotAMember` first: these flows attribute the action to the actor's own
 * membership, so there must be one.
 */
export const requireStoryteller = Effect.fn("Authz.requireStoryteller")(function* (
  sessionId: SessionId,
) {
  const member = yield* requireMember(sessionId)
  if (member.role === "storyteller") return member

  const actor = yield* CurrentActor
  if (!actor.isDev) {
    return yield* new NotStoryteller({ sessionId: member.sessionId, userId: member.userId })
  }
  yield* recordBypass(
    new OverrideMarker({
      invokedByUserId: actor.userId,
      invokedByName: member.displayName,
      kind: "godmode-action",
    }),
  )
  return member
})

/** Authorization: this door is the Storyteller's (or a Dev's). */
export class NotStoryteller extends Schema.TaggedErrorClass<NotStoryteller>()(
  "NotStoryteller",
  {
    sessionId: SessionId,
    userId: PlayerId,
  },
) {}

/**
 * The hand-edit door (issue #19): an **inverted** authority ladder —
 * ownership grants nothing. Only the session's Storyteller and a Dev pass,
 * and *every* pass records a `repair` Override (ADR-0006: a repair is
 * "direct-setting state outside the rules" — the rule bent is that state
 * changes only through game actions, so the marker always fires). A plain
 * member — the owning Player included — fails `NotStoryteller`.
 *
 * Returns the editor's identity: a hand edit is the editor's own act and is
 * attributed to them, unlike casts, where attribution follows the owner.
 */
export const requireRepairAuthority = Effect.fn("Authz.requireRepairAuthority")(
  function* (sessionId: SessionId) {
    const actor = yield* CurrentActor
    const store = yield* GameStore
    const membership = yield* store
      .getMembership(sessionId, actor.userId)
      .pipe(Effect.option)

    const editor = (displayName: string) =>
      recordBypass(
        new OverrideMarker({
          invokedByUserId: actor.userId,
          invokedByName: displayName,
          kind: "repair",
        }),
      ).pipe(Effect.as({ userId: actor.userId, displayName }))

    if (
      Option.isSome(membership) &&
      membership.value.role === "storyteller"
    ) {
      return yield* editor(membership.value.displayName)
    }

    if (actor.isDev) {
      // A Dev may not be a member at all; fall back to the id (as the
      // god-mode rung of `requireOwnedCharacter` does).
      return yield* editor(
        Option.isSome(membership) ? membership.value.displayName : actor.userId,
      )
    }

    return yield* new NotStoryteller({ sessionId, userId: actor.userId })
  },
)

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
    const sheet = yield* getSessionScopedSheet(sessionId, characterId)
    yield* requireOwnedCharacter(sheet)
    return sheet
  },
)

/**
 * The session-scoped sheet read on its own: a character outside this session
 * isn't there, as far as this session's flows are concerned —
 * `DocumentNotFound`, not a leak. For flows whose authority isn't the
 * ownership ladder (the hand edit's inverted door), which compose their own
 * guard on top.
 */
export const getSessionScopedSheet = Effect.fn("Authz.getSessionScopedSheet")(
  function* (sessionId: SessionId, characterId: CharacterId) {
    const store = yield* GameStore
    const sheet = yield* store.getSheet(characterId)

    if (sheet.sessionId !== sessionId) {
      return yield* new DocumentNotFound({ table: "characters", id: characterId })
    }
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
