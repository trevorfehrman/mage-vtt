import { describe, expect, it, vi } from "@effect/vitest"
import { Schema } from "effect"
import { ActivityEntry, ActivityFeed, decodeFeed } from "../activity"
import { matchesConvexValidator, validatorJson } from "../testing/convex-validator"

/**
 * The Activity module's seam (issue #22 PRD): behavioral tests cross the module
 * interface only — the Convex query and the React hook are logic-free adapters
 * and get no tests. This file covers the tracer bullet (issue #24): the entry
 * union's wire contract and the client-side per-entry decode.
 */

// --- Fixtures: well-formed wire entries, as the feed query projects them ---

const messageEntry = {
  _tag: "message",
  _id: "msg_1",
  timestamp: 1000,
  senderId: "user_a",
  senderName: "Arctus",
  text: "The door is warded.",
  visibilityType: "public",
} as const

const whisperEntry = {
  _tag: "message",
  _id: "msg_2",
  timestamp: 1500,
  senderId: "user_a",
  senderName: "Arctus",
  text: "Meet me outside.",
  visibilityType: "whisper",
  whisperTargetId: "user_b",
} as const

const rollEntry = {
  _tag: "roll",
  _id: "roll_1",
  timestamp: 2000,
  userId: "user_b",
  displayName: "Sacrosanct",
  components: [{ type: "attribute", name: "Wits", dots: 3 }],
  poolSize: 3,
  rolls: [8, 3, 10],
  explosions: [7],
  roteRerolls: [],
  successes: 2,
  isChanceDie: false,
  isDramaticFailure: false,
  isExceptionalSuccess: false,
  visibility: "public",
  againThreshold: 10,
  isRoteAction: false,
  summary: "Sacrosanct rolled 3 dice.",
  override: {
    invokedByUserId: "user_st",
    invokedByName: "The Storyteller",
    kind: "storyteller-action",
  },
} as const

// --- Property-based round-trip (ADR-0005's safety net, extended to returns) ---

describe("ActivityEntry: the wire contract", () => {
  const node = validatorJson(ActivityFeed)
  const encode = Schema.encodeUnknownSync(ActivityEntry)

  it.prop(
    "arbitrary entries pass the derived returns validator and round-trip through decodeFeed",
    [Schema.toArbitrary(ActivityEntry)],
    ([entry]) => {
      const wire = encode(entry)
      expect(matchesConvexValidator([wire], node)).toBe(true)
      expect(decodeFeed([wire])).toEqual([entry])
    },
  )
})

// --- decodeFeed: atom-level failure isolation (ADR-0009) ---

describe("decodeFeed", () => {
  it("a well-formed list decodes wholly, in order", () => {
    const feed = decodeFeed([rollEntry, whisperEntry, messageEntry])
    expect(feed).toEqual([rollEntry, whisperEntry, messageEntry])
  })

  it("a list with one corrupt entry yields the others and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
      const corrupt = { ...rollEntry, successes: "two" }
      const feed = decodeFeed([messageEntry, corrupt, whisperEntry])
      expect(feed).toEqual([messageEntry, whisperEntry])
      expect(warn).toHaveBeenCalledTimes(1)
    } finally {
      warn.mockRestore()
    }
  })

  it("an entry of an unknown kind drops without blanking the feed", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
      const future = { _tag: "initiative", _id: "x", timestamp: 3000 }
      expect(decodeFeed([future, messageEntry])).toEqual([messageEntry])
      expect(warn).toHaveBeenCalledTimes(1)
    } finally {
      warn.mockRestore()
    }
  })

  it("an empty feed decodes to an empty feed", () => {
    expect(decodeFeed([])).toEqual([])
  })
})
