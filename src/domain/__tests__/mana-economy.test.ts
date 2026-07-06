import { Effect } from "effect"
import { Mana, Willpower } from "../quantities"
import { describe, expect, it } from "@effect/vitest"
import {
  manaPerTurnByGnosis,
  improvisedManaCost,
  patternRestoration,
  patternScouring,
  oblation,
  spendMana,
  startingMana,
} from "../mana-economy"

// --- Type-level guard (issue #35): quantities don't cross-fund ---
// The branding campaign's contract: a Willpower value cannot pay a Mana cost.
// @ts-expect-error — Willpower where Mana is expected is a compile error
const _quantityConfusion = spendMana(Mana.make(5), Willpower.make(3))
void _quantityConfusion

describe("Mana Economy", () => {
  it("mana per turn lookup by gnosis", () => {
    expect(manaPerTurnByGnosis(1)).toBe(1)
    expect(manaPerTurnByGnosis(5)).toBe(5)
    expect(manaPerTurnByGnosis(9)).toBe(10)
    expect(manaPerTurnByGnosis(10)).toBe(15)
  })

  it("non-ruling improvised spell costs 1 mana", () => {
    // Moros ruling: Matter, Death
    expect(improvisedManaCost("Moros", "death")).toBe(0)
    expect(improvisedManaCost("Moros", "matter")).toBe(0)
    expect(improvisedManaCost("Moros", "forces")).toBe(1)
    expect(improvisedManaCost("Moros", "mind")).toBe(1)
  })

  it("an unrecognized Path off the sheet rules nothing — cost 1", () => {
    expect(improvisedManaCost("Not A Path", "death")).toBe(1)
  })

  it("pattern restoration: 3 mana per wound healed, daily limit by gnosis", () => {
    const result = patternRestoration({ gnosis: 1 })
    expect(result.manaCostPerWound).toBe(3)
    expect(result.dailyLimit).toBe(1)

    const high = patternRestoration({ gnosis: 7 })
    expect(high.dailyLimit).toBe(3)
  })

  it("pattern scouring: sacrifice 1 attribute dot for 3 mana", () => {
    const result = patternScouring()
    expect(result.manaGained).toBe(3)
    expect(result.attributeDotsLost).toBe(1)
    expect(result.restorationTime).toBe("24 hours")
  })

  it("oblation: Gnosis + Composure at hallow, 1 mana per success", () => {
    const pool = oblation({ gnosis: 3, composure: 2, hallowRating: 4 })
    expect(pool.dicePool).toBe(5)
    expect(pool.maxManaPerDay).toBe(4)
  })

  it("starting mana equals wisdom", () => {
    expect(startingMana(7)).toBe(7)
    expect(startingMana(5)).toBe(5)
  })

  it.effect("spendMana deducts the cost and returns the remainder", () =>
    Effect.gen(function* () {
      expect(yield* spendMana(Mana.make(10), Mana.make(1))).toBe(9)
      expect(yield* spendMana(Mana.make(10), Mana.make(0))).toBe(10)
      expect(yield* spendMana(Mana.make(3), Mana.make(3))).toBe(0)
    }),
  )

  it.effect("spendMana fails InsufficientMana when the cost can't be paid", () =>
    Effect.gen(function* () {
      const error = yield* spendMana(Mana.make(2), Mana.make(3)).pipe(Effect.flip)
      expect(error._tag).toBe("InsufficientMana")
      expect(error.current).toBe(2)
      expect(error.required).toBe(3)

      const zero = yield* spendMana(Mana.make(0), Mana.make(1)).pipe(Effect.flip)
      expect(zero._tag).toBe("InsufficientMana")
    }),
  )
})
