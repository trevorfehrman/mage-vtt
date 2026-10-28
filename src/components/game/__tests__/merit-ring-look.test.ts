import { describe, expect, it } from "@effect/vitest"
import { periodic, pipStates, ringName, wrapIndex } from "../merit-ring-look"

describe("the ring's names", () => {
  it("a name over fifteen characters hangs short; the door says the whole of it", () => {
    expect(ringName("Encyclopedic Knowledge")).toBe("Encyclopedia")
    expect(ringName("Fighting Style: Kung Fu")).toBe("Kung Fu")
    expect(ringName("Danger Sense")).toBe("Danger Sense")
  })
})

describe("the wheel's placement", () => {
  it("wraps an index into the ring and a distance into one period, the short way round", () => {
    expect(wrapIndex(5, 7)).toBe(2)
    expect(wrapIndex(5, -1)).toBe(4)
    expect(periodic(10, 4)).toBe(4)
    expect(periodic(10, 6)).toBe(-4)
    expect(periodic(10, -6)).toBe(4)
  })
})

describe("the purse's pips (MAG-67)", () => {
  // Destiny •• holds four; two are left this chapter; one is staged into this roll.
  it("read left to right: staged into this roll, left in the purse, gone this chapter", () => {
    expect(pipStates({ capacity: 4, current: 2, staged: 1 })).toEqual(["staged", "purse", "gone", "gone"])
    expect(pipStates({ capacity: 4, current: 4, staged: 0 })).toEqual(["purse", "purse", "purse", "purse"])
    expect(pipStates({ capacity: 2, current: 0, staged: 0 })).toEqual(["gone", "gone"])
    expect(pipStates({ capacity: 4, current: 3, staged: 3 })).toEqual(["staged", "staged", "staged", "gone"])
  })
})
