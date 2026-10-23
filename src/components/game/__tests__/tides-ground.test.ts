import { describe, expect, it } from "@effect/vitest"
import { signedDice, tidesGround, tidesNetInk, tidesWeight } from "../tides-ground"

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
    expect(css).not.toContain("var(--paradox) 1")
    expect(css).not.toContain("var(--paradox) 2")
  })
  it("slides the seam toward the lighter side as the net grows", () => {
    const seam = (css: string) => Number(/transparent (\d+)%/.exec(css.split("90deg")[1]!)![1])
    expect(seam(tidesGround([flood(3)])!)).toBeLessThan(seam(tidesGround([flood(1)])!))
    expect(seam(tidesGround([ebb(3)])!)).toBeGreaterThan(seam(tidesGround([ebb(1)])!))
  })
  it("never lets one side erase the other's edge", () => {
    const css = tidesGround([flood(5), flood(5), flood(5)])!
    const base = css.split("90deg")[1]!
    expect(base).toMatch(/transparent (0|[1-9]\d?)%/)
  })
})

describe("the eyebrow's net", () => {
  it("wears dim at zero and its side's ink otherwise", () => {
    expect(tidesNetInk(0)).toBe("var(--dim)")
    expect(tidesNetInk(-1)).toBe("var(--accent)")
    expect(tidesNetInk(2)).toBe("var(--paradox)")
  })
  it("signs dice with a true minus", () => {
    expect(signedDice(-2)).toBe("−2")
    expect(signedDice(3)).toBe("+3")
  })
})
