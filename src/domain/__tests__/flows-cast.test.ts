import { Effect, Exit, Random } from "effect"
import { describe, expect, it } from "@effect/vitest"
import type { CharacterSheet } from "../character"
import { castSpell } from "../flows/casting"
import { CharacterId, PlayerId, SessionId, SessionMemberId } from "../ids"
import { Membership } from "../membership"
import type { SheetPatch } from "../ports/game-store"
import { failureTag, makeAldousSheet as makeSheet } from "../testing/fixtures"
import { makeInMemory } from "../testing/in-memory"

/**
 * Flow tests for `Flows.casting.castSpell` (PRD #4, slice #7) — asserted at the
 * port boundary: results, tagged errors, and the writes collected by the
 * in-memory adapter. Zero Convex, seeded dice.
 */

const SESSION = SessionId.make("session-1")
const PLAYER = PlayerId.make("user-aldous")
const OTHER_PLAYER = PlayerId.make("user-briar")
const CHARACTER = CharacterId.make("char-aldous")

const aldous = new Membership({
  userId: PLAYER,
  sessionId: SESSION,
  role: "player",
  displayName: "Aldous",
})

const briar = new Membership({
  userId: OTHER_PLAYER,
  sessionId: SESSION,
  role: "player",
  displayName: "Briar",
})

const seed = (opts: { actor?: PlayerId; sheet?: CharacterSheet } = {}) =>
  makeInMemory({
    members: [aldous, briar],
    actor: { userId: opts.actor ?? PLAYER, isDev: false },
    sheets: [opts.sheet ?? makeSheet()],
  })

describe("Flows.casting.castSpell (covert improvised tracer)", () => {
  it.effect("a non-Ruling cast spends 1 Mana and posts one narrated Roll entry", () =>
    Effect.gen(function* () {
      const store = seed()

      const rollId = yield* castSpell({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "prime", // Moros ruling is Matter/Death — Prime costs 1
        level: 1,
      }).pipe(Effect.provide(store.layer), Random.withSeed("cast-seed"))

      // One atomic Activity entry (ADR-0009), one sheet patch
      expect(store.rolls).toHaveLength(1)
      expect(store.messages).toHaveLength(0)
      expect(store.sheetPatches).toEqual([
        { characterId: CHARACTER, patch: { manaCurrent: 9 } },
      ])
      expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(9)

      const entry = store.rolls[0]!
      expect(entry.id).toBe(rollId)
      // Attribution: the owner's action, unmarked (no rule bent)
      expect(entry.userId).toBe(PLAYER)
      expect(entry.displayName).toBe("Aldous")
      expect(entry.override).toBeNull()
      // Pool = Gnosis 1 + Prime 1
      expect(entry.result.poolSize).toBe(2)
      expect(entry.components).toEqual([
        { type: "gnosis", name: "Gnosis", dots: 1 },
        { type: "arcanum", name: "Prime", dots: 1 },
      ])
      // The summary narrates the cast: who, Arcanum, Mana, successes (ADR-0009)
      expect(entry.summary).toContain("Aldous")
      expect(entry.summary).toContain("Prime")
      expect(entry.summary).toContain("1 Mana")
      expect(entry.summary).toContain(String(entry.result.successes))
      expect(entry.visibility).toBe("public")
    }),
  )

  it.effect("a Ruling-Arcanum cast costs 0 Mana (computed server-side)", () =>
    Effect.gen(function* () {
      const store = seed()

      yield* castSpell({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "death", // Moros ruling
        level: 2,
      }).pipe(Effect.provide(store.layer), Random.withSeed("cast-seed"))

      expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(10)
      expect(store.sheetPatches).toEqual([
        { characterId: CHARACTER, patch: { manaCurrent: 10 } },
      ])
      const entry = store.rolls[0]!
      // Pool = Gnosis 1 + Death 3
      expect(entry.result.poolSize).toBe(4)
      expect(entry.summary).toContain("0 Mana")
    }),
  )

  it.effect("declaring a level above the Arcanum dots fails ArcanumTooWeak, untouched", () =>
    Effect.gen(function* () {
      const store = seed()

      const exit = yield* castSpell({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "death",
        level: 4, // Death 3
      }).pipe(Effect.provide(store.layer), Random.withSeed("cast-seed"), Effect.exit)

      expect(failureTag(exit)).toBe("ArcanumTooWeak")
      if (Exit.isFailure(exit)) {
        const fail = exit.cause.reasons.find((r) => r._tag === "Fail") as {
          error: { arcanum: string; level: number; dots: number }
        }
        expect(fail.error.arcanum).toBe("death")
        expect(fail.error.level).toBe(4)
        expect(fail.error.dots).toBe(3)
      }
      // Nothing written, sheet untouched
      expect(store.rolls).toHaveLength(0)
      expect(store.sheetPatches).toHaveLength(0)
      expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(10)
    }),
  )

  it.effect("0 dots in the Arcanum fails ArcanumTooWeak at any level", () =>
    Effect.gen(function* () {
      const store = seed()

      const exit = yield* castSpell({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "forces", // absent from the sheet
        level: 1,
      }).pipe(Effect.provide(store.layer), Random.withSeed("cast-seed"), Effect.exit)

      expect(failureTag(exit)).toBe("ArcanumTooWeak")
      expect(store.rolls).toHaveLength(0)
    }),
  )

  it.effect("an unpayable cost fails InsufficientMana atomically — no writes", () =>
    Effect.gen(function* () {
      const store = seed({ sheet: makeSheet({ manaCurrent: 0 }) })

      const exit = yield* castSpell({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "prime", // non-Ruling: costs 1, has 0
        level: 1,
      }).pipe(Effect.provide(store.layer), Random.withSeed("cast-seed"), Effect.exit)

      expect(failureTag(exit)).toBe("InsufficientMana")
      expect(store.rolls).toHaveLength(0)
      expect(store.sheetPatches).toHaveLength(0)
      expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(0)
    }),
  )

  it.effect("another member casting from my sheet fails NotYourCharacter", () =>
    Effect.gen(function* () {
      const store = seed({ actor: OTHER_PLAYER })

      const exit = yield* castSpell({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "death",
        level: 1,
      }).pipe(Effect.provide(store.layer), Random.withSeed("cast-seed"), Effect.exit)

      expect(failureTag(exit)).toBe("NotYourCharacter")
      expect(store.rolls).toHaveLength(0)
      expect(store.sheetPatches).toHaveLength(0)
    }),
  )

  it.effect("an unknown character fails DocumentNotFound", () =>
    Effect.gen(function* () {
      const store = seed()

      const exit = yield* castSpell({
        sessionId: SESSION,
        characterId: "char-nobody",
        arcanum: "death",
        level: 1,
      }).pipe(Effect.provide(store.layer), Random.withSeed("cast-seed"), Effect.exit)

      expect(failureTag(exit)).toBe("DocumentNotFound")
    }),
  )

  it.effect("a character from a different session is not found in this one", () =>
    Effect.gen(function* () {
      const store = seed({
        sheet: makeSheet({ sessionId: SessionId.make("session-elsewhere") }),
      })

      const exit = yield* castSpell({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "death",
        level: 1,
      }).pipe(Effect.provide(store.layer), Random.withSeed("cast-seed"), Effect.exit)

      expect(failureTag(exit)).toBe("DocumentNotFound")
      expect(store.rolls).toHaveLength(0)
    }),
  )

  it.effect("a malformed declaration fails InvalidCastDeclaration", () =>
    Effect.gen(function* () {
      const store = seed()

      const badArcanum = yield* castSpell({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "kung-fu",
        level: 1,
      }).pipe(Effect.provide(store.layer), Random.withSeed("cast-seed"), Effect.exit)
      expect(failureTag(badArcanum)).toBe("InvalidCastDeclaration")

      const badLevel = yield* castSpell({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "death",
        level: 6,
      }).pipe(Effect.provide(store.layer), Random.withSeed("cast-seed"), Effect.exit)
      expect(failureTag(badLevel)).toBe("InvalidCastDeclaration")
      expect(store.rolls).toHaveLength(0)
    }),
  )

  it.effect("a fudged, out-of-book sheet still casts (ADR-0011)", () =>
    Effect.gen(function* () {
      // 7 dots of Death at Gnosis 1 — no book character looks like this,
      // but bending the game never bricks a cast.
      const store = seed({ sheet: makeSheet({ arcana: { death: 7 } }) })

      yield* castSpell({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "death",
        level: 5,
      }).pipe(Effect.provide(store.layer), Random.withSeed("cast-seed"))

      expect(store.rolls).toHaveLength(1)
      // Pool = Gnosis 1 + Death 7
      expect(store.rolls[0]!.result.poolSize).toBe(8)
    }),
  )

  it.effect("dramatic outcomes are called out in the summary", () =>
    Effect.gen(function* () {
      // Hunt seeds until the roll is an exceptional success so the callout is
      // observable (5+ successes on a big fudged pool comes up fast).
      let found = false
      for (let i = 0; i < 50 && !found; i++) {
        const store = seed({ sheet: makeSheet({ arcana: { death: 10 }, gnosis: 10 }) })
        yield* castSpell({
          sessionId: SESSION,
          characterId: CHARACTER,
          arcanum: "death",
          level: 5,
        }).pipe(Effect.provide(store.layer), Random.withSeed(`outcome-${i}`))
        const entry = store.rolls[0]!
        if (entry.result.isExceptionalSuccess) {
          expect(entry.summary).toContain("exceptional success")
          found = true
        }
      }
      expect(found).toBe(true)
    }),
  )
})

describe("Flows.casting.castSpell authority ladder (ADR-0006)", () => {
  const STORYTELLER = PlayerId.make("user-morgan")
  const DEV = PlayerId.make("user-dev")

  const morgan = new Membership({
    userId: STORYTELLER,
    sessionId: SESSION,
    role: "storyteller",
    displayName: "Morgan",
  })

  const ladderSeed = (opts: {
    actor: PlayerId
    isDev?: boolean
    sheet?: CharacterSheet
  }) =>
    makeInMemory({
      members: [aldous, briar, morgan],
      actor: { userId: opts.actor, isDev: opts.isDev ?? false },
      sheets: [opts.sheet ?? makeSheet()],
    })

  const cast = (store: ReturnType<typeof makeInMemory>, characterId = CHARACTER) =>
    castSpell({
      sessionId: SESSION,
      characterId,
      arcanum: "prime",
      level: 1,
    }).pipe(Effect.provide(store.layer), Random.withSeed("ladder-seed"))

  it.effect("the session's Storyteller casts in a player's stead: marked, attributed to the owner", () =>
    Effect.gen(function* () {
      const store = ladderSeed({ actor: STORYTELLER })

      yield* cast(store)

      const entry = store.rolls[0]!
      // Attribution follows the character's owner — it lands in their scope
      expect(entry.userId).toBe(PLAYER)
      expect(entry.displayName).toBe("Aldous")
      // The marker records who invoked it, on top
      expect(entry.override).toEqual({
        invokedByUserId: STORYTELLER,
        invokedByName: "Morgan",
        kind: "storyteller-action",
      })
      // Mana deducted from the character's sheet as if the owner cast
      expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(9)
    }),
  )

  it.effect("a Dev casts from any character's sheet in any session: godmode-action", () =>
    Effect.gen(function* () {
      // The Dev is not even a member of this session.
      const store = ladderSeed({ actor: DEV, isDev: true })

      yield* cast(store)

      const entry = store.rolls[0]!
      expect(entry.userId).toBe(PLAYER)
      expect(entry.override).toEqual({
        invokedByUserId: DEV,
        invokedByName: DEV, // no membership to take a display name from
        kind: "godmode-action",
      })
    }),
  )

  it.effect("marker fires on bypass, not identity: an ST casting their own character is unmarked", () =>
    Effect.gen(function* () {
      const store = ladderSeed({
        actor: STORYTELLER,
        sheet: makeSheet({
          userId: STORYTELLER,
          sessionMemberId: SessionMemberId.make("member-morgan"),
        }),
      })

      yield* cast(store)

      const entry = store.rolls[0]!
      expect(entry.override).toBeNull()
      expect(entry.userId).toBe(STORYTELLER)
      expect(entry.displayName).toBe("Morgan")
    }),
  )

  it.effect("a Dev who owns the character is likewise unmarked", () =>
    Effect.gen(function* () {
      const store = makeInMemory({
        members: [
          aldous,
          new Membership({
            userId: DEV,
            sessionId: SESSION,
            role: "player",
            displayName: "The Dev",
          }),
        ],
        actor: { userId: DEV, isDev: true },
        sheets: [
          makeSheet({
            userId: DEV,
            sessionMemberId: SessionMemberId.make("member-dev"),
          }),
        ],
      })

      yield* cast(store)

      expect(store.rolls[0]!.override).toBeNull()
    }),
  )

  it.effect("a plain player casting another's character still fails NotYourCharacter", () =>
    Effect.gen(function* () {
      const store = ladderSeed({ actor: OTHER_PLAYER })

      const exit = yield* cast(store).pipe(Effect.exit)

      expect(failureTag(exit)).toBe("NotYourCharacter")
      expect(store.rolls).toHaveLength(0)
    }),
  )

  it.effect("InsufficientMana still blocks an ST-invoked cast — same rules apply", () =>
    Effect.gen(function* () {
      const store = ladderSeed({
        actor: STORYTELLER,
        sheet: makeSheet({ manaCurrent: 0 }),
      })

      const exit = yield* cast(store).pipe(Effect.exit)

      expect(failureTag(exit)).toBe("InsufficientMana")
      expect(store.rolls).toHaveLength(0)
      expect(store.sheetPatches).toHaveLength(0)
    }),
  )
})

describe("Flows.casting.castSpell spell factors (PRD #4 slice #9)", () => {
  // Death 3 + Gnosis 1 = 4 base dice, Ruling for Moros (0 base Mana).
  const castDeath = (
    store: ReturnType<typeof makeInMemory>,
    extras: Partial<Parameters<typeof castSpell>[0]> = {},
  ) =>
    castSpell({
      sessionId: SESSION,
      characterId: CHARACTER,
      arcanum: "death",
      level: 1,
      ...extras,
    }).pipe(Effect.provide(store.layer), Random.withSeed("factor-seed"))

  it.effect("Potency 2 costs 2 dice off the pool, visible as a component", () =>
    Effect.gen(function* () {
      const store = seed()

      yield* castDeath(store, { potency: 2 })

      const entry = store.rolls[0]!
      expect(entry.result.poolSize).toBe(2) // 4 - 2
      expect(entry.components).toContainEqual({
        type: "modifier",
        name: "Spell factors",
        dots: -2,
      })
      expect(entry.summary).toContain("Potency 2")
    }),
  )

  it.effect("2 targets costs 2 dice", () =>
    Effect.gen(function* () {
      const store = seed()

      yield* castDeath(store, { targets: 2 })

      const entry = store.rolls[0]!
      expect(entry.result.poolSize).toBe(2)
      expect(entry.summary).toContain("2 targets")
    }),
  )

  it.effect("High Speech adds +2 dice", () =>
    Effect.gen(function* () {
      const store = seed()

      yield* castDeath(store, { highSpeech: true })

      const entry = store.rolls[0]!
      expect(entry.result.poolSize).toBe(6) // 4 + 2
      expect(entry.components).toContainEqual({
        type: "modifier",
        name: "High Speech",
        dots: 2,
      })
      expect(entry.summary).toContain("High Speech")
    }),
  )

  it.effect("factors combine: potency 2 + 2 targets + High Speech", () =>
    Effect.gen(function* () {
      const store = seed()

      yield* castDeath(store, { potency: 2, targets: 2, highSpeech: true })

      const entry = store.rolls[0]!
      expect(entry.result.poolSize).toBe(2) // 4 - 2 - 2 + 2
    }),
  )

  it.effect("factor penalties can drive the pool to a chance die", () =>
    Effect.gen(function* () {
      const store = seed()

      yield* castDeath(store, { potency: 3 }) // 4 - 4 = 0

      const entry = store.rolls[0]!
      expect(entry.result.poolSize).toBe(0)
      expect(entry.result.isChanceDie).toBe(true)
      expect(entry.summary).toContain("a chance die")
    }),
  )

  it.effect("a penalty far past the pool's floor still casts as a chance die", () =>
    Effect.gen(function* () {
      const store = seed()

      // Potency 5 (-8) + 4 targets (-4) = -12 on a 4-die pool. The book allows
      // the declaration; mechanically anything past the floor is the same
      // chance die, and the cast must not error out.
      yield* castDeath(store, { potency: 5, targets: 4 })

      const entry = store.rolls[0]!
      expect(entry.result.poolSize).toBe(0)
      expect(entry.result.isChanceDie).toBe(true)
      expect(entry.summary).toContain("Potency 5")
      expect(entry.summary).toContain("4 targets")
    }),
  )

  it.effect("a huge penalty on a huge fudged pool stays within component bounds", () =>
    Effect.gen(function* () {
      // Gnosis 10 + Death 10 = 20 positive dice; Potency 12 is -22. The
      // effective penalty (-20, floor at zero dice) must be recorded in
      // components that each fit a component's dots range.
      const store = seed({ sheet: makeSheet({ gnosis: 10, arcana: { death: 10 } }) })

      yield* castDeath(store, { potency: 12 })

      const entry = store.rolls[0]!
      expect(entry.result.poolSize).toBe(0)
      expect(entry.result.isChanceDie).toBe(true)
      const penaltyTotal = entry.components
        .filter((c) => c.name === "Spell factors")
        .reduce((sum, c) => sum + c.dots, 0)
      expect(penaltyTotal).toBe(-20)
      for (const c of entry.components) {
        expect(Math.abs(c.dots)).toBeLessThanOrEqual(10)
      }
    }),
  )

  it.effect("extraManaCost adds to the server-computed cost and is deducted", () =>
    Effect.gen(function* () {
      const store = seed()

      // Ruling (0) + declared extra 2 = 2 total
      yield* castDeath(store, { extraManaCost: 2 })

      expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(8)
      expect(store.rolls[0]!.summary).toContain("2 Mana")
    }),
  )

  it.effect("extraManaCost stacks on the non-Ruling cost", () =>
    Effect.gen(function* () {
      const store = seed()

      yield* castSpell({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "prime", // non-Ruling: 1
        level: 1,
        extraManaCost: 1,
      }).pipe(Effect.provide(store.layer), Random.withSeed("factor-seed"))

      expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(8) // 10 - (1 + 1)
    }),
  )

  it.effect("an unpayable combined cost blocks the cast atomically", () =>
    Effect.gen(function* () {
      const store = seed({ sheet: makeSheet({ manaCurrent: 1 }) })

      const exit = yield* castDeath(store, { extraManaCost: 2 }).pipe(Effect.exit)

      expect(failureTag(exit)).toBe("InsufficientMana")
      expect(store.rolls).toHaveLength(0)
      expect(store.sheetPatches).toHaveLength(0)
      expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(1)
    }),
  )

  it.effect("a hidden cast is written visibility:hidden", () =>
    Effect.gen(function* () {
      const store = seed()

      yield* castDeath(store, { visibility: "hidden" })

      expect(store.rolls[0]!.visibility).toBe("hidden")
    }),
  )

  it.effect("malformed factors fail InvalidCastDeclaration", () =>
    Effect.gen(function* () {
      const store = seed()

      const zeroPotency = yield* castDeath(store, { potency: 0 }).pipe(Effect.exit)
      expect(failureTag(zeroPotency)).toBe("InvalidCastDeclaration")

      const negativeExtra = yield* castDeath(store, { extraManaCost: -1 }).pipe(
        Effect.exit,
      )
      expect(failureTag(negativeExtra)).toBe("InvalidCastDeclaration")

      expect(store.rolls).toHaveLength(0)
    }),
  )
})

describe("Flows.casting.castSpell willpower spend (PRD #11, issue #12)", () => {
  // Death 3 + Gnosis 1 = 4 base dice, Ruling for Moros (0 base Mana).
  const castDeath = (
    store: ReturnType<typeof makeInMemory>,
    extras: Partial<Parameters<typeof castSpell>[0]> = {},
  ) =>
    castSpell({
      sessionId: SESSION,
      characterId: CHARACTER,
      arcanum: "death",
      level: 1,
      ...extras,
    }).pipe(Effect.provide(store.layer), Random.withSeed("wp-cast-seed"))

  it.effect("a willpower spend adds +3 dice and decrements the sheet in the same patch", () =>
    Effect.gen(function* () {
      const store = seed()

      yield* castDeath(store, { spendWillpower: true })

      const entry = store.rolls[0]!
      // Pool = Gnosis 1 + Death 3 + Willpower 3
      expect(entry.result.poolSize).toBe(7)
      expect(entry.components).toContainEqual({
        type: "modifier",
        name: "Willpower",
        dots: 3,
      })
      // One atomic patch carries both currencies
      expect(store.sheetPatches).toEqual([
        {
          characterId: CHARACTER,
          patch: { manaCurrent: 10, willpowerCurrent: 5 },
        },
      ])
      expect(store.sheets.get(CHARACTER)!.willpowerCurrent).toBe(5)
      // The narrative names the spend
      expect(entry.summary).toContain("Willpower")
    }),
  )

  it.effect("willpower stacks with the other factors", () =>
    Effect.gen(function* () {
      const store = seed()

      // 4 base + 2 High Speech + 3 Willpower - 2 Potency = 7
      yield* castDeath(store, {
        spendWillpower: true,
        highSpeech: true,
        potency: 2,
      })

      expect(store.rolls[0]!.result.poolSize).toBe(7)
    }),
  )

  it.effect("a spend at 0 Willpower fails InsufficientWillpower atomically — no writes", () =>
    Effect.gen(function* () {
      const store = seed({ sheet: makeSheet({ willpowerCurrent: 0 }) })

      const exit = yield* castDeath(store, { spendWillpower: true }).pipe(Effect.exit)

      expect(failureTag(exit)).toBe("InsufficientWillpower")
      expect(store.rolls).toHaveLength(0)
      expect(store.sheetPatches).toHaveLength(0)
      expect(store.sheets.get(CHARACTER)!.willpowerCurrent).toBe(0)
      expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(10)
    }),
  )

  it.effect("the Storyteller spending in a player's stead carries the Override marker", () =>
    Effect.gen(function* () {
      const STORYTELLER = PlayerId.make("user-morgan")
      const morgan = new Membership({
        userId: STORYTELLER,
        sessionId: SESSION,
        role: "storyteller",
        displayName: "Morgan",
      })
      const store = makeInMemory({
        members: [aldous, briar, morgan],
        actor: { userId: STORYTELLER, isDev: false },
        sheets: [makeSheet()],
      })

      yield* castDeath(store, { spendWillpower: true })

      const entry = store.rolls[0]!
      expect(entry.override).toEqual({
        invokedByUserId: STORYTELLER,
        invokedByName: "Morgan",
        kind: "storyteller-action",
      })
      expect(store.sheets.get(CHARACTER)!.willpowerCurrent).toBe(5)
    }),
  )

  it.effect("a cast without the declaration touches no Willpower", () =>
    Effect.gen(function* () {
      const store = seed()

      yield* castDeath(store)

      expect(store.sheetPatches).toEqual([
        { characterId: CHARACTER, patch: { manaCurrent: 10 } },
      ])
      expect(store.sheets.get(CHARACTER)!.willpowerCurrent).toBe(6)
    }),
  )
})

// --- Type-level guard: the narrow patch port (ADR-0011) ---
// `SheetPatch` is the compensating control for permissive sheet checks: it must
// not be able to express writes outside the fields play mutates.
// @ts-expect-error — traits are unreachable through SheetPatch
const _traitsUnreachable: SheetPatch = { gnosis: 10 }
// @ts-expect-error — identity is unreachable through SheetPatch
const _identityUnreachable: SheetPatch = { name: "Renamed" }
const _playStateReachable: SheetPatch = {
  manaCurrent: 1,
  willpowerCurrent: 2,
  healthTrack: ["empty"],
}
void _traitsUnreachable
void _identityUnreachable
void _playStateReachable
