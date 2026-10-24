import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import { SessionMemberRow } from "../session"
import { makeAldousSheet, makeCorvinSheet } from "../testing/fixtures"
import { videoSeats } from "../video-rail"

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
      { memberId: "member-st", displayName: "Morrigan", role: "storyteller", sheet: null },
      { memberId: "member-new", displayName: "Newcomer", role: "player", sheet: null },
    ])
  })

  it("gives a Storyteller who has a sheet their sheet", () => {
    const seats = videoSeats([member("member-st", "storyteller", 1)], [makeAldousSheet({ sessionMemberId: "member-st" })])
    expect(seats[0]?.sheet?.name).toBe("Aldous")
  })
})
