import { Effect } from "effect"
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
  FIRE_SIZES,
  EXPLOSIVES,
} from "../environment"

describe("Environmental Hazards", () => {
  it.effect("fire: automatic lethal per turn based on size + heat", () =>
    Effect.gen(function* () {
      const torch = yield* fireDamage({ size: "torch", heat: "torch" })
      expect(torch.lethalPerTurn).toBe(2) // size 1 + heat +1

      const bonfire = yield* fireDamage({ size: "bonfire", heat: "bonfire" })
      expect(bonfire.lethalPerTurn).toBe(4) // size 2 + heat +2

      const inferno = yield* fireDamage({ size: "inferno", heat: "chemical" })
      expect(inferno.lethalPerTurn).toBe(6) // size 3 + heat +3
    }),
  )

  it.effect("electrocution: automatic bashing per turn, no armor", () =>
    Effect.gen(function* () {
      const minor = yield* electrocutionDamage("minor")
      expect(minor.bashingPerTurn).toBe(4)
      expect(minor.armorApplies).toBe(false)

      const severe = yield* electrocutionDamage("severe")
      expect(severe.bashingPerTurn).toBe(8)
    }),
  )

  it.effect("explosives: blast area + damage, prone reduces by 2", () =>
    Effect.gen(function* () {
      const result = yield* explosiveDamage({ type: "fragmentation", isProne: false })
      expect(result.damage).toBeGreaterThan(0)
      expect(result.blastRadius).toBeGreaterThan(0)

      const prone = yield* explosiveDamage({ type: "fragmentation", isProne: true })
      expect(prone.damage).toBe(result.damage - 2)
    }),
  )

  it.effect("poison: contested Stamina + Resolve vs toxicity", () =>
    Effect.gen(function* () {
      const result = yield* poisonResistance({ stamina: 3, resolve: 2, toxicity: 4 })
      expect(result.resistPool).toBe(5) // 3 + 2
      expect(result.lethalDamage).toBe(4) // equal to toxicity if failed
    }),
  )

  it.effect("deprivation: survive Stamina days without water, then 1 bashing/day", () =>
    Effect.gen(function* () {
      const result = yield* deprivationDamage({ stamina: 3, resolve: 2, daysWithoutWater: 5, daysWithoutFood: 0 })
      expect(result.bashingPerDay).toBe(1) // past Stamina threshold
      expect(result.thresholdDays).toBe(3) // Stamina = 3
    }),
  )

  it.effect("fatigue: cumulative -1 per 6 hours past 24h awake", () =>
    Effect.gen(function* () {
      expect(yield* fatiguePenalty(20)).toBe(0)  // under 24h
      expect(yield* fatiguePenalty(24)).toBe(0)  // exactly 24h
      expect(yield* fatiguePenalty(30)).toBe(-1) // 1 period past
      expect(yield* fatiguePenalty(36)).toBe(-2) // 2 periods past
    }),
  )

  it.effect("temperature: cumulative -1 per hour to Dex/Str/Wits", () =>
    Effect.gen(function* () {
      expect(yield* temperaturePenalty(0)).toBe(0)
      expect(yield* temperaturePenalty(3)).toBe(-3)
    }),
  )

  it.effect("drug effects reference data", () =>
    Effect.gen(function* () {
      const alcohol = yield* drugEffects("alcohol")
      expect(alcohol.poolPenalty).toBeDefined()
      expect(alcohol.affectedPools).toContain("dexterity")
    }),
  )
})
