import { describe, expect, it } from "@effect/vitest"
import type { MessageEntry, RollEntry } from "../activity"
import { NOTHING_UNREAD, newestMessageAt, unreadFor } from "../working-slot"

/**
 * The working slot's news (MAG-53): what arrived while the tray was showing,
 * counted for the Chronicle's switch. A whisper to you is its own count;
 * everything else someone else said is chat.
 */

const line = (over: Partial<Omit<MessageEntry, "_id">> & { _id?: string }): MessageEntry =>
  ({
    _tag: "message",
    _id: "m",
    timestamp: 100,
    senderId: "user_b",
    senderName: "B",
    text: "hi",
    visibilityType: "public",
    ...over,
  }) as MessageEntry

const roll = { _tag: "roll", _id: "r", timestamp: 500, userId: "user_b" } as unknown as RollEntry

describe("unreadFor", () => {
  it("counts nothing until something arrives after what was seen", () => {
    expect(unreadFor([line({ timestamp: 100 })], "user_a", 100)).toEqual(NOTHING_UNREAD)
  })

  it("counts other people's lines after what was seen as chat", () => {
    const entries = [line({ _id: "1", timestamp: 90 }), line({ _id: "2", timestamp: 110 }), line({ _id: "3", timestamp: 120 })]
    expect(unreadFor(entries, "user_a", 100)).toEqual({ chat: 2, whisper: 0 })
  })

  it("never counts the viewer's own lines", () => {
    expect(unreadFor([line({ timestamp: 110, senderId: "user_a" })], "user_a", 100)).toEqual(NOTHING_UNREAD)
  })

  it("counts a whisper to the viewer — single or in a group — as a whisper", () => {
    const entries = [
      line({ _id: "1", timestamp: 110, visibilityType: "whisper", whisperTargetId: "user_a" }),
      line({ _id: "2", timestamp: 120, visibilityType: "whisper", whisperTargetIds: ["user_c", "user_a"] }),
    ]
    expect(unreadFor(entries, "user_a", 100)).toEqual({ chat: 0, whisper: 2 })
  })

  it("ignores system lines and everything that isn't a message", () => {
    expect(unreadFor([line({ timestamp: 110, visibilityType: "system" }), roll], "user_a", 100)).toEqual(NOTHING_UNREAD)
  })
})

describe("newestMessageAt", () => {
  it("is the newest message's timestamp, rolls aside", () => {
    expect(newestMessageAt([line({ timestamp: 90 }), roll, line({ timestamp: 120 })])).toBe(120)
  })

  it("is zero for a feed with no messages", () => {
    expect(newestMessageAt([roll])).toBe(0)
  })
})
