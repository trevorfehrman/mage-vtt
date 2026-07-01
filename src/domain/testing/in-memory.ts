import { Clock, Effect, Layer } from "effect"
import type { DiceRollResult, RawPoolComponent, RollVisibility } from "../dice"
import { MessageId, PlayerId, RollId, type SessionId } from "../ids"
import type { Membership } from "../membership"
import { NotAMember } from "../authz"
import { OverrideMarker, OverrideStamp, makeOverrideStamp } from "../override"
import { CurrentActor, type Actor } from "../ports/current-actor"
import { GameStore, type MessageDraft, type RollDraft } from "../ports/game-store"

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

export interface InMemory {
  readonly layer: Layer.Layer<GameStore | CurrentActor | OverrideStamp>
  readonly rolls: ReadonlyArray<StoredRoll>
  readonly messages: ReadonlyArray<StoredMessage>
}

export const makeInMemory = (seed: {
  members: ReadonlyArray<Membership>
  actor: Actor
}): InMemory => {
  const rolls: Array<StoredRoll> = []
  const messages: Array<StoredMessage> = []
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

  return { layer, rolls, messages }
}
