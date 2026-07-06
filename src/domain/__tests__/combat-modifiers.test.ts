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
} from "../combat-modifiers"

describe("Combat Modifiers", () => {
  it("defense degrades by 1 per attacker after the first", () => {
    expect(defenseAgainstMultiple(4, 1)).toBe(4)
    expect(defenseAgainstMultiple(4, 2)).toBe(3)
    expect(defenseAgainstMultiple(4, 3)).toBe(2)
    expect(defenseAgainstMultiple(4, 5)).toBe(0) // can't go below 0
  })

  it("dodge: double defense as full action", () => {
    const result = dodgePool(3)
    expect(result.dodgeValue).toBe(6)
    expect(result.losesAction).toBe(true)
  })

  it("specified target penalties from table", () => {
    expect(specifiedTargetPenalty("torso")).toBe(-1)
    expect(specifiedTargetPenalty("arm")).toBe(-2)
    expect(specifiedTargetPenalty("head")).toBe(-3)
    expect(specifiedTargetPenalty("hand")).toBe(-4)
    expect(specifiedTargetPenalty("eye")).toBe(-5)
  })

  it("range penalties: short 0, medium -2, long -4", () => {
    expect(rangePenalty("short")).toBe(0)
    expect(rangePenalty("medium")).toBe(-2)
    expect(rangePenalty("long")).toBe(-4)
  })

  it("concealment levels", () => {
    expect(concealment("barely")).toBe(-1)
    expect(concealment("partially")).toBe(-2)
    expect(concealment("substantially")).toBe(-3)
  })

  it("charging: double speed, brawl/weaponry, lose defense", () => {
    const result = chargingAttack(10) // speed 10
    expect(result.maxDistance).toBe(20)
    expect(result.losesDefense).toBe(true)
  })

  it("grapple: initiate = Str + Brawl - Defense", () => {
    const pool = grappleInitiate({ strength: 3, brawl: 2, targetDefense: 2 })
    expect(pool.dicePool).toBe(3) // 3 + 2 - 2
  })

  it("grapple break free: Str + Brawl - attacker Str", () => {
    const pool = grappleBreakFree({ strength: 2, brawl: 2, attackerStrength: 3 })
    expect(pool.dicePool).toBe(1) // 2 + 2 - 3
  })

  it("knockout: head hit (-3) >= target size in damage", () => {
    const ko = knockoutCheck({ damage: 5, targetSize: 5 })
    expect(ko.possibleKnockout).toBe(true)

    const noKo = knockoutCheck({ damage: 3, targetSize: 5 })
    expect(noKo.possibleKnockout).toBe(false)
  })

  it("falling damage: 1 bashing per 3 yards, cap 10 lethal at 30+", () => {
    expect(fallingDamage(9).damage).toBe(3)
    expect(fallingDamage(9).type).toBe("bashing")
    expect(fallingDamage(30).damage).toBe(10)
    expect(fallingDamage(30).type).toBe("lethal")
    expect(fallingDamage(100).damage).toBe(10) // capped
  })
})
