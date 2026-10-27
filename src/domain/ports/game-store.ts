import { Context, Effect, Schema, type Option } from "effect"
import { CastStatus, TidesSnapshot, type Cast } from "../cast"
import type { CharacterSheet } from "../character"
import { CombatParticipant, type Combat } from "../combat-tracker"
import { HealthBox } from "../damage"
import { DiceRollResult, Explosion, RawPoolComponent } from "../dice"
import {
  CharacterId,
  PlayerId,
  SceneId,
  SessionId,
  type CastId,
  type CombatId,
  type MessageId,
  type RollId,
} from "../ids"
import { ParadoxPoolModifier, ParadoxSeverity } from "../paradox"
import { ParadoxSpan } from "../paradox-effects"
import { Membership } from "../membership"
import type { NotAMember } from "../authz"
import { Mana, Willpower } from "../quantities"
import type { SpellRef } from "../rote-cast"
import type { RoteArcanumName } from "../rote-pool"
import type { Scene } from "../scene"
import { WisdomRank } from "../wisdom"
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
  /** The standing tool fact (issue #107) — the one identity column a flow
   * may flip; everything else here is current state. */
  hasMagicalTool: Schema.optionalKey(Schema.Boolean),
  /** Wisdom (MAG-56): a trait, not current state — widened deliberately so the
   * Storyteller's hand-edit door can record degeneration and recovery. */
  wisdom: Schema.optionalKey(WisdomRank),
})
export type SheetPatch = typeof SheetPatch.Type

/**
 * Intent-level draft of a new `scenes` row (issue #42, ADR-0022): always born
 * `active` with its Tides explicit (a new Scene opens quiet — zero witnesses,
 * no circumstances — armed deliberately on the strip); the adapter stamps
 * status and the open timestamp (from `Clock`).
 */
export const SceneDraft = Schema.Struct({
  sessionId: SessionId,
  name: Schema.String,
  witnessCount: Schema.Number,
  circumstances: Schema.Array(ParadoxPoolModifier),
})
export type SceneDraft = typeof SceneDraft.Type

/**
 * The only writes a flow can express against a Scene: its lifecycle end and
 * the Tides (ADR-0022). The name is immutable after open — renaming a Scene
 * is a door no flow has earned yet.
 */
export const ScenePatch = Schema.Struct({
  status: Schema.optionalKey(Schema.Literals(["closed"])),
  witnessCount: Schema.optionalKey(Schema.Number),
  circumstances: Schema.optionalKey(Schema.Array(ParadoxPoolModifier)),
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
  /** The rote lane's stamp (issue #47): −1 Paradox die and the Rote's name. */
  isRote: Schema.optionalKey(Schema.Boolean),
  roteName: Schema.optionalKey(Schema.String),
  usesMagicalTool: Schema.Boolean,
  /** The blind Willpower precommitment (ADR-0022, WoD p. 133). */
  spendWillpower: Schema.optionalKey(Schema.Boolean),
  /** The bought floor (issue #107): declared factors, stamped for the ST. */
  potency: Schema.optionalKey(Schema.Number),
  targets: Schema.optionalKey(Schema.Number),
  declaredComponents: Schema.Array(RawPoolComponent),
  declaredPool: Schema.Number,
  spellManaCost: Schema.Number,
})
export type CastDraft = typeof CastDraft.Type

/**
 * The writes the beat flows can express against a Cast: each beat stamps its
 * own fields plus the status rung it lands on. The declaration is immutable
 * after draft — except `usesMagicalTool`, the caster's side of the price
 * (issue #44), editable until the fix. The adapter stamps `updatedAt` and
 * any recorded `Override` marker (void's repair provenance) structurally.
 */
export const CastPatch = Schema.Struct({
  status: Schema.optionalKey(CastStatus),
  sceneId: Schema.optionalKey(SceneId),
  gnosis: Schema.optionalKey(Schema.Number),
  adjustments: Schema.optionalKey(Schema.Array(ParadoxPoolModifier)),
  tides: Schema.optionalKey(TidesSnapshot),
  manaMitigation: Schema.optionalKey(Schema.Number),
  /** The caster's live bets (MAG-34): broadcast drafts, no rules consequence. */
  draftMitigation: Schema.optionalKey(Schema.Number),
  draftContainedSuccesses: Schema.optionalKey(Schema.Number),
  /** The Paradox roll's faces (the 2026-07-19 polish, note 5): the roll
   * stamps onto the document like the release's — one card, no roll entry. */
  paradoxSuccesses: Schema.optionalKey(Schema.Number),
  paradoxRolls: Schema.optionalKey(Schema.Array(Schema.Number)),
  /** Parented (issue #122): a beat flow only ever stamps the new structs. */
  paradoxExplosions: Schema.optionalKey(Schema.Array(Explosion)),
  paradoxIsChanceDie: Schema.optionalKey(Schema.Boolean),
  paradoxIsDramaticFailure: Schema.optionalKey(Schema.Boolean),
  containedSuccesses: Schema.optionalKey(Schema.Number),
  castPool: Schema.optionalKey(Schema.Number),
  castSuccesses: Schema.optionalKey(Schema.Number),
  /** The release roll's faces (the resolution-merge ruling, 2026-07-19):
   * the resolved card is the record, so the roll stamps onto the document. */
  castRolls: Schema.optionalKey(Schema.Array(Schema.Number)),
  castExplosions: Schema.optionalKey(Schema.Array(Explosion)),
  castRoteRerolls: Schema.optionalKey(Schema.Array(Schema.Number)),
  castIsChanceDie: Schema.optionalKey(Schema.Boolean),
  castIsDramaticFailure: Schema.optionalKey(Schema.Boolean),
  castIsExceptionalSuccess: Schema.optionalKey(Schema.Boolean),
  severity: Schema.optionalKey(ParadoxSeverity),
  /** The aftermath Wisdom governs (MAG-56): stamped with the resolution. */
  wisdom: Schema.optionalKey(WisdomRank),
  paradoxSpan: Schema.optionalKey(ParadoxSpan),
  havocSuccesses: Schema.optionalKey(Schema.Number),
})
export type CastPatch = typeof CastPatch.Type

/**
 * Intent-level draft of a new `combats` row (issue #60): always born `active`
 * with an empty roster — the adapter stamps status, the counters, and the
 * start timestamp (from `Clock`).
 */
export const CombatDraft = Schema.Struct({
  sessionId: SessionId,
  sceneId: SceneId,
})
export type CombatDraft = typeof CombatDraft.Type

/**
 * The writes the Combat flows can express: the lifecycle end, the whole
 * roster as it should now read (replace, not merge — the document is the
 * atom), the participant-id mint, and the settled next actor (`null` clears
 * it when no rolled participant remains).
 */
export const CombatPatch = Schema.Struct({
  status: Schema.optionalKey(Schema.Literals(["ended"])),
  participants: Schema.optionalKey(Schema.Array(CombatParticipant)),
  seq: Schema.optionalKey(Schema.Number),
  nextActorId: Schema.optionalKey(Schema.NullOr(Schema.String)),
})
export type CombatPatch = typeof CombatPatch.Type

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
    /**
     * The session's at-most-one active Combat (issue #60). `Option`, like
     * `getActiveScene`: no Combat running is a legal state, so absence is an
     * answer — flows that need one raise their own precondition error.
     */
    readonly getActiveCombat: (
      sessionId: SessionId,
    ) => Effect.Effect<Option.Option<Combat>>
    readonly insertCombat: (draft: CombatDraft) => Effect.Effect<CombatId>
    readonly patchCombat: (
      combatId: CombatId,
      patch: CombatPatch,
    ) => Effect.Effect<void>
  }
>()("GameStore") {}
