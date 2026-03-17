import { Effect } from "effect"
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
  it.effect("magic resistance: contested (Resistance + Gnosis) and automated (subtract Resistance)", () =>
    Effect.gen(function* () {
      const contested = yield* magicResistance({
        mode: "contested",
        resistanceAttribute: 3,
        targetGnosis: 2,
        spendWillpower: false,
      })
      expect(contested.dicePool).toBe(5) // 3 + 2

      const contestedWP = yield* magicResistance({
        mode: "contested",
        resistanceAttribute: 3,
        targetGnosis: 2,
        spendWillpower: true,
      })
      expect(contestedWP.dicePool).toBe(8) // 3 + 2 + 3 WP

      const automated = yield* magicResistance({
        mode: "automated",
        resistanceAttribute: 4,
        spendWillpower: false,
      })
      expect(automated.subtractFromPool).toBe(4)

      const automatedWP = yield* magicResistance({
        mode: "automated",
        resistanceAttribute: 4,
        spendWillpower: true,
      })
      expect(automatedWP.subtractFromPool).toBe(6) // 4 + 2 WP
    }),
  )

  it.effect("combined spells: gnosis threshold, dice penalty, arcanum +1", () =>
    Effect.gen(function* () {
      const two = yield* combinedSpellRequirements(2)
      expect(two.minGnosis).toBe(3)
      expect(two.dicePenalty).toBe(-2)
      expect(two.extraArcanumDots).toBe(1)

      const three = yield* combinedSpellRequirements(3)
      expect(three.minGnosis).toBe(6)
      expect(three.dicePenalty).toBe(-4)

      const four = yield* combinedSpellRequirements(4)
      expect(four.minGnosis).toBe(9)
    }),
  )

  it.effect("spell tolerance: spells on target beyond Stamina levy -1 each", () =>
    Effect.gen(function* () {
      expect(yield* spellTolerance({ stamina: 3, activeSpellsOnTarget: 2 })).toBe(0)
      expect(yield* spellTolerance({ stamina: 3, activeSpellsOnTarget: 3 })).toBe(0)
      expect(yield* spellTolerance({ stamina: 3, activeSpellsOnTarget: 4 })).toBe(-1)
      expect(yield* spellTolerance({ stamina: 3, activeSpellsOnTarget: 6 })).toBe(-3)
    }),
  )

  it.effect("rote specialty +1 when order skill matches", () =>
    Effect.gen(function* () {
      // Mysterium rote skills: Investigation, Occult, Survival
      expect(yield* roteSpecialtyBonus("Mysterium", "Occult")).toBe(1)
      expect(yield* roteSpecialtyBonus("Mysterium", "Athletics")).toBe(0)
    }),
  )

  it.effect("extended casting target successes table", () =>
    Effect.gen(function* () {
      const targets = yield* extendedCastingTargets({
        potency: 2,
        targets: 2,
        durationSteps: 1,
      })
      // Base 1 + potency extra + target extra + duration extra
      expect(targets.targetSuccesses).toBeGreaterThan(1)
    }),
  )

  it.effect("transitory duration penalty table", () =>
    Effect.gen(function* () {
      expect(yield* transitorDurationPenalty(1)).toBe(0)   // 1 turn
      expect(yield* transitorDurationPenalty(2)).toBe(-2)  // 2 turns
      expect(yield* transitorDurationPenalty(3)).toBe(-4)  // 3 minutes
      expect(yield* transitorDurationPenalty(4)).toBe(-6)  // 5 turns
      expect(yield* transitorDurationPenalty(5)).toBe(-8)  // 10 turns
    }),
  )

  it.effect("advanced prolonged duration penalty (with +1 arcanum)", () =>
    Effect.gen(function* () {
      expect(yield* advancedProlongedDurationPenalty(1)).toBe(0)    // 1 scene
      expect(yield* advancedProlongedDurationPenalty(2)).toBe(-2)   // 24 hours
      expect(yield* advancedProlongedDurationPenalty(3)).toBe(-4)   // 2 days
      expect(yield* advancedProlongedDurationPenalty(4)).toBe(-6)   // 1 week
      expect(yield* advancedProlongedDurationPenalty(5)).toBe(-8)   // 1 month
      expect(yield* advancedProlongedDurationPenalty(6)).toBe(-10)  // indefinite
    }),
  )
})
