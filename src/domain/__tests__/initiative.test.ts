import { Effect, Option, Random } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  rollInitiative,
  resolveTickOrder,
  applyActionCost,
  findNextActor,
  ACTION_COSTS,
} from "../initiative"

describe("Tick Initiative (Homebrew)", () => {
  it.effect("rolls initiative: d10 + Dexterity + Composure", () =>
    Effect.gen(function* () {
      const result = yield* rollInitiative({
        participantId: "player-1",
        dexterity: 3,
        composure: 2,
      }).pipe(Random.withSeed("init-seed"))

      expect(result.participantId).toBe("player-1")
      expect(result.roll).toBeGreaterThanOrEqual(1)
      expect(result.roll).toBeLessThanOrEqual(10)
      expect(result.total).toBe(result.roll + 3 + 2)
    }),
  )

  it.effect("highest total gets 0 ticks, others get difference", () =>
    Effect.gen(function* () {
      const order = yield* resolveTickOrder([
        { participantId: "fast", total: 15, roll: 10, dexterity: 3, composure: 2 },
        { participantId: "slow", total: 8, roll: 3, dexterity: 3, composure: 2 },
        { participantId: "mid", total: 12, roll: 7, dexterity: 3, composure: 2 },
      ])

      const fast = order.entries.find((p) => p.participantId === "fast")!
      const slow = order.entries.find((p) => p.participantId === "slow")!
      const mid = order.entries.find((p) => p.participantId === "mid")!

      expect(fast.ticks).toBe(0)
      expect(mid.ticks).toBe(3) // 15 - 12
      expect(slow.ticks).toBe(7) // 15 - 8
      expect(order.flips).toEqual([]) // no ties, no fate
    }),
  )

  it.effect("tiebreaker: Wits > Dex > Composure > Willpower — no flip drawn", () =>
    Effect.gen(function* () {
      const order = yield* resolveTickOrder([
        { participantId: "a", total: 10, roll: 5, dexterity: 3, composure: 2, wits: 4 },
        { participantId: "b", total: 10, roll: 5, dexterity: 3, composure: 2, wits: 2 },
      ])

      // Same total, "a" has higher Wits so acts first (lower tick)
      expect(order.entries[0]!.participantId).toBe("a")
      expect(order.entries[0]!.ticks).toBe(0)
      expect(order.entries[1]!.ticks).toBe(0) // same ticks but ordered by tiebreaker
      // The chain settled it: a coinflip here would be spurious randomness.
      expect(order.flips).toEqual([])
    }),
  )

  it.effect("a full-chain tie ends in a reported coinflip (issue #59)", () =>
    Effect.gen(function* () {
      const twins = [
        { participantId: "castor", total: 10, roll: 5, dexterity: 3, composure: 2, wits: 3, willpower: 5 },
        { participantId: "pollux", total: 10, roll: 5, dexterity: 3, composure: 2, wits: 3, willpower: 5 },
      ]
      const order = yield* resolveTickOrder(twins).pipe(Random.withSeed("gemini"))

      // Fate decided, and said so: one flip naming both twins and its pick.
      expect(order.flips).toHaveLength(1)
      const flip = order.flips[0]!
      expect([...flip.participantIds].sort()).toEqual(["castor", "pollux"])
      expect([...flip.order].sort()).toEqual(["castor", "pollux"])
      // The entries honor the flip: the winner leads, ticks unchanged by it.
      expect(order.entries.map((e) => e.participantId)).toEqual(flip.order)
      expect(order.entries[0]!.ticks).toBe(0)
      expect(order.entries[1]!.ticks).toBe(0)
    }),
  )

  it.effect("the coinflip is seeded fate: deterministic per seed, free across seeds", () =>
    Effect.gen(function* () {
      const twins = [
        { participantId: "castor", total: 10, roll: 5, dexterity: 3, composure: 2 },
        { participantId: "pollux", total: 10, roll: 5, dexterity: 3, composure: 2 },
      ]
      const once = yield* resolveTickOrder(twins).pipe(Random.withSeed("gemini"))
      const again = yield* resolveTickOrder(twins).pipe(Random.withSeed("gemini"))
      expect(again.flips[0]!.order).toEqual(once.flips[0]!.order)

      // A seed that disagrees with "gemini" (observed: castor/pollux vs
      // pollux/castor) — the flip is a real coin, not a constant.
      const other = yield* resolveTickOrder(twins).pipe(Random.withSeed("tails"))
      expect(other.flips[0]!.order).not.toEqual(once.flips[0]!.order)
    }),
  )

  it("action costs: attack 3, spell 5, move 3, dodge 1-3", () => {
    expect(ACTION_COSTS.attack).toBe(3)
    expect(ACTION_COSTS.castSpell).toBe(5)
    expect(ACTION_COSTS.move).toBe(3)
    expect(ACTION_COSTS.useItem).toBe(3)
  })

  it("after acting, participant gains action-cost ticks", () => {
    const result = applyActionCost({
      participantId: "player-1",
      currentTicks: 0,
      action: "attack",
    })

    expect(result.newTicks).toBe(3)
  })

  it.effect("findNextActor returns participant with 0 ticks", () =>
    Effect.gen(function* () {
      const next = Option.getOrThrow(
        yield* findNextActor([
          { participantId: "a", ticks: 3 },
          { participantId: "b", ticks: 0 },
          { participantId: "c", ticks: 5 },
        ]),
      )

      expect(next.participantId).toBe("b")
      expect(next.flip).toBeUndefined()
    }),
  )

  it.effect("findNextActor advances ticks when nobody at 0", () =>
    Effect.gen(function* () {
      const next = Option.getOrThrow(
        yield* findNextActor([
          { participantId: "a", ticks: 3 },
          { participantId: "b", ticks: 2 },
          { participantId: "c", ticks: 5 },
        ]),
      )

      // "b" has lowest ticks (2), so all advance by 2
      expect(next.participantId).toBe("b")
      expect(next.ticksAdvanced).toBe(2)
    }),
  )

  it.effect("equal Ticks resolve by the chain — insertion order never decides", () =>
    Effect.gen(function* () {
      const next = Option.getOrThrow(
        yield* findNextActor([
          { participantId: "listed-first", ticks: 2, wits: 2, dexterity: 3, composure: 2 },
          { participantId: "sharper", ticks: 2, wits: 4, dexterity: 3, composure: 2 },
        ]),
      )

      expect(next.participantId).toBe("sharper")
      expect(next.flip).toBeUndefined() // the chain settled it
    }),
  )

  it.effect("equal Ticks through the whole chain: the coin decides, visibly", () =>
    Effect.gen(function* () {
      const twins = [
        { participantId: "castor", ticks: 2, wits: 3, dexterity: 3, composure: 2, willpower: 5 },
        { participantId: "pollux", ticks: 2, wits: 3, dexterity: 3, composure: 2, willpower: 5 },
      ]
      const next = Option.getOrThrow(
        yield* findNextActor(twins).pipe(Random.withSeed("gemini")),
      )

      expect(next.flip).toBeDefined()
      expect([...next.flip!.participantIds].sort()).toEqual(["castor", "pollux"])
      expect(next.participantId).toBe(next.flip!.order[0])
      expect(next.ticksAdvanced).toBe(2)

      // Deterministic under the seed.
      const again = Option.getOrThrow(
        yield* findNextActor(twins).pipe(Random.withSeed("gemini")),
      )
      expect(again.participantId).toBe(next.participantId)
    }),
  )

  it.effect("findNextActor on an empty tracker is a miss, not a crash", () =>
    Effect.gen(function* () {
      expect(Option.isNone(yield* findNextActor([]))).toBe(true)
    }),
  )
})
