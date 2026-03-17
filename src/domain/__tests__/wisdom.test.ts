import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  degenerationDicePool,
  wisdomEffects,
  untrainedSkillPenalty,
  xpCost,
} from "../wisdom"

describe("Wisdom & Morality", () => {
  it.effect("degeneration dice pool by wisdom level", () =>
    Effect.gen(function* () {
      expect(yield* degenerationDicePool(10)).toBe(5)
      expect(yield* degenerationDicePool(8)).toBe(4)
      expect(yield* degenerationDicePool(6)).toBe(3)
      expect(yield* degenerationDicePool(4)).toBe(3)
      expect(yield* degenerationDicePool(2)).toBe(2)
      expect(yield* degenerationDicePool(1)).toBe(2)
    }),
  )

  it.effect("wisdom effects on social rolls with spirits", () =>
    Effect.gen(function* () {
      const high = yield* wisdomEffects(9)
      expect(high.spiritSocialBonus).toBe(1)
      expect(high.abyssalContestBonus).toBe(1)

      const normal = yield* wisdomEffects(5)
      expect(normal.spiritSocialBonus).toBe(0)

      const low = yield* wisdomEffects(2)
      expect(low.spiritSocialBonus).toBe(-1)
      expect(low.abyssalContestBonus).toBe(-1)
    }),
  )

  it.effect("untrained skill penalties: mental -3, physical/social -1", () =>
    Effect.gen(function* () {
      expect(yield* untrainedSkillPenalty("mental")).toBe(-3)
      expect(yield* untrainedSkillPenalty("physical")).toBe(-1)
      expect(yield* untrainedSkillPenalty("social")).toBe(-1)
    }),
  )

  it.effect("xp costs for trait advancement", () =>
    Effect.gen(function* () {
      expect(yield* xpCost("attribute", 3)).toBe(15)     // 3 x 5
      expect(yield* xpCost("skill", 4)).toBe(12)          // 4 x 3
      expect(yield* xpCost("skillSpecialty", 1)).toBe(3)   // flat 3
      expect(yield* xpCost("rulingArcanum", 3)).toBe(18)   // 3 x 6
      expect(yield* xpCost("commonArcanum", 3)).toBe(21)   // 3 x 7
      expect(yield* xpCost("inferiorArcanum", 3)).toBe(24) // 3 x 8
      expect(yield* xpCost("gnosis", 4)).toBe(32)          // 4 x 8
      expect(yield* xpCost("wisdom", 5)).toBe(15)          // 5 x 3
      expect(yield* xpCost("merit", 3)).toBe(6)            // 3 x 2
      expect(yield* xpCost("rote", 1)).toBe(2)             // flat 2
      expect(yield* xpCost("willpower", 1)).toBe(8)        // flat 8
    }),
  )
})
