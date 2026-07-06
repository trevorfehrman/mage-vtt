import { describe, expect, it } from "@effect/vitest"
import {
  degenerationDicePool,
  wisdomEffects,
  untrainedSkillPenalty,
  xpCost,
} from "../wisdom"

describe("Wisdom & Morality", () => {
  it("degeneration dice pool by wisdom level", () => {
    expect(degenerationDicePool(10)).toBe(5)
    expect(degenerationDicePool(8)).toBe(4)
    expect(degenerationDicePool(6)).toBe(3)
    expect(degenerationDicePool(4)).toBe(3)
    expect(degenerationDicePool(2)).toBe(2)
    expect(degenerationDicePool(1)).toBe(2)
  })

  it("wisdom effects on social rolls with spirits", () => {
    const high = wisdomEffects(9)
    expect(high.spiritSocialBonus).toBe(1)
    expect(high.abyssalContestBonus).toBe(1)

    const normal = wisdomEffects(5)
    expect(normal.spiritSocialBonus).toBe(0)

    const low = wisdomEffects(2)
    expect(low.spiritSocialBonus).toBe(-1)
    expect(low.abyssalContestBonus).toBe(-1)
  })

  it("untrained skill penalties: mental -3, physical/social -1", () => {
    expect(untrainedSkillPenalty("mental")).toBe(-3)
    expect(untrainedSkillPenalty("physical")).toBe(-1)
    expect(untrainedSkillPenalty("social")).toBe(-1)
  })

  it("xp costs for trait advancement", () => {
    expect(xpCost("attribute", 3)).toBe(15) // 3 x 5
    expect(xpCost("skill", 4)).toBe(12) // 4 x 3
    expect(xpCost("skillSpecialty", 1)).toBe(3) // flat 3
    expect(xpCost("rulingArcanum", 3)).toBe(18) // 3 x 6
    expect(xpCost("commonArcanum", 3)).toBe(21) // 3 x 7
    expect(xpCost("inferiorArcanum", 3)).toBe(24) // 3 x 8
    expect(xpCost("gnosis", 4)).toBe(32) // 4 x 8
    expect(xpCost("wisdom", 5)).toBe(15) // 5 x 3
    expect(xpCost("merit", 3)).toBe(6) // 3 x 2
    expect(xpCost("rote", 1)).toBe(2) // flat 2
    expect(xpCost("willpower", 1)).toBe(8) // flat 8
  })
})
