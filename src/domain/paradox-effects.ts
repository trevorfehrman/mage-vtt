import { Match, Option, Schema } from "effect"
import { EXCEPTIONAL_THRESHOLD } from "./dice"
import { WisdomRank } from "./wisdom"

// Pure rules leaves (ADR-0014): plain functions; the duration tables are total
// over the Wisdom-rank vocabulary, so no lookup can miss.

// --- Paradox Duration by Wisdom (page 268) ---

/**
 * The Paradox severities that outlast the casting and so take a duration off
 * the Wisdom table. Havoc is not among them: a Havoc runs exactly as long as
 * the spell it hijacks (page 268).
 */
export const ParadoxDurationKind = Schema.Literals([
  "bedlam",
  "anomaly",
  "branding",
  "manifestation",
])
export type ParadoxDurationKind = typeof ParadoxDurationKind.Type

/**
 * How long a Paradox lasts, in the book's own units (page 268). A scene has
 * no clock, so the span is a closed vocabulary rather than a minute count —
 * the table before MAG-56 invented minutes the book never printed.
 */
export const ParadoxSpan = Schema.Literals([
  "scene",
  "twoHours",
  "twelveHours",
  "day",
  "twoDays",
  "week",
  "month",
])
export type ParadoxSpan = typeof ParadoxSpan.Type

const BEDLAM_SPAN: Record<WisdomRank, ParadoxSpan> = {
  10: "scene",
  9: "scene",
  8: "scene",
  7: "scene",
  6: "scene",
  5: "scene",
  4: "twoHours",
  3: "twelveHours",
  2: "day",
  1: "twoDays",
}

/** Anomaly, Branding and Manifestation share one column of the table. */
const LASTING_SPAN: Record<WisdomRank, ParadoxSpan> = {
  10: "scene",
  9: "scene",
  8: "scene",
  7: "scene",
  6: "scene",
  5: "scene",
  4: "day",
  3: "twoDays",
  2: "week",
  1: "month",
}

export const paradoxSpan = (kind: ParadoxDurationKind, wisdom: WisdomRank): ParadoxSpan =>
  Match.value(kind).pipe(
    Match.when("bedlam", () => BEDLAM_SPAN[wisdom]),
    Match.whenOr("anomaly", "branding", "manifestation", () => LASTING_SPAN[wisdom]),
    Match.exhaustive,
  )

/** The span as the book prints it: "one scene", "24 hours", "one month". */
export const spanWords = (span: ParadoxSpan): string =>
  Match.value(span).pipe(
    Match.when("scene", () => "one scene"),
    Match.when("twoHours", () => "two hours"),
    Match.when("twelveHours", () => "12 hours"),
    Match.when("day", () => "24 hours"),
    Match.when("twoDays", () => "two days"),
    Match.when("week", () => "one week"),
    Match.when("month", () => "one month"),
    Match.exhaustive,
  )

/**
 * The span as a clock reads it, in milliseconds — for a mark that must stamp
 * an expiry (a Bedlam derangement at Wisdom 4 and below, MAG-60). A scene
 * has no clock, so it is None: whatever is bound to it ends when the
 * Storyteller closes the Scene, not when a timer runs out. A month is the
 * book's "one month": thirty days.
 */
export const spanMillis = (span: ParadoxSpan): Option.Option<number> =>
  Match.value(span).pipe(
    Match.when("scene", () => Option.none()),
    Match.when("twoHours", () => Option.some(2 * HOUR)),
    Match.when("twelveHours", () => Option.some(12 * HOUR)),
    Match.when("day", () => Option.some(24 * HOUR)),
    Match.when("twoDays", () => Option.some(48 * HOUR)),
    Match.when("week", () => Option.some(7 * 24 * HOUR)),
    Match.when("month", () => Option.some(30 * 24 * HOUR)),
    Match.exhaustive,
  )

const HOUR = 60 * 60 * 1000

// --- Havoc: the Wisdom roll (page 268) ---

/**
 * What the caster's Wisdom roll does to a Havoc spell: a failure (dramatic
 * or plain) reverses its effect — a blessing curses, an attack heals; any
 * success leaves it as cast; an exceptional success also hands the mage +2
 * dice on any attempt to dispel it.
 */
export const HavocOutcome = Schema.Literals(["reversed", "unaltered", "unalteredDispelBonus"])
export type HavocOutcome = typeof HavocOutcome.Type

export const havocOutcome = (successes: number): HavocOutcome =>
  Match.value(successes).pipe(
    Match.when(
      (n) => n >= EXCEPTIONAL_THRESHOLD,
      () => "unalteredDispelBonus" as const,
    ),
    Match.when(
      (n) => n > 0,
      () => "unaltered" as const,
    ),
    Match.orElse(() => "reversed" as const),
  )

/** The outcome in the card's words: what the loose spell now does. */
export const havocWords = (outcome: HavocOutcome): string =>
  Match.value(outcome).pipe(
    Match.when("reversed", () => "reversed"),
    Match.when("unaltered", () => "runs true"),
    Match.when("unalteredDispelBonus", () => "runs true · +2 to dispel"),
    Match.exhaustive,
  )

// --- Branding severity by arcanum dots (pages 272-273) ---

const BRANDING_TABLE = [
  { minDots: 1, name: "Uncanny Nimbus", socialPenalty: 0 },
  { minDots: 2, name: "Witch's Mark", socialPenalty: 0 },
  { minDots: 3, name: "Disfigurement", socialPenalty: -1 },
  { minDots: 4, name: "Bestial Feature", socialPenalty: -3 },
  { minDots: 5, name: "Inhuman Feature", socialPenalty: -5 },
]

// --- Types ---

export class BacklashResult extends Schema.Class<BacklashResult>("BacklashResult")({
  resistantBashingDamage: Schema.Number.check(Schema.isInt()),
  paradoxContained: Schema.Boolean,
}) {}

export class BrandingInfo extends Schema.Class<BrandingInfo>("BrandingInfo")({
  name: Schema.String,
  socialPenalty: Schema.Number.check(Schema.isInt()),
  arcanumDots: Schema.Number.check(Schema.isInt()),
}) {}

// --- Public API ---

export const paradoxBacklash = (paradoxSuccesses: number): BacklashResult =>
  new BacklashResult({
    resistantBashingDamage: paradoxSuccesses,
    paradoxContained: true,
  })

export const brandingSeverity = (arcanumDots: number): BrandingInfo => {
  // Highest bracket at or below the dots; below 1 dot falls to the weakest brand.
  const entry =
    [...BRANDING_TABLE].reverse().find((e) => arcanumDots >= e.minDots) ??
    BRANDING_TABLE[0]

  return new BrandingInfo({
    name: entry.name,
    socialPenalty: entry.socialPenalty,
    arcanumDots,
  })
}

export const anomalyArea = (arcanumDots: number): number => arcanumDots * 20
