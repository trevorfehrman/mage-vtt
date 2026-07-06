import { describe, expect, it } from "@effect/vitest"
import {
  paradoxDuration,
  paradoxBacklash,
  brandingSeverity,
  anomalyArea,
} from "../paradox-effects"

describe("Paradox Effects", () => {
  it("paradox duration varies by wisdom", () => {
    const high = paradoxDuration("bedlam", 7)
    const low = paradoxDuration("bedlam", 2)
    expect(low.minutes).toBeGreaterThan(high.minutes)
  })

  it("backlash converts paradox successes to resistant bashing", () => {
    const result = paradoxBacklash(3)
    expect(result.resistantBashingDamage).toBe(3)
    expect(result.paradoxContained).toBe(true)
  })

  it("branding severity escalates with arcanum dots", () => {
    const mild = brandingSeverity(1)
    expect(mild.socialPenalty).toBe(0)

    const severe = brandingSeverity(3)
    expect(severe.socialPenalty).toBe(-1)

    const extreme = brandingSeverity(5)
    expect(extreme.socialPenalty).toBe(-5)
  })

  it("anomaly area = 20 yards per arcanum dot", () => {
    expect(anomalyArea(3)).toBe(60)
    expect(anomalyArea(5)).toBe(100)
  })
})
