import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  calculateImprovisedPool,
  calculateRotePool,
  applySpellFactors,
} from "../spellcasting"

describe("Spellcasting", () => {
  it.effect("improvised spell pool = Gnosis + Arcanum", () =>
    Effect.gen(function* () {
      const pool = yield* calculateImprovisedPool({
        gnosis: 3,
        arcanumDots: 2,
      })

      expect(pool.baseDice).toBe(5) // 3 + 2
      expect(pool.method).toBe("improvised")
    }),
  )

  it.effect("rote spell pool = Attribute + Skill + Arcanum", () =>
    Effect.gen(function* () {
      const pool = yield* calculateRotePool({
        attributeDots: 3,
        skillDots: 2,
        arcanumDots: 4,
      })

      expect(pool.baseDice).toBe(9) // 3 + 2 + 4
      expect(pool.method).toBe("rote")
    }),
  )

  it.effect("high speech adds +2 to casting pool", () =>
    Effect.gen(function* () {
      const pool = yield* calculateImprovisedPool({
        gnosis: 2,
        arcanumDots: 3,
        highSpeech: true,
      })

      expect(pool.baseDice).toBe(5) // 2 + 3
      expect(pool.bonuses).toContainEqual({ source: "High Speech", dice: 2 })
      expect(pool.totalDice).toBe(7) // 5 + 2
    }),
  )

  it.effect("spell factor penalties reduce the pool", () =>
    Effect.gen(function* () {
      const base = yield* calculateImprovisedPool({
        gnosis: 3,
        arcanumDots: 3,
      })

      // Increase potency to 2 (-2), target two people (-2)
      const modified = yield* applySpellFactors(base, {
        potency: 2,
        targets: 2,
      })

      expect(modified.factorPenalty).toBe(-4) // -2 potency + -2 targets
      expect(modified.totalDice).toBe(2) // 6 base - 4 penalty
    }),
  )

  it.effect("sympathetic casting adds connection penalty and costs 1 mana", () =>
    Effect.gen(function* () {
      const pool = yield* calculateImprovisedPool({
        gnosis: 3,
        arcanumDots: 3,
        sympatheticConnection: "known",
      })

      expect(pool.penalties).toContainEqual({ source: "Sympathetic (Known)", dice: -4 })
      expect(pool.isVulgar).toBe(true) // sympathetic is always vulgar
      expect(pool.manaCost).toBeGreaterThanOrEqual(1)
    }),
  )
})
