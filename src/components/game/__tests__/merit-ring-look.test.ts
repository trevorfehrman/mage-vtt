import { describe, expect, it } from "@effect/vitest"
import { periodic, ringName, wrapIndex } from "../merit-ring-look"

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
