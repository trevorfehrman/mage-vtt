import { Context, Effect } from "effect"
import type { CharacterSheet, HealthBoxState } from "../character"
import type { DiceRollResult, RawPoolComponent } from "../dice"
import type { CharacterId, MessageId, PlayerId, RollId, SessionId } from "../ids"
import type { Membership } from "../membership"
import type { NotAMember } from "../authz"
import type { SpellRef } from "../rote-cast"
import type { RoteArcanumName } from "../rote-pool"
import type { DocumentNotFound } from "./errors"

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
 * The only writes a flow can express against a character sheet: the fields play
 * mutates. This narrowness is ADR-0011's compensating control for permissive
 * sheet checks — traits and identity are unreachable until a future flow
 * (advancement, ST sheet-edit) earns them a door with its own authority story.
 * Widening this type is a design decision, not a convenience edit.
 */
export interface SheetPatch {
  readonly manaCurrent?: number
  readonly willpowerCurrent?: number
  readonly healthTrack?: ReadonlyArray<HealthBoxState>
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
    /**
     * The whole `CharacterSheet`, decoded from the Doc at the adapter — no
     * per-flow projections (flows destructure narrowly; Convex reads whole
     * documents anyway).
     */
    readonly getSheet: (
      characterId: CharacterId,
    ) => Effect.Effect<CharacterSheet, DocumentNotFound>
    readonly patchSheet: (
      characterId: CharacterId,
      patch: SheetPatch,
    ) => Effect.Effect<void>
    /**
     * The read side's spell reference (issue #18): resolve a spell by its
     * business key — the (name, Arcanum) pair a `KnownRote` carries — into the
     * decoded `SpellRef` the cast flows consult for the Aspect gate.
     */
    readonly getSpell: (
      spellName: string,
      arcanum: typeof RoteArcanumName.Type,
    ) => Effect.Effect<SpellRef, DocumentNotFound>
    readonly insertRoll: (draft: RollDraft) => Effect.Effect<RollId>
    readonly insertMessage: (draft: MessageDraft) => Effect.Effect<MessageId>
  }
>()("GameStore") {}
