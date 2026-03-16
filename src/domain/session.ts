import { Effect, Schema } from "effect"

// --- Types ---

const Role = Schema.Literals(["storyteller", "player"])

export class SessionMember extends Schema.Class<SessionMember>("SessionMember")({
  userId: Schema.String,
  role: Role,
  characterId: Schema.optional(Schema.String),
}) {}

export class SessionMembership extends Schema.Class<SessionMembership>("SessionMembership")({
  userId: Schema.String,
  role: Role,
  sessionId: Schema.String,
  characterId: Schema.optional(Schema.String),
}) {}

export class Session extends Schema.Class<Session>("Session")({
  id: Schema.String,
  name: Schema.String,
  storytellerId: Schema.String,
  inviteCode: Schema.String,
  members: Schema.Array(SessionMember),
}) {}

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

const generateInviteCode = Effect.gen(function* () {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no I/O/0/1 to avoid confusion
  let code = ""
  for (let i = 0; i < 8; i++) {
    const idx = Math.floor(Math.random() * chars.length)
    code += chars[idx]
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`
})

const generateId = Effect.sync(() => crypto.randomUUID())

// --- Public API ---

export const createSession = Effect.fn("Session.create")(function* (input: {
  name: string
  storytellerId: string
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
  playerId: string
  sessions: ReadonlyArray<Session>
}) {
  // Find session by invite code
  const session = input.sessions.find((s) => s.inviteCode === input.inviteCode)
  if (!session) {
    yield* new SessionNotFound({
      message: `No session found with invite code: ${input.inviteCode}`,
    })
    // unreachable but TypeScript needs it
    throw new Error("unreachable")
  }

  // Check if already a member
  const existing = session.members.find((m) => m.userId === input.playerId)
  if (existing) {
    yield* new AlreadyJoined({
      message: `User ${input.playerId} is already in session ${session.name}`,
    })
    throw new Error("unreachable")
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
  userId: string
  characterId: string
}) {
  const memberIndex = input.session.members.findIndex((m) => m.userId === input.userId)

  if (memberIndex === -1) {
    yield* new SessionNotFound({
      message: `User ${input.userId} is not a member of session ${input.session.name}`,
    })
    throw new Error("unreachable")
  }

  const updatedMembers = input.session.members.map((m, i) =>
    i === memberIndex
      ? new SessionMember({ ...m, characterId: input.characterId })
      : m,
  )

  return new Session({ ...input.session, members: updatedMembers })
})
