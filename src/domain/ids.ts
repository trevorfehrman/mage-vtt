import { Schema } from "effect"

// Entity IDs — branded to prevent accidental mixing
export const SessionId = Schema.String.pipe(Schema.brand("SessionId"))
export type SessionId = typeof SessionId.Type

export const CharacterId = Schema.String.pipe(Schema.brand("CharacterId"))
export type CharacterId = typeof CharacterId.Type

export const PlayerId = Schema.String.pipe(Schema.brand("PlayerId"))
export type PlayerId = typeof PlayerId.Type

export const MapId = Schema.String.pipe(Schema.brand("MapId"))
export type MapId = typeof MapId.Type

export const MessageId = Schema.String.pipe(Schema.brand("MessageId"))
export type MessageId = typeof MessageId.Type

export const RoteId = Schema.String.pipe(Schema.brand("RoteId"))
export type RoteId = typeof RoteId.Type

export const RuleChunkId = Schema.String.pipe(Schema.brand("RuleChunkId"))
export type RuleChunkId = typeof RuleChunkId.Type
