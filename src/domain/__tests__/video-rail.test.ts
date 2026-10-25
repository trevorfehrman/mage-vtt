import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import { SessionMemberRow } from "../session"
import { makeAldousSheet, makeCorvinSheet } from "../testing/fixtures"
import { seatName, videoSeats, whisperable } from "../video-rail"

const member = (id: string, role: "storyteller" | "player", joined: number, displayName = id) =>
  Schema.decodeUnknownSync(SessionMemberRow)({
    _id: id,
    _creationTime: joined,
    sessionId: "session-1",
    userId: `user-${id}`,
    role,
    displayName,
  })

describe("videoSeats", () => {
  it("seats the Storyteller first, then the players in the order they joined", () => {
    const seats = videoSeats(
      [member("member-b", "player", 3), member("member-st", "storyteller", 2), member("member-a", "player", 1)],
      [],
    )
    expect(seats.map((s) => s.memberId)).toEqual(["member-st", "member-a", "member-b"])
  })

  it("gives each player their own sheet, matched by membership", () => {
    const aldous = makeAldousSheet()
    const corvin = makeCorvinSheet()
    const seats = videoSeats(
      [member("member-corvin", "player", 1), member("member-aldous", "player", 2)],
      [aldous, corvin],
    )
    expect(seats.map((s) => s.sheet?.name)).toEqual(["Corvin Ashe", "Aldous"])
  })

  it("keeps a seat for a member with no sheet", () => {
    const seats = videoSeats(
      [member("member-st", "storyteller", 1, "Morrigan"), member("member-new", "player", 2, "Newcomer")],
      [],
    )
    expect(seats).toEqual([
      { memberId: "member-st", userId: "user-member-st", displayName: "Morrigan", role: "storyteller", sheet: null },
      { memberId: "member-new", userId: "user-member-new", displayName: "Newcomer", role: "player", sheet: null },
    ])
  })

  it("gives a Storyteller who has a sheet their sheet", () => {
    const seats = videoSeats([member("member-st", "storyteller", 1)], [makeAldousSheet({ sessionMemberId: "member-st" })])
    expect(seats[0]?.sheet?.name).toBe("Aldous")
  })

  it("names each seat by its sheet's headline, else the member's own name", () => {
    const seats = videoSeats(
      [member("member-corvin", "player", 1), member("member-new", "player", 2, "Newcomer")],
      [makeCorvinSheet({ shadowName: "Tessellate" })],
    )
    expect(seats.map(seatName)).toEqual(["Tessellate", "Newcomer"])
  })

  it("offers every seat but the viewer's own to whisper, named as their tiles are", () => {
    const seats = videoSeats(
      [member("member-st", "storyteller", 1, "Morrigan"), member("member-corvin", "player", 2)],
      [makeCorvinSheet({ shadowName: "Tessellate" })],
    )
    expect(whisperable(seats, "user-member-st")).toEqual([{ id: "user-member-corvin", name: "Tessellate" }])
  })
})
