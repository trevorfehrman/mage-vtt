import { Effect, Schema } from "effect"

// --- Visibility ---

export class PublicVisibility extends Schema.TaggedClass<PublicVisibility>()(
  "public",
  {},
) {}

export class WhisperVisibility extends Schema.TaggedClass<WhisperVisibility>()(
  "whisper",
  { targetId: Schema.String },
) {}

const Visibility = Schema.Union([PublicVisibility, WhisperVisibility])
type Visibility = typeof Visibility.Type

// --- Message ---

export class Message extends Schema.Class<Message>("Message")({
  id: Schema.String,
  sessionId: Schema.String,
  senderId: Schema.String,
  senderName: Schema.String,
  text: Schema.String,
  visibility: Visibility,
  isSystem: Schema.Boolean,
  timestamp: Schema.Number,
}) {}

// --- Public API ---

export const createMessage = Effect.fn("Chat.createMessage")(function* (input: {
  sessionId: string
  senderId: string
  senderName: string
  text: string
  visibility: { type: "public" } | { type: "whisper"; targetId: string }
  isSystem?: boolean
}) {
  const id = yield* Effect.sync(() => crypto.randomUUID())
  const timestamp = yield* Effect.sync(() => Date.now())

  const visibility: Visibility =
    input.visibility.type === "whisper"
      ? new WhisperVisibility({ targetId: input.visibility.targetId })
      : new PublicVisibility({})

  return new Message({
    id,
    sessionId: input.sessionId,
    senderId: input.senderId,
    senderName: input.senderName,
    text: input.text,
    visibility,
    isSystem: input.isSystem ?? false,
    timestamp,
  })
})

export const filterVisibleMessages = Effect.fn("Chat.filterVisible")(function* (
  messages: ReadonlyArray<Message>,
  userId: string,
  role: "storyteller" | "player",
) {
  // Storyteller sees everything
  if (role === "storyteller") {
    return [...messages]
  }

  // Players see: public messages + whispers where they are sender or target
  return messages.filter((msg) => {
    if (msg.visibility._tag === "public") return true
    if (msg.visibility._tag === "whisper") {
      return msg.senderId === userId || msg.visibility.targetId === userId
    }
    return false
  })
})
