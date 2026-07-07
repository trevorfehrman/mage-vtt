import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import type { MutationCtx } from "../../../convex/_generated/server"
import { convexLive } from "../../../convex/lib/convexLive"
import { closeScene, openScene, setSceneWitnesses } from "../flows/scene"
import { PlayerId, SessionId } from "../ids"
import { Membership } from "../membership"
import { failureTag } from "../testing/fixtures"
import { makeInMemory } from "../testing/in-memory"

/**
 * Conformance for the Scene lifecycle (issue #42): the new `GameStore`
 * operations — `getActiveScene`, `insertScene`, `patchScene` — must be
 * observably identical through `ConvexLive` and `InMemory`. This is the
 * rule-of-two's pin: the store surface grew for this slice, so the suite
 * exercises exactly the ways a live adapter could drift — the compound-index
 * active read, the status/closedAt stamp on close, the quiet witnesses patch,
 * and the plain (no-Override) provenance on the open/close entries.
 */

const SESSION = "session-1"
const USER = "user-aldous"
const ST_USER = "user-stella"

const memberRows = [
  { sessionId: SESSION, userId: USER, role: "player" as const, displayName: "Aldous" },
  { sessionId: SESSION, userId: ST_USER, role: "storyteller" as const, displayName: "Stella" },
]

// --- Minimal fake Convex ctx with scenes + messages ---

const makeFakeCtx = () => {
  const diceRolls: Array<Record<string, unknown>> = []
  const messages: Array<Record<string, unknown>> = []
  const scenes = new Map<string, Record<string, unknown>>()
  let sceneCounter = 0

  const db = {
    normalizeId: (_table: string, id: string) =>
      typeof id === "string" && id.length > 0 ? id : null,
    get: async (id: string) => scenes.get(id) ?? null,
    patch: async (id: string, fields: Record<string, unknown>) => {
      const doc = scenes.get(id)
      if (!doc) throw new Error(`patch of missing doc ${id}`)
      scenes.set(id, { ...doc, ...fields })
    },
    query: (table: string) => ({
      withIndex: (_index: string, fn: (q: unknown) => unknown) => {
        // The scenes read chains eqs on the compound index, so the fake
        // builder collects every (field, value) pair before filtering.
        const eqs: Array<readonly [string, unknown]> = []
        const builder = {
          eq: (f: string, v: unknown) => {
            eqs.push([f, v] as const)
            return builder
          },
        }
        fn(builder)
        const matches = (row: Record<string, unknown>) =>
          eqs.every(([f, v]) => row[f] === v)
        return {
          collect: async () => {
            if (table === "sessionMembers") {
              return memberRows.filter((r) =>
                matches(r as unknown as Record<string, unknown>),
              )
            }
            if (table === "scenes") {
              return [...scenes.values()].filter(matches)
            }
            return []
          },
        }
      },
    }),
    insert: async (table: string, doc: Record<string, unknown>) => {
      if (table === "scenes") {
        const id = `scene_${sceneCounter++}`
        scenes.set(id, { _id: id, _creationTime: sceneCounter, ...doc })
        return id
      }
      if (table === "diceRolls") {
        diceRolls.push(doc)
        return `dr_${diceRolls.length - 1}`
      }
      messages.push(doc)
      return `msg_${messages.length - 1}`
    },
  }

  return { ctx: { db } as unknown as MutationCtx, diceRolls, messages, scenes }
}

const makeInMemoryStore = (opts: { actor: string }) => {
  const members = memberRows.map(
    (r) =>
      new Membership({
        userId: PlayerId.make(r.userId),
        sessionId: SessionId.make(r.sessionId),
        role: r.role,
        displayName: r.displayName,
      }),
  )
  return makeInMemory({
    members,
    actor: { userId: PlayerId.make(opts.actor), isDev: false },
  })
}

const liveScenes = (fake: ReturnType<typeof makeFakeCtx>) => [...fake.scenes.values()]

describe("Flows.scene conformance (ConvexLive vs InMemory)", () => {
  it.effect("both adapters agree on an ST open: active row, plain system entry", () =>
    Effect.gen(function* () {
      const inMem = makeInMemoryStore({ actor: ST_USER })
      yield* openScene({ sessionId: SESSION, name: "The Docks" }).pipe(
        Effect.provide(inMem.layer),
      )
      const inMemScene = inMem.scenes[0]!
      const inMemEntry = inMem.messages[0]!
      const observedInMem = {
        name: inMemScene.name,
        status: inMemScene.status,
        sleeperWitnesses: inMemScene.sleeperWitnesses,
        text: inMemEntry.text,
        visibility: inMemEntry.visibility,
        senderName: inMemEntry.senderName,
        // Plain provenance (ADR-0015): live omits the key, InMemory holds null.
        override: inMemEntry.override ?? null,
        activityCount: inMem.rolls.length + inMem.messages.length,
      }

      const fake = makeFakeCtx()
      yield* openScene({ sessionId: SESSION, name: "The Docks" }).pipe(
        Effect.provide(convexLive(fake.ctx, { _id: ST_USER })),
      )
      const liveScene = liveScenes(fake)[0] as Record<string, unknown>
      const liveEntry = fake.messages[0] as Record<string, unknown>
      const observedLive = {
        name: liveScene.name,
        status: liveScene.status,
        sleeperWitnesses: liveScene.sleeperWitnesses,
        text: liveEntry.text,
        visibility: liveEntry.visibilityType,
        senderName: liveEntry.senderName,
        override: liveEntry.override ?? null,
        activityCount: fake.diceRolls.length + fake.messages.length,
      }

      expect(observedLive).toEqual(observedInMem)
      expect(observedLive.status).toBe("active")
      expect(observedLive.sleeperWitnesses).toBe(false)
      expect(observedLive.override).toBeNull()
      // One atomic entry (ADR-0009), and the row stamps its open time.
      expect(observedLive.activityCount).toBe(1)
      expect(liveScene.openedAt).toBeTypeOf("number")
    }),
  )

  it.effect("both adapters refuse a second concurrent open: SceneAlreadyOpen, zero writes", () =>
    Effect.gen(function* () {
      const inMem = makeInMemoryStore({ actor: ST_USER })
      yield* openScene({ sessionId: SESSION, name: "The Docks" }).pipe(
        Effect.provide(inMem.layer),
      )
      const inMemExit = yield* openScene({ sessionId: SESSION, name: "The Chantry" }).pipe(
        Effect.provide(inMem.layer),
        Effect.exit,
      )

      const fake = makeFakeCtx()
      const layer = convexLive(fake.ctx, { _id: ST_USER })
      yield* openScene({ sessionId: SESSION, name: "The Docks" }).pipe(
        Effect.provide(layer),
      )
      const liveExit = yield* openScene({ sessionId: SESSION, name: "The Chantry" }).pipe(
        Effect.provide(layer),
        Effect.exit,
      )

      expect(failureTag(inMemExit)).toBe("SceneAlreadyOpen")
      expect(failureTag(liveExit)).toBe("SceneAlreadyOpen")
      expect(inMem.scenes).toHaveLength(1)
      expect(liveScenes(fake)).toHaveLength(1)
      expect(inMem.messages).toHaveLength(1)
      expect(fake.messages).toHaveLength(1)
    }),
  )

  it.effect("both adapters agree on a close: status flips, close is stamped, one more entry", () =>
    Effect.gen(function* () {
      const inMem = makeInMemoryStore({ actor: ST_USER })
      yield* openScene({ sessionId: SESSION, name: "The Docks" }).pipe(
        Effect.provide(inMem.layer),
      )
      yield* closeScene({ sessionId: SESSION }).pipe(Effect.provide(inMem.layer))

      const fake = makeFakeCtx()
      const layer = convexLive(fake.ctx, { _id: ST_USER })
      yield* openScene({ sessionId: SESSION, name: "The Docks" }).pipe(
        Effect.provide(layer),
      )
      yield* closeScene({ sessionId: SESSION }).pipe(Effect.provide(layer))

      const inMemScene = inMem.scenes[0]!
      const liveScene = liveScenes(fake)[0] as Record<string, unknown>
      expect(liveScene.status).toBe(inMemScene.status)
      expect(liveScene.status).toBe("closed")
      expect(liveScene.closedAt).toBeTypeOf("number")
      expect(inMemScene.closedAt).toBeTypeOf("number")

      expect(fake.messages).toHaveLength(2)
      expect(inMem.messages).toHaveLength(2)
      expect((fake.messages[1] as { text: string }).text).toBe(inMem.messages[1]!.text)
      // Closed means re-openable: the active read finds nothing in either.
      const reopenExit = yield* closeScene({ sessionId: SESSION }).pipe(
        Effect.provide(layer),
        Effect.exit,
      )
      expect(failureTag(reopenExit)).toBe("NoActiveScene")
    }),
  )

  it.effect("both adapters agree on the witnesses toggle: quiet patch, no entry", () =>
    Effect.gen(function* () {
      const inMem = makeInMemoryStore({ actor: ST_USER })
      yield* openScene({ sessionId: SESSION, name: "The Docks" }).pipe(
        Effect.provide(inMem.layer),
      )
      yield* setSceneWitnesses({ sessionId: SESSION, sleeperWitnesses: true }).pipe(
        Effect.provide(inMem.layer),
      )

      const fake = makeFakeCtx()
      const layer = convexLive(fake.ctx, { _id: ST_USER })
      yield* openScene({ sessionId: SESSION, name: "The Docks" }).pipe(
        Effect.provide(layer),
      )
      yield* setSceneWitnesses({ sessionId: SESSION, sleeperWitnesses: true }).pipe(
        Effect.provide(layer),
      )

      const liveScene = liveScenes(fake)[0] as Record<string, unknown>
      expect(liveScene.sleeperWitnesses).toBe(true)
      expect(inMem.scenes[0]!.sleeperWitnesses).toBe(true)
      // Still active, still one entry (the open's) — the toggle logs nothing.
      expect(liveScene.status).toBe("active")
      expect(fake.messages).toHaveLength(1)
      expect(inMem.messages).toHaveLength(1)
    }),
  )

  it.effect("both adapters refuse a player's open with NotStoryteller, zero writes", () =>
    Effect.gen(function* () {
      const inMem = makeInMemoryStore({ actor: USER })
      const inMemExit = yield* openScene({ sessionId: SESSION, name: "The Docks" }).pipe(
        Effect.provide(inMem.layer),
        Effect.exit,
      )

      const fake = makeFakeCtx()
      const liveExit = yield* openScene({ sessionId: SESSION, name: "The Docks" }).pipe(
        Effect.provide(convexLive(fake.ctx, { _id: USER })),
        Effect.exit,
      )

      expect(failureTag(inMemExit)).toBe("NotStoryteller")
      expect(failureTag(liveExit)).toBe("NotStoryteller")
      expect(inMem.scenes).toHaveLength(0)
      expect(liveScenes(fake)).toHaveLength(0)
      expect(inMem.messages).toHaveLength(0)
      expect(fake.messages).toHaveLength(0)
    }),
  )
})
