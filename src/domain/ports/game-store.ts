import { Context, Effect } from "effect"
import type { DiceRollResult, RawPoolComponent } from "../dice"
import type { MessageId, PlayerId, RollId, SessionId } from "../ids"
import type { Membership } from "../membership"
import type { NotAMember } from "../authz"

/**
 * Intent-level draft of a dice-roll Activity entry.
 *
 * Deliberately narrow: the flow author describes *what happened*, and the adapter
 * expands it into the wide `diceRolls` row — flattening the result, stamping the
 * timestamp (from `Clock`) and any `Override` marker. Per ADR-0009 the entry is
 * atomic and self-describing: it carries its `summary` narrative and intrinsic
 * `visibility` (inside `result`), so no shadow `messages` row is needed.
 */
export interface RollDraft {
  readonly sessionId: SessionId
  readonly member: Membership
  readonly components: ReadonlyArray<RawPoolComponent>
  readonly result: DiceRollResult
  readonly summary: string
}

/** Intent-level draft of a chat / system `messages` row. */
export interface MessageDraft {
  readonly sessionId: SessionId
  readonly sender: { readonly userId: PlayerId; readonly displayName: string }
  readonly text: string
  readonly visibility: "public" | "whisper" | "system"
  readonly whisperTargetId?: PlayerId
}

/**
 * The write-side persistence port (ADR-0004).
 *
 * Domain-specific write helpers hide the wide field maps; typed reads fail with a
 * tagged error instead of returning null. Grown by the rule of two, never a mirror
 * of `ctx.db`.
 */
export class GameStore extends Context.Service<
  GameStore,
  {
    readonly getMembership: (
      sessionId: SessionId,
      userId: PlayerId,
    ) => Effect.Effect<Membership, NotAMember>
    readonly insertRoll: (draft: RollDraft) => Effect.Effect<RollId>
    readonly insertMessage: (draft: MessageDraft) => Effect.Effect<MessageId>
  }
>()("GameStore") {}
