import { Effect, Random } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { castSheetless } from "../flows/sheetless-cast"
import { CharacterId, PlayerId, SessionId } from "../ids"
import { Membership } from "../membership"
import { failureTag, makeAldousSheet as makeSheet } from "../testing/fixtures"
import { makeInMemory } from "../testing/in-memory"

/**
 * Flow tests for `Flows.casting.castSheetless` (PRD #11, issue #15) — NPC and
 * spirit opposition with no Character Sheet behind it. Asserted at the port
 * boundary: one Activity entry, zero sheet writes, ST/Dev-only authority.
 */

const SESSION = SessionId.make("session-1")
const PLAYER = PlayerId.make("user-aldous")
const STORYTELLER = PlayerId.make("user-morgan")
const DEV = PlayerId.make("user-dev")
const CHARACTER = CharacterId.make("char-aldous")

const aldous = new Membership({
  userId: PLAYER,
  sessionId: SESSION,
  role: "player",
  displayName: "Aldous",
})

const morgan = new Membership({
  userId: STORYTELLER,
  sessionId: SESSION,
  role: "storyteller",
  displayName: "Morgan",
})

// A sheet in the store, to prove sheet-less means sheet-less.
const seed = (opts: { actor: PlayerId; isDev?: boolean }) =>
  makeInMemory({
    members: [aldous, morgan],
    actor: { userId: opts.actor, isDev: opts.isDev ?? false },
    sheets: [makeSheet()],
  })

describe("Flows.casting.castSheetless (ST NPC opposition)", () => {
  it.effect("the ST casts with a hand-declared pool — Hidden by default, zero sheet writes", () =>
    Effect.gen(function* () {
      const store = seed({ actor: STORYTELLER })

      const rollId = yield* castSheetless({
        sessionId: SESSION,
        poolSize: 6,
      }).pipe(Effect.provide(store.layer), Random.withSeed("npc-seed"))

      // One atomic Activity entry, nothing else persisted (ADR-0009)
      expect(store.rolls).toHaveLength(1)
      expect(store.messages).toHaveLength(0)
      expect(store.sheetPatches).toHaveLength(0)
      expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(10)
      expect(store.sheets.get(CHARACTER)!.willpowerCurrent).toBe(6)

      const entry = store.rolls[0]!
      expect(entry.id).toBe(rollId)
      // NPC spells are usually Hidden regardless of Aspect (glossary)
      expect(entry.visibility).toBe("hidden")
      // Attribution: the Storyteller's own action — no rule bent, no marker
      expect(entry.userId).toBe(STORYTELLER)
      expect(entry.displayName).toBe("Morgan")
      expect(entry.override).toBeNull()
      expect(entry.result.poolSize).toBe(6)
      expect(entry.summary).toContain("Morgan")
      expect(entry.summary).toContain("sheet-less")
    }),
  )

  it.effect("visibility can be declared public at cast time", () =>
    Effect.gen(function* () {
      const store = seed({ actor: STORYTELLER })

      yield* castSheetless({
        sessionId: SESSION,
        poolSize: 4,
        visibility: "public",
      }).pipe(Effect.provide(store.layer), Random.withSeed("npc-seed"))

      expect(store.rolls[0]!.visibility).toBe("public")
    }),
  )

  it.effect("a declared pool of 0 rolls a chance die", () =>
    Effect.gen(function* () {
      const store = seed({ actor: STORYTELLER })

      yield* castSheetless({
        sessionId: SESSION,
        poolSize: 0,
      }).pipe(Effect.provide(store.layer), Random.withSeed("npc-seed"))

      const entry = store.rolls[0]!
      expect(entry.result.poolSize).toBe(0)
      expect(entry.result.isChanceDie).toBe(true)
    }),
  )

  it.effect("a big pool still lands as one entry with the full size", () =>
    Effect.gen(function* () {
      const store = seed({ actor: STORYTELLER })

      yield* castSheetless({
        sessionId: SESSION,
        poolSize: 23,
      }).pipe(Effect.provide(store.layer), Random.withSeed("npc-seed"))

      expect(store.rolls[0]!.result.poolSize).toBe(23)
    }),
  )

  it.effect("a Player invoking it is rejected with NotStoryteller — nothing written", () =>
    Effect.gen(function* () {
      const store = seed({ actor: PLAYER })

      const exit = yield* castSheetless({
        sessionId: SESSION,
        poolSize: 5,
      }).pipe(Effect.provide(store.layer), Random.withSeed("npc-seed"), Effect.exit)

      expect(failureTag(exit)).toBe("NotStoryteller")
      expect(store.rolls).toHaveLength(0)
      expect(store.sheetPatches).toHaveLength(0)
    }),
  )

  it.effect("a Dev member who is not the ST passes with a godmode-action marker", () =>
    Effect.gen(function* () {
      const dev = new Membership({
        userId: DEV,
        sessionId: SESSION,
        role: "player",
        displayName: "The Dev",
      })
      const store = makeInMemory({
        members: [aldous, morgan, dev],
        actor: { userId: DEV, isDev: true },
        sheets: [makeSheet()],
      })

      yield* castSheetless({
        sessionId: SESSION,
        poolSize: 3,
      }).pipe(Effect.provide(store.layer), Random.withSeed("npc-seed"))

      const entry = store.rolls[0]!
      expect(entry.userId).toBe(DEV)
      expect(entry.override).toEqual({
        invokedByUserId: DEV,
        invokedByName: "The Dev",
        kind: "godmode-action",
      })
    }),
  )

  it.effect("a non-member fails NotAMember, Dev or not", () =>
    Effect.gen(function* () {
      const store = seed({ actor: PlayerId.make("user-outsider"), isDev: true })

      const exit = yield* castSheetless({
        sessionId: SESSION,
        poolSize: 5,
      }).pipe(Effect.provide(store.layer), Random.withSeed("npc-seed"), Effect.exit)

      expect(failureTag(exit)).toBe("NotAMember")
      expect(store.rolls).toHaveLength(0)
    }),
  )

  it.effect("a malformed pool declaration fails InvalidSheetlessCast", () =>
    Effect.gen(function* () {
      const store = seed({ actor: STORYTELLER })

      for (const poolSize of [-1, 2.5, 31]) {
        const exit = yield* castSheetless({
          sessionId: SESSION,
          poolSize,
        }).pipe(Effect.provide(store.layer), Random.withSeed("npc-seed"), Effect.exit)
        expect(failureTag(exit)).toBe("InvalidSheetlessCast")
      }
      expect(store.rolls).toHaveLength(0)
    }),
  )
})
