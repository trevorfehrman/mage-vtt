import { describe, expect, it } from "@effect/vitest"
import {
  canCounterspell,
  calculateCounterspellPool,
  resolveDispel,
} from "../counterspell"

describe("Counterspell & Dispel", () => {
  it("can counterspell with matching arcanum", () => {
    const result = canCounterspell({
      casterArcana: { death: 3, matter: 2 },
      targetSpellArcanum: "death",
    })

    expect(result.canCounter).toBe(true)
    expect(result.arcanumUsed).toBe("death")
  })

  it("can counterspell any spell with Prime", () => {
    const result = canCounterspell({
      casterArcana: { prime: 2 },
      targetSpellArcanum: "forces",
    })

    expect(result.canCounter).toBe(true)
    expect(result.arcanumUsed).toBe("prime")
  })

  it("cannot counterspell without matching arcanum or prime", () => {
    const result = canCounterspell({
      casterArcana: { death: 3, matter: 2 },
      targetSpellArcanum: "forces",
    })

    expect(result.canCounter).toBe(false)
  })

  it("counterspell pool = Gnosis + Arcanum", () => {
    const pool = calculateCounterspellPool({
      gnosis: 3,
      arcanumDots: 2,
    })

    expect(pool.totalDice).toBe(5)
  })

  it("dispel succeeds when successes >= target spell potency", () => {
    const success = resolveDispel({
      dispelSuccesses: 3,
      targetPotency: 2,
    })
    expect(success.dispelled).toBe(true)

    const fail = resolveDispel({
      dispelSuccesses: 1,
      targetPotency: 3,
    })
    expect(fail.dispelled).toBe(false)
  })
})
