import { describe, expect, it } from "@effect/vitest"
import { resolveSeat, seatIsAnnounced } from "../seat"

describe("seatIsAnnounced", () => {
  const storyteller = { userId: "dev-1" }
  const player = { userId: "dev:phantom" }

  it("sitting in a player's seat is announced — whispers are private to their people", () => {
    expect(seatIsAnnounced(storyteller, player)).toBe(true)
  })

  it("sitting in the Storyteller's seat is announced", () => {
    expect(seatIsAnnounced(player, storyteller)).toBe(true)
  })

  it("a non-member Dev's seat is announced", () => {
    expect(seatIsAnnounced(null, player)).toBe(true)
  })

  it("your own seat is silent — it shows nothing you don't already see", () => {
    expect(seatIsAnnounced(player, { userId: "dev:phantom" })).toBe(false)
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
