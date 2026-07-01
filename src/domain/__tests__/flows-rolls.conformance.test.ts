import { Effect, Exit, Random } from "effect"
import { describe, expect, it } from "@effect/vitest"
import type { MutationCtx } from "../../../convex/_generated/server"
import { convexLive } from "../../../convex/lib/convexLive"
import { createRoll } from "../flows/rolls"
import { PlayerId, SessionId } from "../ids"
import { Membership } from "../membership"
import { makeInMemory } from "../testing/in-memory"

/**
 * Conformance test (ADR-0004): the same flow run through both real adapters must
 * produce the same observable result — so `InMemory` can't silently drift from
 * `ConvexLive`. It also enforces the "every enforced mutation emits ≥1 Activity
 * entry" invariant structurally (ADR-0009), which the type system can't.
 *
 * `ConvexLive` is exercised against a minimal fake `ctx` implementing only the
 * `db` surface the adapter uses. The fake is the one unavoidable `as`-to-`ctx`:
 * fakes always assert conformance to the real interface. It exercises the
 * drift-prone code — decode-at-adapter, the wide `insertRoll` field map, id
 * translation, `NotAMember` — which is where the value of the test lives.
 */

const SESSION = "session-1"
const USER = "user-aldous"

const components = [
  { type: "attribute", name: "Strength", dots: 3 },
  { type: "skill", name: "Brawl", dots: 2 },
]

// --- Minimal fake Convex ctx ---

interface DiceRollRow {
  successes: number
  poolSize: number
  summary: string
  visibility: string
  rolls: ReadonlyArray<number>
  explosions: ReadonlyArray<number>
  override?: unknown
}

const makeFakeCtx = (
  memberRows: ReadonlyArray<{
    sessionId: string
    userId: string
    role: "player" | "storyteller"
    displayName: string
  }>,
) => {
  const diceRolls: Array<DiceRollRow> = []
  const messages: Array<Record<string, unknown>> = []

  const db = {
    normalizeId: (_table: string, id: string) =>
      typeof id === "string" && id.length > 0 ? id : null,
    query: (table: string) => ({
      withIndex: (_index: string, fn: (q: unknown) => unknown) => {
        let field = ""
        let value: unknown
        fn({
          eq: (f: string, v: unknown) => {
            field = f
            value = v
            return {}
          },
        })
        return {
          collect: async () =>
            table === "sessionMembers"
              ? memberRows.filter((r) => (r as Record<string, unknown>)[field] === value)
              : [],
        }
      },
    }),
    insert: async (table: string, doc: Record<string, unknown>) => {
      if (table === "diceRolls") {
        diceRolls.push(doc as unknown as DiceRollRow)
        return `dr_${diceRolls.length - 1}`
      }
      messages.push(doc)
      return `msg_${messages.length - 1}`
    },
  }

  return { ctx: { db } as unknown as MutationCtx, diceRolls, messages }
}

// --- Normalized observable projection both adapters must agree on ---

interface Observed {
  successes: number
  poolSize: number
  summary: string
  visibility: string
  rolls: ReadonlyArray<number>
  explosions: ReadonlyArray<number>
  hasOverride: boolean
  activityCount: number
}

const runInMemory = (visibility: "public" | "hidden") =>
  Effect.gen(function* () {
    const member = new Membership({
      userId: PlayerId.make(USER),
      sessionId: SessionId.make(SESSION),
      role: "player",
      displayName: "Aldous",
    })
    const store = makeInMemory({
      members: [member],
      actor: { userId: PlayerId.make(USER), isDev: false },
    })
    yield* createRoll({ sessionId: SESSION, components, visibility }).pipe(
      Effect.provide(store.layer),
      Random.withSeed("conformance-seed"),
    )
    const r = store.rolls[0]!
    const observed: Observed = {
      successes: r.result.successes,
      poolSize: r.result.poolSize,
      summary: r.summary,
      visibility: r.visibility,
      rolls: r.result.rolls,
      explosions: r.result.explosions,
      hasOverride: r.override !== null,
      activityCount: store.rolls.length + store.messages.length,
    }
    return observed
  })

const runConvexLive = (visibility: "public" | "hidden") =>
  Effect.gen(function* () {
    const fake = makeFakeCtx([
      { sessionId: SESSION, userId: USER, role: "player", displayName: "Aldous" },
    ])
    yield* createRoll({ sessionId: SESSION, components, visibility }).pipe(
      Effect.provide(convexLive(fake.ctx, { _id: USER })),
      Random.withSeed("conformance-seed"),
    )
    const r = fake.diceRolls[0]!
    const observed: Observed = {
      successes: r.successes,
      poolSize: r.poolSize,
      summary: r.summary,
      visibility: r.visibility,
      rolls: r.rolls,
      explosions: r.explosions,
      hasOverride: r.override !== undefined,
      activityCount: fake.diceRolls.length + fake.messages.length,
    }
    return observed
  })

describe("Flows.rolls.create conformance (ConvexLive vs InMemory)", () => {
  it.effect("both adapters agree on a public roll and emit ≥1 Activity entry", () =>
    Effect.gen(function* () {
      const inMem = yield* runInMemory("public")
      const live = yield* runConvexLive("public")

      expect(live).toEqual(inMem)
      // Structural enforcement of the every-mutation-logs invariant (ADR-0009)
      expect(inMem.activityCount).toBeGreaterThanOrEqual(1)
      expect(live.activityCount).toBeGreaterThanOrEqual(1)
      // Exactly one atomic entry, no shadow message
      expect(inMem.activityCount).toBe(1)
      expect(live.activityCount).toBe(1)
    }),
  )

  it.effect("both adapters agree on a hidden roll", () =>
    Effect.gen(function* () {
      const inMem = yield* runInMemory("hidden")
      const live = yield* runConvexLive("hidden")

      expect(live).toEqual(inMem)
      expect(inMem.visibility).toBe("hidden")
    }),
  )

  it.effect("both adapters reject a non-member with NotAMember and write nothing", () =>
    Effect.gen(function* () {
      // InMemory: actor is not among members
      const store = makeInMemory({
        members: [],
        actor: { userId: PlayerId.make("intruder"), isDev: false },
      })
      const inMemExit = yield* createRoll({
        sessionId: SESSION,
        components,
        visibility: "public",
      }).pipe(Effect.provide(store.layer), Random.withSeed("conformance-seed"), Effect.exit)

      // ConvexLive: no matching member row
      const fake = makeFakeCtx([])
      const liveExit = yield* createRoll({
        sessionId: SESSION,
        components,
        visibility: "public",
      }).pipe(
        Effect.provide(convexLive(fake.ctx, { _id: "intruder" })),
        Random.withSeed("conformance-seed"),
        Effect.exit,
      )

      const tagOf = (exit: Exit.Exit<unknown, unknown>) => {
        if (!Exit.isFailure(exit)) return null
        const fail = exit.cause.reasons.find((r) => r._tag === "Fail") as
          | { error: { _tag: string } }
          | undefined
        return fail?.error._tag ?? null
      }

      expect(tagOf(inMemExit)).toBe("NotAMember")
      expect(tagOf(liveExit)).toBe("NotAMember")
      expect(store.rolls).toHaveLength(0)
      expect(fake.diceRolls).toHaveLength(0)
    }),
  )
})
