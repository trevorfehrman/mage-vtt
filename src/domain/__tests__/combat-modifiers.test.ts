import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  defenseAgainstMultiple,
  dodgePool,
  specifiedTargetPenalty,
  rangePenalty,
  concealment,
  chargingAttack,
  grappleInitiate,
  grappleBreakFree,
  knockoutCheck,
  fallingDamage,
  SPECIFIED_TARGETS,
} from "../combat-modifiers"

describe("Combat Modifiers", () => {
  it.effect("defense degrades by 1 per attacker after the first", () =>
    Effect.gen(function* () {
      expect(yield* defenseAgainstMultiple(4, 1)).toBe(4)
      expect(yield* defenseAgainstMultiple(4, 2)).toBe(3)
      expect(yield* defenseAgainstMultiple(4, 3)).toBe(2)
      expect(yield* defenseAgainstMultiple(4, 5)).toBe(0) // can't go below 0
    }),
  )

  it.effect("dodge: double defense as full action", () =>
    Effect.gen(function* () {
      const result = yield* dodgePool(3)
      expect(result.dodgeValue).toBe(6)
      expect(result.losesAction).toBe(true)
    }),
  )

  it.effect("specified target penalties from table", () =>
    Effect.gen(function* () {
      expect(yield* specifiedTargetPenalty("torso")).toBe(-1)
      expect(yield* specifiedTargetPenalty("arm")).toBe(-2)
      expect(yield* specifiedTargetPenalty("head")).toBe(-3)
      expect(yield* specifiedTargetPenalty("hand")).toBe(-4)
      expect(yield* specifiedTargetPenalty("eye")).toBe(-5)
    }),
  )

  it.effect("range penalties: short 0, medium -2, long -4", () =>
    Effect.gen(function* () {
      expect(yield* rangePenalty("short")).toBe(0)
      expect(yield* rangePenalty("medium")).toBe(-2)
      expect(yield* rangePenalty("long")).toBe(-4)
    }),
  )

  it.effect("concealment levels", () =>
    Effect.gen(function* () {
      expect(yield* concealment("barely")).toBe(-1)
      expect(yield* concealment("partially")).toBe(-2)
      expect(yield* concealment("substantially")).toBe(-3)
    }),
  )

  it.effect("charging: double speed, brawl/weaponry, lose defense", () =>
    Effect.gen(function* () {
      const result = yield* chargingAttack(10) // speed 10
      expect(result.maxDistance).toBe(20)
      expect(result.losesDefense).toBe(true)
    }),
  )

  it.effect("grapple: initiate = Str + Brawl - Defense", () =>
    Effect.gen(function* () {
      const pool = yield* grappleInitiate({ strength: 3, brawl: 2, targetDefense: 2 })
      expect(pool.dicePool).toBe(3) // 3 + 2 - 2
    }),
  )

  it.effect("grapple break free: Str + Brawl - attacker Str", () =>
    Effect.gen(function* () {
      const pool = yield* grappleBreakFree({ strength: 2, brawl: 2, attackerStrength: 3 })
      expect(pool.dicePool).toBe(1) // 2 + 2 - 3
    }),
  )

  it.effect("knockout: head hit (-3) >= target size in damage", () =>
    Effect.gen(function* () {
      const ko = yield* knockoutCheck({ damage: 5, targetSize: 5 })
      expect(ko.possibleKnockout).toBe(true)

      const noKo = yield* knockoutCheck({ damage: 3, targetSize: 5 })
      expect(noKo.possibleKnockout).toBe(false)
    }),
  )

  it.effect("falling damage: 1 bashing per 3 yards, cap 10 lethal at 30+", () =>
    Effect.gen(function* () {
      expect((yield* fallingDamage(9)).damage).toBe(3)
      expect((yield* fallingDamage(9)).type).toBe("bashing")
      expect((yield* fallingDamage(30)).damage).toBe(10)
      expect((yield* fallingDamage(30)).type).toBe("lethal")
      expect((yield* fallingDamage(100)).damage).toBe(10) // capped
    }),
  )
})
