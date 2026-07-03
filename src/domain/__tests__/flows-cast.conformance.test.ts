import { Effect, Exit, Random } from "effect"
import { describe, expect, it } from "@effect/vitest"
import type { MutationCtx } from "../../../convex/_generated/server"
import { convexLive } from "../../../convex/lib/convexLive"
import { CharacterSheet } from "../character"
import { castSpell } from "../flows/casting"
import { CharacterId, PlayerId, SessionId, SessionMemberId } from "../ids"
import { Membership } from "../membership"
import { GameStore } from "../ports/game-store"
import { makeInMemory } from "../testing/in-memory"

/**
 * Conformance for the sheet surface of the seam (ADR-0004): `getSheet` (with
 * its Doc → Sheet decode), `patchSheet`, and the whole `castSpell` flow must be
 * observably identical through `ConvexLive` and `InMemory`, so the fake the
 * flow tests lean on can't silently drift from production. Exercises the
 * drift-prone code: decode-at-adapter, the narrow patch mapping, id
 * translation, and the tagged failures.
 */

const SESSION = "session-1"
const USER = "user-aldous"
const OTHER_USER = "user-briar"
const CHARACTER = "char-aldous"

const memberRows = [
  { sessionId: SESSION, userId: USER, role: "player" as const, displayName: "Aldous" },
  { sessionId: SESSION, userId: OTHER_USER, role: "player" as const, displayName: "Briar" },
]

/** The raw character document, as the `characters` table stores it. */
const characterDoc = (manaCurrent: number) => ({
  _id: CHARACTER,
  _creationTime: 0,
  sessionMemberId: "member-aldous",
  sessionId: SESSION,
  userId: USER,
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
  manaCurrent,
})

/** The same character as the decoded domain artifact, for seeding `InMemory`. */
const characterSheet = (manaCurrent: number) => {
  const doc = characterDoc(manaCurrent)
  return new CharacterSheet({
    id: CharacterId.make(doc._id),
    sessionId: SessionId.make(doc.sessionId),
    userId: PlayerId.make(doc.userId),
    sessionMemberId: SessionMemberId.make(doc.sessionMemberId),
    name: doc.name,
    concept: doc.concept,
    virtue: "Justice",
    vice: "Pride",
    path: "Moros",
    order: "Mysterium",
    gnosis: doc.gnosis,
    attributes: doc.attributes,
    skills: doc.skills,
    arcana: doc.arcana,
    healthTrack: doc.healthTrack.map(() => "empty" as const),
    willpowerCurrent: doc.willpowerCurrent,
    manaCurrent: doc.manaCurrent,
  })
}

// --- Minimal fake Convex ctx with a characters table ---

const makeFakeCtx = (opts: { manaCurrent: number }) => {
  const diceRolls: Array<Record<string, unknown>> = []
  const messages: Array<Record<string, unknown>> = []
  const characters = new Map<string, Record<string, unknown>>([
    [CHARACTER, characterDoc(opts.manaCurrent)],
  ])

  const db = {
    normalizeId: (_table: string, id: string) =>
      typeof id === "string" && id.length > 0 ? id : null,
    get: async (id: string) => characters.get(id) ?? null,
    patch: async (id: string, fields: Record<string, unknown>) => {
      const doc = characters.get(id)
      if (!doc) throw new Error(`patch of missing doc ${id}`)
      characters.set(id, { ...doc, ...fields })
    },
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
              ? memberRows.filter(
                  (r) => (r as Record<string, unknown>)[field] === value,
                )
              : [],
        }
      },
    }),
    insert: async (table: string, doc: Record<string, unknown>) => {
      if (table === "diceRolls") {
        diceRolls.push(doc)
        return `dr_${diceRolls.length - 1}`
      }
      messages.push(doc)
      return `msg_${messages.length - 1}`
    },
  }

  return { ctx: { db } as unknown as MutationCtx, diceRolls, messages, characters }
}

const makeInMemoryStore = (opts: { manaCurrent: number; actor?: string }) => {
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
    actor: { userId: PlayerId.make(opts.actor ?? USER), isDev: false },
    sheets: [characterSheet(opts.manaCurrent)],
  })
}

// --- Normalized observable projection both adapters must agree on ---

interface Observed {
  successes: number
  poolSize: number
  summary: string
  components: unknown
  manaAfter: number
  activityCount: number
}

const castArgs = {
  sessionId: SESSION,
  characterId: CHARACTER,
  arcanum: "prime", // non-Ruling for Moros: exercises the sheet write
  level: 1,
}

const tagOf = (exit: Exit.Exit<unknown, unknown>) => {
  if (!Exit.isFailure(exit)) return null
  const fail = exit.cause.reasons.find((r) => r._tag === "Fail") as
    | { error: { _tag: string } }
    | undefined
  return fail?.error._tag ?? null
}

describe("Flows.casting.castSpell conformance (ConvexLive vs InMemory)", () => {
  it.effect("getSheet decodes the same CharacterSheet through both adapters", () =>
    Effect.gen(function* () {
      const inMem = makeInMemoryStore({ manaCurrent: 10 })
      const fake = makeFakeCtx({ manaCurrent: 10 })

      const readSheet = Effect.gen(function* () {
        const store = yield* GameStore
        return yield* store.getSheet(CharacterId.make(CHARACTER))
      })

      const fromInMem = yield* readSheet.pipe(Effect.provide(inMem.layer))
      const fromLive = yield* readSheet.pipe(
        Effect.provide(convexLive(fake.ctx, { _id: USER })),
      )

      expect(fromLive).toEqual(fromInMem)
      expect(fromLive).toBeInstanceOf(CharacterSheet)
      // Derived getters survive the decode
      expect(fromLive.maxMana).toBe(10)
      expect(fromLive.willpower).toBe(fromInMem.willpower)
    }),
  )

  it.effect("getSheet fails DocumentNotFound identically for an unknown character", () =>
    Effect.gen(function* () {
      const inMem = makeInMemoryStore({ manaCurrent: 10 })
      const fake = makeFakeCtx({ manaCurrent: 10 })

      const readMissing = Effect.gen(function* () {
        const store = yield* GameStore
        return yield* store.getSheet(CharacterId.make("char-nobody"))
      })

      const inMemExit = yield* readMissing.pipe(Effect.provide(inMem.layer), Effect.exit)
      const liveExit = yield* readMissing.pipe(
        Effect.provide(convexLive(fake.ctx, { _id: USER })),
        Effect.exit,
      )

      expect(tagOf(inMemExit)).toBe("DocumentNotFound")
      expect(tagOf(liveExit)).toBe("DocumentNotFound")
    }),
  )

  it.effect("both adapters agree on a full cast: mana write, entry, summary", () =>
    Effect.gen(function* () {
      const inMem = makeInMemoryStore({ manaCurrent: 10 })
      yield* castSpell(castArgs).pipe(
        Effect.provide(inMem.layer),
        Random.withSeed("cast-conformance"),
      )
      const inMemRoll = inMem.rolls[0]!
      const observedInMem: Observed = {
        successes: inMemRoll.result.successes,
        poolSize: inMemRoll.result.poolSize,
        summary: inMemRoll.summary,
        components: JSON.parse(JSON.stringify(inMemRoll.components)),
        manaAfter: inMem.sheets.get(CharacterId.make(CHARACTER))!.manaCurrent,
        activityCount: inMem.rolls.length + inMem.messages.length,
      }

      const fake = makeFakeCtx({ manaCurrent: 10 })
      yield* castSpell(castArgs).pipe(
        Effect.provide(convexLive(fake.ctx, { _id: USER })),
        Random.withSeed("cast-conformance"),
      )
      const liveRoll = fake.diceRolls[0] as {
        successes: number
        poolSize: number
        summary: string
        components: unknown
      }
      const observedLive: Observed = {
        successes: liveRoll.successes,
        poolSize: liveRoll.poolSize,
        summary: liveRoll.summary,
        components: JSON.parse(JSON.stringify(liveRoll.components)),
        manaAfter: fake.characters.get(CHARACTER)!.manaCurrent as number,
        activityCount: fake.diceRolls.length + fake.messages.length,
      }

      expect(observedLive).toEqual(observedInMem)
      // Non-Ruling improvised cast: exactly 1 Mana left the sheet
      expect(observedLive.manaAfter).toBe(9)
      // One atomic entry (ADR-0009)
      expect(observedLive.activityCount).toBe(1)
    }),
  )

  it.effect("both adapters block InsufficientMana with zero writes", () =>
    Effect.gen(function* () {
      const inMem = makeInMemoryStore({ manaCurrent: 0 })
      const inMemExit = yield* castSpell(castArgs).pipe(
        Effect.provide(inMem.layer),
        Random.withSeed("cast-conformance"),
        Effect.exit,
      )

      const fake = makeFakeCtx({ manaCurrent: 0 })
      const liveExit = yield* castSpell(castArgs).pipe(
        Effect.provide(convexLive(fake.ctx, { _id: USER })),
        Random.withSeed("cast-conformance"),
        Effect.exit,
      )

      expect(tagOf(inMemExit)).toBe("InsufficientMana")
      expect(tagOf(liveExit)).toBe("InsufficientMana")
      expect(inMem.rolls).toHaveLength(0)
      expect(inMem.sheetPatches).toHaveLength(0)
      expect(fake.diceRolls).toHaveLength(0)
      expect(fake.characters.get(CHARACTER)!.manaCurrent).toBe(0)
    }),
  )

  it.effect("both adapters refuse another member's cast with NotYourCharacter", () =>
    Effect.gen(function* () {
      const inMem = makeInMemoryStore({ manaCurrent: 10, actor: OTHER_USER })
      const inMemExit = yield* castSpell(castArgs).pipe(
        Effect.provide(inMem.layer),
        Random.withSeed("cast-conformance"),
        Effect.exit,
      )

      const fake = makeFakeCtx({ manaCurrent: 10 })
      const liveExit = yield* castSpell(castArgs).pipe(
        Effect.provide(convexLive(fake.ctx, { _id: OTHER_USER })),
        Random.withSeed("cast-conformance"),
        Effect.exit,
      )

      expect(tagOf(inMemExit)).toBe("NotYourCharacter")
      expect(tagOf(liveExit)).toBe("NotYourCharacter")
      expect(inMem.rolls).toHaveLength(0)
      expect(fake.diceRolls).toHaveLength(0)
    }),
  )

  it.effect("patchSheet writes only the narrow play-state fields", () =>
    Effect.gen(function* () {
      const fake = makeFakeCtx({ manaCurrent: 10 })
      const patchIt = Effect.gen(function* () {
        const store = yield* GameStore
        yield* store.patchSheet(CharacterId.make(CHARACTER), {
          manaCurrent: 4,
          willpowerCurrent: 3,
          healthTrack: ["bashing", "empty"],
        })
      })
      yield* patchIt.pipe(Effect.provide(convexLive(fake.ctx, { _id: USER })))

      const doc = fake.characters.get(CHARACTER)!
      expect(doc.manaCurrent).toBe(4)
      expect(doc.willpowerCurrent).toBe(3)
      expect(doc.healthTrack).toEqual(["bashing", "empty"])
      // Everything else untouched
      expect(doc.gnosis).toBe(1)
      expect(doc.name).toBe("Aldous")
    }),
  )
})
