import { describe, expect, it, vi } from "@effect/vitest"
import { Schema } from "effect"
import {
  ActivityEntry,
  ActivityFeed,
  FEED_CAP,
  decodeFeed,
  mergeFeed,
  visibleEntries,
  type MessageEntry,
  type Reader,
  type RollEntry,
} from "../activity"
import { resolveSeat } from "../seat"
import { matchesConvexValidator, validatorJson } from "../testing/convex-validator"

/**
 * The Activity module's seam (issue #22 PRD): behavioral tests cross the module
 * interface only — the Convex query and the React hook are logic-free adapters
 * and get no tests. Covers the tracer bullet (issue #24: the entry union's wire
 * contract, the client-side per-entry decode) and the feed rules (issue #26:
 * the Reader × visibility matrix, the chronological merge).
 */

// --- Fixtures: well-formed wire entries, as the feed query projects them ---

const message = (
  over?: Partial<Omit<MessageEntry, "_tag" | "_id">> & { readonly _id?: string },
): MessageEntry =>
  ({
    _tag: "message",
    _id: "msg_1",
    timestamp: 1000,
    senderId: "user_a",
    senderName: "Arctus",
    text: "The door is warded.",
    visibilityType: "public",
    ...over,
  }) as MessageEntry

const roll = (
  over?: Partial<Omit<RollEntry, "_tag" | "_id">> & { readonly _id?: string },
): RollEntry =>
  ({
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
    ...over,
  }) as RollEntry

const messageEntry = message()

const whisperEntry = message({
  _id: "msg_2",
  timestamp: 1500,
  text: "Meet me outside.",
  visibilityType: "whisper",
  whisperTargetId: "user_b",
})

const rollEntry = roll({
  override: {
    invokedByUserId: "user_st",
    invokedByName: "The Storyteller",
    kind: "storyteller-action",
  },
})

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

// --- The visibility policy: the Reader × entry matrix (issue #26) ---

describe("visibleEntries: the Reader × visibility matrix", () => {
  // The cast: user_a whispers to user_b; user_c rolls one public, one Hidden.
  const publicMessage = message({ _id: "m_pub", visibilityType: "public" })
  const systemMessage = message({ _id: "m_sys", visibilityType: "system" })
  const whisper = message({
    _id: "m_whisper",
    visibilityType: "whisper",
    senderId: "user_a",
    whisperTargetId: "user_b",
  })
  const publicRoll = roll({ _id: "r_pub", userId: "user_c", visibility: "public" })
  const hiddenRoll = roll({ _id: "r_hidden", userId: "user_c", visibility: "hidden" })

  const feed = [publicMessage, systemMessage, whisper, publicRoll, hiddenRoll]

  const matrix: ReadonlyArray<{
    who: string
    reader: Reader
    sees: ReadonlyArray<ActivityEntry>
  }> = [
    { who: "a non-member sees no Activity at all", reader: null, sees: [] },
    {
      who: "an uninvolved Player sees the public and system entries only",
      reader: { userId: "user_z", role: "player" },
      sees: [publicMessage, systemMessage, publicRoll],
    },
    {
      who: "the Whisper sender sees their own Whisper",
      reader: { userId: "user_a", role: "player" },
      sees: [publicMessage, systemMessage, whisper, publicRoll],
    },
    {
      who: "the Whisper target sees the Whisper sent to them",
      reader: { userId: "user_b", role: "player" },
      sees: [publicMessage, systemMessage, whisper, publicRoll],
    },
    {
      who: "the Hidden-roll owner sees their own Hidden roll",
      reader: { userId: "user_c", role: "player" },
      sees: [publicMessage, systemMessage, publicRoll, hiddenRoll],
    },
    {
      who: "the Storyteller sees everything",
      reader: { userId: "user_st", role: "storyteller" },
      sees: feed,
    },
  ]

  for (const { who, reader, sees } of matrix) {
    it(who, () => {
      expect(visibleEntries(reader, feed)).toEqual(sees)
    })
  }

  it("a seated Reader (ADR-0013) sees exactly the target member's feed — replacement, not union", () => {
    // A Dev whose own sight is Storyteller-wide takes an uninvolved player's seat:
    // the wider sight is genuinely lost while seated.
    const own: NonNullable<Reader> = { userId: "user_st", role: "storyteller" }
    const target: NonNullable<Reader> = { userId: "user_z", role: "player" }
    const decision = resolveSeat({ isDev: true, own, seat: target })
    if (decision._tag !== "Seated") throw new Error("expected a Seated decision")

    const seatedFeed = visibleEntries(decision.member, feed)
    expect(seatedFeed).toEqual(visibleEntries(target, feed))
    expect(seatedFeed).not.toContainEqual(hiddenRoll)
    expect(seatedFeed).not.toContainEqual(whisper)
  })
})

// --- mergeFeed: the chronological merge (issue #26) ---

describe("mergeFeed", () => {
  it("interleaves by timestamp descending", () => {
    const a = message({ _id: "a", timestamp: 100 })
    const b = roll({ _id: "b", timestamp: 300 })
    const c = message({ _id: "c", timestamp: 200 })
    expect(mergeFeed([a, b, c])).toEqual([b, c, a])
  })

  it("keeps input order on timestamp ties", () => {
    const first = message({ _id: "first", timestamp: 100 })
    const second = roll({ _id: "second", timestamp: 100 })
    const third = message({ _id: "third", timestamp: 100 })
    expect(mergeFeed([first, second, third])).toEqual([first, second, third])
  })

  it("caps the feed at FEED_CAP, keeping the newest entries", () => {
    const entries = Array.from({ length: FEED_CAP + 50 }, (_, i) =>
      message({ _id: `m_${i}`, timestamp: i }),
    )
    const merged = mergeFeed(entries)
    expect(merged).toHaveLength(FEED_CAP)
    expect(merged[0]).toEqual(entries[entries.length - 1])
    expect(merged[merged.length - 1]).toEqual(entries[50])
  })

  it("does not mutate its input", () => {
    const a = message({ _id: "a", timestamp: 100 })
    const b = roll({ _id: "b", timestamp: 300 })
    const input = [a, b]
    mergeFeed(input)
    expect(input).toEqual([a, b])
  })
})
