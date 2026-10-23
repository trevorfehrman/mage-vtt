/**
 * The Tides box's mood (MAG-44, the owner's 2026-10-22 audition at
 * /prototype/tides-audition, treatment H): the ST's named circumstances
 * summed into a ground the player reads before a single pill. Pure half
 * (ADR-0014): plain functions from modifiers to CSS, no React.
 *
 * Doctrine: the tide is reality's. A flood is the world rushing in — red,
 * the Paradox area's ink — and an ebb is the world drawing back to show the
 * mage's own ground — verdigris, the felt's ink. Green owns the LEFT edge
 * and red the RIGHT, always; the net slides the seam between them; each
 * side's alpha is its own weight. A tilt leans green into the top-left and
 * red into the bottom-right, so green's column is a wedge thinning toward
 * the floor, never a bar. A dead band either side of the seam keeps the two
 * inks from mixing into brown: they go dark before they meet.
 */

import { Schema } from "effect"
import type { ParadoxPoolModifier } from "#/domain/paradox"

const EBB = "var(--accent)"
const FLOOD = "var(--paradox)"

/** Verdigris sinks into the void faster than the red: at equal alpha the
 * green side reads half as loud, so its alpha is boosted. */
const EBB_BOOST = 1.7

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const mix = (ink: string, pct: number) => `color-mix(in srgb, ${ink} ${pct}%, transparent)`
/** A side at zero weight paints nothing — never its ink at 0%. */
const mixSide = (ink: string, pct: number) =>
  pct <= 0 ? "transparent" : mix(ink, ink === EBB ? Math.min(pct * EBB_BOOST, 40) : pct)

/** The weather summed: ebb and flood weights (both ≥ 0) and the net. */
export const TidesWeight = Schema.Struct({
  ebb: Schema.Number,
  flood: Schema.Number,
  net: Schema.Number,
})
export type TidesWeight = typeof TidesWeight.Type

export const tidesWeight = (mods: ReadonlyArray<ParadoxPoolModifier>): TidesWeight => {
  const ebb = mods.filter((m) => m.dice < 0).reduce((s, m) => s + Math.abs(m.dice), 0)
  const flood = mods.filter((m) => m.dice > 0).reduce((s, m) => s + m.dice, 0)
  return { ebb, flood, net: flood - ebb }
}

/**
 * The ground's numbers, before any CSS: where the seam sits (percent of the
 * box's width, from the left; clamped so neither edge is ever reached) and
 * each side's alpha (percent; zero when the side has no weight).
 */
export const TidesSeam = Schema.Struct({
  seam: Schema.Number,
  ebbAlpha: Schema.Number,
  floodAlpha: Schema.Number,
})
export type TidesSeam = typeof TidesSeam.Type

export const tidesSeam = (mods: ReadonlyArray<ParadoxPoolModifier>): TidesSeam => {
  const { ebb, flood, net } = tidesWeight(mods)
  return {
    seam: clamp(50 - net * 9, 4, 96),
    ebbAlpha: ebb === 0 ? 0 : clamp(8 + ebb * 3.5, 8, 22),
    floodAlpha: flood === 0 ? 0 : clamp(8 + flood * 3.5, 8, 22),
  }
}

/** The box's CSS background, or undefined when there is no weather. */
export const tidesGround = (mods: ReadonlyArray<ParadoxPoolModifier>): string | undefined => {
  const { seam, ebbAlpha, floodAlpha } = tidesSeam(mods)
  if (ebbAlpha === 0 && floodAlpha === 0) return undefined
  return [
    // the tilt: green's weight lives mostly in a wash from the top-left
    // corner, red's in one from the bottom-right, both stopping short of
    // the seam
    ...(ebbAlpha > 0
      ? [`linear-gradient(150deg, ${mixSide(EBB, ebbAlpha * 1.1)} 0%, ${mixSide(EBB, ebbAlpha * 0.45)} 34%, transparent 60%)`]
      : []),
    ...(floodAlpha > 0
      ? [`linear-gradient(330deg, ${mixSide(FLOOD, floodAlpha * 0.9)} 0%, transparent 54%)`]
      : []),
    // the base: green's edge lightened so the wash carries it, red owning
    // its whole floor, a dead band of seven percent either side of the seam
    `linear-gradient(90deg, ${mixSide(EBB, ebbAlpha * 0.5)} 0%, transparent ${clamp(seam - 7, 0, 100)}%, transparent ${clamp(seam + 7, 0, 100)}%, ${mixSide(FLOOD, floodAlpha)} 100%)`,
  ].join(", ")
}

/** A pill's edge: its side's ink, pulled well toward the line. */
export const tidesPillEdge = (dice: number): string =>
  `color-mix(in srgb, ${dice < 0 ? EBB : FLOOD} 45%, var(--line))`

/** The net's ink for the eyebrow: dim at zero, else its side's full ink. */
export const tidesNetInk = (net: number): string =>
  net === 0 ? "var(--dim)" : net < 0 ? EBB : FLOOD

/** A true minus, a plus, and a bare zero. */
export const signedDice = (dice: number): string =>
  dice < 0 ? `−${Math.abs(dice)}` : dice > 0 ? `+${dice}` : "0"

/** The two shores a tide lands on: an ebb takes Paradox dice, a flood adds them. */
export const Shore = Schema.Literals(["ebb", "flood"])
export type Shore = typeof Shore.Type

/** Everything that differs between the shores, in one closed table. */
const ShoreSpec = Schema.Struct({
  /** The sign the shore gives a tide's count. */
  sign: Schema.Literals([-1, 1]),
  /** The number cell sits outboard, toward the shore's own edge — first on the left shore, last on the right. */
  numberFirst: Schema.Boolean,
  /** The tooltip's prefix before the count. */
  says: Schema.String,
  /** The skeleton pill's invitation. */
  invite: Schema.String,
  /** The draft pill's number cell. */
  countTitle: Schema.String,
})
type ShoreSpec = typeof ShoreSpec.Type

export const SHORE: Record<Shore, ShoreSpec> = {
  ebb: {
    sign: -1,
    numberFirst: true,
    says: "Ebb · −",
    invite: "Name an ebb — the Tides pull back: fewer Paradox dice",
    countTitle: "Dice the ebb takes",
  },
  flood: {
    sign: 1,
    numberFirst: false,
    says: "Flood · +",
    invite: "Name a flood — the Tides rise: more Paradox dice",
    countTitle: "Dice the flood adds",
  },
}

/** The most a draft tide swings — the swing a single ruling plausibly reaches
 * (issue #44); a wilder swing is several named rulings, each readable. */
export const TIDE_COUNT_MAX = 10

/** A draft tide's count: 1..TIDE_COUNT_MAX dice, unsigned — the shore signs it. */
export const TideCount = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 1, maximum: TIDE_COUNT_MAX }),
).pipe(Schema.brand("TideCount"))
export type TideCount = typeof TideCount.Type

/** The ST's draft tide (MAG-45): the shore it opens on, its prose, its count. */
export const TideDraft = Schema.Struct({ side: Shore, source: Schema.String, count: TideCount })
export type TideDraft = typeof TideDraft.Type

/** The dice a draft lands as: its count, signed by its shore. */
export const tideDraftDice = (d: TideDraft): number => SHORE[d.side].sign * d.count

/** One step of the draft's count, held within 1..TIDE_COUNT_MAX. */
export const stepTideCount = (count: TideCount, dir: 1 | -1): TideCount =>
  TideCount.make(clamp(count + dir, 1, TIDE_COUNT_MAX))
