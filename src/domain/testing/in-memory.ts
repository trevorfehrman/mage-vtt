import { Clock, Effect, Layer, Option } from "effect"
import { Cast } from "../cast"
import { CharacterSheet } from "../character"
import type { DiceRollResult, RawPoolComponent, RollVisibility } from "../dice"
import {
  CastId,
  MessageId,
  PlayerId,
  RollId,
  SceneId,
  type CharacterId,
  type SessionId,
} from "../ids"
import type { Membership } from "../membership"
import type { ParadoxPoolModifier } from "../paradox"
import { NotAMember } from "../authz"
import { OverrideMarker, OverrideStamp, makeOverrideStamp } from "../override"
import { CurrentActor, type Actor } from "../ports/current-actor"
import { DocumentNotFound } from "../ports/errors"
import type { SpellRef } from "../rote-cast"
import { Scene, type SceneStatus } from "../scene"
import {
  GameStore,
  type CastDraft,
  type CastPatch,
  type MessageDraft,
  type RollDraft,
  type SceneDraft,
  type ScenePatch,
  type SheetPatch,
} from "../ports/game-store"

/**
 * In-memory adapter (ADR-0004): the second real `GameStore` implementation.
 *
 * Backed by plain Maps + an injected actor, it makes enforced flows unit-testable
 * with zero Convex and deterministic dice (`Random.withSeed`). Tests read the
 * collected `rolls` / `messages` arrays to assert on the writes the flow produced.
 * The conformance test runs the same assertions against this and `ConvexLive` so
 * it can't silently drift.
 */

export interface StoredRoll {
  readonly id: RollId
  readonly sessionId: SessionId
  readonly userId: PlayerId
  readonly displayName: string
  readonly components: ReadonlyArray<RawPoolComponent>
  readonly result: DiceRollResult
  readonly summary: string
  readonly visibility: RollVisibility
  readonly override: OverrideMarker | null
  readonly timestamp: number
}

export interface StoredMessage {
  readonly id: MessageId
  readonly sessionId: SessionId
  readonly senderId: PlayerId
  readonly senderName: string
  readonly text: string
  readonly visibility: MessageDraft["visibility"]
  readonly override: OverrideMarker | null
  readonly timestamp: number
}

/** A `patchSheet` call as the flow issued it — for asserting on writes. */
export interface StoredSheetPatch {
  readonly characterId: CharacterId
  readonly patch: SheetPatch
}

/** A `scenes` row as stored (issue #42) — timestamps stamped like the rolls'. */
export interface StoredScene {
  readonly id: SceneId
  readonly sessionId: SessionId
  readonly name: string
  readonly status: SceneStatus
  readonly sleeperWitnesses: boolean
  readonly openedAt: number
  readonly closedAt?: number
}

/**
 * A `casts` row as stored (issue #43): the draft plus whatever beats have
 * stamped. `override` carries void's repair provenance, patched in the same
 * way the live adapter stamps it.
 */
export interface StoredCast {
  readonly id: CastId
  readonly sessionId: SessionId
  readonly characterId: CharacterId
  readonly casterUserId: PlayerId
  readonly casterName: string
  readonly status: Cast["status"]
  readonly arcanum: string
  readonly level: number
  readonly intent?: string
  readonly usesMagicalTool: boolean
  readonly declaredComponents: ReadonlyArray<RawPoolComponent>
  readonly declaredPool: number
  readonly spellManaCost: number
  readonly sceneId?: SceneId
  readonly gnosis?: number
  readonly sleeperWitnesses?: boolean
  readonly witnessCount?: number
  readonly priorParadoxRolls?: number
  readonly discretionaryModifiers?: ReadonlyArray<ParadoxPoolModifier>
  readonly manaMitigation?: number
  readonly paradoxSuccesses?: number
  readonly paradoxIsDramaticFailure?: boolean
  readonly containedSuccesses?: number
  readonly castPool?: number
  readonly castSuccesses?: number
  readonly severity?: Cast["severity"]
  readonly override: OverrideMarker | null
  readonly createdAt: number
  readonly updatedAt: number
}

export interface InMemory {
  readonly layer: Layer.Layer<GameStore | CurrentActor | OverrideStamp>
  readonly rolls: ReadonlyArray<StoredRoll>
  readonly messages: ReadonlyArray<StoredMessage>
  /** Live sheet state by character id — patches apply here, as in a real store. */
  readonly sheets: ReadonlyMap<CharacterId, CharacterSheet>
  readonly sheetPatches: ReadonlyArray<StoredSheetPatch>
  /** Live Scene state — inserts append, patches apply in place (issue #42). */
  readonly scenes: ReadonlyArray<StoredScene>
  /** Live Cast state — inserts append, patches apply in place (issue #43). */
  readonly casts: ReadonlyArray<StoredCast>
}

export const makeInMemory = (seed: {
  members: ReadonlyArray<Membership>
  actor: Actor
  sheets?: ReadonlyArray<CharacterSheet>
  /** Spell reference rows the read side resolves (issue #18). */
  spells?: ReadonlyArray<SpellRef>
  /** Pre-existing Scene rows (issue #42) — e.g. an already-active Scene. */
  scenes?: ReadonlyArray<StoredScene>
  /** Pre-existing Cast rows (issue #43) — e.g. a ladder already mid-climb. */
  casts?: ReadonlyArray<StoredCast>
}): InMemory => {
  const rolls: Array<StoredRoll> = []
  const messages: Array<StoredMessage> = []
  const sheets = new Map<CharacterId, CharacterSheet>(
    (seed.sheets ?? []).map((sheet) => [sheet.id, sheet]),
  )
  const sheetPatches: Array<StoredSheetPatch> = []
  const scenes: Array<StoredScene> = [...(seed.scenes ?? [])]
  const casts: Array<StoredCast> = [...(seed.casts ?? [])]
  const override = makeOverrideStamp()

  // The artifact the flows read: the stored row minus its provenance columns,
  // present-only fields picked so `optionalKey` decode sees absent, not undefined.
  const castOf = (row: StoredCast): Cast => {
    const { override: _override, createdAt: _createdAt, ...fields } = row
    return new Cast(
      Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined),
      ) as ConstructorParameters<typeof Cast>[0],
    )
  }

  const gameStore = GameStore.of({
    getMembership: (sessionId, userId) => {
      const member = seed.members.find(
        (m) => m.sessionId === sessionId && m.userId === userId,
      )
      return member
        ? Effect.succeed(member)
        : Effect.fail(new NotAMember({ sessionId, userId }))
    },

    getSheet: (characterId) => {
      const sheet = sheets.get(characterId)
      return sheet
        ? Effect.succeed(sheet)
        : Effect.fail(new DocumentNotFound({ table: "characters", id: characterId }))
    },

    getSpell: (spellName, arcanum) => {
      const spell = (seed.spells ?? []).find(
        (s) => s.name === spellName && s.arcanum === arcanum,
      )
      return spell
        ? Effect.succeed(spell)
        : Effect.fail(
            new DocumentNotFound({ table: "spells", id: `${spellName} (${arcanum})` }),
          )
    },

    patchSheet: (characterId, patch) =>
      Effect.sync(() => {
        const sheet = sheets.get(characterId)
        if (sheet) {
          sheets.set(
            characterId,
            new CharacterSheet({
              ...sheet,
              ...(patch.manaCurrent !== undefined
                ? { manaCurrent: patch.manaCurrent }
                : {}),
              ...(patch.willpowerCurrent !== undefined
                ? { willpowerCurrent: patch.willpowerCurrent }
                : {}),
              ...(patch.healthTrack !== undefined
                ? { healthTrack: patch.healthTrack }
                : {}),
            }),
          )
        }
        sheetPatches.push({ characterId, patch })
      }),

    insertRoll: (draft: RollDraft) =>
      Effect.gen(function* () {
        const timestamp = yield* Clock.currentTimeMillis
        const id = RollId.make(`roll_${rolls.length}`)
        rolls.push({
          id,
          sessionId: draft.sessionId,
          userId: draft.member.userId,
          displayName: draft.member.displayName,
          components: draft.components,
          result: draft.result,
          summary: draft.summary,
          visibility: draft.result.visibility,
          override: override.current(),
          timestamp,
        })
        return id
      }),

    insertMessage: (draft: MessageDraft) =>
      Effect.gen(function* () {
        const timestamp = yield* Clock.currentTimeMillis
        const id = MessageId.make(`message_${messages.length}`)
        messages.push({
          id,
          sessionId: draft.sessionId,
          senderId: draft.sender.userId,
          senderName: draft.sender.displayName,
          text: draft.text,
          visibility: draft.visibility,
          override: override.current(),
          timestamp,
        })
        return id
      }),

    getActiveScene: (sessionId) => {
      const row = scenes.find(
        (s) => s.sessionId === sessionId && s.status === "active",
      )
      return Effect.succeed(
        row ? Option.some(new Scene({ ...row })) : Option.none(),
      )
    },

    insertScene: (draft: SceneDraft) =>
      Effect.gen(function* () {
        const openedAt = yield* Clock.currentTimeMillis
        const id = SceneId.make(`scene_${scenes.length}`)
        scenes.push({
          id,
          sessionId: draft.sessionId,
          name: draft.name,
          status: "active",
          sleeperWitnesses: draft.sleeperWitnesses,
          openedAt,
        })
        return id
      }),

    insertCast: (draft: CastDraft) =>
      Effect.gen(function* () {
        const timestamp = yield* Clock.currentTimeMillis
        const id = CastId.make(`cast_${casts.length}`)
        casts.push({
          id,
          sessionId: draft.sessionId,
          characterId: draft.characterId,
          casterUserId: draft.casterUserId,
          casterName: draft.casterName,
          status: "draft",
          arcanum: draft.arcanum,
          level: draft.level,
          ...(draft.intent !== undefined ? { intent: draft.intent } : {}),
          usesMagicalTool: draft.usesMagicalTool,
          declaredComponents: draft.declaredComponents,
          declaredPool: draft.declaredPool,
          spellManaCost: draft.spellManaCost,
          override: override.current(),
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        return id
      }),

    getCast: (castId) => {
      const row = casts.find((c) => c.id === castId)
      return row
        ? Effect.succeed(castOf(row))
        : Effect.fail(new DocumentNotFound({ table: "casts", id: castId }))
    },

    patchCast: (castId: CastId, patch: CastPatch) =>
      Effect.gen(function* () {
        const index = casts.findIndex((c) => c.id === castId)
        if (index === -1) {
          // patchCast follows a successful getCast in every flow; a missing
          // row is a bug — fail loudly, as the live adapter does.
          throw new Error(`patch of missing cast ${castId}`)
        }
        const updatedAt = yield* Clock.currentTimeMillis
        const marker = override.current()
        const defined = Object.fromEntries(
          Object.entries(patch).filter(([, value]) => value !== undefined),
        )
        casts[index] = {
          ...casts[index]!,
          ...defined,
          ...(marker ? { override: marker } : {}),
          updatedAt,
        }
      }),

    listCasts: (sessionId) =>
      Effect.succeed(
        casts.filter((c) => c.sessionId === sessionId).map(castOf),
      ),

    patchScene: (sceneId: SceneId, patch: ScenePatch) =>
      Effect.gen(function* () {
        const index = scenes.findIndex((s) => s.id === sceneId)
        if (index === -1) {
          // patchScene follows a successful getActiveScene in every flow; a
          // missing row is a bug — fail loudly, as the live adapter does.
          throw new Error(`patch of missing scene ${sceneId}`)
        }
        const closedAt = yield* Clock.currentTimeMillis
        scenes[index] = {
          ...scenes[index]!,
          ...(patch.status !== undefined
            ? { status: patch.status, closedAt }
            : {}),
          ...(patch.sleeperWitnesses !== undefined
            ? { sleeperWitnesses: patch.sleeperWitnesses }
            : {}),
        }
      }),
  })

  const layer = Layer.mergeAll(
    Layer.succeed(GameStore, gameStore),
    Layer.succeed(CurrentActor, seed.actor),
    Layer.succeed(OverrideStamp, override.stamp),
  )

  return { layer, rolls, messages, sheets, sheetPatches, scenes, casts }
}
