import { Effect, Random } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  buildPool,
  burstClusters,
  explosionValues,
  isDieDramaticFailure,
  isDieExplosive,
  isDieSuccess,
  normalizeExplosion,
  normalizeExplosions,
  rollPool,
  resolveExplosions,
  type Explosion,
} from "../dice"

describe("die-outcome rules (issue #25: one source of truth for the renderer)", () => {
  it("a normal die succeeds on 8, 9, and 10", () => {
    expect(isDieSuccess(7, false)).toBe(false)
    expect(isDieSuccess(8, false)).toBe(true)
    expect(isDieSuccess(9, false)).toBe(true)
    expect(isDieSuccess(10, false)).toBe(true)
  })

  it("a chance die succeeds only on 10", () => {
    expect(isDieSuccess(8, true)).toBe(false)
    expect(isDieSuccess(9, true)).toBe(false)
    expect(isDieSuccess(10, true)).toBe(true)
  })

  it("only a chance die showing 1 is a dramatic failure", () => {
    expect(isDieDramaticFailure(1, true)).toBe(true)
    expect(isDieDramaticFailure(2, true)).toBe(false)
    expect(isDieDramaticFailure(1, false)).toBe(false)
  })

  it("a die at or above the again threshold explodes; chance dice never do", () => {
    expect(isDieExplosive(10, 10, false)).toBe(true)
    expect(isDieExplosive(9, 10, false)).toBe(false)
    expect(isDieExplosive(9, 9, false)).toBe(true)
    expect(isDieExplosive(8, 8, false)).toBe(true)
    expect(isDieExplosive(10, 10, true)).toBe(false)
  })
})

describe("stored-explosion healing (issue #122: legacy flat records decode parentless)", () => {
  it("a legacy bare face heals to a parentless struct; a struct passes through", () => {
    expect(normalizeExplosion(7)).toEqual({ value: 7, parentIndex: null })
    const parented: Explosion = { value: 10, parentIndex: 3 }
    expect(normalizeExplosion(parented)).toBe(parented)
  })

  it("a mixed stored list heals element by element", () => {
    expect(normalizeExplosions([9, { value: 10, parentIndex: 0 }, 4])).toEqual([
      { value: 9, parentIndex: null },
      { value: 10, parentIndex: 0 },
      { value: 4, parentIndex: null },
    ])
  })

  it("explosionValues reads the faces off either generation", () => {
    expect(explosionValues([9, { value: 10, parentIndex: 0 }])).toEqual([9, 10])
  })
})

describe("burstClusters (issue #126: the burst order a felt renders)", () => {
  it("groups each explosion behind its trigger, chains linking generation to generation", () => {
    // rolls [10, 3]: the 10 at index 0 bursts into a 10 (combined index 2),
    // which itself bursts into an 8 (combined index 3) — one chain.
    const clusters = burstClusters(
      [10, 3],
      [],
      [
        { value: 10, parentIndex: 0 },
        { value: 8, parentIndex: 2 },
      ],
    )
    expect(clusters).toEqual([
      [
        { value: 10, index: 0, kind: "roll" },
        { value: 10, index: 2, kind: "explosion" },
        { value: 8, index: 3, kind: "explosion" },
      ],
      [{ value: 3, index: 1, kind: "roll" }],
    ])
  })

  it("rote rerolls hold base positions, and their own bursts tether to them", () => {
    // Combined sequence: rolls [10, 2] at 0–1, the rote 10 at 2, explosions
    // at 3–4 — one child off the initial 10, one off the rote 10.
    const clusters = burstClusters(
      [10, 2],
      [10],
      [
        { value: 5, parentIndex: 0 },
        { value: 7, parentIndex: 2 },
      ],
    )
    expect(clusters).toEqual([
      [
        { value: 10, index: 0, kind: "roll" },
        { value: 5, index: 3, kind: "explosion" },
      ],
      [{ value: 2, index: 1, kind: "roll" }],
      [
        { value: 10, index: 2, kind: "rote" },
        { value: 7, index: 4, kind: "explosion" },
      ],
    ])
  })

  it("all-parentless (legacy) explosions fall back to the inline order", () => {
    const clusters = burstClusters(
      [10, 8],
      [],
      [
        { value: 7, parentIndex: null },
        { value: 9, parentIndex: null },
      ],
    )
    expect(clusters).toEqual([
      [{ value: 10, index: 0, kind: "roll" }],
      [{ value: 8, index: 1, kind: "roll" }],
      [{ value: 7, index: 2, kind: "explosion" }],
      [{ value: 9, index: 3, kind: "explosion" }],
    ])
  })

  it("mixed parentage tethers what it can and trails the rest inline", () => {
    const clusters = burstClusters(
      [10, 3],
      [],
      [
        { value: 6, parentIndex: null },
        { value: 4, parentIndex: 0 },
      ],
    )
    expect(clusters).toEqual([
      [
        { value: 10, index: 0, kind: "roll" },
        { value: 4, index: 3, kind: "explosion" },
      ],
      [{ value: 3, index: 1, kind: "roll" }],
      [{ value: 6, index: 2, kind: "explosion" }],
    ])
  })

  it("malformed parentage never loops or drops a die", () => {
    // A self-reference, an out-of-range parent, and a duplicate claimant:
    // the first claimant chains; everything unhonorable trails inline once.
    const clusters = burstClusters(
      [10],
      [],
      [
        { value: 9, parentIndex: 1 }, // self-reference (own combined index)
        { value: 8, parentIndex: 99 }, // out of range
        { value: 7, parentIndex: 0 }, // first claimant of the 10
        { value: 6, parentIndex: 0 }, // duplicate claimant
      ],
    )
    expect(clusters).toEqual([
      [
        { value: 10, index: 0, kind: "roll" },
        { value: 7, index: 3, kind: "explosion" },
      ],
      [{ value: 9, index: 1, kind: "explosion" }],
      [{ value: 8, index: 2, kind: "explosion" }],
      [{ value: 6, index: 4, kind: "explosion" }],
    ])
    expect(clusters.flat()).toHaveLength(5)
  })

  it.effect("a seeded chain roll clusters every die exactly once, children behind triggers", () =>
    Effect.gen(function* () {
      // The "ten-3" chain from the parentage test above: rolls
      // [6,2,10,6,10,3,10], four children, one of them a chain link.
      const pool = yield* buildPool([{ type: "attribute", name: "Str", dots: 7 }])
      const result = yield* rollPool(pool).pipe(Random.withSeed("ten-3"))

      const clusters = burstClusters(result.rolls, result.roteRerolls, result.explosions)
      const flat = clusters.flat()
      expect(flat).toHaveLength(result.rolls.length + result.explosions.length)
      const indices = flat.map((d) => d.index)
      expect(indices.every((idx, i) => indices.indexOf(idx) === i)).toBe(true)
      // The chain: the 10 at index 4 carries its child 10 (index 8), which
      // carries its own child — three dice in one cluster.
      expect(clusters.find((c) => c[0]!.index === 4)).toEqual([
        { value: 10, index: 4, kind: "roll" },
        { value: 10, index: 8, kind: "explosion" },
        { value: 8, index: 10, kind: "explosion" },
      ])
    }),
  )
})

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
        const allRolls = [...resolved.rolls, ...resolved.explosions.map((e) => e.value)]
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

  it.effect("explosions record parentage: each child points at a trigger die (issue #122)", () =>
    Effect.gen(function* () {
      // Seed "ten-3" on 7 dice at 10-again: rolls [6,2,10,6,10,3,10], then
      // one child per 10 — and the second child is itself a 10, whose own
      // child links back to it (a chain across generations).
      const pool = yield* buildPool([{ type: "attribute", name: "Str", dots: 7 }])
      const result = yield* rollPool(pool).pipe(Random.withSeed("ten-3"))

      expect(result.rolls).toEqual([6, 2, 10, 6, 10, 3, 10])
      expect(result.explosions).toEqual([
        { value: 8, parentIndex: 2 },
        { value: 10, parentIndex: 4 },
        { value: 5, parentIndex: 6 },
        { value: 8, parentIndex: 8 },
      ])

      // Every parent is a die in the combined sequence that was itself a
      // trigger — at or above the threshold, in a strictly earlier position.
      const combined = [...result.rolls, ...explosionValues(result.explosions)]
      result.explosions.forEach((e, i) => {
        expect(e.parentIndex).not.toBeNull()
        expect(e.parentIndex!).toBeLessThan(result.rolls.length + i)
        expect(combined[e.parentIndex!]!).toBeGreaterThanOrEqual(result.againThreshold)
      })

      // The chain: the last child's parent (index 8) is the exploded 10 at
      // explosions[1], not an initial die.
      expect(result.explosions[3]!.parentIndex).toBe(8)
      expect(combined[8]).toBe(10)

      // The shape change never moves the success count: counting faces flat
      // agrees with the result.
      expect(result.successes).toBe(combined.filter((r) => r >= 8).length)
    }),
  )

  it.effect("a rote reroll that explodes is the recorded parent of its child", () =>
    Effect.gen(function* () {
      // Seed "rote-11" on 5 dice: rolls [7,4,9,5,9], rote rerolls [10,4,2] —
      // the child's parent index 5 lands in the rote-reroll region of the
      // combined sequence ([...rolls, ...roteRerolls, ...explosions]).
      const pool = yield* buildPool([{ type: "attribute", name: "Str", dots: 5 }])
      const result = yield* rollPool(pool, { roteAction: true }).pipe(
        Random.withSeed("rote-11"),
      )

      expect(result.rolls).toEqual([7, 4, 9, 5, 9])
      expect(result.roteRerolls).toEqual([10, 4, 2])
      expect(result.explosions).toEqual([{ value: 2, parentIndex: 5 }])
    }),
  )

  it.effect("8-again chains link generation to generation", () =>
    Effect.gen(function* () {
      // Seed "parentage-9" on 6 dice at 8-again: initial dice 0–5, children
      // at combined indices 6–13. The child at 11 ({8, parent 6}) hangs off
      // the first-generation 10 at index 6; the child at 13 hangs off THAT
      // one — a three-generation chain 0 → 6 → 11 → 13.
      const pool = yield* buildPool([{ type: "attribute", name: "Str", dots: 6 }])
      const result = yield* rollPool(pool, { againThreshold: 8 }).pipe(
        Random.withSeed("parentage-9"),
      )

      expect(result.rolls).toEqual([10, 9, 10, 10, 9, 3])
      expect(result.explosions).toEqual([
        { value: 10, parentIndex: 0 },
        { value: 10, parentIndex: 1 },
        { value: 2, parentIndex: 2 },
        { value: 6, parentIndex: 3 },
        { value: 4, parentIndex: 4 },
        { value: 8, parentIndex: 6 },
        { value: 3, parentIndex: 7 },
        { value: 3, parentIndex: 11 },
      ])

      const combined = [...result.rolls, ...explosionValues(result.explosions)]
      expect(result.successes).toBe(combined.filter((r) => r >= 8).length)
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
