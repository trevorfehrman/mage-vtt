import { Option } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  anomalyArea,
  brandingSeverity,
  havocOutcome,
  havocWords,
  paradoxBacklash,
  paradoxSpan,
  spanMillis,
  spanWords,
} from "../paradox-effects"
import { WisdomRank } from "../wisdom"

describe("Paradox Effects", () => {
  describe("the duration table (Mage p. 268, MAG-56)", () => {
    it("Wisdom 5 and above holds every lasting Paradox to one scene", () => {
      for (const wisdom of [5, 6, 7, 8, 9, 10] as const) {
        expect(paradoxSpan("bedlam", wisdom)).toBe("scene")
        expect(paradoxSpan("anomaly", wisdom)).toBe("scene")
        expect(paradoxSpan("branding", wisdom)).toBe("scene")
        expect(paradoxSpan("manifestation", wisdom)).toBe("scene")
      }
    })

    it("Bedlam's column: two hours, 12 hours, 24 hours, two days as Wisdom falls 4 → 1", () => {
      expect(paradoxSpan("bedlam", 4)).toBe("twoHours")
      expect(paradoxSpan("bedlam", 3)).toBe("twelveHours")
      expect(paradoxSpan("bedlam", 2)).toBe("day")
      expect(paradoxSpan("bedlam", 1)).toBe("twoDays")
    })

    it("Anomaly, Branding and Manifestation share the longer column: 24 hours, two days, a week, a month", () => {
      for (const kind of ["anomaly", "branding", "manifestation"] as const) {
        expect(paradoxSpan(kind, 4)).toBe("day")
        expect(paradoxSpan(kind, 3)).toBe("twoDays")
        expect(paradoxSpan(kind, 2)).toBe("week")
        expect(paradoxSpan(kind, 1)).toBe("month")
      }
    })

    it("the table is total over every Wisdom rank", () => {
      for (const wisdom of WisdomRank.literals) {
        expect(spanWords(paradoxSpan("bedlam", wisdom))).toMatch(/\S/)
      }
    })

    it("speaks the book's words", () => {
      expect(spanWords("scene")).toBe("one scene")
      expect(spanWords("twoHours")).toBe("two hours")
      expect(spanWords("twelveHours")).toBe("12 hours")
      expect(spanWords("day")).toBe("24 hours")
      expect(spanWords("twoDays")).toBe("two days")
      expect(spanWords("week")).toBe("one week")
      expect(spanWords("month")).toBe("one month")
    })
  })

  describe("the Havoc Wisdom roll (Mage p. 268, MAG-56)", () => {
    it("no successes reverse the spell; any success leaves it as cast; five hand +2 to dispel", () => {
      expect(havocOutcome(0)).toBe("reversed")
      expect(havocOutcome(1)).toBe("unaltered")
      expect(havocOutcome(4)).toBe("unaltered")
      expect(havocOutcome(5)).toBe("unalteredDispelBonus")
      expect(havocOutcome(7)).toBe("unalteredDispelBonus")
    })

    it("speaks each outcome", () => {
      expect(havocWords("reversed")).toBe("reversed")
      expect(havocWords("unaltered")).toBe("runs true")
      expect(havocWords("unalteredDispelBonus")).toBe("runs true · +2 to dispel")
    })
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

describe("spanMillis (MAG-60)", () => {
  it("a scene has no clock; the rest are the book's hours and days", () => {
    expect(spanMillis("scene")).toEqual(Option.none())
    expect(spanMillis("twoHours")).toEqual(Option.some(2 * 3_600_000))
    expect(spanMillis("day")).toEqual(Option.some(24 * 3_600_000))
    expect(spanMillis("month")).toEqual(Option.some(30 * 24 * 3_600_000))
  })
})
