import { Effect, Random } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { KnownRote } from "../character"
import { castRote } from "../flows/rote-cast"
import { CharacterId, PlayerId, SessionId } from "../ids"
import { Membership } from "../membership"
import { RotePool } from "../rote-pool"
import { SpellRef } from "../rote-cast"
import { failureTag, makeAldousSheet as makeSheet } from "../testing/fixtures"
import { makeInMemory } from "../testing/in-memory"

/**
 * Flow tests for `Flows.roteCast.castRote` (PRD #11, issue #18) — asserted at
 * the port boundary: results, tagged errors, and the writes collected by the
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

// --- Reference data: the spells Aldous's Rotes name ---

const speakWithTheDead = new SpellRef({
  name: "Speak with the Dead",
  arcanum: "Death",
  level: 2,
  aspect: "Covert",
})

const ectoplasmicShaping = new SpellRef({
  name: "Ectoplasmic Shaping",
  arcanum: "Death",
  level: 1,
  aspect: "Vulgar",
})

// --- Aldous's trained Rotes ---

// Presence 2 + Occult 4 + Death 3 = 9 dice.
const graveMien = new KnownRote({
  name: "Grave Mien",
  spellName: "Speak with the Dead",
  spellArcanum: "Death",
  spellLevel: 2,
  order: "Mysterium",
  pool: new RotePool({ attribute: "Presence", skills: ["Occult"], arcanum: "Death" }),
})

// Vulgar-aspected spell behind the Rote.
const sealOf = new KnownRote({
  name: "The Seal of",
  spellName: "Ectoplasmic Shaping",
  spellArcanum: "Death",
  spellLevel: 1,
  order: "Mysterium",
  pool: new RotePool({
    attribute: "Presence",
    skills: ["Occult"],
    arcanum: "Death",
    vs: ["Resolve", "Gnosis"],
  }),
})

const KNOWN_ROTES = [graveMien, sealOf]

const seed = (
  opts: {
    actor?: PlayerId
    isDev?: boolean
    sheet?: ReturnType<typeof makeSheet>
    members?: ReadonlyArray<Membership>
  } = {},
) =>
  makeInMemory({
    members: opts.members ?? [aldous, briar],
    actor: { userId: opts.actor ?? PLAYER, isDev: opts.isDev ?? false },
    sheets: [opts.sheet ?? makeSheet({ knownRotes: KNOWN_ROTES })],
    spells: [speakWithTheDead, ectoplasmicShaping],
  })

const cast = (
  store: ReturnType<typeof makeInMemory>,
  extras: Partial<Parameters<typeof castRote>[0]> = {},
) =>
  castRote({
    sessionId: SESSION,
    characterId: CHARACTER,
    roteName: "Grave Mien",
    ...extras,
  }).pipe(Effect.provide(store.layer), Random.withSeed("rote-seed"))

describe("Flows.roteCast.castRote (covert rote, issue #18)", () => {
  it.effect("casts a known covert Rote: Attribute + Skill + Arcanum pool, one narrated entry", () =>
    Effect.gen(function* () {
      const store = seed()

      const rollId = yield* cast(store)

      // One atomic Activity entry (ADR-0009); a costless Rote still patches
      // the (unchanged) Mana total in one write
      expect(store.rolls).toHaveLength(1)
      expect(store.messages).toHaveLength(0)

      const entry = store.rolls[0]!
      expect(entry.id).toBe(rollId)
      expect(entry.userId).toBe(PLAYER)
      expect(entry.displayName).toBe("Aldous")
      expect(entry.override).toBeNull()
      // Pool = Presence 2 + Occult 4 + Death 3 (the caster's own ratings)
      expect(entry.result.poolSize).toBe(9)
      expect(entry.components).toEqual([
        { type: "attribute", name: "Presence", dots: 2 },
        { type: "skill", name: "Occult", dots: 4 },
        { type: "arcanum", name: "Death", dots: 3 },
      ])
      // The summary narrates the cast: who, which Rote, the spell, successes
      expect(entry.summary).toContain("Aldous")
      expect(entry.summary).toContain("Grave Mien")
      expect(entry.summary).toContain("Speak with the Dead")
      expect(entry.summary).toContain(String(entry.result.successes))
      expect(entry.visibility).toBe("public")
    }),
  )

  it.effect("a costless Rote deducts nothing: Mana computed server-side as 0", () =>
    Effect.gen(function* () {
      const store = seed()

      yield* cast(store)

      // No Path cost for a Rote (that's the improvised flow's rule)
      expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(10)
      expect(store.sheetPatches).toEqual([
        { characterId: CHARACTER, patch: { manaCurrent: 10 } },
      ])
      expect(store.rolls[0]!.summary).toContain("0 Mana")
    }),
  )

  it.effect("the rote-quality reroll is NOT applied — a Rote is not a rote action", () =>
    Effect.gen(function* () {
      const store = seed()

      yield* cast(store)

      const entry = store.rolls[0]!
      expect(entry.result.isRoteAction).toBe(false)
      expect(entry.result.roteRerolls).toEqual([])
    }),
  )

  it.effect("a Vulgar-aspected Rote is refused with the phase's typed error — no roll, no writes", () =>
    Effect.gen(function* () {
      const store = seed()

      const exit = yield* cast(store, { roteName: "The Seal of" }).pipe(Effect.exit)

      expect(failureTag(exit)).toBe("VulgarCastingNotYetSupported")
      expect(store.rolls).toHaveLength(0)
      expect(store.sheetPatches).toHaveLength(0)
      expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(10)
    }),
  )

  it.effect("a Rote the character never trained is refused RoteNotKnown", () =>
    Effect.gen(function* () {
      const store = seed()

      const exit = yield* cast(store, { roteName: "Someone Else's Trick" }).pipe(
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("RoteNotKnown")
      expect(store.rolls).toHaveLength(0)
      expect(store.sheetPatches).toHaveLength(0)
    }),
  )

  it.effect("a Rote whose spell reference row is missing fails DocumentNotFound", () =>
    Effect.gen(function* () {
      const orphan = new KnownRote({
        name: "Orphaned Rote",
        spellName: "Spell Not In The Book",
        spellArcanum: "Death",
        spellLevel: 1,
        order: "Mysterium",
        pool: new RotePool({
          attribute: "Presence",
          skills: ["Occult"],
          arcanum: "Death",
        }),
      })
      const store = seed({
        sheet: makeSheet({ knownRotes: [...KNOWN_ROTES, orphan] }),
      })

      const exit = yield* cast(store, { roteName: "Orphaned Rote" }).pipe(Effect.exit)

      expect(failureTag(exit)).toBe("DocumentNotFound")
      expect(store.rolls).toHaveLength(0)
    }),
  )
})

describe("Flows.roteCast.castRote 'or' pools and contested pools", () => {
  // Intelligence 3 + (Crafts 0 or Science 2) + Matter 2.
  const transubstantiation = new SpellRef({
    name: "Transubstantiation",
    arcanum: "Matter",
    level: 3,
    aspect: "Covert",
  })
  const alchemistsTouch = new KnownRote({
    name: "Alchemist's Touch",
    spellName: "Transubstantiation",
    spellArcanum: "Matter",
    spellLevel: 3,
    order: "Mysterium",
    pool: new RotePool({
      attribute: "Intelligence",
      skills: ["Crafts", "Science"],
      arcanum: "Matter",
    }),
  })

  const seedOr = () =>
    makeInMemory({
      members: [aldous, briar],
      actor: { userId: PLAYER, isDev: false },
      sheets: [makeSheet({ knownRotes: [...KNOWN_ROTES, alchemistsTouch] })],
      spells: [speakWithTheDead, ectoplasmicShaping, transubstantiation],
    })

  it.effect("an 'or' pool casts with the declared alternative", () =>
    Effect.gen(function* () {
      const store = seedOr()

      yield* cast(store, { roteName: "Alchemist's Touch", skillChoice: "Science" })

      const entry = store.rolls[0]!
      // Intelligence 3 + Science 2 + Matter 2
      expect(entry.result.poolSize).toBe(7)
      expect(entry.components).toContainEqual({
        type: "skill",
        name: "Science",
        dots: 2,
      })
      expect(entry.summary).toContain("Science")
    }),
  )

  it.effect("an 'or' pool with no declared pick is refused RoteSkillChoiceRequired", () =>
    Effect.gen(function* () {
      const store = seedOr()

      const exit = yield* cast(store, { roteName: "Alchemist's Touch" }).pipe(
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("RoteSkillChoiceRequired")
      expect(store.rolls).toHaveLength(0)
      expect(store.sheetPatches).toHaveLength(0)
    }),
  )

  it.effect("a contested pool records the target's traits in the entry summary", () =>
    Effect.gen(function* () {
      // "The Seal of" is contested but Vulgar; a Covert contested rote proves
      // the summary without tripping the aspect gate.
      const contested = new KnownRote({
        name: "Whispered Secrets",
        spellName: "Speak with the Dead",
        spellArcanum: "Death",
        spellLevel: 2,
        order: "Mysterium",
        pool: new RotePool({
          attribute: "Presence",
          skills: ["Occult"],
          arcanum: "Death",
          vs: ["Resolve", "Gnosis"],
        }),
      })
      const store = seed({ sheet: makeSheet({ knownRotes: [contested] }) })

      yield* cast(store, { roteName: "Whispered Secrets" })

      const entry = store.rolls[0]!
      expect(entry.summary).toContain("vs Resolve + Gnosis")
      // The caster's own roll happened; resolution is the Storyteller's
      expect(entry.result.poolSize).toBe(9)
    }),
  )
})

describe("Flows.roteCast.castRote factors and Willpower (issues #12, #18)", () => {
  it.effect("willpower spend adds +3 dice and decrements the sheet in the same patch", () =>
    Effect.gen(function* () {
      const store = seed()

      yield* cast(store, { spendWillpower: true })

      const entry = store.rolls[0]!
      // Presence 2 + Occult 4 + Death 3 + Willpower 3
      expect(entry.result.poolSize).toBe(12)
      expect(entry.components).toContainEqual({
        type: "modifier",
        name: "Willpower",
        dots: 3,
      })
      expect(store.sheetPatches).toEqual([
        {
          characterId: CHARACTER,
          patch: { manaCurrent: 10, willpowerCurrent: 5 },
        },
      ])
      expect(entry.summary).toContain("Willpower")
    }),
  )

  it.effect("a spend at 0 Willpower fails InsufficientWillpower atomically — no writes", () =>
    Effect.gen(function* () {
      const store = seed({
        sheet: makeSheet({ knownRotes: KNOWN_ROTES, willpowerCurrent: 0 }),
      })

      const exit = yield* cast(store, { spendWillpower: true }).pipe(Effect.exit)

      expect(failureTag(exit)).toBe("InsufficientWillpower")
      expect(store.rolls).toHaveLength(0)
      expect(store.sheetPatches).toHaveLength(0)
    }),
  )

  it.effect("factors compose: potency, targets, High Speech, Willpower on one cast", () =>
    Effect.gen(function* () {
      const store = seed()

      // 9 base + 2 High Speech + 3 Willpower - 2 Potency - 2 targets = 10
      yield* cast(store, {
        potency: 2,
        targets: 2,
        highSpeech: true,
        spendWillpower: true,
      })

      const entry = store.rolls[0]!
      expect(entry.result.poolSize).toBe(10)
      expect(entry.components).toContainEqual({
        type: "modifier",
        name: "High Speech",
        dots: 2,
      })
      expect(entry.components).toContainEqual({
        type: "modifier",
        name: "Spell factors",
        dots: -4,
      })
      expect(entry.summary).toContain("Potency 2")
      expect(entry.summary).toContain("2 targets")
      expect(entry.summary).toContain("High Speech")
    }),
  )

  it.effect("factor penalties can drive a Rote to a chance die without erroring", () =>
    Effect.gen(function* () {
      const store = seed()

      yield* cast(store, { potency: 5, targets: 4 }) // 9 - 8 - 4 = -3

      const entry = store.rolls[0]!
      expect(entry.result.poolSize).toBe(0)
      expect(entry.result.isChanceDie).toBe(true)
    }),
  )

  it.effect("extraManaCost is deducted on top of the costless Rote", () =>
    Effect.gen(function* () {
      const store = seed()

      yield* cast(store, { extraManaCost: 2 })

      expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(8)
      expect(store.rolls[0]!.summary).toContain("2 Mana")
    }),
  )

  it.effect("an unpayable declared cost blocks the cast atomically", () =>
    Effect.gen(function* () {
      const store = seed({
        sheet: makeSheet({ knownRotes: KNOWN_ROTES, manaCurrent: 1 }),
      })

      const exit = yield* cast(store, { extraManaCost: 2 }).pipe(Effect.exit)

      expect(failureTag(exit)).toBe("InsufficientMana")
      expect(store.rolls).toHaveLength(0)
      expect(store.sheetPatches).toHaveLength(0)
      expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(1)
    }),
  )

  it.effect("a hidden cast is written visibility:hidden", () =>
    Effect.gen(function* () {
      const store = seed()

      yield* cast(store, { visibility: "hidden" })

      expect(store.rolls[0]!.visibility).toBe("hidden")
    }),
  )

  it.effect("malformed factors fail InvalidCastDeclaration", () =>
    Effect.gen(function* () {
      const store = seed()

      const zeroPotency = yield* cast(store, { potency: 0 }).pipe(Effect.exit)
      expect(failureTag(zeroPotency)).toBe("InvalidCastDeclaration")

      const negativeExtra = yield* cast(store, { extraManaCost: -1 }).pipe(Effect.exit)
      expect(failureTag(negativeExtra)).toBe("InvalidCastDeclaration")

      expect(store.rolls).toHaveLength(0)
    }),
  )
})

describe("Flows.roteCast.castRote authority ladder (ADR-0006)", () => {
  const STORYTELLER = PlayerId.make("user-morgan")
  const morgan = new Membership({
    userId: STORYTELLER,
    sessionId: SESSION,
    role: "storyteller",
    displayName: "Morgan",
  })

  it.effect("the Storyteller casting in a player's stead: marked, attributed to the owner", () =>
    Effect.gen(function* () {
      const store = seed({ actor: STORYTELLER, members: [aldous, briar, morgan] })

      yield* cast(store)

      const entry = store.rolls[0]!
      expect(entry.userId).toBe(PLAYER)
      expect(entry.displayName).toBe("Aldous")
      expect(entry.override).toEqual({
        invokedByUserId: STORYTELLER,
        invokedByName: "Morgan",
        kind: "storyteller-action",
      })
    }),
  )

  it.effect("another player casting from my sheet fails NotYourCharacter", () =>
    Effect.gen(function* () {
      const store = seed({ actor: OTHER_PLAYER })

      const exit = yield* cast(store).pipe(Effect.exit)

      expect(failureTag(exit)).toBe("NotYourCharacter")
      expect(store.rolls).toHaveLength(0)
      expect(store.sheetPatches).toHaveLength(0)
    }),
  )

  it.effect("a Dev casts from any sheet: godmode-action marker", () =>
    Effect.gen(function* () {
      const DEV = PlayerId.make("user-dev")
      const store = seed({ actor: DEV, isDev: true })

      yield* cast(store)

      const entry = store.rolls[0]!
      expect(entry.userId).toBe(PLAYER)
      expect(entry.override).toEqual({
        invokedByUserId: DEV,
        invokedByName: DEV,
        kind: "godmode-action",
      })
    }),
  )
})
