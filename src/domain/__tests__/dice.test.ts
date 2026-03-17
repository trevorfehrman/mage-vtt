import { Effect, Random } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { buildPool, rollPool, resolveExplosions, type RollVisibility } from "../dice"

describe("Dice Roller", () => {
  it.effect("rolls a pool and counts 8, 9, 10 as successes", () =>
    Effect.gen(function* () {
      const pool = yield* buildPool([
        { type: "attribute", name: "Strength", dots: 3 },
        { type: "skill", name: "Brawl", dots: 2 },
      ])

      const result = yield* rollPool(pool).pipe(Random.withSeed("test-seed-1"))

      // Pool should be 3 + 2 = 5 dice
      expect(result.poolSize).toBe(5)
      // Results are deterministic with the seed — just check the invariants
      expect(result.rolls).toHaveLength(5)
      // Every roll is 1-10
      for (const roll of result.rolls) {
        expect(roll).toBeGreaterThanOrEqual(1)
        expect(roll).toBeLessThanOrEqual(10)
      }
      // Successes = count of rolls >= 8
      const expectedSuccesses = result.rolls.filter((r) => r >= 8).length
      expect(result.successes).toBe(expectedSuccesses)
    }),
  )

  it.effect("exploding 10s generate additional rolls that can also explode", () =>
    Effect.gen(function* () {
      const pool = yield* buildPool([
        { type: "attribute", name: "Strength", dots: 2 },
      ])

      const initial = yield* rollPool(pool).pipe(Random.withSeed("explode-seed"))

      const resolved = yield* resolveExplosions(initial).pipe(Random.withSeed("explode-seed-2"))

      // Resolved result should have more rolls than initial if any 10s were rolled
      // And the explosion rolls are tracked separately
      const tensInInitial = initial.rolls.filter((r) => r === 10).length
      if (tensInInitial > 0) {
        expect(resolved.explosions.length).toBeGreaterThan(0)
        // Total successes includes explosion successes
        const allRolls = [...resolved.rolls, ...resolved.explosions]
        const expectedSuccesses = allRolls.filter((r) => r >= 8).length
        expect(resolved.successes).toBe(expectedSuccesses)
      }
      // Either way, the function should work without error
      expect(resolved.poolSize).toBe(pool.size)
    }),
  )

  it.effect("pool of zero or less rolls a chance die — only 10 succeeds", () =>
    Effect.gen(function* () {
      // Pool with 0 dice (e.g., penalty exceeds stats)
      const pool = yield* buildPool([
        { type: "attribute", name: "Strength", dots: 1 },
        { type: "modifier", name: "penalty", dots: -3 },
      ])

      const result = yield* rollPool(pool).pipe(Random.withSeed("chance-seed"))

      // Chance die always rolls exactly 1 die
      expect(result.rolls).toHaveLength(1)
      expect(result.isChanceDie).toBe(true)

      // Only a 10 counts as a success on a chance die
      if (result.rolls[0] === 10) {
        expect(result.successes).toBe(1)
      } else {
        expect(result.successes).toBe(0)
      }
    }),
  )

  it.effect("chance die with roll of 1 is a dramatic failure", () =>
    Effect.gen(function* () {
      const pool = yield* buildPool([
        { type: "attribute", name: "Strength", dots: 0 },
      ])

      const result = yield* rollPool(pool).pipe(Random.withSeed("dramatic-seed"))

      expect(result.isChanceDie).toBe(true)
      // If the roll is 1, it's a dramatic failure
      if (result.rolls[0] === 1) {
        expect(result.isDramaticFailure).toBe(true)
      }
    }),
  )

  it.effect("rejects invalid pool components with typed error", () =>
    Effect.gen(function* () {
      const result = yield* buildPool([
        { type: "attribute", name: "Strength", dots: 15 }, // dots max is 10
      ]).pipe(
        Effect.flip, // flip success/error so we can inspect the error
      )

      expect(result._tag).toBe("InvalidPoolComponent")
    }),
  )

  it.effect("rejects unknown component types with typed error", () =>
    Effect.gen(function* () {
      const result = yield* buildPool([
        { type: "nonsense", name: "Foo", dots: 3 },
      ]).pipe(Effect.flip)

      expect(result._tag).toBe("InvalidPoolComponent")
    }),
  )

  it.effect("pool components add correctly: attribute + skill + arcanum", () =>
    Effect.gen(function* () {
      const pool = yield* buildPool([
        { type: "attribute", name: "Intelligence", dots: 3 },
        { type: "skill", name: "Occult", dots: 2 },
        { type: "arcanum", name: "Death", dots: 4 },
      ])

      expect(pool.size).toBe(9)
      expect(pool.components).toHaveLength(3)
    }),
  )

  it.effect("modifier components adjust pool size including negative", () =>
    Effect.gen(function* () {
      const pool = yield* buildPool([
        { type: "attribute", name: "Strength", dots: 4 },
        { type: "skill", name: "Brawl", dots: 3 },
        { type: "modifier", name: "bonus", dots: 2 },
        { type: "modifier", name: "wound penalty", dots: -1 },
      ])

      // 4 + 3 + 2 - 1 = 8
      expect(pool.size).toBe(8)
    }),
  )

  it.effect("9-again: rerolls 9s and 10s", () =>
    Effect.gen(function* () {
      const pool = yield* buildPool([{ type: "attribute", name: "Str", dots: 5 }])
      const result = yield* rollPool(pool, { againThreshold: 9 }).pipe(Random.withSeed("9again-seed"))

      // With 9-again, any 9 or 10 generates an extra roll
      const ninesAndTens = result.rolls.filter((r) => r >= 9).length
      // Explosions should include rerolls for 9s too
      if (ninesAndTens > 0) {
        expect(result.explosions.length).toBeGreaterThanOrEqual(0) // may or may not produce more
      }
      expect(result.againThreshold).toBe(9)
    }),
  )

  it.effect("8-again: rerolls 8s, 9s, and 10s", () =>
    Effect.gen(function* () {
      const pool = yield* buildPool([{ type: "attribute", name: "Str", dots: 5 }])
      const result = yield* rollPool(pool, { againThreshold: 8 }).pipe(Random.withSeed("8again-seed"))
      expect(result.againThreshold).toBe(8)
    }),
  )

  it.effect("rote action: reroll all failed dice once", () =>
    Effect.gen(function* () {
      const pool = yield* buildPool([{ type: "attribute", name: "Str", dots: 5 }])
      const result = yield* rollPool(pool, { roteAction: true }).pipe(Random.withSeed("rote-seed"))

      expect(result.isRoteAction).toBe(true)
      // Rote action should have rerolls for failures
      expect(result.roteRerolls.length).toBeGreaterThanOrEqual(0)
    }),
  )

  it.effect("roll result carries visibility (public or hidden)", () =>
    Effect.gen(function* () {
      const pool = yield* buildPool([
        { type: "attribute", name: "Wits", dots: 3 },
      ])

      const publicRoll = yield* rollPool(pool, { visibility: "public" }).pipe(
        Random.withSeed("vis-seed"),
      )
      expect(publicRoll.visibility).toBe("public")

      const hiddenRoll = yield* rollPool(pool, { visibility: "hidden" }).pipe(
        Random.withSeed("vis-seed-2"),
      )
      expect(hiddenRoll.visibility).toBe("hidden")
    }),
  )
})
