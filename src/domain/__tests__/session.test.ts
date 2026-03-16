import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  createSession,
  joinSession,
  getMembers,
  assignCharacter,
} from "../session"

describe("Session", () => {
  it.effect("creates a session with the creator as storyteller", () =>
    Effect.gen(function* () {
      const session = yield* createSession({
        name: "The Boston Chronicles",
        storytellerId: "user-123",
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
        storytellerId: "st-1",
      })

      const membership = yield* joinSession({
        inviteCode: session.inviteCode,
        playerId: "player-1",
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
        storytellerId: "st-1",
      })

      const error = yield* joinSession({
        inviteCode: "WRONG-CODE",
        playerId: "player-1",
        sessions: [session],
      }).pipe(Effect.flip)

      expect(error._tag).toBe("SessionNotFound")
    }),
  )

  it.effect("rejects joining the same session twice", () =>
    Effect.gen(function* () {
      const session = yield* createSession({
        name: "Test Game",
        storytellerId: "st-1",
      })

      // First join succeeds
      yield* joinSession({
        inviteCode: session.inviteCode,
        playerId: "player-1",
        sessions: [session],
      })

      // Second join fails — player already a member
      // (session now has the player in members)
      const updatedSession = {
        ...session,
        members: [
          ...session.members,
          { userId: "player-1", role: "player" as const, characterId: undefined },
        ],
      }

      const error = yield* joinSession({
        inviteCode: updatedSession.inviteCode,
        playerId: "player-1",
        sessions: [updatedSession],
      }).pipe(Effect.flip)

      expect(error._tag).toBe("AlreadyJoined")
    }),
  )

  it.effect("assign a character to a session member", () =>
    Effect.gen(function* () {
      const session = yield* createSession({
        name: "Test Game",
        storytellerId: "st-1",
      })

      // Add the storyteller's character
      const updated = yield* assignCharacter({
        session,
        userId: "st-1",
        characterId: "char-456",
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
        storytellerId: "st-1",
      })

      const error = yield* assignCharacter({
        session,
        userId: "not-a-member",
        characterId: "char-789",
      }).pipe(Effect.flip)

      expect(error._tag).toBe("SessionNotFound")
    }),
  )
})
