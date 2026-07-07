import { Effect, Random, Result, Schema } from "effect"
import { CharacterId, PlayerId, SessionId } from "./ids"
import { SessionRole } from "./roles"
import { ConvexId } from "./schema-bridge"
import { SessionDoc, SessionMemberDoc } from "./tables"

// --- Types ---

export class SessionMember extends Schema.Class<SessionMember>("SessionMember")({
  userId: PlayerId,
  role: SessionRole,
  characterId: Schema.optional(CharacterId),
}) {}

export class SessionMembership extends Schema.Class<SessionMembership>("SessionMembership")({
  userId: PlayerId,
  role: SessionRole,
  sessionId: SessionId,
  characterId: Schema.optional(CharacterId),
}) {}

export class Session extends Schema.Class<Session>("Session")({
  id: SessionId,
  name: Schema.String,
  storytellerId: PlayerId,
  inviteCode: Schema.String,
  members: Schema.Array(SessionMember),
}) {}

// --- Seam mirrors (ADR-0005, issue #49) ---

/**
 * A `sessionMembers` row as the client reads it off `api.sessions.get` — the
 * one home of the member-row shape the header components share (issue #49
 * killed three inline copies). `role` is the `SessionRole` literal union, not
 * a raw string.
 */
export const SessionMemberRow = Schema.Struct({
  _id: ConvexId("sessionMembers"),
  _creationTime: Schema.Number,
  ...SessionMemberDoc.fields,
})
export type SessionMemberRow = typeof SessionMemberRow.Type

/** The `api.sessions.get` payload: the session row plus its roster. */
export const SessionSnapshot = Schema.Struct({
  _id: ConvexId("sessions"),
  _creationTime: Schema.Number,
  ...SessionDoc.fields,
  members: Schema.Array(SessionMemberRow),
})
export type SessionSnapshot = typeof SessionSnapshot.Type

const decodeSnapshot = Schema.decodeUnknownResult(SessionSnapshot)

/**
 * Decode the session query off the wire. `null` passes through (no such
 * session); a corrupt payload degrades to `null` with a warning rather than
 * taking the session page down (the same posture as `decodeFeed`).
 */
export const decodeSessionSnapshot = (input: unknown): SessionSnapshot | null => {
  if (input === null || input === undefined) return null
  const result = decodeSnapshot(input)
  if (Result.isFailure(result)) {
    console.warn("Session: dropped an unreadable session snapshot", result.failure)
    return null
  }
  return result.success
}

// --- Errors ---

export class SessionNotFound extends Schema.TaggedErrorClass<SessionNotFound>()(
  "SessionNotFound",
  { message: Schema.String },
) {}

export class AlreadyJoined extends Schema.TaggedErrorClass<AlreadyJoined>()(
  "AlreadyJoined",
  { message: Schema.String },
) {}

// --- Helpers ---

const INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no I/O/0/1 to avoid confusion

const generateInviteCode = Effect.gen(function* () {
  const indices = yield* Effect.forEach(Array.from({ length: 8 }), () =>
    Random.nextIntBetween(0, INVITE_CODE_CHARS.length - 1),
  )
  const code = indices.map((i) => INVITE_CODE_CHARS[i]).join("")
  return `${code.slice(0, 4)}-${code.slice(4)}`
})

const generateId = Effect.gen(function* () {
  const nibbles = yield* Effect.forEach(Array.from({ length: 32 }), () =>
    Random.nextIntBetween(0, 15),
  )
  return SessionId.make(nibbles.map((n) => n.toString(16)).join(""))
})

// --- Public API ---

export const createSession = Effect.fn("Session.create")(function* (input: {
  name: string
  storytellerId: PlayerId
}) {
  const id = yield* generateId
  const inviteCode = yield* generateInviteCode

  const storytellerMember = new SessionMember({
    userId: input.storytellerId,
    role: "storyteller",
    characterId: undefined,
  })

  return new Session({
    id,
    name: input.name,
    storytellerId: input.storytellerId,
    inviteCode,
    members: [storytellerMember],
  })
})

export const joinSession = Effect.fn("Session.join")(function* (input: {
  inviteCode: string
  playerId: PlayerId
  sessions: ReadonlyArray<Session>
}) {
  // Find session by invite code
  const session = input.sessions.find((s) => s.inviteCode === input.inviteCode)
  if (!session) {
    return yield* new SessionNotFound({
      message: `No session found with invite code: ${input.inviteCode}`,
    })
  }

  // Check if already a member
  const existing = session.members.find((m) => m.userId === input.playerId)
  if (existing) {
    return yield* new AlreadyJoined({
      message: `User ${input.playerId} is already in session ${session.name}`,
    })
  }

  return new SessionMembership({
    userId: input.playerId,
    role: "player",
    sessionId: session.id,
    characterId: undefined,
  })
})

export const getMembers = Effect.fn("Session.getMembers")(function* (
  session: Session,
) {
  return [...session.members]
})

export const assignCharacter = Effect.fn("Session.assignCharacter")(function* (input: {
  session: Session
  userId: PlayerId
  characterId: CharacterId
}) {
  const memberIndex = input.session.members.findIndex((m) => m.userId === input.userId)

  if (memberIndex === -1) {
    return yield* new SessionNotFound({
      message: `User ${input.userId} is not a member of session ${input.session.name}`,
    })
  }

  const updatedMembers = input.session.members.map((m, i) =>
    i === memberIndex
      ? new SessionMember({ ...m, characterId: input.characterId })
      : m,
  )

  return new Session({ ...input.session, members: updatedMembers })
})
