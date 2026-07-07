/**
 * The probability leaf (issue #45, PRD #39): exact success odds for World of
 * Darkness pools, computed closed-form or by convolution — never simulated.
 * Seed-free plain functions (ADR-0014): the betting previews (mitigation and
 * containment dialogs) read these to make the caster's wager an informed one,
 * against the same die-face rules `dice.ts` rolls with — success on 8+ with
 * 10-again on a standard pool; a chance die (zero or fewer dice) succeeds on
 * 10 only and never explodes.
 */

import { Array as Arr, Schema } from "effect"

/** P(a single standard die scores no success): 7 failing faces in 10. */
const DIE_FAILURE = 0.7

/** The chance die: success on 10 only, dramatic failure on 1 — 1 face each. */
const CHANCE_DIE_SUCCESS = 0.1
const CHANCE_DIE_DRAMATIC_FAILURE = 0.1

/** Zero or fewer dice roll the chance die — `rollPool`'s contract. */
export const isChanceDiePool = (dice: number): boolean => dice <= 0

/**
 * P(at least one success). Explosions can only add to an existing success,
 * so the closed form 1 − 0.7^N is exact for any standard pool.
 */
export const probabilityOfSuccess = (dice: number): number =>
  isChanceDiePool(dice) ? CHANCE_DIE_SUCCESS : 1 - DIE_FAILURE ** dice

/**
 * Expected successes. A standard die scores 0.3 per throw and every 10
 * (p = 0.1) throws again, so one die expects 0.3 / 0.9 = ⅓ — linearity gives
 * N/3 for the pool. The chance die expects its single success face's 0.1.
 */
export const expectedSuccesses = (dice: number): number =>
  isChanceDiePool(dice) ? CHANCE_DIE_SUCCESS : dice / 3

/**
 * One standard die's success-count distribution, exact: P(0) = 0.7, and
 * exactly k ≥ 1 successes is k−1 chained tens then an 8/9 stop, or k tens
 * then a miss — 0.1^(k−1)·0.2 + 0.1^k·0.7 = 0.27·0.1^(k−1). The geometric
 * tail is cut where it falls below any representable share (0.1^30 ≈ 1e-31).
 */
const SINGLE_DIE_CUTOFF = 30
const singleDie: ReadonlyArray<number> = [
  DIE_FAILURE,
  ...Arr.makeBy(SINGLE_DIE_CUTOFF, (k) => 0.27 * 0.1 ** k),
]

/** Mass below this is display-invisible; trimming it keeps arrays short. */
const NEGLIGIBLE = 1e-12

const convolve = (
  a: ReadonlyArray<number>,
  b: ReadonlyArray<number>,
): ReadonlyArray<number> =>
  Arr.makeBy(a.length + b.length - 1, (k) =>
    a.reduce((sum, p, i) => sum + p * (b[k - i] ?? 0), 0),
  )

// Drop the run of negligible entries at the distribution's high end (counted
// off the reversed copy), always keeping at least the zero-successes bucket.
const trimTail = (dist: ReadonlyArray<number>): ReadonlyArray<number> =>
  Arr.dropRight(
    dist,
    Math.min(
      dist.length - 1,
      Arr.takeWhile([...dist].reverse(), (p) => p < NEGLIGIBLE).length,
    ),
  )

/**
 * The pool's full success-count distribution — index k is P(exactly k) — by
 * convolving independent dice. The chance die's is closed-form: it cannot
 * explode, so one success face is the whole story.
 */
export const successDistribution = (dice: number): ReadonlyArray<number> =>
  isChanceDiePool(dice)
    ? [1 - CHANCE_DIE_SUCCESS, CHANCE_DIE_SUCCESS]
    : trimTail(
        Arr.makeBy(dice, () => singleDie).reduce(convolve, [1] as ReadonlyArray<number>),
      )

/** Five successes is exceptional — `dice.ts`'s threshold. */
const EXCEPTIONAL_THRESHOLD = 5

/** P(exceptional success): the distribution's tail from five up. The chance
 * die tops out at one success, so its odds are exactly zero. */
export const probabilityOfExceptional = (dice: number): number =>
  successDistribution(dice)
    .slice(EXCEPTIONAL_THRESHOLD)
    .reduce((sum, p) => sum + p, 0)

/** Only a chance die showing 1 is the dramatic failure — 1 face in 10. */
export const probabilityOfDramaticFailure = (dice: number): number =>
  isChanceDiePool(dice) ? CHANCE_DIE_DRAMATIC_FAILURE : 0

/** The composite readout a betting dialog renders for one candidate pool. */
export const RollOdds = Schema.Struct({
  isChanceDie: Schema.Boolean,
  /** P(at least one success) — the number the bet hangs on. */
  success: Schema.Number,
  /** P(five or more successes). */
  exceptional: Schema.Number,
  /** P(the chance die's dramatic failure); zero on a standard pool. */
  dramaticFailure: Schema.Number,
  /** Expected successes. */
  expected: Schema.Number,
})
export type RollOdds = typeof RollOdds.Type

export const rollOdds = (dice: number): RollOdds => ({
  isChanceDie: isChanceDiePool(dice),
  success: probabilityOfSuccess(dice),
  exceptional: probabilityOfExceptional(dice),
  dramaticFailure: probabilityOfDramaticFailure(dice),
  expected: expectedSuccesses(dice),
})
