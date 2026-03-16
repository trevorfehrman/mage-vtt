import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  createSpirit,
  spiritDerivedStats,
  SPIRIT_RANKS,
  NUMINA,
} from "../spirits"

describe("Spirits & Antagonists", () => {
  it.effect("creates a spirit with Power/Finesse/Resistance stats", () =>
    Effect.gen(function* () {
      const spirit = yield* createSpirit({
        name: "Fire Elemental",
        rank: 2,
        power: 4,
        finesse: 3,
        resistance: 3,
        willpower: 7,
        essence: 12,
        influences: [{ name: "Fire", dots: 2 }],
        numina: ["Blast", "Materialize"],
      })

      expect(spirit.name).toBe("Fire Elemental")
      expect(spirit.rank).toBe(2)
      expect(spirit.power).toBe(4)
      expect(spirit.finesse).toBe(3)
      expect(spirit.resistance).toBe(3)
    }),
  )

  it.effect("spirit derived stats: Initiative, Defense, Speed", () =>
    Effect.gen(function* () {
      const stats = yield* spiritDerivedStats({
        power: 5,
        finesse: 3,
        resistance: 4,
        speciesFactor: 10,
      })

      // Initiative = Finesse + Resistance
      expect(stats.initiative).toBe(7)
      // Defense = higher of Power or Finesse
      expect(stats.defense).toBe(5)
      // Speed = Power + Finesse + species factor
      expect(stats.speed).toBe(18)
    }),
  )

  it.effect("spirit rank table defines attribute dots and max essence", () =>
    Effect.gen(function* () {
      const rank1 = SPIRIT_RANKS.find((r) => r.rank === 1)!
      expect(rank1.attributeDots).toBe(5)
      expect(rank1.maxEssence).toBe(10)

      const rank3 = SPIRIT_RANKS.find((r) => r.rank === 3)!
      expect(rank3.attributeDots).toBe(9)
      expect(rank3.maxEssence).toBe(20)

      const rank5 = SPIRIT_RANKS.find((r) => r.rank === 5)!
      expect(rank5.maxEssence).toBe(50)
    }),
  )

  it.effect("numina reference data exists", () =>
    Effect.gen(function* () {
      expect(NUMINA.length).toBeGreaterThan(5)

      const materialize = NUMINA.find((n) => n.name === "Materialize")
      expect(materialize).toBeDefined()
      expect(materialize!.dicePool).toBeDefined()

      const blast = NUMINA.find((n) => n.name === "Blast")
      expect(blast).toBeDefined()
    }),
  )
})
