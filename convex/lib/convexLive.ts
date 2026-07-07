/**
 * ConvexLive adapter (ADR-0004): the production `GameStore` / `CurrentActor` /
 * `OverrideStamp` implementation, backed by a request-scoped Convex `ctx` + the
 * authenticated user. Kept honest against `InMemory` by the conformance test.
 *
 * Lives in the Convex bundle (imports `ctx.db`) but speaks Effect-Schema domain
 * mirrors, decoded here — the domain never sees Convex's `Doc<T>`.
 */

import { Clock, Effect, Layer, Option, Schema } from "effect"
import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import { Cast } from "../../src/domain/cast"
import { CharacterSheet } from "../../src/domain/character"
import {
  CastId,
  PlayerId,
  MessageId,
  RollId,
  SceneId,
  SessionId,
} from "../../src/domain/ids"
import { NotAMember } from "../../src/domain/authz"
import { Membership } from "../../src/domain/membership"
import { Scene } from "../../src/domain/scene"
import {
  OverrideMarker,
  OverrideStamp,
  makeOverrideStamp,
} from "../../src/domain/override"
import { CurrentActor, type Actor } from "../../src/domain/ports/current-actor"
import { DocumentNotFound } from "../../src/domain/ports/errors"
import { SpellRef } from "../../src/domain/rote-cast"
import {
  GameStore,
  type CastDraft,
  type CastPatch,
  type MessageDraft,
  type RollDraft,
  type SceneDraft,
  type ScenePatch,
} from "../../src/domain/ports/game-store"
import { isDevUser } from "./dev"

/** Minimal shape of the authenticated user the seam needs. */
interface AuthUser {
  readonly _id: string
}

const overrideToDoc = (marker: OverrideMarker | null) =>
  marker
    ? {
        invokedByUserId: marker.invokedByUserId,
        invokedByName: marker.invokedByName,
        kind: marker.kind,
      }
    : undefined

/**
 * Doc → Sheet, once, at the adapter (ADR-0011): the game speaks Sheet, the
 * database speaks Doc. A stored document that fails the representability decode
 * is corrupt data — a bug, not a client-actionable failure — so decode failure
 * dies rather than surfacing a tagged error (ADR-0010's Fail/Die split).
 */
const decodeSheet = Effect.fn("ConvexLive.decodeSheet")(function* (
  doc: Doc<"characters">,
) {
  const { _id, _creationTime, ...fields } = doc
  return yield* Schema.decodeUnknownEffect(CharacterSheet)({ id: _id, ...fields }).pipe(
    Effect.orDie,
  )
})

/**
 * Doc → Cast, once, at the adapter (issue #43): provenance columns stay in the
 * row; a stored Cast that fails the vocabulary decode is corrupt data — a bug,
 * not a client-actionable failure (ADR-0010's Fail/Die split).
 */
const decodeCast = Effect.fn("ConvexLive.decodeCast")(function* (doc: Doc<"casts">) {
  const { _id, _creationTime, override: _override, createdAt: _createdAt, ...fields } = doc
  return yield* Schema.decodeUnknownEffect(Cast)({ id: _id, ...fields }).pipe(
    Effect.orDie,
  )
})

export const convexLive = (
  ctx: MutationCtx,
  user: AuthUser,
): Layer.Layer<GameStore | CurrentActor | OverrideStamp> => {
  // Translate a domain-branded session id back into a Convex `Id<"sessions">` at
  // the adapter boundary. `normalizeId` validates the string belongs to the table
  // (no unchecked cast); a null here means a malformed id slipped past the
  // `v.id("sessions")` arg validator — a bug, so we fail loudly.
  const sessionRef = (sessionId: string): Id<"sessions"> => {
    const id = ctx.db.normalizeId("sessions", sessionId)
    if (id === null) {
      throw new Error(`Not a valid sessions id: ${sessionId}`)
    }
    return id
  }

  // Request-scoped record of a bent rule (ADR-0006). Authz helpers `record` into
  // it; the write helpers `read` it and stamp. Never set by rolls.create.
  const override = makeOverrideStamp()

  const actor: Actor = {
    userId: PlayerId.make(user._id),
    isDev: isDevUser(user._id),
  }

  const gameStore = GameStore.of({
    getMembership: (sessionId, userId) =>
      Effect.gen(function* () {
        const rows = yield* Effect.promise(() =>
          ctx.db
            .query("sessionMembers")
            .withIndex("by_sessionId", (q) =>
              q.eq("sessionId", sessionRef(sessionId)),
            )
            .collect(),
        )
        const row = rows.find((m) => m.userId === userId)
        if (!row) {
          return yield* new NotAMember({ sessionId, userId })
        }
        // Decode the Convex row into the domain mirror (compound-key identity).
        return new Membership({
          userId: PlayerId.make(row.userId),
          sessionId: SessionId.make(sessionId),
          role: row.role,
          displayName: row.displayName,
        })
      }),

    getSheet: (characterId) =>
      Effect.gen(function* () {
        const id = ctx.db.normalizeId("characters", characterId)
        if (id === null) {
          // Malformed for the table — as absent as an unknown id.
          return yield* new DocumentNotFound({ table: "characters", id: characterId })
        }
        const doc = yield* Effect.promise(() => ctx.db.get(id))
        if (!doc) {
          return yield* new DocumentNotFound({ table: "characters", id: characterId })
        }
        return yield* decodeSheet(doc)
      }),

    getSpell: (spellName, arcanum) =>
      Effect.gen(function* () {
        const rows = yield* Effect.promise(() =>
          ctx.db
            .query("spells")
            .withIndex("by_name", (q) => q.eq("name", spellName))
            .collect(),
        )
        const row = rows.find((s) => s.arcanum === arcanum)
        if (!row) {
          return yield* new DocumentNotFound({
            table: "spells",
            id: `${spellName} (${arcanum})`,
          })
        }
        // A reference row that fails the decode (a dirty Aspect, an
        // out-of-range level) is corrupt data — a pipeline bug, not a
        // client-actionable failure (ADR-0010's Fail/Die split).
        return yield* Schema.decodeUnknownEffect(SpellRef)({
          name: row.name,
          arcanum: row.arcanum,
          level: row.level,
          aspect: row.aspect,
        }).pipe(Effect.orDie)
      }),

    patchSheet: (characterId, patch) =>
      Effect.gen(function* () {
        const id = ctx.db.normalizeId("characters", characterId)
        if (id === null) {
          // patchSheet follows a successful getSheet in every flow; a malformed
          // id here is a bug, so fail loudly like sessionRef does.
          throw new Error(`Not a valid characters id: ${characterId}`)
        }
        yield* Effect.promise(() =>
          ctx.db.patch(id, {
            ...(patch.manaCurrent !== undefined
              ? { manaCurrent: patch.manaCurrent }
              : {}),
            ...(patch.willpowerCurrent !== undefined
              ? { willpowerCurrent: patch.willpowerCurrent }
              : {}),
            ...(patch.healthTrack !== undefined
              ? { healthTrack: patch.healthTrack.map((box) => ({ ...box })) }
              : {}),
          }),
        )
      }),

    insertRoll: (draft: RollDraft) =>
      Effect.gen(function* () {
        const timestamp = yield* Clock.currentTimeMillis
        const r = draft.result
        const marker = overrideToDoc(override.current())
        const id = yield* Effect.promise(() =>
          ctx.db.insert("diceRolls", {
            sessionId: sessionRef(draft.sessionId),
            userId: draft.member.userId,
            displayName: draft.member.displayName,
            components: draft.components.map((c) => ({ ...c })),
            poolSize: r.poolSize,
            rolls: [...r.rolls],
            explosions: [...r.explosions],
            roteRerolls: [...r.roteRerolls],
            successes: r.successes,
            isChanceDie: r.isChanceDie,
            isDramaticFailure: r.isDramaticFailure,
            isExceptionalSuccess: r.isExceptionalSuccess,
            visibility: r.visibility,
            againThreshold: r.againThreshold,
            isRoteAction: r.isRoteAction,
            summary: draft.summary,
            // Only present when a rule was bent (ADR-0006) — omit the key entirely
            // otherwise, to satisfy exactOptionalPropertyTypes.
            ...(marker ? { override: marker } : {}),
            timestamp,
          }),
        )
        return RollId.make(id)
      }),

    insertMessage: (draft: MessageDraft) =>
      Effect.gen(function* () {
        const timestamp = yield* Clock.currentTimeMillis
        // Stamped like insertRoll (ADR-0006): every record the mutation
        // writes carries the marker — InMemory already did; parity restored.
        const marker = overrideToDoc(override.current())
        const id = yield* Effect.promise(() =>
          ctx.db.insert("messages", {
            sessionId: sessionRef(draft.sessionId),
            senderId: draft.sender.userId,
            senderName: draft.sender.displayName,
            text: draft.text,
            visibilityType: draft.visibility,
            ...(draft.whisperTargetId
              ? { whisperTargetId: draft.whisperTargetId }
              : {}),
            ...(marker ? { override: marker } : {}),
            timestamp,
          }),
        )
        return MessageId.make(id)
      }),

    getActiveScene: (sessionId) =>
      Effect.gen(function* () {
        const rows = yield* Effect.promise(() =>
          ctx.db
            .query("scenes")
            .withIndex("by_sessionId_status", (q) =>
              q.eq("sessionId", sessionRef(sessionId)).eq("status", "active"),
            )
            .collect(),
        )
        // At most one active per session is the open flow's invariant, not the
        // table's; should it ever fork, the oldest row is "the" active Scene so
        // repeated closes can drain the surplus rather than crash every read.
        const row = rows[0]
        if (!row) return Option.none()
        // A stored row that fails the vocabulary decode is corrupt data — a
        // bug, not a client-actionable failure (ADR-0010's Fail/Die split).
        return Option.some(
          yield* Schema.decodeUnknownEffect(Scene)({
            id: row._id,
            sessionId: row.sessionId,
            name: row.name,
            status: row.status,
            sleeperWitnesses: row.sleeperWitnesses,
          }).pipe(Effect.orDie),
        )
      }),

    insertScene: (draft: SceneDraft) =>
      Effect.gen(function* () {
        const openedAt = yield* Clock.currentTimeMillis
        const id = yield* Effect.promise(() =>
          ctx.db.insert("scenes", {
            sessionId: sessionRef(draft.sessionId),
            name: draft.name,
            status: "active",
            sleeperWitnesses: draft.sleeperWitnesses,
            openedAt,
          }),
        )
        return SceneId.make(id)
      }),

    insertCast: (draft: CastDraft) =>
      Effect.gen(function* () {
        const timestamp = yield* Clock.currentTimeMillis
        const marker = overrideToDoc(override.current())
        const characterId = ctx.db.normalizeId("characters", draft.characterId)
        if (characterId === null) {
          // The draft flow just read this sheet; a malformed id here is a bug.
          throw new Error(`Not a valid characters id: ${draft.characterId}`)
        }
        const id = yield* Effect.promise(() =>
          ctx.db.insert("casts", {
            sessionId: sessionRef(draft.sessionId),
            characterId,
            casterUserId: draft.casterUserId,
            casterName: draft.casterName,
            status: "draft",
            arcanum: draft.arcanum,
            level: draft.level,
            ...(draft.intent !== undefined ? { intent: draft.intent } : {}),
            usesMagicalTool: draft.usesMagicalTool,
            declaredComponents: draft.declaredComponents.map((c) => ({ ...c })),
            declaredPool: draft.declaredPool,
            spellManaCost: draft.spellManaCost,
            ...(marker ? { override: marker } : {}),
            createdAt: timestamp,
            updatedAt: timestamp,
          }),
        )
        return CastId.make(id)
      }),

    getCast: (castId) =>
      Effect.gen(function* () {
        const id = ctx.db.normalizeId("casts", castId)
        if (id === null) {
          // Malformed for the table — as absent as an unknown id.
          return yield* new DocumentNotFound({ table: "casts", id: castId })
        }
        const doc = yield* Effect.promise(() => ctx.db.get(id))
        if (!doc) {
          return yield* new DocumentNotFound({ table: "casts", id: castId })
        }
        return yield* decodeCast(doc)
      }),

    patchCast: (castId: CastId, patch: CastPatch) =>
      Effect.gen(function* () {
        const id = ctx.db.normalizeId("casts", castId)
        if (id === null) {
          // patchCast follows a successful getCast in every flow; a malformed
          // id here is a bug, so fail loudly like sessionRef does.
          throw new Error(`Not a valid casts id: ${castId}`)
        }
        const updatedAt = yield* Clock.currentTimeMillis
        const marker = overrideToDoc(override.current())
        const sceneId =
          patch.sceneId !== undefined
            ? ctx.db.normalizeId("scenes", patch.sceneId)
            : undefined
        if (patch.sceneId !== undefined && sceneId === null) {
          throw new Error(`Not a valid scenes id: ${patch.sceneId}`)
        }
        yield* Effect.promise(() =>
          ctx.db.patch(id, {
            ...(patch.status !== undefined ? { status: patch.status } : {}),
            ...(sceneId ? { sceneId } : {}),
            ...(patch.gnosis !== undefined ? { gnosis: patch.gnosis } : {}),
            ...(patch.sleeperWitnesses !== undefined
              ? { sleeperWitnesses: patch.sleeperWitnesses }
              : {}),
            ...(patch.priorParadoxRolls !== undefined
              ? { priorParadoxRolls: patch.priorParadoxRolls }
              : {}),
            ...(patch.manaMitigation !== undefined
              ? { manaMitigation: patch.manaMitigation }
              : {}),
            ...(patch.paradoxSuccesses !== undefined
              ? { paradoxSuccesses: patch.paradoxSuccesses }
              : {}),
            ...(patch.paradoxIsDramaticFailure !== undefined
              ? { paradoxIsDramaticFailure: patch.paradoxIsDramaticFailure }
              : {}),
            ...(patch.containedSuccesses !== undefined
              ? { containedSuccesses: patch.containedSuccesses }
              : {}),
            ...(patch.castPool !== undefined ? { castPool: patch.castPool } : {}),
            ...(patch.castSuccesses !== undefined
              ? { castSuccesses: patch.castSuccesses }
              : {}),
            ...(patch.severity !== undefined ? { severity: patch.severity } : {}),
            ...(marker ? { override: marker } : {}),
            updatedAt,
          }),
        )
      }),

    listCasts: (sessionId) =>
      Effect.gen(function* () {
        const rows = yield* Effect.promise(() =>
          ctx.db
            .query("casts")
            .withIndex("by_sessionId", (q) =>
              q.eq("sessionId", sessionRef(sessionId)),
            )
            .collect(),
        )
        return yield* Effect.forEach(rows, decodeCast)
      }),

    patchScene: (sceneId: SceneId, patch: ScenePatch) =>
      Effect.gen(function* () {
        const id = ctx.db.normalizeId("scenes", sceneId)
        if (id === null) {
          // patchScene follows a successful getActiveScene in every flow; a
          // malformed id here is a bug, so fail loudly like sessionRef does.
          throw new Error(`Not a valid scenes id: ${sceneId}`)
        }
        const closedAt = yield* Clock.currentTimeMillis
        yield* Effect.promise(() =>
          ctx.db.patch(id, {
            ...(patch.status !== undefined
              ? { status: patch.status, closedAt }
              : {}),
            ...(patch.sleeperWitnesses !== undefined
              ? { sleeperWitnesses: patch.sleeperWitnesses }
              : {}),
          }),
        )
      }),
  })

  return Layer.mergeAll(
    Layer.succeed(GameStore, gameStore),
    Layer.succeed(CurrentActor, actor),
    Layer.succeed(OverrideStamp, override.stamp),
  )
}
