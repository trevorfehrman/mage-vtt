import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import type { MutationCtx } from "../../../convex/_generated/server"
import { convexLive } from "../../../convex/lib/convexLive"
import { CharacterSheet } from "../character"
import { handEditSheet } from "../flows/hand-edit"
import { CharacterId, PlayerId, SessionId, SessionMemberId } from "../ids"
import { Membership } from "../membership"
import { failureTag } from "../testing/fixtures"
import { makeInMemory } from "../testing/in-memory"

/**
 * Conformance for the hand-edit flow (issue #19): the inverted ladder, the
 * narrow patch write, and — new with this slice — the Override stamp on
 * `insertMessage` must be observably identical through `ConvexLive` and
 * `InMemory`. The message stamping is exactly the kind of adapter parity this
 * suite exists for: `InMemory` recorded it from day one; `ConvexLive` only
 * grew the column with this flow.
 */

const SESSION = "session-1"
const USER = "user-aldous"
const ST_USER = "user-stella"
const CHARACTER = "char-aldous"

const memberRows = [
  { sessionId: SESSION, userId: USER, role: "player" as const, displayName: "Aldous" },
  { sessionId: SESSION, userId: ST_USER, role: "storyteller" as const, displayName: "Stella" },
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
})

/** The same character as the decoded domain artifact, for seeding `InMemory`. */
const characterSheet = () => {
  const doc = characterDoc()
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

// --- Minimal fake Convex ctx with characters + messages ---

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

const makeInMemoryStore = (opts: { actor: string; isDev?: boolean }) => {
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
    actor: { userId: PlayerId.make(opts.actor), isDev: opts.isDev ?? false },
    sheets: [characterSheet()],
  })
}

const editArgs = {
  sessionId: SESSION,
  characterId: CHARACTER,
  manaCurrent: 3,
  willpowerCurrent: 4,
}

describe("Flows.handEdit.handEditSheet conformance (ConvexLive vs InMemory)", () => {
  it.effect("both adapters agree on an ST hand edit: patch, entry, repair Override", () =>
    Effect.gen(function* () {
      const inMem = makeInMemoryStore({ actor: ST_USER })
      yield* handEditSheet(editArgs).pipe(Effect.provide(inMem.layer))

      const inMemEntry = inMem.messages[0]!
      const inMemSheet = inMem.sheets.get(CharacterId.make(CHARACTER))!
      const observedInMem = {
        manaAfter: inMemSheet.manaCurrent,
        willpowerAfter: inMemSheet.willpowerCurrent,
        text: inMemEntry.text,
        visibility: inMemEntry.visibility,
        senderName: inMemEntry.senderName,
        override: JSON.parse(JSON.stringify(inMemEntry.override)),
        activityCount: inMem.rolls.length + inMem.messages.length,
      }

      const fake = makeFakeCtx()
      yield* handEditSheet(editArgs).pipe(
        Effect.provide(convexLive(fake.ctx, { _id: ST_USER })),
      )
      const liveEntry = fake.messages[0] as Record<string, unknown>
      const liveDoc = fake.characters.get(CHARACTER)!
      const observedLive = {
        manaAfter: liveDoc.manaCurrent,
        willpowerAfter: liveDoc.willpowerCurrent,
        text: liveEntry.text,
        visibility: liveEntry.visibilityType,
        senderName: liveEntry.senderName,
        override: JSON.parse(JSON.stringify(liveEntry.override)),
        activityCount: fake.diceRolls.length + fake.messages.length,
      }

      expect(observedLive).toEqual(observedInMem)
      expect(observedLive.manaAfter).toBe(3)
      expect(observedLive.willpowerAfter).toBe(4)
      // The stamp survives the wide insertMessage field map (ADR-0006)
      expect(observedLive.override).toEqual({
        invokedByUserId: ST_USER,
        invokedByName: "Stella",
        kind: "repair",
      })
      // One atomic entry (ADR-0009)
      expect(observedLive.activityCount).toBe(1)
    }),
  )

  it.effect("both adapters reject the owning Player with NotStoryteller, zero writes", () =>
    Effect.gen(function* () {
      const inMem = makeInMemoryStore({ actor: USER })
      const inMemExit = yield* handEditSheet(editArgs).pipe(
        Effect.provide(inMem.layer),
        Effect.exit,
      )

      const fake = makeFakeCtx()
      const liveExit = yield* handEditSheet(editArgs).pipe(
        Effect.provide(convexLive(fake.ctx, { _id: USER })),
        Effect.exit,
      )

      expect(failureTag(inMemExit)).toBe("NotStoryteller")
      expect(failureTag(liveExit)).toBe("NotStoryteller")
      expect(inMem.sheetPatches).toHaveLength(0)
      expect(inMem.messages).toHaveLength(0)
      expect(fake.messages).toHaveLength(0)
      expect(fake.characters.get(CHARACTER)!.manaCurrent).toBe(10)
    }),
  )

  it.effect("both adapters pass the Dev via the env allowlist (god-mode tier)", () =>
    Effect.gen(function* () {
      const DEV = "user-trevor"
      const inMem = makeInMemoryStore({ actor: DEV, isDev: true })
      yield* handEditSheet(editArgs).pipe(Effect.provide(inMem.layer))

      // ConvexLive resolves isDev from DEV_USER_IDS — the drift-prone bit
      const saved = process.env.DEV_USER_IDS
      process.env.DEV_USER_IDS = `someone-else, ${DEV}`
      try {
        const fake = makeFakeCtx()
        yield* handEditSheet(editArgs).pipe(
          Effect.provide(convexLive(fake.ctx, { _id: DEV })),
        )
        const liveEntry = fake.messages[0] as { override?: unknown }
        expect(JSON.parse(JSON.stringify(liveEntry.override))).toEqual(
          JSON.parse(JSON.stringify(inMem.messages[0]!.override)),
        )
        expect(fake.characters.get(CHARACTER)!.manaCurrent).toBe(3)
      } finally {
        if (saved === undefined) delete process.env.DEV_USER_IDS
        else process.env.DEV_USER_IDS = saved
      }
    }),
  )
})
