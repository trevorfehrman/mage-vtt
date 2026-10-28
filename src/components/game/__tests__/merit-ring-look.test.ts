import { describe, expect, it } from "@effect/vitest"
import { periodic, purseDice, purseTap, ringName, wrapIndex } from "../merit-ring-look"

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

describe("the purse's dice (MAG-67)", () => {
  // Destiny •• holds four; two are left this chapter; one is staged into this roll.
  it("read left to right: in the purse, staged into the tray, gone this chapter", () => {
    expect(purseDice({ capacity: 4, current: 2, staged: 1 })).toEqual(["purse", "staged", "gone", "gone"])
    expect(purseDice({ capacity: 4, current: 4, staged: 0 })).toEqual(["purse", "purse", "purse", "purse"])
    expect(purseDice({ capacity: 2, current: 0, staged: 0 })).toEqual(["gone", "gone"])
  })

  it("one input: a purse die goes to the tray, a staged die comes back, a gone die refills through itself", () => {
    const full = { capacity: 4, current: 3, staged: 0 }
    expect(purseTap(full, 2)).toEqual({ _tag: "stage", staged: 1 })
    expect(purseTap(full, 0)).toEqual({ _tag: "stage", staged: 3 })
    const some = { capacity: 4, current: 3, staged: 2 }
    expect(purseDice(some)).toEqual(["purse", "staged", "staged", "gone"])
    expect(purseTap(some, 2)).toEqual({ _tag: "stage", staged: 0 })
    expect(purseTap(some, 1)).toEqual({ _tag: "stage", staged: 1 })
    expect(purseTap(some, 3)).toEqual({ _tag: "refill", current: 4 })
    expect(purseTap({ capacity: 4, current: 0, staged: 0 }, 1)).toEqual({ _tag: "refill", current: 2 })
  })
})
