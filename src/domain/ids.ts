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

export const SessionMemberId = Schema.String.pipe(Schema.brand("SessionMemberId"))
export type SessionMemberId = typeof SessionMemberId.Type

export const MessageId = Schema.String.pipe(Schema.brand("MessageId"))
export type MessageId = typeof MessageId.Type

export const RollId = Schema.String.pipe(Schema.brand("RollId"))
export type RollId = typeof RollId.Type

export const RoteId = Schema.String.pipe(Schema.brand("RoteId"))
export type RoteId = typeof RoteId.Type

export const SceneId = Schema.String.pipe(Schema.brand("SceneId"))
export type SceneId = typeof SceneId.Type

export const CastId = Schema.String.pipe(Schema.brand("CastId"))
export type CastId = typeof CastId.Type

export const RuleChunkId = Schema.String.pipe(Schema.brand("RuleChunkId"))
export type RuleChunkId = typeof RuleChunkId.Type
