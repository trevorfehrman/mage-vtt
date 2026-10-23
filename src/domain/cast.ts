import { Array as Arr, Match, Order, Schema } from "effect"
import type { HealthTrack } from "./damage"
import { Explosion } from "./dice"
import { applyDamage, isIncapacitated, woundPenalty } from "./health"
import { CastId, CharacterId, PlayerId, SceneId, SessionId } from "./ids"
import type { GnosisRank } from "./mana-economy"
import { ParadoxPoolModifier, ParadoxSeverity } from "./paradox"

/**
 * The Cast (issue #43, PRD #39, ADR-0016 as amended by ADR-0022): a declared
 * Vulgar spellcasting walking its status ladder as a first-class document —
 * the single source of truth for the caster/Storyteller handshake. One Convex
 * mutation per *commitment* (ADR-0022; drafting is broadcast working state);
 * the client XState machine is a projection of this document, never an owner
 * of pending state.
 *
 * The four-rung ladder (ADR-0022):
 *
 *   draft (caster declares, the wings)
 *     → price (the Tides rung: ST assembles seed ± personal adjustments, fixes ·
 *              caster insures, commits or bails)
 *     → paradox (ST rolls · caster contains & releases in one Cast click)
 *     → resolved
 *   terminals: cancelled (free, pre-commitment), voided (ST repair, any stage)
 *
 * Rungs with two actors are two-colored phases of one rung, derived from the
 * document — `waitingOn` reads the phase off the stamped fields, never off a
 * status suffix.
 */

export const CastStatus = Schema.Literals([
  "draft",
  "price",
  "paradox",
  "resolved",
  "cancelled",
  "voided",
])
export type CastStatus = typeof CastStatus.Type

const TERMINAL: ReadonlyArray<CastStatus> = ["resolved", "cancelled", "voided"]

/** A Cast still in play — what "one unresolved Cast per character" counts. */
export const isUnresolved = (status: CastStatus): boolean =>
  !TERMINAL.includes(status)

/**
 * On stage (CONTEXT.md): the Tides rung through Paradox — the at-most-one Cast
 * holding the table's attention. Drafts queue in the wings; terminals free it.
 */
export const isOnStage = (status: CastStatus): boolean =>
  isUnresolved(status) && status !== "draft"

/**
 * Past the point of no return: the caster's Mana (mitigation + spell cost) and
 * any precommitted Willpower are spent, and the only exits are playing the
 * Cast out or an ST void. Commitment is what enters the Paradox rung.
 */
export const isCommitted = (status: CastStatus): boolean => status === "paradox"

/**
 * The fixed Tides seed as the fix stamps it onto the card (ADR-0022, verb
 * renamed by the 2026-07-19 polish pass — "Fix the Tides", never "freeze"):
 * inherited-from-scene ambient truth — witnesses, circumstances, the caster's
 * prior-Paradox pips — stamped, never re-derived. Its presence on the document
 * IS the fix: after it lands the ST is irrevocably hands-off and the caster
 * weighs insurance against a price that cannot shift under them.
 */
export const TidesSnapshot = Schema.Struct({
  witnessCount: Schema.Number,
  /** Ambient {source, dice} modifiers, signs in both directions (ADR-0022). */
  circumstances: Schema.Array(ParadoxPoolModifier),
  priorParadoxRolls: Schema.Number,
})
export type TidesSnapshot = typeof TidesSnapshot.Type

/**
 * What the phase derivation needs of the document: the rung plus the stamps
 * that split its two-colored phases. Structural like `AccumulatorCast` — a
 * decoded `Cast` satisfies it, a feed `CastEntry` too.
 */
export const CastPhases = Schema.Struct({
  status: CastStatus,
  tides: Schema.optionalKey(TidesSnapshot),
  paradoxSuccesses: Schema.optionalKey(Schema.Number),
})
export type CastPhases = typeof CastPhases.Type

/** The fix has landed: the price is settled and "settled" never lies. */
export const isPriceFixed = (cast: CastPhases): boolean =>
  cast.tides !== undefined

/**
 * Whose hand the rung waits on (ADR-0022: two-colored phases replace "waiting
 * on you" prose); null once the Cast is terminal. Phases derive from stamps:
 * the fixed Tides flip the Tides rung to the caster, the rolled successes flip
 * Paradox to the caster.
 */
export const waitingOn = (cast: CastPhases): "storyteller" | "caster" | null =>
  Match.value(cast.status).pipe(
    // draft: in the wings — the ST engages (or declines).
    Match.when("draft", () => "storyteller" as const),
    // price: the ST assembles and fixes; then the caster insures & commits.
    Match.when("price", () =>
      isPriceFixed(cast) ? ("caster" as const) : ("storyteller" as const),
    ),
    // paradox: the ST's own roll button; then the caster contains & releases.
    Match.when("paradox", () =>
      cast.paradoxSuccesses !== undefined ? ("caster" as const) : ("storyteller" as const),
    ),
    // Terminals listed, not defaulted (ADR-0018): a new rung is a compile error.
    Match.whenOr("resolved", "cancelled", "voided", () => null),
    Match.exhaustive,
  )

/**
 * Seam mirror of a `casts` row (ADR-0004): decoded at the adapter from
 * Convex's `Doc<"casts">` — the domain never sees `Doc<T>`. Fields past the
 * declaration are stamped beat by beat and absent until their beat lands, so
 * the document alone tells any reconnecting client exactly where the ladder
 * stands. `updatedAt` orders resolved Casts for the accumulator's grace rule.
 */
export class Cast extends Schema.Class<Cast>("Cast")({
  id: CastId,
  sessionId: SessionId,
  characterId: CharacterId,
  casterUserId: PlayerId,
  casterName: Schema.String,
  status: CastStatus,
  // Declaration (the draft beat). A rote declaration (issue #47) stamps
  // `isRote` (−1 Paradox die, p. 127) and the trained Rote's name; the
  // arcanum/level pair derives from the Rote's spell. Absent on improvised
  // rows and on rows written before the rote lane existed — both mean false.
  // `spendWillpower` is the blind precommitment (ADR-0022, WoD p. 133): +3
  // dice in the declared pool, the point itself deducted at the commit.
  arcanum: Schema.String,
  level: Schema.Number,
  isRote: Schema.optionalKey(Schema.Boolean),
  roteName: Schema.optionalKey(Schema.String),
  usesMagicalTool: Schema.Boolean,
  spendWillpower: Schema.optionalKey(Schema.Boolean),
  // The bought floor (issue #107): declared spell factors, stamped so the
  // ST's dispel knows what it rolls against. Absent when left at 1.
  potency: Schema.optionalKey(Schema.Number),
  targets: Schema.optionalKey(Schema.Number),
  declaredComponents: Schema.Array(
    Schema.Struct({ type: Schema.String, name: Schema.String, dots: Schema.Number }),
  ),
  declaredPool: Schema.Number,
  spellManaCost: Schema.Number,
  // The stage (the engage beat): where the Cast plays, and the caster's
  // Gnosis as the sheet stood when it took the stage.
  sceneId: Schema.optionalKey(SceneId),
  gnosis: Schema.optionalKey(Schema.Number),
  // The Tides rung (ADR-0022; wire status stays "price", #114): the ST's personal adjustments accumulate while the
  // rung is fluid; the fix stamps the Tides seed — its presence IS the
  // fix, and after it nothing on the price moves.
  adjustments: Schema.optionalKey(Schema.Array(ParadoxPoolModifier)),
  tides: Schema.optionalKey(TidesSnapshot),
  // Commitment (the caster's point of no return)
  manaMitigation: Schema.optionalKey(Schema.Number),
  // The Paradox roll — stamped mid-rung; its presence flips the phase. Its
  // faces ride the document like the release's (the 2026-07-19 polish,
  // note 5): one live card in the feed, no roll entry beside it. Rows
  // rolled before the merge carry only successes.
  paradoxSuccesses: Schema.optionalKey(Schema.Number),
  paradoxRolls: Schema.optionalKey(Schema.Array(Schema.Number)),
  // Parented explosions (issue #122): the decode boundary heals legacy bare
  // faces to parentless structs before this schema sees them.
  paradoxExplosions: Schema.optionalKey(Schema.Array(Explosion)),
  paradoxIsChanceDie: Schema.optionalKey(Schema.Boolean),
  paradoxIsDramaticFailure: Schema.optionalKey(Schema.Boolean),
  // The one Cast click (contain + release) and resolution. The release roll's
  // faces stamp onto the document (the resolution-merge ruling, 2026-07-19):
  // the resolved card IS the record, no separate roll entry beside it.
  containedSuccesses: Schema.optionalKey(Schema.Number),
  castPool: Schema.optionalKey(Schema.Number),
  castSuccesses: Schema.optionalKey(Schema.Number),
  castRolls: Schema.optionalKey(Schema.Array(Schema.Number)),
  castExplosions: Schema.optionalKey(Schema.Array(Explosion)),
  castRoteRerolls: Schema.optionalKey(Schema.Array(Schema.Number)),
  castIsChanceDie: Schema.optionalKey(Schema.Boolean),
  castIsDramaticFailure: Schema.optionalKey(Schema.Boolean),
  castIsExceptionalSuccess: Schema.optionalKey(Schema.Boolean),
  severity: Schema.optionalKey(ParadoxSeverity),
  updatedAt: Schema.Number,
}) {}

/**
 * The Tides seed a fix stamps (ADR-0022): the Scene's ambient truth plus
 * this caster's derived pips (ADR-0012). Downtime (no Scene) seeds nothing —
 * no witnesses, no circumstances, no accumulation. Structural over the Scene
 * so the strip's raw reads and the flow's decoded `Scene` both fit.
 */
export const sceneTides = (
  casts: ReadonlyArray<AccumulatorCast>,
  scene:
    | {
        readonly id: string
        readonly witnessCount: number
        readonly circumstances: ReadonlyArray<ParadoxPoolModifier>
      }
    | undefined,
  characterId: string,
): TidesSnapshot =>
  scene === undefined
    ? { witnessCount: 0, circumstances: [], priorParadoxRolls: 0 }
    : {
        witnessCount: scene.witnessCount,
        circumstances: scene.circumstances,
        priorParadoxRolls: deriveAccumulator(casts, scene.id, characterId),
      }

/**
 * The per-(Scene, caster) Paradox accumulator (ADR-0012, ADR-0016): derived by
 * reading resolved Cast history — never a stored tally, never counted from
 * Activity Log entries. Each resolved Cast in the Scene made exactly one
 * Paradox roll for this caster (+1 die each, the successive-rolls rule); a
 * voided Cast leaves no trace by never reaching `resolved`.
 *
 * The dramatic-failure grace (Mage 1e p. 124): a chance-die dramatic failure
 * means Paradox leaves the caster alone, so the roll immediately after it
 * skips that Cast's +1. Encoded as: if the *most recent* resolved Cast rolled
 * a dramatic failure, its increment is forgiven. A computed default the ST
 * will be able to edit once the negotiation UI lands (ADR-0015).
 *
 * No Scene (downtime) accumulates nothing.
 *
 * Typed structurally (issue #44): the strip's pips query reads raw `casts`
 * rows outside the enforcement seam, and the derivation needs only these
 * fields — a decoded `Cast` satisfies the shape, a `Doc<"casts">` too.
 */
export const AccumulatorCast = Schema.Struct({
  status: CastStatus,
  sceneId: Schema.optional(Schema.String),
  characterId: Schema.String,
  casterName: Schema.String,
  paradoxIsDramaticFailure: Schema.optional(Schema.Boolean),
  updatedAt: Schema.Number,
})
export type AccumulatorCast = typeof AccumulatorCast.Type

export const deriveAccumulator = (
  casts: ReadonlyArray<AccumulatorCast>,
  sceneId: string | undefined,
  characterId: string,
): number => {
  if (sceneId === undefined) return 0
  const resolved = casts
    .filter(
      (c) =>
        c.status === "resolved" &&
        c.sceneId === sceneId &&
        c.characterId === characterId,
    )
    .sort((a, b) => a.updatedAt - b.updatedAt)
  if (resolved.length === 0) return 0
  const grace = resolved[resolved.length - 1]!.paradoxIsDramaticFailure === true
  return Math.max(0, resolved.length - (grace ? 1 : 0))
}

/**
 * Whether the Cast plays as a trained Rote (issue #47) — −1 Paradox die,
 * page 127. Rows written before the rote lane existed are improvised drafts.
 * Structural like `sceneWitnessCount`: the card reads raw rows too.
 */
export const isRoteCast = (cast: {
  readonly isRote?: boolean | undefined
}): boolean => cast.isRote ?? false

/** One caster's standing on the strip: who, and how hard they're pushing.
 * A Schema (ADR-0017): it crosses the wire from `api.casts.paradoxPips` and
 * the strip decodes against it (issue #49). */
export const ScenePip = Schema.Struct({
  characterId: Schema.String,
  casterName: Schema.String,
  accumulator: Schema.Number,
})
export type ScenePip = typeof ScenePip.Type

/**
 * The strip's per-caster Paradox pips (issue #44): every caster with a
 * nonzero accumulator this Scene, each derived through `deriveAccumulator`
 * (grace and all), ordered heaviest first (ties by name, a stable strip).
 * The name rides the latest resolved Cast. No Scene, no pips.
 */
const byUpdatedAt = Order.mapInput(Order.Number, (c: AccumulatorCast) => c.updatedAt)

export const sceneParadoxPips = (
  casts: ReadonlyArray<AccumulatorCast>,
  sceneId: string | undefined,
): Array<ScenePip> => {
  if (sceneId === undefined) return []
  const resolvedInScene = Arr.sort(
    casts.filter((c) => c.status === "resolved" && c.sceneId === sceneId),
    byUpdatedAt,
  )
  const byCharacter = Arr.groupBy(resolvedInScene, (c) => c.characterId)
  return Object.entries(byCharacter)
    .map(([characterId, group]) => ({
      characterId,
      // The name rides the latest resolved Cast.
      casterName: Arr.lastNonEmpty(group).casterName,
      accumulator: deriveAccumulator(casts, sceneId, characterId),
    }))
    .filter((pip) => pip.accumulator > 0)
    .sort(
      (a, b) =>
        b.accumulator - a.accumulator || a.casterName.localeCompare(b.casterName),
    )
}

/**
 * How many Paradox successes the caster may absorb as Resistant bashing: one
 * wound per success, capped by the boxes still empty — the martyr play down to
 * the last box is possible, death is not (PRD #39 story 25).
 */
export const containmentCap = (
  track: HealthTrack,
  paradoxSuccesses: number,
): number =>
  Math.min(
    paradoxSuccesses,
    track.filter((box) => box.severity === "empty").length,
  )

/**
 * How many Paradox dice the caster may buy off with Mana at the intention
 * lock: one die per Mana, capped by the pool itself and by the Mana still
 * free once the spell's own cost is reserved (issue #52 — the client mirror
 * of the server's mitigation refusals; the server stays authoritative).
 */
export const mitigationCap = (
  poolBeforeMitigation: number,
  manaCurrent: number,
  spellManaCost: number,
): number =>
  Math.min(poolBeforeMitigation, Math.max(manaCurrent - spellManaCost, 0))

/**
 * The climax pool: declared dice minus every uncontained Paradox success
 * (−1 die each, page 124). Zero or below rolls a chance die — `rollPool`'s
 * contract, not this leaf's.
 */
export const castPoolAfterParadox = (
  declaredPool: number,
  paradoxSuccesses: number,
  containedSuccesses: number,
): number => declaredPool - (paradoxSuccesses - containedSuccesses)

/**
 * The pool the cast roll actually throws (issue #45): the double shrink —
 * uncontained successes and the track's wound penalty — composed in one
 * place, so the containment preview and `rollCastDice` cannot drift.
 */
export const finalCastPool = (input: {
  declaredPool: number
  paradoxSuccesses: number
  contained: number
  woundPenalty: number
}): number =>
  castPoolAfterParadox(input.declaredPool, input.paradoxSuccesses, input.contained) +
  input.woundPenalty

/**
 * Dice eaten off the declared pool before the throw, read from any
 * (declaredPool, castPool) pair and clamped to the pool — never more ghosts
 * than dice exist. The containment preview's felt and the resolved record's
 * ghost row (#123) both derive from this one clamp, so the felt always shows
 * the whole declared pool.
 */
export const eatenDice = (declaredPool: number, castPool: number): number =>
  Math.min(declaredPool, Math.max(0, declaredPool - castPool))

/**
 * One stop on the containment slider, fully priced (issue #45): what the bet
 * costs and what pool survives it. Containment shrinks the cast pool twice —
 * each uncontained success is −1 die (p. 124), and the self-inflicted
 * Resistant bashing can push the track into wound-penalty territory, which
 * the cast roll also pays. A Schema (ADR-0017): a data shape, not a contract.
 */
export const ContainmentOutlook = Schema.Struct({
  /** Resistant bashing wounds this stop writes — one per contained success. */
  damage: Schema.Number,
  /** Paradox successes left to mar the cast and pick its severity. */
  uncontained: Schema.Number,
  /** The track's wound penalty before and after the containment lands (≤ 0). */
  penaltyBefore: Schema.Number,
  penaltyAfter: Schema.Number,
  /** The worsening this stop causes — the second shrink's price tag. */
  newPenalty: Schema.Number,
  /** Declared − uncontained + penaltyAfter; zero or below rolls a chance die. */
  castPool: Schema.Number,
  /** Dice the bet eats off the declared pool (uncontained Paradox plus the
   * new wound penalty), clamped to the pool — the felt ghosts exactly these. */
  eaten: Schema.Number,
  /** The stop fills the last box: the full-track unconsciousness rule looms. */
  martyr: Schema.Boolean,
})
export type ContainmentOutlook = typeof ContainmentOutlook.Type

export const containmentOutlook = (input: {
  track: HealthTrack
  declaredPool: number
  paradoxSuccesses: number
  contained: number
}): ContainmentOutlook => {
  const after = Arr.reduce(
    Arr.makeBy(input.contained, (i) => i),
    input.track,
    (track) => applyDamage(track, "bashing", { resistant: true }),
  )
  const penaltyBefore = woundPenalty(input.track)
  const penaltyAfter = woundPenalty(after)
  const uncontained = input.paradoxSuccesses - input.contained
  const castPool = finalCastPool({
    declaredPool: input.declaredPool,
    paradoxSuccesses: input.paradoxSuccesses,
    contained: input.contained,
    woundPenalty: penaltyAfter,
  })
  return {
    damage: input.contained,
    uncontained,
    penaltyBefore,
    penaltyAfter,
    newPenalty: penaltyAfter - penaltyBefore,
    castPool,
    eaten: eatenDice(input.declaredPool, castPool),
    martyr: input.contained > 0 && isIncapacitated(after),
  }
}

/**
 * The sheet stores Gnosis as 0–10 dots (representability, ADR-0011); the
 * Paradox table speaks rules-legal ranks 1–10. Clamp at the boundary — a
 * fudged Gnosis 0 sheet still gets a rank-1 Paradox pool rather than a crash.
 */
export const toGnosisRank = (gnosis: number): GnosisRank =>
  Math.min(10, Math.max(1, Math.round(gnosis))) as GnosisRank
