import { Clock, Effect, Layer } from "effect"
import { CharacterSheet } from "../character"
import type { DiceRollResult, RawPoolComponent, RollVisibility } from "../dice"
import { MessageId, PlayerId, RollId, type CharacterId, type SessionId } from "../ids"
import type { Membership } from "../membership"
import { NotAMember } from "../authz"
import { OverrideMarker, OverrideStamp, makeOverrideStamp } from "../override"
import { CurrentActor, type Actor } from "../ports/current-actor"
import { DocumentNotFound } from "../ports/errors"
import type { SpellRef } from "../rote-cast"
import {
  GameStore,
  type MessageDraft,
  type RollDraft,
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

export interface InMemory {
  readonly layer: Layer.Layer<GameStore | CurrentActor | OverrideStamp>
  readonly rolls: ReadonlyArray<StoredRoll>
  readonly messages: ReadonlyArray<StoredMessage>
  /** Live sheet state by character id — patches apply here, as in a real store. */
  readonly sheets: ReadonlyMap<CharacterId, CharacterSheet>
  readonly sheetPatches: ReadonlyArray<StoredSheetPatch>
}

export const makeInMemory = (seed: {
  members: ReadonlyArray<Membership>
  actor: Actor
  sheets?: ReadonlyArray<CharacterSheet>
  /** Spell reference rows the read side resolves (issue #18). */
  spells?: ReadonlyArray<SpellRef>
}): InMemory => {
  const rolls: Array<StoredRoll> = []
  const messages: Array<StoredMessage> = []
  const sheets = new Map<CharacterId, CharacterSheet>(
    (seed.sheets ?? []).map((sheet) => [sheet.id, sheet]),
  )
  const sheetPatches: Array<StoredSheetPatch> = []
  const override = makeOverrideStamp()

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
  })

  const layer = Layer.mergeAll(
    Layer.succeed(GameStore, gameStore),
    Layer.succeed(CurrentActor, seed.actor),
    Layer.succeed(OverrideStamp, override.stamp),
  )

  return { layer, rolls, messages, sheets, sheetPatches }
}
