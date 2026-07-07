import { Context, Effect, type Option } from "effect"
import type { CharacterSheet } from "../character"
import type { HealthBox } from "../damage"
import type { DiceRollResult, RawPoolComponent } from "../dice"
import type {
  CharacterId,
  MessageId,
  PlayerId,
  RollId,
  SceneId,
  SessionId,
} from "../ids"
import type { Membership } from "../membership"
import type { NotAMember } from "../authz"
import type { Mana, Willpower } from "../quantities"
import type { SpellRef } from "../rote-cast"
import type { RoteArcanumName } from "../rote-pool"
import type { Scene } from "../scene"
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
  readonly manaCurrent?: Mana
  readonly willpowerCurrent?: Willpower
  readonly healthTrack?: ReadonlyArray<HealthBox>
}

/**
 * Intent-level draft of a new `scenes` row (issue #42): always born `active`
 * — the adapter stamps status and the open timestamp (from `Clock`).
 */
export interface SceneDraft {
  readonly sessionId: SessionId
  readonly name: string
  readonly sleeperWitnesses: boolean
}

/**
 * The only writes a flow can express against a Scene: its lifecycle end and
 * the witnesses default. The name is immutable after open — renaming a Scene
 * is a door no flow has earned yet.
 */
export interface ScenePatch {
  readonly status?: "closed"
  readonly sleeperWitnesses?: boolean
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
    /**
     * The session's at-most-one active Scene (issue #42). `Option`, not a
     * tagged error: no Scene open is a legal state (downtime), so absence is
     * an answer, never a failure — flows that need one raise their own
     * precondition error.
     */
    readonly getActiveScene: (
      sessionId: SessionId,
    ) => Effect.Effect<Option.Option<Scene>>
    readonly insertScene: (draft: SceneDraft) => Effect.Effect<SceneId>
    readonly patchScene: (sceneId: SceneId, patch: ScenePatch) => Effect.Effect<void>
  }
>()("GameStore") {}
