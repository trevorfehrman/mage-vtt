import { describe, expect, it } from "@effect/vitest"
import { resolveSeat, seatWidensReads } from "../seat"

describe("seatWidensReads", () => {
  it("a player sitting in the Storyteller's seat widens", () => {
    expect(seatWidensReads("player", "storyteller")).toBe(true)
  })

  it("a Storyteller sitting in a player's seat narrows — silent", () => {
    expect(seatWidensReads("storyteller", "player")).toBe(false)
  })

  it("a same-sight seat is silent", () => {
    expect(seatWidensReads("player", "player")).toBe(false)
    expect(seatWidensReads("storyteller", "storyteller")).toBe(false)
  })

  it("a non-member Dev gains sight from any seat", () => {
    expect(seatWidensReads(null, "player")).toBe(true)
    expect(seatWidensReads(null, "storyteller")).toBe(true)
  })
})

describe("resolveSeat", () => {
  type Member = { userId: string; role: "player" | "storyteller" }
  const own: Member = { userId: "dev-1", role: "storyteller" }
  const target: Member = { userId: "dev:phantom", role: "player" }

  it("no seat requested reads as yourself", () => {
    const decision = resolveSeat({ isDev: true, own, seat: undefined })
    expect(decision).toEqual({ _tag: "OwnSeat", member: own })
  })

  it("no seat requested by a non-member reads as nobody", () => {
    const decision = resolveSeat({ isDev: false, own: null, seat: undefined })
    expect(decision).toEqual({ _tag: "OwnSeat", member: null })
  })

  it("a Dev takes the requested seat — replacement, not union", () => {
    const decision = resolveSeat({ isDev: true, own, seat: target })
    expect(decision).toEqual({ _tag: "Seated", member: target })
  })

  it("a non-Dev passing a seat is refused, even for a seat that exists", () => {
    const decision = resolveSeat({ isDev: false, own, seat: target })
    expect(decision).toEqual({ _tag: "SeatRefused" })
  })

  it("a non-Dev passing an unknown seat is refused, not told it's unknown", () => {
    const decision = resolveSeat({ isDev: false, own, seat: null })
    expect(decision).toEqual({ _tag: "SeatRefused" })
  })

  it("a Dev passing a seat that isn't a member of this Session fails loudly", () => {
    const decision = resolveSeat({ isDev: true, own, seat: null })
    expect(decision).toEqual({ _tag: "SeatNotFound" })
  })
})
