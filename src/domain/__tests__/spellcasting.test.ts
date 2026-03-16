import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  calculateImprovisedPool,
  calculateRotePool,
  applySpellFactors,
  calculateAimedSpellRange,
  calculateDurationPenalty,
  calculateSizePenalty,
  calculateAreaPenalty,
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

  it.effect("duration penalty: extending transitory beyond 1 turn", () =>
    Effect.gen(function* () {
      // Transitory default is 1 turn, each step doubles
      expect(yield* calculateDurationPenalty("transitory", 1)).toBe(0)   // 1 turn default
      expect(yield* calculateDurationPenalty("transitory", 2)).toBe(-2)  // 2 turns
      expect(yield* calculateDurationPenalty("transitory", 3)).toBe(-4)  // 3 minutes
      // Prolonged default is 1 scene, each step extends
      expect(yield* calculateDurationPenalty("prolonged", 1)).toBe(0)    // 1 scene default
      expect(yield* calculateDurationPenalty("prolonged", 2)).toBe(-2)   // 24 hours
      expect(yield* calculateDurationPenalty("prolonged", 3)).toBe(-4)   // 2 days
      expect(yield* calculateDurationPenalty("prolonged", 4)).toBe(-6)   // 1 week
      expect(yield* calculateDurationPenalty("prolonged", 5)).toBe(-8)   // 1 month
      expect(yield* calculateDurationPenalty("prolonged", 6)).toBe(-10)  // indefinite
    }),
  )

  it.effect("size penalty for large targets", () =>
    Effect.gen(function* () {
      expect(yield* calculateSizePenalty(15)).toBe(0)   // ≤20 no penalty
      expect(yield* calculateSizePenalty(20)).toBe(0)
      expect(yield* calculateSizePenalty(25)).toBe(-2)  // 21-30
      expect(yield* calculateSizePenalty(35)).toBe(-4)  // 31-40
      expect(yield* calculateSizePenalty(55)).toBe(-8)  // 51-60
    }),
  )

  it.effect("area-affecting penalty for radius", () =>
    Effect.gen(function* () {
      // Basic table (no advanced arcanum)
      expect(yield* calculateAreaPenalty(1, false)).toBe(0)    // 1-yard radius
      expect(yield* calculateAreaPenalty(2, false)).toBe(-2)   // 2-yard
      expect(yield* calculateAreaPenalty(4, false)).toBe(-4)   // 4-yard
      expect(yield* calculateAreaPenalty(8, false)).toBe(-6)   // 8-yard
      expect(yield* calculateAreaPenalty(16, false)).toBe(-8)  // 16-yard

      // Advanced table (caster has +1 arcanum dot)
      expect(yield* calculateAreaPenalty(4, true)).toBe(-2)    // 4-yard advanced
      expect(yield* calculateAreaPenalty(16, true)).toBe(-4)   // 16-yard advanced
      expect(yield* calculateAreaPenalty(64, true)).toBe(-6)   // 64-yard advanced
    }),
  )

  it.effect("aimed spell range from gnosis", () =>
    Effect.gen(function* () {
      const range = yield* calculateAimedSpellRange(3)

      // Short = Gnosis × 10, Medium = 2×short, Long = 2×medium
      expect(range.short).toBe(30)
      expect(range.medium).toBe(60)
      expect(range.long).toBe(120)
    }),
  )
})
