import { Effect, Exit, Layer, Random } from "effect"
import { describe, expect, it } from "@effect/vitest"
import type { MutationCtx } from "../../../convex/_generated/server"
import type { OverrideStamp } from "../override"
import type { GameStore } from "../ports/game-store"
import { convexLive } from "../../../convex/lib/convexLive"
import {
  addParticipant,
  endCombat,
  rollCombatInitiative,
  spendTicks,
  startCombat,
} from "../flows/combat"
import { openScene } from "../flows/scene"
import { PlayerId, SessionId } from "../ids"
import { Membership } from "../membership"
import { CurrentActor } from "../ports/current-actor"
import { failureTag, makeAldousSheet } from "../testing/fixtures"
import { makeInMemory } from "../testing/in-memory"

/**
 * Conformance for the Combat clock (issue #60): the new `GameStore`
 * operations — `getActiveCombat`, `insertCombat`, `patchCombat` — must be
 * observably identical through `ConvexLive` and `InMemory`. The suite drives
 * the same seeded fight through both adapters and compares the stored Combat
 * row (roster stamps, Ticks, reminders, the settled next actor), the
 * initiative Rolls, the Activity trail, and the one-active-Combat refusal.
 */

const SESSION = "session-1"
const PLAYER = "user-aldous"
const ST_USER = "user-stella"
const CHARACTER = "char-aldous"

const memberRows = [
  { sessionId: SESSION, userId: PLAYER, role: "player" as const, displayName: "Aldous" },
  { sessionId: SESSION, userId: ST_USER, role: "storyteller" as const, displayName: "Stella" },
]

/** The Aldous fixture as a raw `characters` row (what `decodeSheet` reads). */
const aldousDoc = () => ({
  _id: CHARACTER,
  _creationTime: 0,
  sessionId: SESSION,
  userId: PLAYER,
  sessionMemberId: "member-aldous",
  name: "Aldous",
  concept: "Occult investigator",
  virtue: "Justice",
  vice: "Pride",
  path: "Moros",
  order: "Mysterium",
  gnosis: 1,
  attributes: {
    mental: { intelligence: 3, wits: 2, resolve: 2 },
    physical: { strength: 2, dexterity: 2, stamina: 2 },
    social: { presence: 2, manipulation: 3, composure: 3 },
  },
  skills: {
    mental: { academics: 2, computer: 0, crafts: 0, investigation: 3, medicine: 0, occult: 4, politics: 0, science: 2 },
    physical: { athletics: 1, brawl: 0, drive: 1, firearms: 0, larceny: 2, stealth: 2, survival: 1, weaponry: 0 },
    social: { animalKen: 0, empathy: 1, expression: 0, intimidation: 0, persuasion: 1, socialize: 1, streetwise: 1, subterfuge: 0 },
  },
  arcana: { death: 3, matter: 2, prime: 1 },
  healthTrack: ["empty", "empty", "empty", "empty", "empty", "empty", "empty"],
  willpowerCurrent: 6,
  manaCurrent: 10,
})

// --- Minimal fake Convex ctx with characters + scenes + combats + entries ---

const makeFakeCtx = () => {
  const diceRolls: Array<Record<string, unknown>> = []
  const messages: Array<Record<string, unknown>> = []
  const characters = new Map<string, Record<string, unknown>>([
    [CHARACTER, aldousDoc()],
  ])
  const scenes = new Map<string, Record<string, unknown>>()
  const combats = new Map<string, Record<string, unknown>>()

  const tableOf = (id: string) =>
    combats.has(id) ? combats : characters.has(id) ? characters : scenes

  const db = {
    normalizeId: (_table: string, id: string) =>
      typeof id === "string" && id.length > 0 ? id : null,
    get: async (id: string) => tableOf(id).get(id) ?? null,
    patch: async (id: string, fields: Record<string, unknown>) => {
      const table = tableOf(id)
      const doc = table.get(id)
      if (!doc) throw new Error(`patch of missing doc ${id}`)
      const next = { ...doc }
      // Convex semantics: a field patched to `undefined` is removed.
      for (const [key, value] of Object.entries(fields)) {
        if (value === undefined) {
          delete next[key]
        } else {
          next[key] = value
        }
      }
      table.set(id, next)
    },
    query: (table: string) => ({
      withIndex: (_index: string, fn: (q: unknown) => unknown) => {
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
            if (table === "scenes") return [...scenes.values()].filter(matches)
            if (table === "combats") return [...combats.values()].filter(matches)
            return []
          },
        }
      },
    }),
    insert: async (table: string, doc: Record<string, unknown>) => {
      // Ids mirror the InMemory adapter's format so the rows compare 1:1.
      if (table === "scenes") {
        const id = `scene_${scenes.size}`
        scenes.set(id, { _id: id, _creationTime: scenes.size, ...doc })
        return id
      }
      if (table === "combats") {
        const id = `combat_${combats.size}`
        combats.set(id, { _id: id, _creationTime: combats.size, ...doc })
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

  return {
    ctx: { db } as unknown as MutationCtx,
    diceRolls,
    messages,
    combats,
  }
}

const makeInMemoryStore = () => {
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
    actor: { userId: PlayerId.make(PLAYER), isDev: false },
    sheets: [makeAldousSheet()],
  })
}

/**
 * The whole fight, generic over a per-actor layer factory so both adapters
 * run the identical script: Scene, Combat, both participant kinds, each face
 * rolling its own way (player plain, ST's NPC plain), the hand-billed clock,
 * the one-active-Combat refusal, and the end. Per-roll seeds keep the dice
 * byte-identical across adapters.
 */
const runFight = (
  layerFor: (userId: string) => Layer.Layer<GameStore | CurrentActor | OverrideStamp>,
) =>
  Effect.gen(function* () {
    yield* openScene({ sessionId: SESSION, name: "The Docks" }).pipe(
      Effect.provide(layerFor(ST_USER)),
    )
    yield* startCombat({ sessionId: SESSION }).pipe(
      Effect.provide(layerFor(ST_USER)),
    )
    yield* addParticipant({ sessionId: SESSION, characterId: CHARACTER }).pipe(
      Effect.provide(layerFor(ST_USER)),
    )
    yield* addParticipant({
      sessionId: SESSION,
      name: "Ghoul α",
      dexterity: 3,
      composure: 2,
      wits: 2,
      willpower: 3,
    }).pipe(Effect.provide(layerFor(ST_USER)))

    yield* rollCombatInitiative({ sessionId: SESSION, participantId: "p1" }).pipe(
      Effect.provide(layerFor(PLAYER)),
      Random.withSeed("init-p1"),
    )
    yield* rollCombatInitiative({ sessionId: SESSION, participantId: "p2" }).pipe(
      Effect.provide(layerFor(ST_USER)),
      Random.withSeed("init-p2"),
    )

    yield* spendTicks({
      sessionId: SESSION,
      participantId: "p1",
      action: "attack",
    }).pipe(Effect.provide(layerFor(ST_USER)), Random.withSeed("bill-1"))
    yield* spendTicks({
      sessionId: SESSION,
      participantId: "p2",
      action: "aim",
      count: 2,
    }).pipe(Effect.provide(layerFor(ST_USER)), Random.withSeed("bill-2"))

    const secondStart = yield* startCombat({ sessionId: SESSION }).pipe(
      Effect.provide(layerFor(ST_USER)),
      Effect.exit,
    )

    yield* endCombat({ sessionId: SESSION }).pipe(
      Effect.provide(layerFor(ST_USER)),
    )
    return secondStart
  })

/** The observable projection both adapters must agree on, field by field. */
const observedCombat = (row: Record<string, unknown>) => ({
  sceneId: row.sceneId,
  status: row.status,
  participants: row.participants,
  seq: row.seq,
  nextActorId: row.nextActorId ?? null,
})

describe("Flows.combat conformance (ConvexLive vs InMemory)", () => {
  it.effect("both adapters walk the same seeded fight to the same ended row", () =>
    Effect.gen(function* () {
      const inMem = makeInMemoryStore()
      const inMemRefusal = yield* runFight((userId) =>
        Layer.merge(
          inMem.layer,
          Layer.succeed(CurrentActor, {
            userId: PlayerId.make(userId),
            isDev: false,
          }),
        ),
      )

      const fake = makeFakeCtx()
      const liveRefusal = yield* runFight((userId) =>
        convexLive(fake.ctx, { _id: userId }),
      )

      // The Combat row, observably identical field by field — the roster's
      // initiative stamps, Ticks, spends, and reminder chrome included.
      const inMemRow = inMem.combats[0]! as unknown as Record<string, unknown>
      const liveRow = [...fake.combats.values()][0]!
      expect(observedCombat(liveRow)).toEqual({
        ...observedCombat(inMemRow),
        participants: (inMemRow.participants as Array<object>).map((p) => ({
          ...p,
        })),
      })
      expect(liveRow.status).toBe("ended")
      expect(liveRow.startedAt).toBeTypeOf("number")
      expect(liveRow.endedAt).toBeTypeOf("number")

      // The initiative Rolls: same dice, same words, plain provenance on
      // both (the player's own face; the ST's own NPC).
      expect(fake.diceRolls.map((r) => r.summary)).toEqual(
        inMem.rolls.map((r) => r.summary),
      )
      expect(fake.diceRolls.map((r) => r.rolls)).toEqual(
        inMem.rolls.map((r) => [...r.result.rolls]),
      )
      expect(fake.diceRolls.every((r) => r.override === undefined)).toBe(true)
      expect(inMem.rolls.every((r) => r.override === null)).toBe(true)

      // The Activity trail: same beats, same words.
      expect(fake.messages.map((m) => m.text)).toEqual(
        inMem.messages.map((m) => m.text),
      )

      // One Combat at a time, refused identically.
      expect(Exit.isFailure(inMemRefusal) && Exit.isFailure(liveRefusal)).toBe(true)
      expect(failureTag(inMemRefusal)).toBe("CombatAlreadyActive")
      expect(failureTag(liveRefusal)).toBe("CombatAlreadyActive")
    }),
  )

  it.effect("both adapters agree the ended Combat frees the stage for the next", () =>
    Effect.gen(function* () {
      const inMem = makeInMemoryStore()
      const inMemLayer = Layer.merge(
        inMem.layer,
        Layer.succeed(CurrentActor, {
          userId: PlayerId.make(ST_USER),
          isDev: false,
        }),
      )
      yield* openScene({ sessionId: SESSION, name: "The Docks" }).pipe(
        Effect.provide(inMemLayer),
      )
      yield* startCombat({ sessionId: SESSION }).pipe(Effect.provide(inMemLayer))
      yield* endCombat({ sessionId: SESSION }).pipe(Effect.provide(inMemLayer))
      yield* startCombat({ sessionId: SESSION }).pipe(Effect.provide(inMemLayer))

      const fake = makeFakeCtx()
      const liveLayer = convexLive(fake.ctx, { _id: ST_USER })
      yield* openScene({ sessionId: SESSION, name: "The Docks" }).pipe(
        Effect.provide(liveLayer),
      )
      yield* startCombat({ sessionId: SESSION }).pipe(Effect.provide(liveLayer))
      yield* endCombat({ sessionId: SESSION }).pipe(Effect.provide(liveLayer))
      yield* startCombat({ sessionId: SESSION }).pipe(Effect.provide(liveLayer))

      expect(inMem.combats.map((c) => c.status)).toEqual(["ended", "active"])
      expect([...fake.combats.values()].map((c) => c.status)).toEqual([
        "ended",
        "active",
      ])
    }),
  )
})
