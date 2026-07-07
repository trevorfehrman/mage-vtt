import { Option, Schema } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { SeamError } from "../seam-errors"

// The union is the client's decode target for ConvexError payloads (issue
// #36): a known tag decodes to its class despite wire extras the bridge's
// mapEffectError copies along (stack, message); an unknown tag is a decode
// miss so an old client degrades to the generic fallback (ADR-0010).
const decode = Schema.decodeUnknownOption(SeamError)

describe("SeamError union", () => {
  it("decodes a seam payload to its tagged class, ignoring wire extras", () => {
    const decoded = decode({
      _tag: "InsufficientMana",
      current: 2,
      required: 5,
      stack: "Error\n    at somewhere",
    })

    expect(Option.isSome(decoded)).toBe(true)
    const error = Option.getOrThrow(decoded)
    expect(error._tag).toBe("InsufficientMana")
    expect(error._tag === "InsufficientMana" && error.required).toBe(5)
  })

  it("a bad invite code crosses the wire typed: the generic not-found decodes (issue #50)", () => {
    // ADR-0010: not-found is one tag, never per-entity variants — the join
    // refusal is DocumentNotFound with the invite code as the missed key.
    const decoded = decode({
      _tag: "DocumentNotFound",
      table: "sessions",
      id: "ABCD-EF23",
      stack: "Error\n    at somewhere",
    })

    expect(Option.isSome(decoded)).toBe(true)
    const error = Option.getOrThrow(decoded)
    expect(error._tag).toBe("DocumentNotFound")
  })

  it("a tag outside the contract is a decode miss, not an answer", () => {
    expect(Option.isNone(decode({ _tag: "BrandNewServerError", detail: 1 }))).toBe(true)
    expect(Option.isNone(decode("not even an object"))).toBe(true)
  })
})
