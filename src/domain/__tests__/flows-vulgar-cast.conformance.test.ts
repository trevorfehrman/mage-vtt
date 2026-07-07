import { Effect, Layer, Random } from "effect"
import { describe, expect, it } from "@effect/vitest"
import type { MutationCtx } from "../../../convex/_generated/server"
import type { OverrideStamp } from "../override"
import type { GameStore } from "../ports/game-store"
import { convexLive } from "../../../convex/lib/convexLive"
import {
  containParadox,
  draftCast,
  engageCast,
  lockIntention,
  lockLiabilities,
  rollCastDice,
  rollParadox,
  voidCast,
} from "../flows/vulgar-cast"
import { PlayerId, SessionId } from "../ids"
import { Membership } from "../membership"
import { CurrentActor } from "../ports/current-actor"
import { makeAldousSheet } from "../testing/fixtures"
import { makeInMemory } from "../testing/in-memory"

/**
 * Conformance for the Cast ladder (issue #43): the new `GameStore` operations
 * — `insertCast`, `getCast`, `patchCast`, `listCasts` — must be observably
 * identical through `ConvexLive` and `InMemory`. The suite drives the same
 * seeded whole handshake through both adapters and compares the stored Cast
 * row, the sheet writes, and the Activity entries at every beat; the void
 * test pins the one patch that carries Override provenance.
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

// --- Minimal fake Convex ctx with characters + casts + scenes + entries ---

const makeFakeCtx = () => {
  const diceRolls: Array<Record<string, unknown>> = []
  const messages: Array<Record<string, unknown>> = []
  const characters = new Map<string, Record<string, unknown>>([
    [CHARACTER, aldousDoc()],
  ])
  const casts = new Map<string, Record<string, unknown>>()
  const scenes = new Map<string, Record<string, unknown>>()
  let counter = 0

  const tableOf = (id: string) =>
    casts.has(id) ? casts : characters.has(id) ? characters : scenes

  const db = {
    normalizeId: (_table: string, id: string) =>
      typeof id === "string" && id.length > 0 ? id : null,
    get: async (id: string) => tableOf(id).get(id) ?? null,
    patch: async (id: string, fields: Record<string, unknown>) => {
      const table = tableOf(id)
      const doc = table.get(id)
      if (!doc) throw new Error(`patch of missing doc ${id}`)
      table.set(id, { ...doc, ...fields })
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
            if (table === "casts") return [...casts.values()].filter(matches)
            if (table === "scenes") return [...scenes.values()].filter(matches)
            return []
          },
        }
      },
    }),
    insert: async (table: string, doc: Record<string, unknown>) => {
      if (table === "casts") {
        const id = `cast_${counter++}`
        casts.set(id, { _id: id, _creationTime: counter, ...doc })
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
    characters,
    casts,
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

const as = (userId: string) =>
  Effect.provide(Layer.succeed(CurrentActor, { userId: PlayerId.make(userId), isDev: false }))

/**
 * The whole downtime handshake (no Scene: 1-die Paradox pool), generic over a
 * per-beat layer factory so both adapters run the identical script. Seeded by
 * the caller, so both draw the same dice.
 */
const runHandshake = (
  layerFor: (userId: string) => Layer.Layer<GameStore | CurrentActor | OverrideStamp>,
) =>
  Effect.gen(function* () {
    const castId = yield* draftCast({
      sessionId: SESSION,
      characterId: CHARACTER,
      arcanum: "death",
      level: 2,
      intent: "Rot the door",
    }).pipe(Effect.provide(layerFor(PLAYER)))
    yield* engageCast({ sessionId: SESSION, castId }).pipe(
      Effect.provide(layerFor(ST_USER)),
    )
    yield* lockLiabilities({ sessionId: SESSION, castId }).pipe(
      Effect.provide(layerFor(ST_USER)),
    )
    yield* lockIntention({ sessionId: SESSION, castId, manaMitigation: 0 }).pipe(
      Effect.provide(layerFor(PLAYER)),
    )
    yield* rollParadox({ sessionId: SESSION, castId }).pipe(
      Effect.provide(layerFor(ST_USER)),
    )
    // Seed "docks" rolls a 9 on the single Paradox die: one success to contain.
    yield* containParadox({ sessionId: SESSION, castId, containedSuccesses: 1 }).pipe(
      Effect.provide(layerFor(PLAYER)),
    )
    yield* rollCastDice({ sessionId: SESSION, castId }).pipe(
      Effect.provide(layerFor(PLAYER)),
    )
    return castId
  })

/** The observable projection both adapters must agree on, field by field. */
const observedCast = (row: Record<string, unknown>) => ({
  status: row.status,
  arcanum: row.arcanum,
  level: row.level,
  intent: row.intent,
  usesMagicalTool: row.usesMagicalTool,
  declaredPool: row.declaredPool,
  spellManaCost: row.spellManaCost,
  sceneId: row.sceneId ?? null,
  gnosis: row.gnosis,
  sleeperWitnesses: row.sleeperWitnesses,
  priorParadoxRolls: row.priorParadoxRolls,
  manaMitigation: row.manaMitigation,
  paradoxSuccesses: row.paradoxSuccesses,
  paradoxIsDramaticFailure: row.paradoxIsDramaticFailure,
  containedSuccesses: row.containedSuccesses,
  castPool: row.castPool,
  castSuccesses: row.castSuccesses,
  severity: row.severity,
  override: row.override ?? null,
})

describe("Flows.vulgarCast conformance (ConvexLive vs InMemory)", () => {
  it.effect("both adapters walk the same seeded handshake to the same resolved row", () =>
    Effect.gen(function* () {
      const inMem = makeInMemoryStore()
      yield* runHandshake((userId) =>
        Layer.merge(inMem.layer, Layer.succeed(CurrentActor, {
          userId: PlayerId.make(userId),
          isDev: false,
        })),
      ).pipe(Random.withSeed("docks"))

      const fake = makeFakeCtx()
      yield* runHandshake((userId) => convexLive(fake.ctx, { _id: userId })).pipe(
        Random.withSeed("docks"),
      )

      // The Cast row, observably identical field by field.
      const inMemRow = inMem.casts[0]! as unknown as Record<string, unknown>
      const liveRow = [...fake.casts.values()][0]!
      expect(observedCast(liveRow)).toEqual(observedCast(inMemRow))
      expect(liveRow.status).toBe("resolved")
      expect(liveRow.paradoxSuccesses).toBe(1)
      expect(liveRow.containedSuccesses).toBe(1)
      expect(liveRow.castPool).toBe(4)
      expect(liveRow.updatedAt).toBeTypeOf("number")
      expect(liveRow.createdAt).toBeTypeOf("number")

      // The sheet writes: Mana untouched (ruling Arcanum, no mitigation),
      // one Resistant bashing box from containment.
      const liveSheet = fake.characters.get(CHARACTER)!
      const inMemSheet = inMem.sheets.get(makeAldousSheet().id)!
      expect(liveSheet.manaCurrent).toBe(inMemSheet.manaCurrent)
      expect(liveSheet.manaCurrent).toBe(10)
      expect(liveSheet.healthTrack).toEqual(
        inMemSheet.healthTrack.map((box) => ({ ...box })),
      )
      expect(
        (liveSheet.healthTrack as Array<{ severity: string; resistant: boolean }>)
          .filter((b) => b.severity === "bashing" && b.resistant),
      ).toHaveLength(1)

      // The Activity trail: same beats, same words, same dice.
      expect(fake.messages.map((m) => m.text)).toEqual(
        inMem.messages.map((m) => m.text),
      )
      expect(fake.diceRolls.map((r) => r.summary)).toEqual(
        inMem.rolls.map((r) => r.summary),
      )
      expect(fake.diceRolls.map((r) => r.rolls)).toEqual(
        inMem.rolls.map((r) => [...r.result.rolls]),
      )
    }),
  )

  it.effect("both adapters stamp void's repair Override onto the row and its entry", () =>
    Effect.gen(function* () {
      const inMem = makeInMemoryStore()
      const inMemDraft = yield* draftCast({
        sessionId: SESSION, characterId: CHARACTER, arcanum: "death", level: 2,
      }).pipe(as(PLAYER), Effect.provide(inMem.layer))
      yield* voidCast({ sessionId: SESSION, castId: inMemDraft }).pipe(
        as(ST_USER),
        Effect.provide(inMem.layer),
      )

      const fake = makeFakeCtx()
      const liveDraft = yield* draftCast({
        sessionId: SESSION, characterId: CHARACTER, arcanum: "death", level: 2,
      }).pipe(Effect.provide(convexLive(fake.ctx, { _id: PLAYER })))
      yield* voidCast({ sessionId: SESSION, castId: liveDraft }).pipe(
        Effect.provide(convexLive(fake.ctx, { _id: ST_USER })),
      )

      const inMemRow = inMem.casts[0]!
      const liveRow = [...fake.casts.values()][0]!
      expect(liveRow.status).toBe("voided")
      expect(inMemRow.status).toBe("voided")
      expect((liveRow.override as { kind: string }).kind).toBe("repair")
      expect(inMemRow.override?.kind).toBe("repair")
      expect((fake.messages[1]!.override as { kind: string }).kind).toBe("repair")
      expect(inMem.messages[1]!.override?.kind).toBe("repair")
      expect(fake.messages[1]!.text).toBe(inMem.messages[1]!.text)
    }),
  )
})
