import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  objectDurability,
  vehicleCrashDamage,
  gauntletStrength,
  astralJourneyTarget,
  disbeliefPool,
  duelArcaneAttack,
  spiritInfluenceCost,
  spiritEssenceHarvest,
  soulLossProgression,
  demesneBonus,
  derangementEffect,
  GAUNTLET_TABLE,
  DERANGEMENTS,
} from "../world-systems"

describe("World Systems", () => {
  // --- Objects ---
  it.effect("object structure = durability + size", () =>
    Effect.gen(function* () {
      const result = yield* objectDurability({ durability: 3, size: 5 })
      expect(result.structure).toBe(8)
    }),
  )

  // --- Vehicles ---
  it.effect("vehicle crash damage: size + 1 per 10 mph", () =>
    Effect.gen(function* () {
      const result = yield* vehicleCrashDamage({ vehicleSize: 12, speedMph: 40 })
      expect(result.damage).toBe(16) // 12 + 4
      expect(result.damageType).toBe("bashing")
    }),
  )

  // --- Gauntlet ---
  it.effect("gauntlet strength by location type", () =>
    Effect.gen(function* () {
      expect(yield* gauntletStrength("dense_urban")).toBe(5)
      expect(yield* gauntletStrength("wilderness")).toBe(2)
      expect(yield* gauntletStrength("verge")).toBe(0)
    }),
  )

  // --- Astral ---
  it.effect("astral journey target successes by destination", () =>
    Effect.gen(function* () {
      expect(yield* astralJourneyTarget("oneiros")).toBe(12)
      expect(yield* astralJourneyTarget("temenos")).toBe(16)
      expect(yield* astralJourneyTarget("dreamtime")).toBe(20)
    }),
  )

  // --- Disbelief ---
  it.effect("disbelief pool = Resolve + Composure vs spell Potency", () =>
    Effect.gen(function* () {
      const result = yield* disbeliefPool({ resolve: 3, composure: 2 })
      expect(result.dicePool).toBe(5)
      expect(result.isExtended).toBe(true)
      expect(result.rollInterval).toBe("10 minutes")
    }),
  )

  // --- Duel Arcane ---
  it.effect("duel arcane attack: Gnosis + Sword Arcanum - Shield Arcanum", () =>
    Effect.gen(function* () {
      const result = yield* duelArcaneAttack({ gnosis: 3, swordArcanum: 4, opponentShieldArcanum: 2 })
      expect(result.dicePool).toBe(5) // 3 + 4 - 2
      expect(result.damageType).toBe("willpower")
    }),
  )

  // --- Spirit Advanced ---
  it.effect("spirit influence essence cost by level", () =>
    Effect.gen(function* () {
      expect(yield* spiritInfluenceCost(1)).toBe(1)
      expect(yield* spiritInfluenceCost(3)).toBe(2)
      expect(yield* spiritInfluenceCost(5)).toBe(5)
    }),
  )

  it.effect("spirit essence harvest: Power + Finesse modified by Gauntlet", () =>
    Effect.gen(function* () {
      const result = yield* spiritEssenceHarvest({ power: 4, finesse: 3, gauntletStrength: 3 })
      expect(result.dicePool).toBe(7) // 4 + 3, gauntlet modifies separately
    }),
  )

  // --- Soul ---
  it.effect("soul loss: lose 1 wisdom per week, then willpower", () =>
    Effect.gen(function* () {
      const result = yield* soulLossProgression({ weeksWithoutSoul: 3, currentWisdom: 7 })
      expect(result.wisdomLost).toBe(3)
      expect(result.remainingWisdom).toBe(4)
    }),
  )

  // --- Demesne ---
  it.effect("demesne: +1 dice to ruling arcana spells, vulgar = covert", () =>
    Effect.gen(function* () {
      const result = yield* demesneBonus("Moros")
      expect(result.rulingBonus).toBe(1)
      expect(result.vulgarTreatedAsCovert).toBe(true)
    }),
  )

  // --- Derangements ---
  it.effect("derangement reference data with mechanical effects", () =>
    Effect.gen(function* () {
      expect(DERANGEMENTS.length).toBeGreaterThan(5)

      const depression = yield* derangementEffect("Depression")
      expect(depression.penalty).toBeDefined()

      const phobia = yield* derangementEffect("Phobia")
      expect(phobia.penalty).toBeDefined()
    }),
  )
})
