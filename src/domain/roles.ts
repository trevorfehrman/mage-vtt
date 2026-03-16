import { Schema } from "effect"
import { PlayerId } from "./ids"

// Session roles
export const SessionRole = Schema.Literals(["player", "storyteller"])
export type SessionRole = typeof SessionRole.Type

// Message visibility
export class PublicVisibility extends Schema.TaggedClass<PublicVisibility>()(
  "Public",
  {},
) {}

export class HiddenVisibility extends Schema.TaggedClass<HiddenVisibility>()(
  "Hidden",
  {},
) {}

export class WhisperVisibility extends Schema.TaggedClass<WhisperVisibility>()(
  "Whisper",
  { targetId: PlayerId },
) {}

export const MessageVisibility = Schema.Union([
  PublicVisibility,
  HiddenVisibility,
  WhisperVisibility,
])
export type MessageVisibility = typeof MessageVisibility.Type
