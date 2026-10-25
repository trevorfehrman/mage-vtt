import { describe, expect, it } from "@effect/vitest"
import { PlayerId, SessionId } from "../ids"
import type { Id } from "../../../convex/_generated/dataModel"
import { Membership, headlineName, tableName, tableNameOf } from "../membership"

/**
 * The name a member goes by at the table (owner, 2026-10-25: the Chronicle
 * names people by character, as the video tiles do): their sheet's
 * headline in this session, else their account name.
 */
const member = (sheetName?: string) =>
  new Membership({
    userId: PlayerId.make("user-1"),
    sessionId: SessionId.make("session-1"),
    role: "player",
    displayName: "Trevor Fehrman",
    ...(sheetName !== undefined && { sheetName }),
  })

describe("a member's table name", () => {
  it("is their sheet's name when they have one", () => {
    expect(tableName(member("Tessellate"))).toBe("Tessellate")
  })

  it("is their account name without a sheet — a Storyteller, a fresh seat", () => {
    expect(tableName(member())).toBe("Trevor Fehrman")
  })
})

describe("a sheet's headline name", () => {
  it("is the shadow name when there is one", () => {
    expect(headlineName({ name: "Yelena Voss", shadowName: "Tessellate" })).toBe("Tessellate")
  })

  it("is the given name otherwise", () => {
    expect(headlineName({ name: "Yelena Voss" })).toBe("Yelena Voss")
  })
})

describe("a roster row's table name", () => {
  const m1 = "m-1" as Id<"sessionMembers">
  const m2 = "m-2" as Id<"sessionMembers">
  const sheets = [{ sessionMemberId: m1, name: "Yelena Voss", shadowName: "Tessellate" }]

  it("reads the headline off the sheet the member plays", () => {
    expect(tableNameOf({ _id: m1, displayName: "Trevor Fehrman" }, sheets)).toBe("Tessellate")
  })

  it("keeps the account name for a member with no sheet", () => {
    expect(tableNameOf({ _id: m2, displayName: "Morgan" }, sheets)).toBe("Morgan")
  })
})
