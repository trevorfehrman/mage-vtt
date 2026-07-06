import { describe, expect, it } from "@effect/vitest"
import {
  fireDamage,
  electrocutionDamage,
  explosiveDamage,
  poisonResistance,
  deprivationDamage,
  fatiguePenalty,
  temperaturePenalty,
  drugEffects,
} from "../environment"

describe("Environmental Hazards", () => {
  it("fire: automatic lethal per turn based on size + heat", () => {
    const torch = fireDamage({ size: "torch", heat: "torch" })
    expect(torch.lethalPerTurn).toBe(2) // size 1 + heat +1

    const bonfire = fireDamage({ size: "bonfire", heat: "bonfire" })
    expect(bonfire.lethalPerTurn).toBe(4) // size 2 + heat +2

    const inferno = fireDamage({ size: "inferno", heat: "chemical" })
    expect(inferno.lethalPerTurn).toBe(6) // size 3 + heat +3
  })

  it("electrocution: automatic bashing per turn, no armor", () => {
    const minor = electrocutionDamage("minor")
    expect(minor.bashingPerTurn).toBe(4)
    expect(minor.armorApplies).toBe(false)

    const severe = electrocutionDamage("severe")
    expect(severe.bashingPerTurn).toBe(8)
  })

  it("explosives: blast area + damage, prone reduces by 2", () => {
    const result = explosiveDamage({ type: "fragmentation", isProne: false })
    expect(result.damage).toBeGreaterThan(0)
    expect(result.blastRadius).toBeGreaterThan(0)

    const prone = explosiveDamage({ type: "fragmentation", isProne: true })
    expect(prone.damage).toBe(result.damage - 2)
  })

  it("poison: contested Stamina + Resolve vs toxicity", () => {
    const result = poisonResistance({ stamina: 3, resolve: 2, toxicity: 4 })
    expect(result.resistPool).toBe(5) // 3 + 2
    expect(result.lethalDamage).toBe(4) // equal to toxicity if failed
  })

  it("deprivation: survive Stamina days without water, then 1 bashing/day", () => {
    const result = deprivationDamage({ stamina: 3, resolve: 2, daysWithoutWater: 5, daysWithoutFood: 0 })
    expect(result.bashingPerDay).toBe(1) // past Stamina threshold
    expect(result.thresholdDays).toBe(3) // Stamina = 3
  })

  it("fatigue: cumulative -1 per 6 hours past 24h awake", () => {
    expect(fatiguePenalty(20)).toBe(0) // under 24h
    expect(fatiguePenalty(24)).toBe(0) // exactly 24h
    expect(fatiguePenalty(30)).toBe(-1) // 1 period past
    expect(fatiguePenalty(36)).toBe(-2) // 2 periods past
  })

  it("temperature: cumulative -1 per hour to Dex/Str/Wits", () => {
    expect(temperaturePenalty(0)).toBe(0)
    expect(temperaturePenalty(3)).toBe(-3)
  })

  it("drug effects reference data", () => {
    const alcohol = drugEffects("alcohol")
    expect(alcohol.poolPenalty).toBeDefined()
    expect(alcohol.affectedPools).toContain("dexterity")
  })
})
