import { Effect, Random } from "effect"
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

      const fast = order.find((p) => p.participantId === "fast")!
      const slow = order.find((p) => p.participantId === "slow")!
      const mid = order.find((p) => p.participantId === "mid")!

      expect(fast.ticks).toBe(0)
      expect(mid.ticks).toBe(3)   // 15 - 12
      expect(slow.ticks).toBe(7)  // 15 - 8
    }),
  )

  it.effect("tiebreaker: Wits > Dex > Composure > Willpower", () =>
    Effect.gen(function* () {
      const order = yield* resolveTickOrder([
        { participantId: "a", total: 10, roll: 5, dexterity: 3, composure: 2, wits: 4 },
        { participantId: "b", total: 10, roll: 5, dexterity: 3, composure: 2, wits: 2 },
      ])

      // Same total, "a" has higher Wits so acts first (lower tick)
      expect(order[0].participantId).toBe("a")
      expect(order[0].ticks).toBe(0)
      expect(order[1].ticks).toBe(0) // same ticks but ordered by tiebreaker
    }),
  )

  it.effect("action costs: attack 3, spell 5, move 3, dodge 1-3", () =>
    Effect.gen(function* () {
      expect(ACTION_COSTS.attack).toBe(3)
      expect(ACTION_COSTS.castSpell).toBe(5)
      expect(ACTION_COSTS.move).toBe(3)
      expect(ACTION_COSTS.useItem).toBe(3)
    }),
  )

  it.effect("after acting, participant gains action-cost ticks", () =>
    Effect.gen(function* () {
      const result = yield* applyActionCost({
        participantId: "player-1",
        currentTicks: 0,
        action: "attack",
      })

      expect(result.newTicks).toBe(3)
    }),
  )

  it.effect("findNextActor returns participant with 0 ticks", () =>
    Effect.gen(function* () {
      const next = yield* findNextActor([
        { participantId: "a", ticks: 3 },
        { participantId: "b", ticks: 0 },
        { participantId: "c", ticks: 5 },
      ])

      expect(next.participantId).toBe("b")
    }),
  )

  it.effect("findNextActor advances ticks when nobody at 0", () =>
    Effect.gen(function* () {
      const next = yield* findNextActor([
        { participantId: "a", ticks: 3 },
        { participantId: "b", ticks: 2 },
        { participantId: "c", ticks: 5 },
      ])

      // "b" has lowest ticks (2), so all advance by 2
      expect(next.participantId).toBe("b")
      expect(next.ticksAdvanced).toBe(2)
    }),
  )
})
