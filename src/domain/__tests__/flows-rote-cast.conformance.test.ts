import { Effect, Random } from "effect"
import { describe, expect, it } from "@effect/vitest"
import type { MutationCtx } from "../../../convex/_generated/server"
import { convexLive } from "../../../convex/lib/convexLive"
import { CharacterSheet, KnownRote } from "../character"
import { castRote } from "../flows/rote-cast"
import { CharacterId, PlayerId, SessionId, SessionMemberId } from "../ids"
import { Membership } from "../membership"
import { GameStore } from "../ports/game-store"
import { RotePool } from "../rote-pool"
import { SpellRef } from "../rote-cast"
import { failureTag } from "../testing/fixtures"
import { makeInMemory } from "../testing/in-memory"

/**
 * Conformance for the spell-reference surface of the seam (issue #18):
 * `getSpell` (with its row → SpellRef decode) and the whole `castRote` flow
 * must be observably identical through `ConvexLive` and `InMemory`, so the
 * fake the flow tests lean on can't silently drift from production. Prior
 * art: flows-cast.conformance.test.ts.
 */

const SESSION = "session-1"
const USER = "user-aldous"
const CHARACTER = "char-aldous"

const memberRows = [
  { sessionId: SESSION, userId: USER, role: "player" as const, displayName: "Aldous" },
]

const knownRotes = [
  {
    name: "Grave Mien",
    spellName: "Speak with the Dead",
    spellArcanum: "Death",
    spellLevel: 2,
    order: "Mysterium",
    pool: { attribute: "Presence", skills: ["Occult"], arcanum: "Death" },
  },
]

/** Spell reference rows, as the `spells` table stores them (wide, prose cost). */
const spellRows = [
  {
    _id: "spell-swtd",
    _creationTime: 0,
    name: "Speak with the Dead",
    arcanum: "Death",
    level: 2,
    practice: "Ruling",
    action: "Instant",
    duration: "Prolonged",
    aspect: "Covert",
    cost: "None",
    description: "…",
    pageStart: 137,
  },
  {
    _id: "spell-es",
    _creationTime: 0,
    name: "Ectoplasmic Shaping",
    arcanum: "Death",
    level: 1,
    practice: "Compelling",
    action: "Instant",
    duration: "Transitory",
    aspect: "Vulgar",
    cost: "None",
    description: "…",
    pageStart: 133,
  },
]

/** The raw character document, as the `characters` table stores it. */
const characterDoc = () => ({
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
  manaCurrent: 10,
  knownRotes,
})

// --- Minimal fake Convex ctx with characters + spells tables ---

const makeFakeCtx = () => {
  const diceRolls: Array<Record<string, unknown>> = []
  const messages: Array<Record<string, unknown>> = []
  const characters = new Map<string, Record<string, unknown>>([
    [CHARACTER, characterDoc()],
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
          collect: async () => {
            if (table === "sessionMembers") {
              return memberRows.filter(
                (r) => (r as Record<string, unknown>)[field] === value,
              )
            }
            if (table === "spells") {
              return spellRows.filter(
                (r) => (r as Record<string, unknown>)[field] === value,
              )
            }
            return []
          },
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

const makeInMemoryStore = (opts: { extraRotes?: ReadonlyArray<KnownRote> } = {}) => {
  const members = memberRows.map(
    (r) =>
      new Membership({
        userId: PlayerId.make(r.userId),
        sessionId: SessionId.make(r.sessionId),
        role: r.role,
        displayName: r.displayName,
      }),
  )
  const doc = characterDoc()
  return makeInMemory({
    members,
    actor: { userId: PlayerId.make(USER), isDev: false },
    sheets: [
      new CharacterSheet({
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
        knownRotes: [
          ...knownRotes.map(
            (r) =>
              new KnownRote({
                name: r.name,
                spellName: r.spellName,
                spellArcanum: "Death",
                spellLevel: r.spellLevel,
                order: "Mysterium",
                pool: new RotePool({
                  attribute: "Presence",
                  skills: ["Occult"],
                  arcanum: "Death",
                }),
              }),
          ),
          ...(opts.extraRotes ?? []),
        ],
      }),
    ],
    spells: spellRows.map(
      (s) =>
        new SpellRef({
          name: s.name,
          arcanum: s.arcanum as "Death",
          level: s.level,
          aspect: s.aspect as "Covert" | "Vulgar",
        }),
    ),
  })
}

const castArgs = {
  sessionId: SESSION,
  characterId: CHARACTER,
  roteName: "Grave Mien",
}

describe("Flows.roteCast.castRote conformance (ConvexLive vs InMemory)", () => {
  it.effect("getSpell decodes the same SpellRef through both adapters", () =>
    Effect.gen(function* () {
      const inMem = makeInMemoryStore()
      const fake = makeFakeCtx()

      const readSpell = Effect.gen(function* () {
        const store = yield* GameStore
        return yield* store.getSpell("Speak with the Dead", "Death")
      })

      const fromInMem = yield* readSpell.pipe(Effect.provide(inMem.layer))
      const fromLive = yield* readSpell.pipe(
        Effect.provide(convexLive(fake.ctx, { _id: USER })),
      )

      expect(fromLive).toEqual(fromInMem)
      expect(fromLive).toBeInstanceOf(SpellRef)
      expect(fromLive.aspect).toBe("Covert")
    }),
  )

  it.effect("getSpell fails DocumentNotFound identically for an unknown spell", () =>
    Effect.gen(function* () {
      const inMem = makeInMemoryStore()
      const fake = makeFakeCtx()

      const readMissing = Effect.gen(function* () {
        const store = yield* GameStore
        return yield* store.getSpell("Spell Not In The Book", "Death")
      })

      const inMemExit = yield* readMissing.pipe(Effect.provide(inMem.layer), Effect.exit)
      const liveExit = yield* readMissing.pipe(
        Effect.provide(convexLive(fake.ctx, { _id: USER })),
        Effect.exit,
      )

      expect(failureTag(inMemExit)).toBe("DocumentNotFound")
      expect(failureTag(liveExit)).toBe("DocumentNotFound")
    }),
  )

  it.effect("a same-named spell under a different Arcanum is not found", () =>
    Effect.gen(function* () {
      const fake = makeFakeCtx()

      const readWrongArcanum = Effect.gen(function* () {
        const store = yield* GameStore
        return yield* store.getSpell("Speak with the Dead", "Matter")
      })

      const liveExit = yield* readWrongArcanum.pipe(
        Effect.provide(convexLive(fake.ctx, { _id: USER })),
        Effect.exit,
      )

      expect(failureTag(liveExit)).toBe("DocumentNotFound")
    }),
  )

  it.effect("both adapters agree on a full Rote cast: pool, entry, no Mana movement", () =>
    Effect.gen(function* () {
      const inMem = makeInMemoryStore()
      yield* castRote(castArgs).pipe(
        Effect.provide(inMem.layer),
        Random.withSeed("rote-conformance"),
      )
      const inMemRoll = inMem.rolls[0]!
      const observedInMem = {
        successes: inMemRoll.result.successes,
        poolSize: inMemRoll.result.poolSize,
        summary: inMemRoll.summary,
        components: JSON.parse(JSON.stringify(inMemRoll.components)) as unknown,
        manaAfter: inMem.sheets.get(CharacterId.make(CHARACTER))!.manaCurrent,
        activityCount: inMem.rolls.length + inMem.messages.length,
      }

      const fake = makeFakeCtx()
      yield* castRote(castArgs).pipe(
        Effect.provide(convexLive(fake.ctx, { _id: USER })),
        Random.withSeed("rote-conformance"),
      )
      const liveRoll = fake.diceRolls[0] as {
        successes: number
        poolSize: number
        summary: string
        components: unknown
      }
      const observedLive = {
        successes: liveRoll.successes,
        poolSize: liveRoll.poolSize,
        summary: liveRoll.summary,
        components: JSON.parse(JSON.stringify(liveRoll.components)) as unknown,
        manaAfter: fake.characters.get(CHARACTER)!.manaCurrent as number,
        activityCount: fake.diceRolls.length + fake.messages.length,
      }

      expect(observedLive).toEqual(observedInMem)
      // Presence 2 + Occult 4 + Death 3, and a costless Rote moves no Mana
      expect(observedLive.poolSize).toBe(9)
      expect(observedLive.manaAfter).toBe(10)
      expect(observedLive.activityCount).toBe(1)
    }),
  )

  it.effect("both adapters refuse the Vulgar-backed Rote identically", () =>
    Effect.gen(function* () {
      const sealOf = {
        name: "The Seal of",
        spellName: "Ectoplasmic Shaping",
        spellArcanum: "Death",
        spellLevel: 1,
        order: "Mysterium",
        pool: {
          attribute: "Presence",
          skills: ["Occult"],
          arcanum: "Death",
          vs: ["Resolve", "Gnosis"],
        },
      }
      const vulgarArgs = { ...castArgs, roteName: "The Seal of" }

      const inMem = makeInMemoryStore({
        extraRotes: [
          new KnownRote({
            name: sealOf.name,
            spellName: sealOf.spellName,
            spellArcanum: "Death",
            spellLevel: sealOf.spellLevel,
            order: "Mysterium",
            pool: new RotePool({
              attribute: "Presence",
              skills: ["Occult"],
              arcanum: "Death",
              vs: ["Resolve", "Gnosis"],
            }),
          }),
        ],
      })
      const inMemExit = yield* castRote(vulgarArgs).pipe(
        Effect.provide(inMem.layer),
        Effect.exit,
      )

      const fake = makeFakeCtx()
      fake.characters.set(CHARACTER, {
        ...characterDoc(),
        knownRotes: [...knownRotes, sealOf],
      })
      const liveExit = yield* castRote(vulgarArgs).pipe(
        Effect.provide(convexLive(fake.ctx, { _id: USER })),
        Effect.exit,
      )

      expect(failureTag(inMemExit)).toBe("VulgarCastingNotYetSupported")
      expect(failureTag(liveExit)).toBe("VulgarCastingNotYetSupported")
      expect(inMem.rolls).toHaveLength(0)
      expect(inMem.sheetPatches).toHaveLength(0)
      expect(fake.diceRolls).toHaveLength(0)
      expect(fake.characters.get(CHARACTER)!.manaCurrent).toBe(10)
    }),
  )
})
