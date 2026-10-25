import { Effect, Layer, Random } from "effect"
import { describe, expect, it } from "@effect/vitest"
import type { MutationCtx } from "../../../convex/_generated/server"
import type { OverrideStamp } from "../override"
import { GameStore } from "../ports/game-store"
import { convexLive } from "../../../convex/lib/convexLive"
import {
  adjustPrice,
  commitCast,
  draftCast,
  engageCast,
  lockPrice,
  releaseCast,
  rollParadox,
  setDraftContainment,
  setDraftMitigation,
  voidCast,
} from "../flows/vulgar-cast"
import { CastId, PlayerId, SessionId } from "../ids"
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
  // The standing tool fact (issue #107): stamped onto the draft by the flow.
  hasMagicalTool: true,
})

// --- Minimal fake Convex ctx with characters + casts + scenes + entries ---

const makeFakeCtx = (
  seedCasts?: ReadonlyArray<readonly [string, Record<string, unknown>]>,
) => {
  const diceRolls: Array<Record<string, unknown>> = []
  const messages: Array<Record<string, unknown>> = []
  const characters = new Map<string, Record<string, unknown>>([
    [CHARACTER, aldousDoc()],
  ])
  const casts = new Map<string, Record<string, unknown>>(seedCasts ?? [])
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
    sheets: [makeAldousSheet({ hasMagicalTool: true })],
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
    // The draft carries the bought floor (issue #107); the tool rides in
    // from the sheet's standing fact, not an arg.
    const castId = yield* draftCast({
      sessionId: SESSION,
      characterId: CHARACTER,
      arcanum: "death",
      level: 2,
      potency: 2,
    }).pipe(Effect.provide(layerFor(PLAYER)))
    yield* engageCast({ sessionId: SESSION, castId }).pipe(
      Effect.provide(layerFor(ST_USER)),
    )
    // The Price beats (ADR-0022) pin the new patch fields through both
    // adapters. Deliberately net-zero on the pool (+1 adjustment, −1 tool
    // from the sheet fact) so the seeded dice downstream stay byte-identical.
    yield* adjustPrice({
      sessionId: SESSION,
      castId,
      adjustments: [{ source: "Ley line hum", dice: 1 }],
    }).pipe(Effect.provide(layerFor(ST_USER)))
    yield* lockPrice({ sessionId: SESSION, castId }).pipe(
      Effect.provide(layerFor(ST_USER)),
    )
    // The caster's live bets (MAG-34) ride the same patch through both
    // adapters: drafted, then committed and cast as drafted.
    yield* setDraftMitigation({ sessionId: SESSION, castId, draftMitigation: 0 }).pipe(
      Effect.provide(layerFor(PLAYER)),
    )
    yield* commitCast({ sessionId: SESSION, castId, manaMitigation: 0 }).pipe(
      Effect.provide(layerFor(PLAYER)),
    )
    yield* rollParadox({ sessionId: SESSION, castId }).pipe(
      Effect.provide(layerFor(ST_USER)),
    )
    // Seed "docks" rolls a 9 on the single Paradox die: one success — the
    // one Cast click contains it and releases the spell (ADR-0022).
    yield* setDraftContainment({ sessionId: SESSION, castId, draftContainedSuccesses: 1 }).pipe(
      Effect.provide(layerFor(PLAYER)),
    )
    yield* releaseCast({ sessionId: SESSION, castId, containedSuccesses: 1 }).pipe(
      Effect.provide(layerFor(PLAYER)),
    )
    return castId
  })

/** The observable projection both adapters must agree on, field by field. */
const observedCast = (row: Record<string, unknown>) => ({
  status: row.status,
  arcanum: row.arcanum,
  level: row.level,
  usesMagicalTool: row.usesMagicalTool,
  potency: row.potency ?? null,
  targets: row.targets ?? null,
  declaredPool: row.declaredPool,
  spellManaCost: row.spellManaCost,
  sceneId: row.sceneId ?? null,
  gnosis: row.gnosis,
  adjustments: row.adjustments,
  tides: row.tides,
  manaMitigation: row.manaMitigation,
  draftMitigation: row.draftMitigation ?? null,
  draftContainedSuccesses: row.draftContainedSuccesses ?? null,
  paradoxSuccesses: row.paradoxSuccesses,
  paradoxIsDramaticFailure: row.paradoxIsDramaticFailure,
  // The stamped faces and their parented explosions (issue #122): both
  // adapters must persist the identical lineage structs.
  paradoxRolls: row.paradoxRolls,
  paradoxExplosions: row.paradoxExplosions,
  castRolls: row.castRolls,
  castExplosions: row.castExplosions,
  castRoteRerolls: row.castRoteRerolls,
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
      expect(liveRow.potency).toBe(2) // the bought floor, stamped for the ST
      expect(liveRow.castPool).toBe(2) // Gnosis 1 + Death 3, −2 Potency
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

  it.effect("a legacy flat-explosion row heals to parentless structs at the live decode", () =>
    Effect.gen(function* () {
      // A playtest row written before issue #122: bare faces in both
      // explosion columns. Only the live adapter can meet one — the
      // in-memory store's seeds are typed to the parented shape — so the
      // heal is pinned where legacy documents actually live.
      const fake = makeFakeCtx([
        [
          "cast_legacy",
          {
            _id: "cast_legacy",
            _creationTime: 1,
            sessionId: SESSION,
            characterId: CHARACTER,
            casterUserId: PLAYER,
            casterName: "Aldous",
            status: "resolved",
            arcanum: "death",
            level: 2,
            usesMagicalTool: false,
            declaredComponents: [{ type: "gnosis", name: "Gnosis", dots: 1 }],
            declaredPool: 4,
            spellManaCost: 0,
            paradoxSuccesses: 1,
            paradoxRolls: [9],
            paradoxExplosions: [9],
            castSuccesses: 2,
            castRolls: [8, 10, 3],
            castExplosions: [10, 8],
            createdAt: 1,
            updatedAt: 2,
          },
        ],
      ])

      const cast = yield* Effect.gen(function* () {
        const store = yield* GameStore
        return yield* store.getCast(CastId.make("cast_legacy"))
      }).pipe(Effect.provide(convexLive(fake.ctx, { _id: PLAYER })))

      expect(cast.paradoxExplosions).toEqual([{ value: 9, parentIndex: null }])
      expect(cast.castExplosions).toEqual([
        { value: 10, parentIndex: null },
        { value: 8, parentIndex: null },
      ])
      // The healed decode never disturbs the stamped counts or faces.
      expect(cast.castSuccesses).toBe(2)
      expect(cast.castRolls).toEqual([8, 10, 3])
    }),
  )

  it.effect("parented structs round-trip patch → get identically through both adapters", () =>
    Effect.gen(function* () {
      const parentedPatch = {
        paradoxRolls: [10],
        paradoxExplosions: [{ value: 5, parentIndex: 0 }],
        castRolls: [4, 10, 3, 7],
        castExplosions: [
          { value: 10, parentIndex: 1 },
          { value: 7, parentIndex: 4 },
        ],
      }

      // Live: draft a row through the flow, stamp the structs, read back.
      const fake = makeFakeCtx()
      const liveId = yield* draftCast({
        sessionId: SESSION, characterId: CHARACTER, arcanum: "death", level: 2,
      }).pipe(Effect.provide(convexLive(fake.ctx, { _id: PLAYER })))
      const live = yield* Effect.gen(function* () {
        const store = yield* GameStore
        yield* store.patchCast(liveId, parentedPatch)
        return yield* store.getCast(liveId)
      }).pipe(Effect.provide(convexLive(fake.ctx, { _id: PLAYER })))

      // InMemory: the same script against the second adapter.
      const inMem = makeInMemoryStore()
      const memId = yield* draftCast({
        sessionId: SESSION, characterId: CHARACTER, arcanum: "death", level: 2,
      }).pipe(as(PLAYER), Effect.provide(inMem.layer))
      const mem = yield* Effect.gen(function* () {
        const store = yield* GameStore
        yield* store.patchCast(memId, parentedPatch)
        return yield* store.getCast(memId)
      }).pipe(as(PLAYER), Effect.provide(inMem.layer))

      expect(live.paradoxExplosions).toEqual(parentedPatch.paradoxExplosions)
      expect(live.castExplosions).toEqual(parentedPatch.castExplosions)
      expect(mem.paradoxExplosions).toEqual(live.paradoxExplosions)
      expect(mem.castExplosions).toEqual(live.castExplosions)
      expect(mem.paradoxRolls).toEqual(live.paradoxRolls)
      expect(mem.castRolls).toEqual(live.castRolls)
    }),
  )
})
