import { describe, expect, it } from "@effect/vitest"
import {
  magicResistance,
  combinedSpellRequirements,
  spellTolerance,
  roteSpecialtyBonus,
  extendedCastingTargets,
  transitorDurationPenalty,
  advancedProlongedDurationPenalty,
} from "../spellcasting-advanced"

describe("Spellcasting Advanced", () => {
  it("magic resistance: contested (Resistance + Gnosis) and automated (subtract Resistance)", () => {
    const contested = magicResistance({
      mode: "contested",
      resistanceAttribute: 3,
      targetGnosis: 2,
      spendWillpower: false,
    })
    expect(contested.dicePool).toBe(5) // 3 + 2

    const contestedWP = magicResistance({
      mode: "contested",
      resistanceAttribute: 3,
      targetGnosis: 2,
      spendWillpower: true,
    })
    expect(contestedWP.dicePool).toBe(8) // 3 + 2 + 3 WP

    const automated = magicResistance({
      mode: "automated",
      resistanceAttribute: 4,
      spendWillpower: false,
    })
    expect(automated.subtractFromPool).toBe(4)

    const automatedWP = magicResistance({
      mode: "automated",
      resistanceAttribute: 4,
      spendWillpower: true,
    })
    expect(automatedWP.subtractFromPool).toBe(6) // 4 + 2 WP
  })

  it("combined spells: gnosis threshold, dice penalty, arcanum +1", () => {
    const two = combinedSpellRequirements(2)
    expect(two.minGnosis).toBe(3)
    expect(two.dicePenalty).toBe(-2)
    expect(two.extraArcanumDots).toBe(1)

    const three = combinedSpellRequirements(3)
    expect(three.minGnosis).toBe(6)
    expect(three.dicePenalty).toBe(-4)

    const four = combinedSpellRequirements(4)
    expect(four.minGnosis).toBe(9)
  })

  it("spell tolerance: spells on target beyond Stamina levy -1 each", () => {
    expect(spellTolerance({ stamina: 3, activeSpellsOnTarget: 2 })).toBe(0)
    expect(spellTolerance({ stamina: 3, activeSpellsOnTarget: 3 })).toBe(0)
    expect(spellTolerance({ stamina: 3, activeSpellsOnTarget: 4 })).toBe(-1)
    expect(spellTolerance({ stamina: 3, activeSpellsOnTarget: 6 })).toBe(-3)
  })

  it("rote specialty +1 when order skill matches", () => {
    // Mysterium rote skills: Investigation, Occult, Survival
    expect(roteSpecialtyBonus("Mysterium", "Occult")).toBe(1)
    expect(roteSpecialtyBonus("Mysterium", "Athletics")).toBe(0)
  })

  it("extended casting target successes table", () => {
    const targets = extendedCastingTargets({
      potency: 2,
      targets: 2,
      durationSteps: 1,
    })
    // Base 1 + potency extra + target extra + duration extra
    expect(targets.targetSuccesses).toBeGreaterThan(1)
  })

  it("transitory duration penalty table", () => {
    expect(transitorDurationPenalty(1)).toBe(0) // 1 turn
    expect(transitorDurationPenalty(2)).toBe(-2) // 2 turns
    expect(transitorDurationPenalty(3)).toBe(-4) // 3 minutes
    expect(transitorDurationPenalty(4)).toBe(-6) // 5 turns
    expect(transitorDurationPenalty(5)).toBe(-8) // 10 turns
  })

  it("advanced prolonged duration penalty (with +1 arcanum)", () => {
    expect(advancedProlongedDurationPenalty(1)).toBe(0) // 1 scene
    expect(advancedProlongedDurationPenalty(2)).toBe(-2) // 24 hours
    expect(advancedProlongedDurationPenalty(3)).toBe(-4) // 2 days
    expect(advancedProlongedDurationPenalty(4)).toBe(-6) // 1 week
    expect(advancedProlongedDurationPenalty(5)).toBe(-8) // 1 month
    expect(advancedProlongedDurationPenalty(6)).toBe(-10) // indefinite
  })
})
