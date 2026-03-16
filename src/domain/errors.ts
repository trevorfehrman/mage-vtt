import { Schema } from "effect"
import { CharacterId, SessionId } from "./ids"

export class InvalidDicePool extends Schema.TaggedErrorClass<InvalidDicePool>()(
  "InvalidDicePool",
  {
    poolSize: Schema.Number,
    reason: Schema.String,
  },
) {}

export class CharacterNotFound extends Schema.TaggedErrorClass<CharacterNotFound>()(
  "CharacterNotFound",
  {
    characterId: CharacterId,
  },
) {}

export class SessionNotFound extends Schema.TaggedErrorClass<SessionNotFound>()(
  "SessionNotFound",
  {
    sessionId: SessionId,
  },
) {}

export class InsufficientMana extends Schema.TaggedErrorClass<InsufficientMana>()(
  "InsufficientMana",
  {
    required: Schema.Number,
    available: Schema.Number,
  },
) {}

export class SpellLimitExceeded extends Schema.TaggedErrorClass<SpellLimitExceeded>()(
  "SpellLimitExceeded",
  {
    activeSpells: Schema.Number,
    gnosis: Schema.Number,
  },
) {}

export class Unauthorized extends Schema.TaggedErrorClass<Unauthorized>()(
  "Unauthorized",
  {
    reason: Schema.String,
  },
) {}
