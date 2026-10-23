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

import type { ParadoxPoolModifier } from "#/domain/paradox"

const EBB = "var(--accent)"
const FLOOD = "var(--paradox)"

/** Verdigris sinks into the void faster than the red: at equal alpha the
 * green side reads half as loud, so its alpha is boosted. */
const EBB_BOOST = 1.7

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const mix = (ink: string, pct: number) => `color-mix(in srgb, ${ink} ${pct}%, transparent)`
const mixSide = (ink: string, pct: number) =>
  mix(ink, ink === EBB ? Math.min(pct * EBB_BOOST, 40) : pct)

/** The weather summed: ebb and flood weights (both ≥ 0) and the net. */
export const tidesWeight = (
  mods: ReadonlyArray<ParadoxPoolModifier>,
): { ebb: number; flood: number; net: number } => {
  const ebb = mods.filter((m) => m.dice < 0).reduce((s, m) => s + Math.abs(m.dice), 0)
  const flood = mods.filter((m) => m.dice > 0).reduce((s, m) => s + m.dice, 0)
  return { ebb, flood, net: flood - ebb }
}

/** The box's CSS background, or undefined when there is no weather. */
export const tidesGround = (mods: ReadonlyArray<ParadoxPoolModifier>): string | undefined => {
  const { ebb, flood, net } = tidesWeight(mods)
  if (ebb === 0 && flood === 0) return undefined
  const x = clamp(50 - net * 9, 4, 96)
  const aE = ebb === 0 ? 0 : clamp(8 + ebb * 3.5, 8, 22)
  const aF = flood === 0 ? 0 : clamp(8 + flood * 3.5, 8, 22)
  return [
    // the tilt: green's weight lives mostly in a wash from the top-left
    // corner, red's in one from the bottom-right, both stopping short of
    // the seam
    ...(ebb > 0
      ? [`linear-gradient(150deg, ${mixSide(EBB, aE * 1.1)} 0%, ${mixSide(EBB, aE * 0.45)} 34%, transparent 60%)`]
      : []),
    ...(flood > 0 ? [`linear-gradient(330deg, ${mixSide(FLOOD, aF * 0.9)} 0%, transparent 54%)`] : []),
    // the base: green's edge lightened so the wash carries it, red owning
    // its whole floor, a dead band of seven percent either side of the seam
    `linear-gradient(90deg, ${mixSide(EBB, aE * 0.5)} 0%, transparent ${clamp(x - 7, 0, 100)}%, transparent ${clamp(x + 7, 0, 100)}%, ${mixSide(FLOOD, aF)} 100%)`,
  ].join(", ")
}

/** A pill's edge: its side's ink, pulled well toward the line. */
export const tidesPillEdge = (dice: number): string =>
  `color-mix(in srgb, ${dice < 0 ? EBB : FLOOD} 45%, var(--line))`

/** The net's ink for the eyebrow: dim at zero, else its side's full ink. */
export const tidesNetInk = (net: number): string =>
  net === 0 ? "var(--dim)" : net < 0 ? EBB : FLOOD

export const signedDice = (dice: number): string =>
  dice < 0 ? `−${Math.abs(dice)}` : `+${dice}`
