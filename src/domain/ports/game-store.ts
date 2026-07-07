import { Context, Effect, Schema, type Option } from "effect"
import { CastStatus, type Cast } from "../cast"
import type { CharacterSheet } from "../character"
import { HealthBox } from "../damage"
import { DiceRollResult, RawPoolComponent } from "../dice"
import {
  CharacterId,
  PlayerId,
  SceneId,
  SessionId,
  type CastId,
  type MessageId,
  type RollId,
} from "../ids"
import { ParadoxPoolModifier, ParadoxSeverity } from "../paradox"
import { Membership } from "../membership"
import type { NotAMember } from "../authz"
import { Mana, Willpower } from "../quantities"
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
export const RollDraft = Schema.Struct({
  sessionId: SessionId,
  member: Membership,
  components: Schema.Array(RawPoolComponent),
  result: DiceRollResult,
  summary: Schema.String,
})
export type RollDraft = typeof RollDraft.Type

/** Intent-level draft of a chat / system `messages` row. */
export const MessageDraft = Schema.Struct({
  sessionId: SessionId,
  sender: Schema.Struct({ userId: PlayerId, displayName: Schema.String }),
  text: Schema.String,
  visibility: Schema.Literals(["public", "whisper", "system"]),
  whisperTargetId: Schema.optionalKey(PlayerId),
})
export type MessageDraft = typeof MessageDraft.Type

/**
 * The only writes a flow can express against a character sheet: the fields play
 * mutates. This narrowness is ADR-0011's compensating control for permissive
 * sheet checks — traits and identity are unreachable until a future flow
 * (advancement, ST sheet-edit) earns them a door with its own authority story.
 * Widening this type is a design decision, not a convenience edit.
 */
export const SheetPatch = Schema.Struct({
  manaCurrent: Schema.optionalKey(Mana),
  willpowerCurrent: Schema.optionalKey(Willpower),
  healthTrack: Schema.optionalKey(Schema.Array(HealthBox)),
})
export type SheetPatch = typeof SheetPatch.Type

/**
 * Intent-level draft of a new `scenes` row (issue #42): always born `active`
 * — the adapter stamps status and the open timestamp (from `Clock`).
 */
export const SceneDraft = Schema.Struct({
  sessionId: SessionId,
  name: Schema.String,
  sleeperWitnesses: Schema.Boolean,
})
export type SceneDraft = typeof SceneDraft.Type

/**
 * The only writes a flow can express against a Scene: its lifecycle end and
 * the witnesses default. The name is immutable after open — renaming a Scene
 * is a door no flow has earned yet.
 */
export const ScenePatch = Schema.Struct({
  status: Schema.optionalKey(Schema.Literals(["closed"])),
  sleeperWitnesses: Schema.optionalKey(Schema.Boolean),
})
export type ScenePatch = typeof ScenePatch.Type

/**
 * Intent-level draft of a new `casts` row (issue #43, ADR-0016): the
 * declaration beat's whole knowledge. Always born a `draft` — the adapter
 * stamps status and both timestamps (from `Clock`).
 */
export const CastDraft = Schema.Struct({
  sessionId: SessionId,
  characterId: CharacterId,
  casterUserId: PlayerId,
  casterName: Schema.String,
  arcanum: Schema.String,
  level: Schema.Number,
  intent: Schema.optionalKey(Schema.String),
  usesMagicalTool: Schema.Boolean,
  declaredComponents: Schema.Array(RawPoolComponent),
  declaredPool: Schema.Number,
  spellManaCost: Schema.Number,
})
export type CastDraft = typeof CastDraft.Type

/**
 * The writes the beat flows can express against a Cast: each beat stamps its
 * own fields plus the status rung it lands on. The declaration is immutable
 * after draft — except `usesMagicalTool`, the caster's side of the
 * negotiation (issue #44), editable until liabilities lock. The adapter
 * stamps `updatedAt` and any recorded `Override` marker (void's repair
 * provenance) structurally.
 */
export const CastPatch = Schema.Struct({
  status: Schema.optionalKey(CastStatus),
  usesMagicalTool: Schema.optionalKey(Schema.Boolean),
  sceneId: Schema.optionalKey(SceneId),
  gnosis: Schema.optionalKey(Schema.Number),
  sleeperWitnesses: Schema.optionalKey(Schema.Boolean),
  witnessCount: Schema.optionalKey(Schema.Number),
  priorParadoxRolls: Schema.optionalKey(Schema.Number),
  discretionaryModifiers: Schema.optionalKey(Schema.Array(ParadoxPoolModifier)),
  manaMitigation: Schema.optionalKey(Schema.Number),
  paradoxSuccesses: Schema.optionalKey(Schema.Number),
  paradoxIsDramaticFailure: Schema.optionalKey(Schema.Boolean),
  containedSuccesses: Schema.optionalKey(Schema.Number),
  castPool: Schema.optionalKey(Schema.Number),
  castSuccesses: Schema.optionalKey(Schema.Number),
  severity: Schema.optionalKey(ParadoxSeverity),
})
export type CastPatch = typeof CastPatch.Type

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
    readonly insertCast: (draft: CastDraft) => Effect.Effect<CastId>
    readonly getCast: (castId: CastId) => Effect.Effect<Cast, DocumentNotFound>
    readonly patchCast: (castId: CastId, patch: CastPatch) => Effect.Effect<void>
    /**
     * Every Cast in the session (issue #43): the wings, the stage, and the
     * resolved history the accumulator derives from (ADR-0012). One read, not
     * three — sessions hold few Casts and the flows' filters are the rules.
     */
    readonly listCasts: (sessionId: SessionId) => Effect.Effect<ReadonlyArray<Cast>>
  }
>()("GameStore") {}
