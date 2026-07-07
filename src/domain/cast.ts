import { Array as Arr, Order, Schema } from "effect"
import type { HealthTrack } from "./damage"
import { CastId, CharacterId, PlayerId, SceneId, SessionId } from "./ids"
import type { GnosisRank } from "./mana-economy"
import { ParadoxPoolModifier, ParadoxSeverity } from "./paradox"

/**
 * The Cast (issue #43, PRD #39, ADR-0016): a declared Vulgar spellcasting
 * walking its status ladder as a first-class document — the single source of
 * truth for the caster/Storyteller handshake. One Convex mutation per dramatic
 * beat; the client XState machine is a projection of this document, never an
 * owner of pending state.
 *
 * The ladder:
 *
 *   draft → engaged → liabilitiesLocked → intentionLocked (point of no return)
 *         → paradoxRolled → contained → resolved
 *   terminals: cancelled (free, pre-commitment), voided (ST repair, any stage)
 *
 * `contained` means the containment beat is *behind* the Cast — a zero-success
 * Paradox roll skips straight there (no empty ceremony), so the climax cast
 * roll always launches from `contained`.
 */

export const CastStatus = Schema.Literals([
  "draft",
  "engaged",
  "liabilitiesLocked",
  "intentionLocked",
  "paradoxRolled",
  "contained",
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
 * On stage (CONTEXT.md): engaged through contained — the at-most-one Cast
 * holding the table's attention. Drafts queue in the wings; terminals free it.
 */
export const isOnStage = (status: CastStatus): boolean =>
  isUnresolved(status) && status !== "draft"

/**
 * Past the point of no return: the caster's Mana (mitigation + spell cost) is
 * committed and the only exits are playing the Cast out or an ST void.
 */
export const isCommitted = (status: CastStatus): boolean =>
  status === "intentionLocked" || status === "paradoxRolled" || status === "contained"

/** Whose button the table is waiting on; null once the Cast is terminal. */
export const waitingOn = (status: CastStatus): "storyteller" | "caster" | null => {
  switch (status) {
    case "draft": // in the wings — the ST engages (or declines)
    case "engaged": // negotiation — the ST locks liabilities
    case "intentionLocked": // the ST's own Paradox-roll button
      return "storyteller"
    case "liabilitiesLocked": // the caster's point-of-no-return lock
    case "paradoxRolled": // the caster's containment choice
    case "contained": // the caster's climax cast-roll button
      return "caster"
    default:
      return null
  }
}

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
  // Declaration (the draft beat)
  arcanum: Schema.String,
  level: Schema.Number,
  intent: Schema.optionalKey(Schema.String),
  usesMagicalTool: Schema.Boolean,
  declaredComponents: Schema.Array(
    Schema.Struct({ type: Schema.String, name: Schema.String, dots: Schema.Number }),
  ),
  declaredPool: Schema.Number,
  spellManaCost: Schema.Number,
  // The stage (the engage beat) — liability defaults frozen off the table,
  // then live under the ST's negotiation buttons until liabilities lock
  // (issue #44). `witnessCount` supersedes the boolean (kept for rows written
  // before the count existed); `discretionaryModifiers` are ST judgment calls.
  sceneId: Schema.optionalKey(SceneId),
  gnosis: Schema.optionalKey(Schema.Number),
  sleeperWitnesses: Schema.optionalKey(Schema.Boolean),
  witnessCount: Schema.optionalKey(Schema.Number),
  priorParadoxRolls: Schema.optionalKey(Schema.Number),
  discretionaryModifiers: Schema.optionalKey(Schema.Array(ParadoxPoolModifier)),
  // Commitment (the caster's lock)
  manaMitigation: Schema.optionalKey(Schema.Number),
  // The Paradox roll
  paradoxSuccesses: Schema.optionalKey(Schema.Number),
  paradoxIsDramaticFailure: Schema.optionalKey(Schema.Boolean),
  // Containment
  containedSuccesses: Schema.optionalKey(Schema.Number),
  // The cast roll and resolution
  castPool: Schema.optionalKey(Schema.Number),
  castSuccesses: Schema.optionalKey(Schema.Number),
  severity: Schema.optionalKey(ParadoxSeverity),
  updatedAt: Schema.Number,
}) {}

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
 * The witness count a Cast's pool reads (issue #44): rows written before the
 * count existed carry only the Scene toggle's boolean — "one or more" is 1.
 */
export const effectiveWitnessCount = (cast: {
  readonly witnessCount?: number | undefined
  readonly sleeperWitnesses?: boolean | undefined
}): number => cast.witnessCount ?? (cast.sleeperWitnesses ? 1 : 0)

/** One caster's standing on the strip: who, and how hard they're pushing. */
export interface ScenePip {
  readonly characterId: string
  readonly casterName: string
  readonly accumulator: number
}

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
 * The sheet stores Gnosis as 0–10 dots (representability, ADR-0011); the
 * Paradox table speaks rules-legal ranks 1–10. Clamp at the boundary — a
 * fudged Gnosis 0 sheet still gets a rank-1 Paradox pool rather than a crash.
 */
export const toGnosisRank = (gnosis: number): GnosisRank =>
  Math.min(10, Math.max(1, Math.round(gnosis))) as GnosisRank
