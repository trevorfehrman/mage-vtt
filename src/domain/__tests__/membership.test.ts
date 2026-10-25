import { describe, expect, it } from "@effect/vitest"
import { PlayerId, SessionId } from "../ids"
import { Membership, headlineName, tableNameOf } from "../membership"

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
    expect(member("Tessellate").tableName).toBe("Tessellate")
  })

  it("is their account name without a sheet — a Storyteller, a fresh seat", () => {
    expect(member().tableName).toBe("Trevor Fehrman")
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
  const sheets = [{ sessionMemberId: "m-1", name: "Yelena Voss", shadowName: "Tessellate" }]

  it("reads the headline off the sheet the member plays", () => {
    expect(tableNameOf({ _id: "m-1", displayName: "Trevor Fehrman" }, sheets)).toBe("Tessellate")
  })

  it("keeps the account name for a member with no sheet", () => {
    expect(tableNameOf({ _id: "m-2", displayName: "Morgan" }, sheets)).toBe("Morgan")
  })
})
