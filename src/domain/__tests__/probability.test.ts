import { describe, expect, it } from "@effect/vitest"
import {
  expectedSuccesses,
  probabilityOfDramaticFailure,
  probabilityOfExceptional,
  probabilityOfSuccess,
  rollOdds,
  successDistribution,
} from "../probability"

/**
 * Pure-leaf tests for the probability module (issue #45): exact, seed-free
 * values for World of Darkness pools — closed-form or convolved, never
 * simulated. Expected values are hand-derived from the dice rules (success on
 * 8+, 10-again; chance die succeeds on 10 only), not recomputed from the code.
 */

describe("probabilityOfSuccess (P of at least one success)", () => {
  it("is 1 − 0.7^N for a standard pool", () => {
    // One die: 3 success faces in 10. Three dice: 1 − 0.343.
    expect(probabilityOfSuccess(1)).toBeCloseTo(0.3, 12)
    expect(probabilityOfSuccess(3)).toBeCloseTo(0.657, 12)
    expect(probabilityOfSuccess(8)).toBeCloseTo(1 - 0.05764801, 12)
  })

  it("is exactly 0.1 on the chance die — success on 10 only", () => {
    expect(probabilityOfSuccess(0)).toBe(0.1)
    // Below-zero pools are the same chance die (rollPool's contract).
    expect(probabilityOfSuccess(-3)).toBe(0.1)
  })
})

describe("expectedSuccesses", () => {
  it("is one third per die with 10-again", () => {
    // Per die: 0.3 successes per throw, and each 10 (0.1) throws again —
    // 0.3 / 0.9 = ⅓ exactly. Six dice expect 2 successes.
    expect(expectedSuccesses(1)).toBeCloseTo(1 / 3, 12)
    expect(expectedSuccesses(6)).toBeCloseTo(2, 12)
  })

  it("is 0.1 on the chance die — one success face, no explosion", () => {
    expect(expectedSuccesses(0)).toBe(0.1)
    expect(expectedSuccesses(-2)).toBe(0.1)
  })
})

describe("successDistribution (exact, convolved)", () => {
  it("matches the hand-derived single-die chain with 10-again", () => {
    // One die: fail 0.7; exactly k ≥ 1 successes is k−1 tens then an 8/9, or
    // k tens then a miss — 0.1^(k−1)·0.2 + 0.1^k·0.7 = 0.27·0.1^(k−1).
    const one = successDistribution(1)
    expect(one[0]).toBeCloseTo(0.7, 12)
    expect(one[1]).toBeCloseTo(0.27, 12)
    expect(one[2]).toBeCloseTo(0.027, 12)
    expect(one[3]).toBeCloseTo(0.0027, 12)
  })

  it("convolves independent dice — the two-die values by hand", () => {
    const two = successDistribution(2)
    expect(two[0]).toBeCloseTo(0.49, 12) // 0.7²
    expect(two[1]).toBeCloseTo(0.378, 12) // 2 · 0.7 · 0.27
    expect(two[2]).toBeCloseTo(0.1107, 12) // 0.27² + 2 · 0.7 · 0.027
  })

  it("is a probability distribution: sums to 1", () => {
    const total = successDistribution(8).reduce((s, p) => s + p, 0)
    expect(total).toBeCloseTo(1, 9)
  })

  it("the chance die: 0.9 nothing, 0.1 one success — never more", () => {
    expect(successDistribution(0)).toEqual([0.9, 0.1])
    expect(successDistribution(-1)).toEqual([0.9, 0.1])
  })
})

describe("probabilityOfExceptional (5+ successes)", () => {
  it("one die needs a chain of four tens: 0.27 · 0.1⁴ / 0.9", () => {
    expect(probabilityOfExceptional(1)).toBeCloseTo(0.00003, 12)
  })

  it("grows with the pool and is impossible on the chance die", () => {
    expect(probabilityOfExceptional(0)).toBe(0)
    expect(probabilityOfExceptional(10)).toBeGreaterThan(
      probabilityOfExceptional(5),
    )
  })
})

describe("probabilityOfDramaticFailure", () => {
  it("is the chance die's 1-in-10; a standard pool cannot roll one", () => {
    expect(probabilityOfDramaticFailure(0)).toBe(0.1)
    expect(probabilityOfDramaticFailure(-2)).toBe(0.1)
    expect(probabilityOfDramaticFailure(4)).toBe(0)
  })
})

describe("rollOdds (the composite readout the dialogs render)", () => {
  it("bundles a standard pool's numbers", () => {
    const odds = rollOdds(3)
    expect(odds.isChanceDie).toBe(false)
    expect(odds.success).toBeCloseTo(0.657, 12)
    expect(odds.expected).toBeCloseTo(1, 12)
    expect(odds.dramaticFailure).toBe(0)
  })

  it("a zero-or-below pool reads as the chance die", () => {
    const odds = rollOdds(-1)
    expect(odds.isChanceDie).toBe(true)
    expect(odds.success).toBe(0.1)
    expect(odds.exceptional).toBe(0)
    expect(odds.dramaticFailure).toBe(0.1)
  })
})
