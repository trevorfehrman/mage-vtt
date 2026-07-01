import { Effect, Exit, Random } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { buildPool, rollPool } from "../dice"
import { createRoll } from "../flows/rolls"
import { PlayerId, SessionId } from "../ids"
import { Membership } from "../membership"
import { makeInMemory } from "../testing/in-memory"

const SESSION = SessionId.make("session-1")
const PLAYER = PlayerId.make("user-aldous")

const member = new Membership({
  userId: PLAYER,
  sessionId: SESSION,
  role: "player",
  displayName: "Aldous",
})

const seed = () =>
  makeInMemory({
    members: [member],
    actor: { userId: PLAYER, isDev: false },
  })

const components = [
  { type: "attribute", name: "Strength", dots: 3 },
  { type: "skill", name: "Brawl", dots: 2 },
]

describe("Flows.rolls.create (enforcement seam tracer bullet)", () => {
  it.effect("a member's public roll produces one atomic Activity entry", () =>
    Effect.gen(function* () {
      const store = seed()

      const rollId = yield* createRoll({
        sessionId: SESSION,
        components,
        visibility: "public",
      }).pipe(Effect.provide(store.layer), Random.withSeed("roll-seed"))

      // Exactly one Activity entry, no shadow message (ADR-0009)
      expect(store.rolls).toHaveLength(1)
      expect(store.messages).toHaveLength(0)

      const entry = store.rolls[0]!
      expect(entry.id).toBe(rollId)
      expect(entry.visibility).toBe("public")
      expect(entry.displayName).toBe("Aldous")
      expect(entry.userId).toBe(PLAYER)
      expect(entry.result.poolSize).toBe(5)
      // summary is self-describing and carries the narrative
      expect(entry.summary).toContain("Aldous")
      expect(entry.summary).toContain(String(entry.result.successes))
      // scaffolded-but-unexercised Override marker is absent (ADR-0006)
      expect(entry.override).toBeNull()
    }),
  )

  it.effect("a hidden roll is written visibility:hidden (summary hidden too)", () =>
    Effect.gen(function* () {
      const store = seed()

      yield* createRoll({
        sessionId: SESSION,
        components,
        visibility: "hidden",
      }).pipe(Effect.provide(store.layer), Random.withSeed("roll-seed"))

      expect(store.rolls).toHaveLength(1)
      expect(store.rolls[0]!.visibility).toBe("hidden")
      // The narrative lives on the same entry under the same visibility — so a
      // hidden roll's summary is hidden by construction (no public "system" leak).
      expect(store.messages).toHaveLength(0)
    }),
  )

  it.effect("behavioral oracle: seam dice output equals old buildPool+rollPool", () =>
    Effect.gen(function* () {
      const store = seed()

      // New seam-based flow, fixed seed.
      yield* createRoll({
        sessionId: SESSION,
        components,
        againThreshold: 9,
        roteAction: true,
        visibility: "public",
      }).pipe(Effect.provide(store.layer), Random.withSeed("oracle-seed"))

      // Old implementation's dice math, same seed, run in isolation.
      const expected = yield* buildPool(components)
        .pipe(
          Effect.flatMap((pool) =>
            rollPool(pool, { visibility: "public", againThreshold: 9, roteAction: true }),
          ),
        )
        .pipe(Random.withSeed("oracle-seed"))

      const actual = store.rolls[0]!.result
      // The migration is behavior-preserving for the *dice result*. The narrative
      // `summary` is deliberately NOT diffed: it's a new self-describing field
      // (ADR-0009) replacing the old shadow "system" message, so there is no old
      // output to preserve — its wording is an intentional change, not a regression.
      expect(actual.rolls).toEqual(expected.rolls)
      expect(actual.explosions).toEqual(expected.explosions)
      expect(actual.roteRerolls).toEqual(expected.roteRerolls)
      expect(actual.successes).toBe(expected.successes)
      expect(actual.poolSize).toBe(expected.poolSize)
      expect(actual.isExceptionalSuccess).toBe(expected.isExceptionalSuccess)
      expect(actual.isDramaticFailure).toBe(expected.isDramaticFailure)
    }),
  )

  it.effect("a non-member's roll attempt fails NotAMember", () =>
    Effect.gen(function* () {
      const store = makeInMemory({
        members: [member],
        actor: { userId: PlayerId.make("user-intruder"), isDev: false },
      })

      const exit = yield* createRoll({
        sessionId: SESSION,
        components,
        visibility: "public",
      }).pipe(Effect.provide(store.layer), Random.withSeed("roll-seed"), Effect.exit)

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const error = exit.cause.reasons.find((r) => r._tag === "Fail") as
          | { error: { _tag: string } }
          | undefined
        expect(error?.error._tag).toBe("NotAMember")
      }
      // Nothing was written
      expect(store.rolls).toHaveLength(0)
    }),
  )
})
