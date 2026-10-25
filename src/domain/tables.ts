/**
 * Effect-Schema mirrors of the enforcement-seam tables (ADR-0005).
 *
 * These are the single source of truth for the stored shape of every derived
 * game table — `sessions`, `sessionMembers`, `characters`, `diceRolls`,
 * `messages`, `scenes`, `casts`. `convex/schema.ts` derives each table's Convex
 * validator from the mirror here via `schemaToConvexValidator`, so the `v.*`
 * column list is never hand-maintained alongside the domain shape.
 *
 * They describe the *persisted document* — raw primitives as written by the
 * adapter, not the branded/checked domain values `dice.ts` decodes into. Named
 * `*Doc` (singular), matching Convex's own `Doc<"table">` vocabulary — "Row"
 * collided with rows *on* a character sheet. Convex adds `_id` and
 * `_creationTime`, so they are deliberately absent. `sessionId` uses
 * `ConvexId("sessions")` to compile to `v.id("sessions")`; user/sender ids are
 * Better-Auth strings, so they stay `Schema.String` (compiling to `v.string()`).
 */

import { Schema } from "effect"
import { CastStatus, TidesSnapshot } from "./cast"
import { CombatParticipant } from "./combat-tracker"
import { ConvexId } from "./schema-bridge"
import { StoredExplosion } from "./dice"
import { OverrideKind } from "./override"
import { ParadoxPoolModifier } from "./paradox"
import { SessionRole } from "./roles"

/** Stored shape of a `sessions` row (issue #49): the one home of the session
 * columns, so the table validator and the client's snapshot mirror agree. */
export const SessionDoc = Schema.Struct({
  name: Schema.String,
  storytellerId: Schema.String,
  inviteCode: Schema.String,
  status: Schema.Literals(["lobby", "active", "ended"]),
})

export const SessionMemberDoc = Schema.Struct({
  sessionId: ConvexId("sessions"),
  userId: Schema.String,
  role: SessionRole,
  displayName: Schema.String,
})

/** One entry of a `diceRolls` pool — the raw `RawPoolComponent` triple. */
const DiceRollComponentDoc = Schema.Struct({
  type: Schema.String,
  name: Schema.String,
  dots: Schema.Number,
})

// One stored exploded die is `StoredExplosion` (dice.ts): a union superset of
// both generations (bare face for pre-parentage documents, the parented struct
// for new writes — the `HealthBoxDoc` precedent), healed at the decode boundary
// by `dice.ts`'s `normalizeExplosions`.

/**
 * Stored shape of the `Override` provenance marker (ADR-0006). A plain struct
 * (not the domain `OverrideMarker` class) so the derived column type stays a
 * flat Convex object; reuses `OverrideKind` so the marker kinds have one home.
 */
export const OverrideMarkerDoc = Schema.Struct({
  invokedByUserId: Schema.String,
  invokedByName: Schema.String,
  kind: OverrideKind,
})

export const DiceRollDoc = Schema.Struct({
  sessionId: ConvexId("sessions"),
  userId: Schema.String,
  displayName: Schema.String,
  components: Schema.Array(DiceRollComponentDoc),
  poolSize: Schema.Number,
  rolls: Schema.Array(Schema.Number),
  explosions: Schema.Array(StoredExplosion),
  roteRerolls: Schema.Array(Schema.Number),
  successes: Schema.Number,
  isChanceDie: Schema.Boolean,
  isDramaticFailure: Schema.Boolean,
  isExceptionalSuccess: Schema.Boolean,
  visibility: Schema.Literals(["public", "hidden"]),
  againThreshold: Schema.Number,
  isRoteAction: Schema.Boolean,
  // Self-describing narrative for the atomic Activity entry (ADR-0009).
  summary: Schema.String,
  // Override provenance (ADR-0006): present only when a rule was bent.
  override: Schema.optionalKey(OverrideMarkerDoc),
  timestamp: Schema.Number,
})

/** Raw persisted shape of a structured Rote pool — the Doc-layer mirror of
 * `RotePool` (rote-pool.ts): plain strings, `vs` present only on contested
 * pools. Deliberately looser than the `rotes` table's `pool` column (derived
 * from `RotePool` itself, issue #54): character docs stay raw primitives
 * (ADR-0011), and the character equivalence test pins this shape. */
const RotePoolDoc = Schema.Struct({
  attribute: Schema.String,
  skills: Schema.Array(Schema.String),
  arcanum: Schema.String,
  vs: Schema.optionalKey(Schema.Array(Schema.String)),
})

/**
 * One known Rote on a character (issue #16) — an embedded structured entry,
 * not a `v.id("rotes")` reference: the data pipeline clears and re-inserts the
 * `rotes` table, so its `_id`s are unstable. The spell is referenced by its
 * business key (`spellName` + `spellArcanum`).
 */
export const KnownRoteDoc = Schema.Struct({
  name: Schema.String,
  spellName: Schema.String,
  spellArcanum: Schema.String,
  spellLevel: Schema.Number,
  order: Schema.String,
  pool: RotePoolDoc,
  // Optional column: rows ingested before issue #68 carry no aspect stamp.
  spellAspect: Schema.optionalKey(Schema.String),
  // Optional column (issue #89): the book-page stamp the Rote book renders;
  // rows ingested before it have none. Raw primitives here (ADR-0011) — the
  // shaped mirror is `SpellPage` on the domain `KnownRote`.
  spellPage: Schema.optionalKey(
    Schema.Struct({
      practice: Schema.String,
      action: Schema.String,
      duration: Schema.String,
      cost: Schema.String,
      description: Schema.String,
      roteFlavor: Schema.optionalKey(Schema.String),
    }),
  ),
})

/**
 * The seedable width of a character — identity and rated Traits, no current
 * state. The dev seed mutation (issue #27) derives its `data` arg validator
 * from this struct and computes the current state through the character
 * domain's `initialCurrentState`; `CharacterData` composes it with the
 * current-state columns.
 */
export const CharacterSeedData = Schema.Struct({
  name: Schema.String,
  shadowName: Schema.optionalKey(Schema.String),
  concept: Schema.String,
  virtue: Schema.String,
  vice: Schema.String,
  path: Schema.String,
  order: Schema.String,
  gnosis: Schema.Number,
  attributes: Schema.Struct({
    mental: Schema.Struct({
      intelligence: Schema.Number,
      wits: Schema.Number,
      resolve: Schema.Number,
    }),
    physical: Schema.Struct({
      strength: Schema.Number,
      dexterity: Schema.Number,
      stamina: Schema.Number,
    }),
    social: Schema.Struct({
      presence: Schema.Number,
      manipulation: Schema.Number,
      composure: Schema.Number,
    }),
  }),
  skills: Schema.Struct({
    mental: Schema.Struct({
      academics: Schema.Number,
      computer: Schema.Number,
      crafts: Schema.Number,
      investigation: Schema.Number,
      medicine: Schema.Number,
      occult: Schema.Number,
      politics: Schema.Number,
      science: Schema.Number,
    }),
    physical: Schema.Struct({
      athletics: Schema.Number,
      brawl: Schema.Number,
      drive: Schema.Number,
      firearms: Schema.Number,
      larceny: Schema.Number,
      stealth: Schema.Number,
      survival: Schema.Number,
      weaponry: Schema.Number,
    }),
    social: Schema.Struct({
      animalKen: Schema.Number,
      empathy: Schema.Number,
      expression: Schema.Number,
      intimidation: Schema.Number,
      persuasion: Schema.Number,
      socialize: Schema.Number,
      streetwise: Schema.Number,
      subterfuge: Schema.Number,
    }),
  }),
  arcana: Schema.Struct({
    death: Schema.optionalKey(Schema.Number),
    fate: Schema.optionalKey(Schema.Number),
    forces: Schema.optionalKey(Schema.Number),
    life: Schema.optionalKey(Schema.Number),
    matter: Schema.optionalKey(Schema.Number),
    mind: Schema.optionalKey(Schema.Number),
    prime: Schema.optionalKey(Schema.Number),
    space: Schema.optionalKey(Schema.Number),
    spirit: Schema.optionalKey(Schema.Number),
    time: Schema.optionalKey(Schema.Number),
  }),
})

/**
 * One health box as stored (issue #41): documents written before the
 * (severity, resistant) pair carry the bare severity string, so the column
 * stays a union superset of both generations — new writes are always pairs.
 * Raw primitives here (ADR-0011); the vocabulary decode lives in `damage.ts`.
 */
const HealthBoxDoc = Schema.Union([
  Schema.String,
  Schema.Struct({ severity: Schema.String, resistant: Schema.Boolean }),
])

/**
 * The ingestable width of a character — identity, rated Traits, current state,
 * known Rotes — everything except the linkage columns. The Dev-side character
 * ingestion mutation (issue #16) derives its `data` arg validator from this
 * struct; `CharacterDoc` composes it with the linkage.
 */
export const CharacterData = Schema.Struct({
  ...CharacterSeedData.fields,
  healthTrack: Schema.Array(HealthBoxDoc),
  willpowerCurrent: Schema.Number,
  manaCurrent: Schema.Number,
  // Optional column: rows stored before issue #16 have no knownRotes.
  knownRotes: Schema.optionalKey(Schema.Array(KnownRoteDoc)),
  // The standing tool fact (issue #107): the mage keeps a magical tool in
  // hand (−1 Paradox die on every vulgar cast). A sheet fact, never a
  // per-cast dial; absent on rows written before it existed (= false).
  hasMagicalTool: Schema.optionalKey(Schema.Boolean),
})

/**
 * Full-width mirror of the `characters` table — the raw persisted shape, the
 * last hand-written table definition retired (PRD #4 slice #6). Deliberately
 * raw primitives throughout (ADR-0011): representability and domain checks
 * belong to the `CharacterSheet` artifact decoded at the adapter, never to the
 * Doc layer. Every column is listed because the table validator needs the whole
 * width; flows never touch this shape directly.
 */
export const CharacterDoc = Schema.Struct({
  sessionMemberId: ConvexId("sessionMembers"),
  sessionId: ConvexId("sessions"),
  userId: Schema.String,
  ...CharacterData.fields,
})

/**
 * Stored shape of a Scene (issue #42, ADR-0022): the ST-controlled narrative
 * container, owner of the Tides — the ambient price of vulgar magic. At most
 * one row per session is `active` — an invariant the open flow enforces, not
 * the table. Raw primitives here (ADR-0011); the vocabulary decode lives in
 * `scene.ts`. `closedAt` is present only once closed. The Tides columns
 * (`witnessCount`, `circumstances`) are written on every new row; the
 * `sleeperWitnesses` boolean survives only for rows written before the
 * stepper superseded it ("true is one witness").
 */
export const SceneDoc = Schema.Struct({
  sessionId: ConvexId("sessions"),
  name: Schema.String,
  status: Schema.Literals(["active", "closed"]),
  sleeperWitnesses: Schema.optionalKey(Schema.Boolean),
  witnessCount: Schema.optionalKey(Schema.Number),
  circumstances: Schema.optionalKey(Schema.Array(ParadoxPoolModifier)),
  openedAt: Schema.Number,
  closedAt: Schema.optionalKey(Schema.Number),
})

/**
 * Stored shape of a Cast (issue #43, ADR-0016 as amended by ADR-0022): the
 * Vulgar-casting handshake's single source of truth, walking the four-rung
 * ladder one mutation per commitment. Raw primitives here (ADR-0011); the
 * vocabulary decode lives in `cast.ts` — the status column reuses the domain
 * `CastStatus` literals so a removed rung is one edit, everywhere. Beat
 * fields are present only once their beat lands, so the document alone
 * rehydrates a reconnecting client mid-ladder. `override` carries void's
 * repair provenance (ADR-0006/0015); resolved rows are the system of record
 * for the per-(Scene, caster) Paradox accumulator (ADR-0012). The retired
 * negotiation columns (`sleeperWitnesses`, `witnessCount`,
 * `priorParadoxRolls`, `discretionaryModifiers`) survive only so resolved
 * rows written under the seven-rung ladder keep validating.
 */
export const CastDoc = Schema.Struct({
  sessionId: ConvexId("sessions"),
  characterId: ConvexId("characters"),
  casterUserId: Schema.String,
  casterName: Schema.String,
  status: CastStatus,
  // Declaration (the draft beat). The rote lane (issue #47) stamps `isRote`
  // and the Rote's name; absent on improvised rows and on pre-lane rows.
  // `spendWillpower` is the blind precommitment (ADR-0022, WoD p. 133).
  arcanum: Schema.String,
  level: Schema.Number,
  isRote: Schema.optionalKey(Schema.Boolean),
  roteName: Schema.optionalKey(Schema.String),
  /** Retired (owner, 2026-10-22): intent is spoken on camera, not typed.
   * Kept optional here only so documents written before the retirement
   * still validate; nothing reads or writes it. */
  intent: Schema.optionalKey(Schema.String),
  usesMagicalTool: Schema.Boolean,
  spendWillpower: Schema.optionalKey(Schema.Boolean),
  // The bought floor (issue #107): declared spell factors, stamped so the
  // ST's dispel knows what it rolls against. Absent when left at 1.
  potency: Schema.optionalKey(Schema.Number),
  targets: Schema.optionalKey(Schema.Number),
  declaredComponents: Schema.Array(DiceRollComponentDoc),
  declaredPool: Schema.Number,
  spellManaCost: Schema.Number,
  // The stage (the engage beat)
  sceneId: Schema.optionalKey(ConvexId("scenes")),
  gnosis: Schema.optionalKey(Schema.Number),
  // The Tides rung (ADR-0022; wire status stays "price", #114): the ST's personal adjustments, then the fixed
  // Tides seed — the snapshot's presence IS the fix. Both reuse the
  // domain shapes (raw primitives already, ADR-0011), never a hand-mirror.
  adjustments: Schema.optionalKey(Schema.Array(ParadoxPoolModifier)),
  tides: Schema.optionalKey(TidesSnapshot),
  // Commitment (the caster's point of no return)
  manaMitigation: Schema.optionalKey(Schema.Number),
  // The caster's live bets (MAG-34, reviving ADR-0022's broadcast draft):
  // the Mana pick after the fix and the boxes contained after the Paradox
  // roll, server-held so every seat watches them move. No rules consequence
  // until Commit and Cast stamp the real fields.
  draftMitigation: Schema.optionalKey(Schema.Number),
  draftContainedSuccesses: Schema.optionalKey(Schema.Number),
  // The Paradox roll — stamped mid-rung; its presence flips the phase. The
  // roll's faces ride the document too (the 2026-07-19 polish, note 5: the
  // same resolution-merge treatment as the release), so the table sees the
  // one card and no roll entry beside it. Rows rolled
  // before the merge carry only successes; the card renders what's there.
  paradoxSuccesses: Schema.optionalKey(Schema.Number),
  paradoxRolls: Schema.optionalKey(Schema.Array(Schema.Number)),
  paradoxExplosions: Schema.optionalKey(Schema.Array(StoredExplosion)),
  paradoxIsChanceDie: Schema.optionalKey(Schema.Boolean),
  paradoxIsDramaticFailure: Schema.optionalKey(Schema.Boolean),
  // The one Cast click and resolution. The release roll's faces live here
  // (the resolution-merge ruling, 2026-07-19): the resolved card is the
  // record — no separate roll row rides beside it. Rows resolved before the
  // merge carry only castPool/castSuccesses; the card renders what's there.
  containedSuccesses: Schema.optionalKey(Schema.Number),
  castPool: Schema.optionalKey(Schema.Number),
  castSuccesses: Schema.optionalKey(Schema.Number),
  castRolls: Schema.optionalKey(Schema.Array(Schema.Number)),
  castExplosions: Schema.optionalKey(Schema.Array(StoredExplosion)),
  castRoteRerolls: Schema.optionalKey(Schema.Array(Schema.Number)),
  castIsChanceDie: Schema.optionalKey(Schema.Boolean),
  castIsDramaticFailure: Schema.optionalKey(Schema.Boolean),
  castIsExceptionalSuccess: Schema.optionalKey(Schema.Boolean),
  severity: Schema.optionalKey(Schema.String),
  // Legacy negotiation columns — seven-rung rows only; no new writes.
  sleeperWitnesses: Schema.optionalKey(Schema.Boolean),
  witnessCount: Schema.optionalKey(Schema.Number),
  priorParadoxRolls: Schema.optionalKey(Schema.Number),
  discretionaryModifiers: Schema.optionalKey(Schema.Array(ParadoxPoolModifier)),
  override: Schema.optionalKey(OverrideMarkerDoc),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})

/**
 * Stored shape of a Combat (issue #60): the FFX tick timeline, a child of a
 * Scene. At most one row per session is `active` — the start flow's
 * invariant, not the table's. The participant union is the domain's own
 * (`combat-tracker.ts`, raw primitives per ADR-0011 — the `ParadoxPoolModifier`
 * precedent); `endedAt` is present only once ended.
 */
export const CombatDoc = Schema.Struct({
  sessionId: ConvexId("sessions"),
  sceneId: ConvexId("scenes"),
  status: Schema.Literals(["active", "ended"]),
  participants: Schema.Array(CombatParticipant),
  seq: Schema.Number,
  nextActorId: Schema.optionalKey(Schema.String),
  startedAt: Schema.Number,
  endedAt: Schema.optionalKey(Schema.Number),
})

/** A group whisper's members, by user id (MAG-53): the message row's field
 * and the send's argument, one shape. */
export const WhisperTargetIds = Schema.Array(Schema.String)

export const MessageDoc = Schema.Struct({
  sessionId: ConvexId("sessions"),
  senderId: Schema.String,
  senderName: Schema.String,
  text: Schema.String,
  visibilityType: Schema.Literals(["public", "whisper", "system"]),
  whisperTargetId: Schema.optionalKey(Schema.String),
  // A group whisper (MAG-53): every member it reaches, and their names as
  // they stood when it was sent (self-describing, ADR-0009 — the record
  // names its people the way it names its sender). New whispers carry these;
  // older ones carry the single `whisperTargetId` above.
  whisperTargetIds: Schema.optionalKey(WhisperTargetIds),
  whisperTargetNames: Schema.optionalKey(Schema.Array(Schema.String)),
  // Override provenance (ADR-0006): present only when a rule was bent — the
  // hand-edit flow's system entries carry it (issue #19). Absent on chat.
  override: Schema.optionalKey(OverrideMarkerDoc),
  timestamp: Schema.Number,
})
