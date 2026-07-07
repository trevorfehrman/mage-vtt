import { Effect, Random } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  createSession,
  joinSession,
  getMembers,
  assignCharacter,
  decodeSessionSnapshot,
} from "../session"
import { CharacterId, PlayerId } from "../ids"

describe("Session", () => {
  it.effect("invite codes are deterministic under a seeded Random", () =>
    Effect.gen(function* () {
      const a = yield* createSession({
        name: "Seeded A",
        storytellerId: PlayerId.make("st-1"),
      }).pipe(Random.withSeed("invite-seed"))
      const b = yield* createSession({
        name: "Seeded B",
        storytellerId: PlayerId.make("st-1"),
      }).pipe(Random.withSeed("invite-seed"))

      expect(a.inviteCode).toBe(b.inviteCode)
      expect(a.id).toBe(b.id)
      // 4-4 groups from the confusable-free alphabet (no I/O/0/1)
      expect(a.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
    }),
  )
  it.effect("creates a session with the creator as storyteller", () =>
    Effect.gen(function* () {
      const session = yield* createSession({
        name: "The Boston Chronicles",
        storytellerId: PlayerId.make("user-123"),
      })

      expect(session.name).toBe("The Boston Chronicles")
      expect(session.storytellerId).toBe("user-123")
      expect(session.inviteCode).toBeDefined()
      expect(session.inviteCode.length).toBeGreaterThanOrEqual(6)

      // Storyteller is automatically a member
      const members = yield* getMembers(session)
      expect(members).toHaveLength(1)
      expect(members[0].userId).toBe("user-123")
      expect(members[0].role).toBe("storyteller")
    }),
  )

  it.effect("player joins a session with a valid invite code", () =>
    Effect.gen(function* () {
      const session = yield* createSession({
        name: "Test Game",
        storytellerId: PlayerId.make("st-1"),
      })

      const membership = yield* joinSession({
        inviteCode: session.inviteCode,
        playerId: PlayerId.make("player-1"),
        sessions: [session],
      })

      expect(membership.userId).toBe("player-1")
      expect(membership.role).toBe("player")
      expect(membership.sessionId).toBe(session.id)
    }),
  )

  it.effect("rejects join with invalid invite code", () =>
    Effect.gen(function* () {
      const session = yield* createSession({
        name: "Test Game",
        storytellerId: PlayerId.make("st-1"),
      })

      const error = yield* joinSession({
        inviteCode: "WRONG-CODE",
        playerId: PlayerId.make("player-1"),
        sessions: [session],
      }).pipe(Effect.flip)

      expect(error._tag).toBe("SessionNotFound")
    }),
  )

  it.effect("rejects joining the same session twice", () =>
    Effect.gen(function* () {
      const session = yield* createSession({
        name: "Test Game",
        storytellerId: PlayerId.make("st-1"),
      })

      // First join succeeds
      yield* joinSession({
        inviteCode: session.inviteCode,
        playerId: PlayerId.make("player-1"),
        sessions: [session],
      })

      // Second join fails — player already a member
      // (session now has the player in members)
      const updatedSession = {
        ...session,
        members: [
          ...session.members,
          { userId: PlayerId.make("player-1"), role: "player" as const, characterId: undefined },
        ],
      }

      const error = yield* joinSession({
        inviteCode: updatedSession.inviteCode,
        playerId: PlayerId.make("player-1"),
        sessions: [updatedSession],
      }).pipe(Effect.flip)

      expect(error._tag).toBe("AlreadyJoined")
    }),
  )

  it.effect("assign a character to a session member", () =>
    Effect.gen(function* () {
      const session = yield* createSession({
        name: "Test Game",
        storytellerId: PlayerId.make("st-1"),
      })

      // Add the storyteller's character
      const updated = yield* assignCharacter({
        session,
        userId: PlayerId.make("st-1"),
        characterId: CharacterId.make("char-456"),
      })

      const members = yield* getMembers(updated)
      const storyteller = members.find((m) => m.userId === "st-1")
      expect(storyteller?.characterId).toBe("char-456")
    }),
  )

  it.effect("rejects character assignment for non-member", () =>
    Effect.gen(function* () {
      const session = yield* createSession({
        name: "Test Game",
        storytellerId: PlayerId.make("st-1"),
      })

      const error = yield* assignCharacter({
        session,
        userId: PlayerId.make("not-a-member"),
        characterId: CharacterId.make("char-789"),
      }).pipe(Effect.flip)

      expect(error._tag).toBe("SessionNotFound")
    }),
  )
})

// The client seam (ADR-0005, issue #49): `api.sessions.get` decodes through
// the SessionSnapshot mirror before any component reads it — plain `it()`,
// pure decode leaves.
describe("SessionSnapshot decode (issue #49)", () => {
  const memberRow = {
    _id: "mem-1",
    _creationTime: 1,
    sessionId: "ses-1",
    userId: "user-1",
    role: "storyteller",
    displayName: "Trevor",
  }
  const payload = {
    _id: "ses-1",
    _creationTime: 1,
    name: "Riverside",
    storytellerId: "user-1",
    inviteCode: "ABCD-EF23",
    status: "lobby",
    members: [memberRow],
  }

  it("decodes the sessions.get payload; role is the literal union", () => {
    const snapshot = decodeSessionSnapshot(payload)
    expect(snapshot?.name).toBe("Riverside")
    expect(snapshot?.members[0]?.role).toBe("storyteller")
    expect(snapshot?.members[0]?.displayName).toBe("Trevor")
  })

  it("null passes through — no session is an answer, not a failure", () => {
    expect(decodeSessionSnapshot(null)).toBeNull()
  })

  it("a corrupt payload degrades to null, never a crash", () => {
    expect(decodeSessionSnapshot({ ...payload, members: "nope" })).toBeNull()
    expect(
      decodeSessionSnapshot({
        ...payload,
        members: [{ ...memberRow, role: "archmage" }],
      }),
    ).toBeNull()
  })
})
