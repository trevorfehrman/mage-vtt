import { describe, expect, it } from "@effect/vitest"
import { SHORE, TideCount, signedDice, stepTideCount, tideDraftDice, tidesGround, tidesNetInk, tidesSeam, tidesWeight } from "../tides-ground"

const ebb = (dice: number) => ({ source: "Hallowed ground", dice: -dice })
const flood = (dice: number) => ({ source: "Ley line nexus", dice })

describe("tidesWeight", () => {
  it("sums each side and nets them", () => {
    expect(tidesWeight([ebb(1), ebb(2), flood(1)])).toEqual({ ebb: 3, flood: 1, net: -2 })
  })
})

describe("tidesGround (treatment H)", () => {
  it("is nothing when there is no weather", () => {
    expect(tidesGround([])).toBeUndefined()
  })
  it("paints only the ebb side's ink when only ebbs are named", () => {
    const css = tidesGround([ebb(2)])!
    expect(css).toContain("var(--accent)")
    expect(css).not.toContain("var(--paradox)")
    expect(tidesSeam([ebb(2)]).floodAlpha).toBe(0)
  })
  it("slides the seam toward the lighter side as the net grows", () => {
    expect(tidesSeam([]).seam).toBe(50)
    expect(tidesSeam([flood(1)]).seam).toBe(41)
    expect(tidesSeam([flood(3)]).seam).toBe(23)
    expect(tidesSeam([ebb(3)]).seam).toBe(77)
  })
  it("weighs each side by its own dice, alpha climbing then capping", () => {
    expect(tidesSeam([ebb(1), flood(2)])).toEqual({ seam: 41, ebbAlpha: 11.5, floodAlpha: 15 })
    expect(tidesSeam([flood(9)]).floodAlpha).toBe(22)
  })
  it("never lets one side erase the other's edge, however lopsided", () => {
    const lopsided = [flood(5), flood(5), flood(5), ebb(1)]
    const { seam, ebbAlpha } = tidesSeam(lopsided)
    expect(seam).toBe(4)
    expect(ebbAlpha).toBeGreaterThan(0)
    // the green wash still paints the top-left corner
    expect(tidesGround(lopsided)).toContain("linear-gradient(150deg, color-mix(in srgb, var(--accent)")
  })
})

describe("the eyebrow's net", () => {
  it("wears dim at zero and its side's ink otherwise", () => {
    expect(tidesNetInk(0)).toBe("var(--dim)")
    expect(tidesNetInk(-1)).toBe("var(--accent)")
    expect(tidesNetInk(2)).toBe("var(--paradox)")
  })
  it("signs dice with a true minus, and zero bare", () => {
    expect(signedDice(-2)).toBe("−2")
    expect(signedDice(3)).toBe("+3")
    expect(signedDice(0)).toBe("0")
  })
})

describe("the ST's draft tide (MAG-45)", () => {
  const draft = (side: "ebb" | "flood", count: number) => ({ side, source: "Ley line nexus", count: TideCount.make(count) })

  it("takes its sign from the shore it opens on", () => {
    expect(tideDraftDice(draft("ebb", 2))).toBe(-2)
    expect(tideDraftDice(draft("flood", 3))).toBe(3)
  })

  it("steps its count within 1..10", () => {
    expect(stepTideCount(TideCount.make(1), -1)).toBe(1)
    expect(stepTideCount(TideCount.make(4), 1)).toBe(5)
    expect(stepTideCount(TideCount.make(10), 1)).toBe(10)
  })

  it("refuses a count outside 1..10", () => {
    expect(() => TideCount.make(0)).toThrow()
    expect(() => TideCount.make(11)).toThrow()
  })

  it("mirrors the shores: the number sits outboard, toward each shore's own edge", () => {
    expect(SHORE.ebb.numberFirst).toBe(true)
    expect(SHORE.flood.numberFirst).toBe(false)
    expect(SHORE.ebb.sign).toBe(-1)
    expect(SHORE.flood.sign).toBe(1)
  })
})
