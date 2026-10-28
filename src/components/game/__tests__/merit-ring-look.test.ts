import { describe, expect, it } from "@effect/vitest"
import { canonicalPurse, periodic, reconcilePurse, ringName, tapPurseDie, wrapIndex, type PurseLayout } from "../merit-ring-look"

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
  it("the counts alone lay the purse out: in the purse, staged, gone", () => {
    expect(canonicalPurse({ capacity: 4, current: 2, staged: 1 })).toEqual(["purse", "staged", "gone", "gone"])
    expect(canonicalPurse({ capacity: 2, current: 0, staged: 0 })).toEqual(["gone", "gone"])
  })

  it("one input, any order: tap a purse die and it goes to the tray; tap it again and it comes back; tap a gone die and the purse refills through it", () => {
    const full: PurseLayout = ["purse", "purse", "purse", "purse"]
    const one = tapPurseDie(full, 1)
    expect(one).toEqual({ layout: ["purse", "staged", "purse", "purse"], act: { _tag: "stage", staged: 1 } })
    const two = tapPurseDie(one.layout, 3)
    expect(two).toEqual({ layout: ["purse", "staged", "purse", "staged"], act: { _tag: "stage", staged: 2 } })
    expect(tapPurseDie(two.layout, 1)).toEqual({ layout: ["purse", "purse", "purse", "staged"], act: { _tag: "stage", staged: 1 } })
    expect(tapPurseDie(["purse", "gone", "gone", "gone"], 2)).toEqual({
      layout: ["purse", "gone", "purse", "gone"],
      act: { _tag: "refill", current: 2 },
    })
  })

  it("a remembered layout stands while it agrees with the counts; the roll takes exactly the staged dice; anything else is canonical", () => {
    const remembered: PurseLayout = ["purse", "staged", "purse", "staged"]
    expect(reconcilePurse(remembered, { capacity: 4, current: 4, staged: 2 })).toBe(remembered)
    // the roll resolved: the pool emptied and the purse dropped by two
    expect(reconcilePurse(remembered, { capacity: 4, current: 2, staged: 0 })).toEqual(["purse", "gone", "purse", "gone"])
    // a hand edit the layout cannot explain
    expect(reconcilePurse(remembered, { capacity: 4, current: 1, staged: 0 })).toEqual(["purse", "gone", "gone", "gone"])
  })
})
