import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  canCounterspell,
  calculateCounterspellPool,
  resolveDispel,
} from "../counterspell"

describe("Counterspell & Dispel", () => {
  it.effect("can counterspell with matching arcanum", () =>
    Effect.gen(function* () {
      const result = yield* canCounterspell({
        casterArcana: { death: 3, matter: 2 },
        targetSpellArcanum: "death",
      })

      expect(result.canCounter).toBe(true)
      expect(result.arcanumUsed).toBe("death")
    }),
  )

  it.effect("can counterspell any spell with Prime", () =>
    Effect.gen(function* () {
      const result = yield* canCounterspell({
        casterArcana: { prime: 2 },
        targetSpellArcanum: "forces",
      })

      expect(result.canCounter).toBe(true)
      expect(result.arcanumUsed).toBe("prime")
    }),
  )

  it.effect("cannot counterspell without matching arcanum or prime", () =>
    Effect.gen(function* () {
      const result = yield* canCounterspell({
        casterArcana: { death: 3, matter: 2 },
        targetSpellArcanum: "forces",
      })

      expect(result.canCounter).toBe(false)
    }),
  )

  it.effect("counterspell pool = Gnosis + Arcanum", () =>
    Effect.gen(function* () {
      const pool = yield* calculateCounterspellPool({
        gnosis: 3,
        arcanumDots: 2,
      })

      expect(pool.totalDice).toBe(5)
    }),
  )

  it.effect("dispel succeeds when successes >= target spell potency", () =>
    Effect.gen(function* () {
      const success = yield* resolveDispel({
        dispelSuccesses: 3,
        targetPotency: 2,
      })
      expect(success.dispelled).toBe(true)

      const fail = yield* resolveDispel({
        dispelSuccesses: 1,
        targetPotency: 3,
      })
      expect(fail.dispelled).toBe(false)
    }),
  )
})
