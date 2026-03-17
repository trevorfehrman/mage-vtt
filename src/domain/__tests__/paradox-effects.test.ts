import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  paradoxDuration,
  paradoxBacklash,
  brandingSeverity,
  anomalyArea,
} from "../paradox-effects"

describe("Paradox Effects", () => {
  it.effect("paradox duration varies by wisdom", () =>
    Effect.gen(function* () {
      const high = yield* paradoxDuration("bedlam", 7)
      const low = yield* paradoxDuration("bedlam", 2)
      expect(low.minutes).toBeGreaterThan(high.minutes)
    }),
  )

  it.effect("backlash converts paradox successes to resistant bashing", () =>
    Effect.gen(function* () {
      const result = yield* paradoxBacklash(3)
      expect(result.resistantBashingDamage).toBe(3)
      expect(result.paradoxContained).toBe(true)
    }),
  )

  it.effect("branding severity escalates with arcanum dots", () =>
    Effect.gen(function* () {
      const mild = yield* brandingSeverity(1)
      expect(mild.socialPenalty).toBe(0)

      const severe = yield* brandingSeverity(3)
      expect(severe.socialPenalty).toBe(-1)

      const extreme = yield* brandingSeverity(5)
      expect(extreme.socialPenalty).toBe(-5)
    }),
  )

  it.effect("anomaly area = 20 yards per arcanum dot", () =>
    Effect.gen(function* () {
      expect(yield* anomalyArea(3)).toBe(60)
      expect(yield* anomalyArea(5)).toBe(100)
    }),
  )
})
