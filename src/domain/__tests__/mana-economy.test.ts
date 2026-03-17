import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  manaPerTurnByGnosis,
  isRulingArcanum,
  improvisedManaCost,
  patternRestoration,
  patternScouring,
  oblation,
  startingMana,
} from "../mana-economy"

describe("Mana Economy", () => {
  it.effect("mana per turn lookup by gnosis", () =>
    Effect.gen(function* () {
      expect(yield* manaPerTurnByGnosis(1)).toBe(1)
      expect(yield* manaPerTurnByGnosis(5)).toBe(5)
      expect(yield* manaPerTurnByGnosis(9)).toBe(10)
      expect(yield* manaPerTurnByGnosis(10)).toBe(15)
    }),
  )

  it.effect("non-ruling improvised spell costs 1 mana", () =>
    Effect.gen(function* () {
      // Moros ruling: Matter, Death
      expect(yield* improvisedManaCost("Moros", "death")).toBe(0)
      expect(yield* improvisedManaCost("Moros", "matter")).toBe(0)
      expect(yield* improvisedManaCost("Moros", "forces")).toBe(1)
      expect(yield* improvisedManaCost("Moros", "mind")).toBe(1)
    }),
  )

  it.effect("pattern restoration: 3 mana per wound healed, daily limit by gnosis", () =>
    Effect.gen(function* () {
      const result = yield* patternRestoration({ gnosis: 1 })
      expect(result.manaCostPerWound).toBe(3)
      expect(result.dailyLimit).toBe(1)

      const high = yield* patternRestoration({ gnosis: 7 })
      expect(high.dailyLimit).toBe(3)
    }),
  )

  it.effect("pattern scouring: sacrifice 1 attribute dot for 3 mana", () =>
    Effect.gen(function* () {
      const result = yield* patternScouring()
      expect(result.manaGained).toBe(3)
      expect(result.attributeDotsLost).toBe(1)
      expect(result.restorationTime).toBe("24 hours")
    }),
  )

  it.effect("oblation: Gnosis + Composure at hallow, 1 mana per success", () =>
    Effect.gen(function* () {
      const pool = yield* oblation({ gnosis: 3, composure: 2, hallowRating: 4 })
      expect(pool.dicePool).toBe(5)
      expect(pool.maxManaPerDay).toBe(4)
    }),
  )

  it.effect("starting mana equals wisdom", () =>
    Effect.gen(function* () {
      expect(yield* startingMana(7)).toBe(7)
      expect(yield* startingMana(5)).toBe(5)
    }),
  )
})
