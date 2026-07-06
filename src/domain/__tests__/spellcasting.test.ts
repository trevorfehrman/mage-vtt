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
  it("improvised spell pool = Gnosis + Arcanum", () => {
    const pool = calculateImprovisedPool({
      gnosis: 3,
      arcanumDots: 2,
    })

    expect(pool.baseDice).toBe(5) // 3 + 2
    expect(pool.method).toBe("improvised")
  })

  it("rote spell pool = Attribute + Skill + Arcanum", () => {
    const pool = calculateRotePool({
      attributeDots: 3,
      skillDots: 2,
      arcanumDots: 4,
    })

    expect(pool.baseDice).toBe(9) // 3 + 2 + 4
    expect(pool.method).toBe("rote")
  })

  it("a willpower spend adds +3 to a rote pool (issue #18)", () => {
    const pool = calculateRotePool({
      attributeDots: 2,
      skillDots: 4,
      arcanumDots: 3,
      willpower: true,
    })

    expect(pool.baseDice).toBe(9)
    expect(pool.bonuses).toContainEqual({ source: "Willpower", dice: 3 })
    expect(pool.totalDice).toBe(12)
  })

  it("high speech adds +2 to casting pool", () => {
    const pool = calculateImprovisedPool({
      gnosis: 2,
      arcanumDots: 3,
      highSpeech: true,
    })

    expect(pool.baseDice).toBe(5) // 2 + 3
    expect(pool.bonuses).toContainEqual({ source: "High Speech", dice: 2 })
    expect(pool.totalDice).toBe(7) // 5 + 2
  })

  it("spell factor penalties reduce the pool", () => {
    const base = calculateImprovisedPool({
      gnosis: 3,
      arcanumDots: 3,
    })

    // Increase potency to 2 (-2), target two people (-2)
    const modified = applySpellFactors(base, {
      potency: 2,
      targets: 2,
    })

    expect(modified.factorPenalty).toBe(-4) // -2 potency + -2 targets
    expect(modified.totalDice).toBe(2) // 6 base - 4 penalty
  })

  it("sympathetic casting adds connection penalty and costs 1 mana", () => {
    const pool = calculateImprovisedPool({
      gnosis: 3,
      arcanumDots: 3,
      sympatheticConnection: "known",
    })

    expect(pool.penalties).toContainEqual({ source: "Sympathetic (Known)", dice: -4 })
    expect(pool.isVulgar).toBe(true) // sympathetic is always vulgar
    expect(pool.manaCost).toBeGreaterThanOrEqual(1)
  })

  it("duration penalty: extending transitory beyond 1 turn", () => {
    // Transitory default is 1 turn, each step doubles
    expect(calculateDurationPenalty("transitory", 1)).toBe(0) // 1 turn default
    expect(calculateDurationPenalty("transitory", 2)).toBe(-2) // 2 turns
    expect(calculateDurationPenalty("transitory", 3)).toBe(-4) // 3 minutes
    // Prolonged default is 1 scene, each step extends
    expect(calculateDurationPenalty("prolonged", 1)).toBe(0) // 1 scene default
    expect(calculateDurationPenalty("prolonged", 2)).toBe(-2) // 24 hours
    expect(calculateDurationPenalty("prolonged", 3)).toBe(-4) // 2 days
    expect(calculateDurationPenalty("prolonged", 4)).toBe(-6) // 1 week
    expect(calculateDurationPenalty("prolonged", 5)).toBe(-8) // 1 month
    expect(calculateDurationPenalty("prolonged", 6)).toBe(-10) // indefinite
  })

  it("size penalty for large targets", () => {
    expect(calculateSizePenalty(15)).toBe(0) // ≤20 no penalty
    expect(calculateSizePenalty(20)).toBe(0)
    expect(calculateSizePenalty(25)).toBe(-2) // 21-30
    expect(calculateSizePenalty(35)).toBe(-4) // 31-40
    expect(calculateSizePenalty(55)).toBe(-8) // 51-60
  })

  it("area-affecting penalty for radius", () => {
    // Basic table (no advanced arcanum)
    expect(calculateAreaPenalty(1, false)).toBe(0) // 1-yard radius
    expect(calculateAreaPenalty(2, false)).toBe(-2) // 2-yard
    expect(calculateAreaPenalty(4, false)).toBe(-4) // 4-yard
    expect(calculateAreaPenalty(8, false)).toBe(-6) // 8-yard
    expect(calculateAreaPenalty(16, false)).toBe(-8) // 16-yard

    // Advanced table (caster has +1 arcanum dot)
    expect(calculateAreaPenalty(4, true)).toBe(-2) // 4-yard advanced
    expect(calculateAreaPenalty(16, true)).toBe(-4) // 16-yard advanced
    expect(calculateAreaPenalty(64, true)).toBe(-6) // 64-yard advanced
  })

  it("aimed spell range from gnosis", () => {
    const range = calculateAimedSpellRange(3)

    // Short = Gnosis × 10, Medium = 2×short, Long = 2×medium
    expect(range.short).toBe(30)
    expect(range.medium).toBe(60)
    expect(range.long).toBe(120)
  })
})
