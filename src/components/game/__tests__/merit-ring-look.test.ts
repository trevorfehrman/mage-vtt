import { describe, expect, it } from "@effect/vitest"
import { periodic, pipStates, pipTap, ringName, wrapIndex } from "../merit-ring-look"

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
  it("read left to right: in the purse, staged into this roll, gone this chapter", () => {
    expect(pipStates({ capacity: 4, current: 2, staged: 1 })).toEqual(["purse", "staged", "gone", "gone"])
    expect(pipStates({ capacity: 4, current: 4, staged: 0 })).toEqual(["purse", "purse", "purse", "purse"])
    expect(pipStates({ capacity: 2, current: 0, staged: 0 })).toEqual(["gone", "gone"])
  })

  it("a tap stages through a purse pip, takes back through a staged pip, and refills through a gone pip", () => {
    const purse = { capacity: 4, current: 3, staged: 0 }
    // the first pip: stage it and everything right of it that is in the purse
    expect(pipTap(purse, 0)).toEqual({ _tag: "stage", staged: 3 })
    expect(pipTap(purse, 2)).toEqual({ _tag: "stage", staged: 1 })
    // staged pips are the rightmost in the purse; tapping one takes it and those left of it back
    const some = { capacity: 4, current: 3, staged: 2 }
    expect(pipStates(some)).toEqual(["purse", "staged", "staged", "gone"])
    expect(pipTap(some, 2)).toEqual({ _tag: "stage", staged: 0 })
    expect(pipTap(some, 1)).toEqual({ _tag: "stage", staged: 1 })
    // a gone pip: fill the purse through it (click-through)
    expect(pipTap(some, 3)).toEqual({ _tag: "refill", current: 4 })
    expect(pipTap({ capacity: 4, current: 0, staged: 0 }, 1)).toEqual({ _tag: "refill", current: 2 })
  })
})
