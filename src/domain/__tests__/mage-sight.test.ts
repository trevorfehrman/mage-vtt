import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  activateMageSight,
  peripheralMageSightPool,
  scrutinyPool,
} from "../mage-sight"

describe("Mage Sight", () => {
  it.effect("active mage sight costs 1 mana and uses highest arcanum", () =>
    Effect.gen(function* () {
      const result = yield* activateMageSight({
        arcana: { death: 3, matter: 2 },
      })

      expect(result.manaCost).toBe(1)
      expect(result.primaryArcanum).toBe("death")
      expect(result.primaryDots).toBe(3)
    }),
  )

  it.effect("peripheral mage sight pool = Wits + Composure", () =>
    Effect.gen(function* () {
      const pool = yield* peripheralMageSightPool({
        wits: 3,
        composure: 2,
      })

      expect(pool.totalDice).toBe(5)
    }),
  )

  it.effect("scrutiny pool = Intelligence + Arcanum (extended action)", () =>
    Effect.gen(function* () {
      const pool = yield* scrutinyPool({
        intelligence: 3,
        arcanumDots: 4,
      })

      expect(pool.totalDice).toBe(7)
      expect(pool.isExtended).toBe(true)
    }),
  )
})
