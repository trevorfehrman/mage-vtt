/**
 * Effect-Schema mirrors of the enforcement-seam tables (ADR-0005).
 *
 * These are the single source of truth for the stored shape of `sessionMembers`,
 * `diceRolls`, and `messages`. `convex/schema.ts` derives each table's Convex
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
import { ConvexId } from "./schema-bridge"
import { OverrideKind } from "./override"

export const SessionMemberDoc = Schema.Struct({
  sessionId: ConvexId("sessions"),
  userId: Schema.String,
  role: Schema.Literals(["storyteller", "player"]),
  displayName: Schema.String,
})

/** One entry of a `diceRolls` pool — the raw `RawPoolComponent` triple. */
const DiceRollComponentDoc = Schema.Struct({
  type: Schema.String,
  name: Schema.String,
  dots: Schema.Number,
})

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
  explosions: Schema.Array(Schema.Number),
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
 * pools. Matches the hand-written `rotePoolValidator` on the `rotes` table. */
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
 * Stored shape of a Scene (issue #42): the ST-controlled narrative container.
 * At most one row per session is `active` — an invariant the open flow
 * enforces, not the table. Raw primitives here (ADR-0011); the vocabulary
 * decode lives in `scene.ts`. `closedAt` is present only once closed.
 */
export const SceneDoc = Schema.Struct({
  sessionId: ConvexId("sessions"),
  name: Schema.String,
  status: Schema.Literals(["active", "closed"]),
  sleeperWitnesses: Schema.Boolean,
  openedAt: Schema.Number,
  closedAt: Schema.optionalKey(Schema.Number),
})

/**
 * Stored shape of a Cast (issue #43, ADR-0016): the Vulgar-casting handshake's
 * single source of truth, walking the status ladder one mutation per dramatic
 * beat. Raw primitives here (ADR-0011); the vocabulary decode lives in
 * `cast.ts`. Beat fields are present only once their beat lands, so the
 * document alone rehydrates a reconnecting client mid-ladder. `override`
 * carries void's repair provenance (ADR-0006/0015); resolved rows are the
 * system of record for the per-(Scene, caster) Paradox accumulator (ADR-0012).
 */
export const CastDoc = Schema.Struct({
  sessionId: ConvexId("sessions"),
  characterId: ConvexId("characters"),
  casterUserId: Schema.String,
  casterName: Schema.String,
  status: Schema.Literals([
    "draft",
    "engaged",
    "liabilitiesLocked",
    "intentionLocked",
    "paradoxRolled",
    "contained",
    "resolved",
    "cancelled",
    "voided",
  ]),
  // Declaration (the draft beat)
  arcanum: Schema.String,
  level: Schema.Number,
  intent: Schema.optionalKey(Schema.String),
  usesMagicalTool: Schema.Boolean,
  declaredComponents: Schema.Array(DiceRollComponentDoc),
  declaredPool: Schema.Number,
  spellManaCost: Schema.Number,
  // The stage (the engage beat)
  sceneId: Schema.optionalKey(ConvexId("scenes")),
  gnosis: Schema.optionalKey(Schema.Number),
  sleeperWitnesses: Schema.optionalKey(Schema.Boolean),
  priorParadoxRolls: Schema.optionalKey(Schema.Number),
  // Commitment (the caster's point-of-no-return lock)
  manaMitigation: Schema.optionalKey(Schema.Number),
  // The Paradox roll
  paradoxSuccesses: Schema.optionalKey(Schema.Number),
  paradoxIsDramaticFailure: Schema.optionalKey(Schema.Boolean),
  // Containment
  containedSuccesses: Schema.optionalKey(Schema.Number),
  // The cast roll and resolution
  castPool: Schema.optionalKey(Schema.Number),
  castSuccesses: Schema.optionalKey(Schema.Number),
  severity: Schema.optionalKey(Schema.String),
  override: Schema.optionalKey(OverrideMarkerDoc),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})

export const MessageDoc = Schema.Struct({
  sessionId: ConvexId("sessions"),
  senderId: Schema.String,
  senderName: Schema.String,
  text: Schema.String,
  visibilityType: Schema.Literals(["public", "whisper", "system"]),
  whisperTargetId: Schema.optionalKey(Schema.String),
  // Override provenance (ADR-0006): present only when a rule was bent — the
  // hand-edit flow's system entries carry it (issue #19). Absent on chat.
  override: Schema.optionalKey(OverrideMarkerDoc),
  timestamp: Schema.Number,
})
