import { Option } from "effect"
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
  findDerangement,
  DERANGEMENTS,
} from "../world-systems"

describe("World Systems", () => {
  // --- Objects ---
  it("object structure = durability + size", () => {
    const result = objectDurability({ durability: 3, size: 5 })
    expect(result.structure).toBe(8)
  })

  // --- Vehicles ---
  it("vehicle crash damage: size + 1 per 10 mph", () => {
    const result = vehicleCrashDamage({ vehicleSize: 12, speedMph: 40 })
    expect(result.damage).toBe(16) // 12 + 4
    expect(result.damageType).toBe("bashing")
  })

  // --- Gauntlet ---
  it("gauntlet strength by location type", () => {
    expect(gauntletStrength("dense_urban")).toBe(5)
    expect(gauntletStrength("wilderness")).toBe(2)
    expect(gauntletStrength("verge")).toBe(0)
  })

  // --- Astral ---
  it("astral journey target successes by destination", () => {
    expect(astralJourneyTarget("oneiros")).toBe(12)
    expect(astralJourneyTarget("temenos")).toBe(16)
    expect(astralJourneyTarget("dreamtime")).toBe(20)
  })

  // --- Disbelief ---
  it("disbelief pool = Resolve + Composure vs spell Potency", () => {
    const result = disbeliefPool({ resolve: 3, composure: 2 })
    expect(result.dicePool).toBe(5)
    expect(result.isExtended).toBe(true)
    expect(result.rollInterval).toBe("10 minutes")
  })

  // --- Duel Arcane ---
  it("duel arcane attack: Gnosis + Sword Arcanum - Shield Arcanum", () => {
    const result = duelArcaneAttack({ gnosis: 3, swordArcanum: 4, opponentShieldArcanum: 2 })
    expect(result.dicePool).toBe(5) // 3 + 4 - 2
    expect(result.damageType).toBe("willpower")
  })

  // --- Spirit Advanced ---
  it("spirit influence essence cost by level", () => {
    expect(spiritInfluenceCost(1)).toBe(1)
    expect(spiritInfluenceCost(3)).toBe(2)
    expect(spiritInfluenceCost(5)).toBe(5)
  })

  it("spirit essence harvest: Power + Finesse modified by Gauntlet", () => {
    const result = spiritEssenceHarvest({ power: 4, finesse: 3, gauntletStrength: 3 })
    expect(result.dicePool).toBe(7) // 4 + 3, gauntlet modifies separately
  })

  // --- Soul ---
  it("soul loss: lose 1 wisdom per week, then willpower", () => {
    const result = soulLossProgression({ weeksWithoutSoul: 3, currentWisdom: 7 })
    expect(result.wisdomLost).toBe(3)
    expect(result.remainingWisdom).toBe(4)
  })

  // --- Demesne ---
  it("demesne: +1 dice to ruling arcana spells, vulgar = covert", () => {
    const result = demesneBonus("Moros")
    expect(result.rulingBonus).toBe(1)
    expect(result.vulgarTreatedAsCovert).toBe(true)
  })

  // --- Derangements ---
  it("derangement reference data with mechanical effects", () => {
    expect(DERANGEMENTS.length).toBeGreaterThan(5)

    const depression = Option.getOrThrow(findDerangement("Depression"))
    expect(depression.penalty).toBeDefined()

    const phobia = Option.getOrThrow(findDerangement("Phobia"))
    expect(phobia.penalty).toBeDefined()
  })

  it("an unknown derangement is a miss, not a synthesized default", () => {
    expect(Option.isNone(findDerangement("Chronic Optimism"))).toBe(true)
  })
})
