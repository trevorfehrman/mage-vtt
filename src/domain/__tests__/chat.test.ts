import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  createMessage,
  filterVisibleMessages,
  type Message,
} from "../chat"

describe("Chat", () => {
  it.effect("creates a public message visible to everyone", () =>
    Effect.gen(function* () {
      const msg = yield* createMessage({
        sessionId: "session-1",
        senderId: "player-1",
        senderName: "Arctus",
        text: "I cast Mage Sight.",
        visibility: { type: "public" },
      })

      expect(msg.text).toBe("I cast Mage Sight.")
      expect(msg.senderId).toBe("player-1")
      expect(msg.visibility._tag).toBe("public")
      expect(msg.timestamp).toBeDefined()
    }),
  )

  it.effect("creates a whisper visible only to sender and target", () =>
    Effect.gen(function* () {
      const msg = yield* createMessage({
        sessionId: "session-1",
        senderId: "storyteller-1",
        senderName: "ST",
        text: "You notice something strange about the sigils.",
        visibility: { type: "whisper", targetId: "player-2" },
      })

      expect(msg.visibility._tag).toBe("whisper")
      if (msg.visibility._tag === "whisper") {
        expect(msg.visibility.targetId).toBe("player-2")
      }
    }),
  )

  it.effect("creates a system message", () =>
    Effect.gen(function* () {
      const msg = yield* createMessage({
        sessionId: "session-1",
        senderId: "system",
        senderName: "System",
        text: "Arctus rolled 3 successes on Wits + Occult + Death.",
        visibility: { type: "public" },
        isSystem: true,
      })

      expect(msg.isSystem).toBe(true)
    }),
  )

  it.effect("filters messages by visibility for a player", () =>
    Effect.gen(function* () {
      const messages: Message[] = []

      messages.push(yield* createMessage({
        sessionId: "s1", senderId: "st", senderName: "ST",
        text: "Public message",
        visibility: { type: "public" },
      }))

      messages.push(yield* createMessage({
        sessionId: "s1", senderId: "st", senderName: "ST",
        text: "Secret to player-1",
        visibility: { type: "whisper", targetId: "player-1" },
      }))

      messages.push(yield* createMessage({
        sessionId: "s1", senderId: "st", senderName: "ST",
        text: "Secret to player-2",
        visibility: { type: "whisper", targetId: "player-2" },
      }))

      // Player-1 sees public + their whisper, not player-2's whisper
      const player1Visible = yield* filterVisibleMessages(messages, "player-1", "player")
      expect(player1Visible).toHaveLength(2)
      expect(player1Visible.map((m) => m.text)).toContain("Public message")
      expect(player1Visible.map((m) => m.text)).toContain("Secret to player-1")
      expect(player1Visible.map((m) => m.text)).not.toContain("Secret to player-2")
    }),
  )

  it.effect("storyteller sees all messages including all whispers", () =>
    Effect.gen(function* () {
      const messages: Message[] = []

      messages.push(yield* createMessage({
        sessionId: "s1", senderId: "p1", senderName: "P1",
        text: "Public",
        visibility: { type: "public" },
      }))

      messages.push(yield* createMessage({
        sessionId: "s1", senderId: "st", senderName: "ST",
        text: "Whisper to p1",
        visibility: { type: "whisper", targetId: "p1" },
      }))

      messages.push(yield* createMessage({
        sessionId: "s1", senderId: "st", senderName: "ST",
        text: "Whisper to p2",
        visibility: { type: "whisper", targetId: "p2" },
      }))

      const stVisible = yield* filterVisibleMessages(messages, "st", "storyteller")
      expect(stVisible).toHaveLength(3)
    }),
  )
})
