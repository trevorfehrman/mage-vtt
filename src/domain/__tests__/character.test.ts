import { Effect, Schema } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  CharacterSheet,
  createCharacter,
  initialCurrentState,
  rulingArcanaOf,
  validateCreationRules,
  validateRoteSpecialties,
  validateSkillSpecialties,
  applyWisdomTradeoff,
  activeSpellPenalty,
} from "../character"
import { arctusData } from "../fixtures/arctus"

/**
 * A complete, book-legal `CharacterSheet` input in its raw (pre-decode) form.
 * Tests spread overrides onto it to probe representability bounds (ADR-0011).
 */
const sheetInput = (overrides: Record<string, unknown> = {}) => ({
  id: "char-1",
  sessionId: "session-1",
  userId: "user-1",
  sessionMemberId: "member-1",
  name: "Testmage",
  concept: "Test",
  virtue: "Hope",
  vice: "Sloth",
  path: "Obrimos",
  order: "Silver Ladder",
  gnosis: 1,
  attributes: {
    mental: { intelligence: 2, wits: 3, resolve: 3 },
    physical: { strength: 2, dexterity: 3, stamina: 2 },
    social: { presence: 2, manipulation: 2, composure: 2 },
  },
  skills: {
    mental: { academics: 2, computer: 0, crafts: 0, investigation: 3, medicine: 0, occult: 3, politics: 1, science: 2 },
    physical: { athletics: 2, brawl: 0, drive: 1, firearms: 0, larceny: 0, stealth: 2, survival: 1, weaponry: 1 },
    social: { animalKen: 0, empathy: 0, expression: 1, intimidation: 0, persuasion: 2, socialize: 0, streetwise: 1, subterfuge: 0 },
  },
  arcana: { forces: 3, prime: 2, spirit: 1 },
  healthTrack: ["empty", "empty", "empty", "empty", "empty", "empty", "empty"],
  willpowerCurrent: 6,
  manaCurrent: 10,
  ...overrides,
})

const decodeSheet = Schema.decodeUnknownEffect(CharacterSheet)

describe("Character Sheet", () => {
  it.effect("creates a valid character with all required fields", () =>
    Effect.gen(function* () {
      const character = yield* createCharacter({
        name: "Arctus",
        shadowName: "The Little Bear",
        concept: "Occult investigator seeking forbidden knowledge",
        virtue: "Justice",
        vice: "Pride",
        path: "Moros",
        order: "Mysterium",
        attributes: {
          mental: { intelligence: 3, wits: 2, resolve: 2 },    // 3+2+2 = 7 (base 3 + 4 allocated)
          physical: { strength: 2, dexterity: 2, stamina: 2 },  // 2+2+2 = 6 (base 3 + 3 allocated)
          social: { presence: 2, manipulation: 3, composure: 3 }, // 2+3+3 = 8 (base 3 + 5 allocated)
        },
        skills: {
          mental: { academics: 2, computer: 0, crafts: 0, investigation: 3, medicine: 0, occult: 4, politics: 0, science: 2 }, // 11
          physical: { athletics: 1, brawl: 0, drive: 1, firearms: 0, larceny: 2, stealth: 2, survival: 1, weaponry: 0 }, // 7
          social: { animalKen: 0, empathy: 1, expression: 0, intimidation: 0, persuasion: 1, socialize: 1, streetwise: 1, subterfuge: 0 }, // 4
        },
        arcana: {
          death: 3,
          matter: 2,
          prime: 1,
        },
        gnosis: 1,
      })

      expect(character.name).toBe("Arctus")
      expect(character.path).toBe("Moros")
      expect(character.order).toBe("Mysterium")
      expect(character.virtue).toBe("Justice")
      expect(character.vice).toBe("Pride")
      expect(character.gnosis).toBe(1)

      // Attributes are accessible
      expect(character.attributes.mental.intelligence).toBe(3)
      expect(character.attributes.physical.stamina).toBe(2)
      expect(character.attributes.social.composure).toBe(3)

      // Skills are accessible
      expect(character.skills.mental.occult).toBe(4)

      // Arcana are accessible
      expect(character.arcana.death).toBe(3)
      expect(character.arcana.matter).toBe(2)
    }),
  )

  it.effect("CharacterSheet computes derived stats correctly", () =>
    Effect.gen(function* () {
      const sheet = yield* decodeSheet(sheetInput())

      // Health = Stamina(2) + Size(5) = 7
      expect(sheet.health).toBe(7)
      // Obrimos gives +1 Resolve
      // Willpower = Resolve(3+1) + Composure(2) = 6
      expect(sheet.willpower).toBe(6)
      // Defense = lower of Dexterity(3) or Wits(3) + Athletics(2) = 3 + 2 = 5
      expect(sheet.defense).toBe(5)
      // Initiative = Dexterity(3) + Composure(2) = 5
      expect(sheet.initiative).toBe(5)
      // Speed = Strength(2) + Dexterity(3) + 5 = 10
      expect(sheet.speed).toBe(10)
      // Max Mana at Gnosis 1 = 10
      expect(sheet.maxMana).toBe(10)
    }),
  )

  it("initialCurrentState derives a fresh character's mutable state (issue #27)", () => {
    const state = initialCurrentState(arctusData)

    // The numbers the dev seed mutation used to hand-roll: health boxes are
    // Stamina 2 + Size 5; Willpower is Resolve 2 + (Composure 3 + 1 Moros
    // bonus); Mana starts at the Gnosis-1 maximum.
    expect(state.healthTrack).toEqual(Array.from({ length: 7 }, () => "empty"))
    expect(state.willpowerCurrent).toBe(6)
    expect(state.manaCurrent).toBe(10)
  })

  it("rulingArcanaOf names the Path's ruling pair; an unknown path rules nothing", () => {
    expect(rulingArcanaOf("Moros")).toEqual(["matter", "death"])
    expect(rulingArcanaOf("Atlantean")).toEqual([])
  })

  it.effect("CharacterSheet path resistance bonus applies correctly", () =>
    Effect.gen(function* () {
      // Moros gives +1 Composure
      const moros = yield* decodeSheet(
        sheetInput({
          path: "Moros",
          order: "Mysterium",
          attributes: {
            mental: { intelligence: 2, wits: 2, resolve: 2 },
            physical: { strength: 2, dexterity: 2, stamina: 2 },
            social: { presence: 2, manipulation: 2, composure: 2 },
          },
          arcana: { death: 3, matter: 2, fate: 1 },
        }),
      )

      // Willpower = Resolve(2) + Composure(2+1) = 5
      expect(moros.willpower).toBe(5)
      // Initiative = Dexterity(2) + Composure(2+1) = 5
      expect(moros.initiative).toBe(5)

      // Mastigos gives +1 Resolve
      const mastigos = yield* decodeSheet(
        sheetInput({
          path: "Mastigos",
          order: "Mysterium",
          attributes: {
            mental: { intelligence: 2, wits: 2, resolve: 2 },
            physical: { strength: 2, dexterity: 2, stamina: 2 },
            social: { presence: 2, manipulation: 2, composure: 2 },
          },
          arcana: { space: 3, mind: 2, fate: 1 },
        }),
      )

      // Willpower = Resolve(2+1) + Composure(2) = 5
      expect(mastigos.willpower).toBe(5)
    }),
  )

  it.effect("CharacterSheet carries its linkage as branded domain data", () =>
    Effect.gen(function* () {
      const sheet = yield* decodeSheet(sheetInput())
      expect(sheet.id).toBe("char-1")
      expect(sheet.sessionId).toBe("session-1")
      expect(sheet.userId).toBe("user-1")
      expect(sheet.sessionMemberId).toBe("member-1")
      expect(sheet.manaCurrent).toBe(10)
      expect(sheet.willpowerCurrent).toBe(6)
      expect(sheet.healthTrack).toHaveLength(7)
    }),
  )

  // --- Representability, not game legality (ADR-0011) ---

  it.effect("out-of-book-but-representable values decode (fudged sheets never brick)", () =>
    Effect.gen(function* () {
      // 6 dots in an attribute — illegal at creation, legal on a Gnosis 6+ or
      // deliberately fudged sheet. Must decode.
      const strong = yield* decodeSheet(
        sheetInput({
          attributes: {
            mental: { intelligence: 2, wits: 3, resolve: 3 },
            physical: { strength: 6, dexterity: 3, stamina: 2 },
            social: { presence: 2, manipulation: 2, composure: 2 },
          },
        }),
      )
      expect(strong.attributes.physical.strength).toBe(6)

      // 7 dots in an Arcanum, 10 Gnosis, wounded health track — all representable.
      const wild = yield* decodeSheet(
        sheetInput({
          gnosis: 10,
          arcana: { forces: 7 },
          healthTrack: ["aggravated", "lethal", "bashing", "empty", "empty", "empty", "empty"],
        }),
      )
      expect(wild.arcana.forces).toBe(7)
      expect(wild.maxMana).toBe(100)
    }),
  )

  it.effect("garbage fails to decode: values outside the sheet's boxes", () =>
    Effect.gen(function* () {
      // 11 dots doesn't fit a 10-box rating
      const tooMany = yield* decodeSheet(
        sheetInput({ arcana: { forces: 11 } }),
      ).pipe(Effect.exit)
      expect(tooMany._tag).toBe("Failure")

      // Non-integer dots
      const fractional = yield* decodeSheet(
        sheetInput({ gnosis: 1.5 }),
      ).pipe(Effect.exit)
      expect(fractional._tag).toBe("Failure")

      // A health box only has four states
      const badBox = yield* decodeSheet(
        sheetInput({ healthTrack: ["mangled"] }),
      ).pipe(Effect.exit)
      expect(badBox._tag).toBe("Failure")

      // Path is one of five — that's what the sheet's box can hold
      const badPath = yield* decodeSheet(
        sheetInput({ path: "Hogwarts" }),
      ).pipe(Effect.exit)
      expect(badPath._tag).toBe("Failure")

      // Negative Mana is not representable
      const negativeMana = yield* decodeSheet(
        sheetInput({ manaCurrent: -1 }),
      ).pipe(Effect.exit)
      expect(negativeMana._tag).toBe("Failure")
    }),
  )

  it.effect("rejects invalid virtue", () =>
    Effect.gen(function* () {
      const result = yield* createCharacter({
        name: "Bad", concept: "Test", virtue: "Badness", vice: "Sloth",
        path: "Moros", order: "Mysterium",
        attributes: {
          mental: { intelligence: 2, wits: 2, resolve: 2 },
          physical: { strength: 2, dexterity: 2, stamina: 2 },
          social: { presence: 2, manipulation: 2, composure: 2 },
        },
        skills: {
          mental: { academics: 0, computer: 0, crafts: 0, investigation: 0, medicine: 0, occult: 0, politics: 0, science: 0 },
          physical: { athletics: 0, brawl: 0, drive: 0, firearms: 0, larceny: 0, stealth: 0, survival: 0, weaponry: 0 },
          social: { animalKen: 0, empathy: 0, expression: 0, intimidation: 0, persuasion: 0, socialize: 0, streetwise: 0, subterfuge: 0 },
        },
        arcana: { death: 3, matter: 2, fate: 1 },
        gnosis: 1,
      }).pipe(Effect.flip)

      expect(result._tag).toBe("CharacterValidationError")
    }),
  )

  it.effect("validates attribute allocation: primary 5, secondary 4, tertiary 3", () =>
    Effect.gen(function* () {
      const character = yield* createCharacter({
        name: "Test", concept: "Test", virtue: "Hope", vice: "Sloth",
        path: "Moros", order: "Mysterium",
        attributes: {
          mental: { intelligence: 3, wits: 2, resolve: 2 },    // sum=7, allocated=7-3base=4 (secondary)
          physical: { strength: 2, dexterity: 2, stamina: 2 },  // sum=6, allocated=6-3base=3 (tertiary)
          social: { presence: 2, manipulation: 3, composure: 3 }, // sum=8, allocated=8-3base=5 (primary)
        },
        skills: {
          mental: { academics: 2, computer: 1, crafts: 0, investigation: 3, medicine: 0, occult: 3, politics: 0, science: 2 },
          physical: { athletics: 2, brawl: 0, drive: 1, firearms: 0, larceny: 0, stealth: 2, survival: 1, weaponry: 1 },
          social: { animalKen: 0, empathy: 0, expression: 1, intimidation: 0, persuasion: 2, socialize: 0, streetwise: 1, subterfuge: 0 },
        },
        arcana: { death: 3, matter: 2, fate: 1 },
        gnosis: 1,
      })

      // Validation should pass — dots allocated are [5, 4, 3] in some order
      const result = yield* validateCreationRules(character)
      expect(result).toBeUndefined() // void on success
    }),
  )

  it.effect("rejects attribute allocation that doesn't match 5/4/3", () =>
    Effect.gen(function* () {
      const character = yield* createCharacter({
        name: "Test", concept: "Test", virtue: "Hope", vice: "Sloth",
        path: "Moros", order: "Mysterium",
        attributes: {
          // All categories have 5 allocated (5/5/5 instead of 5/4/3)
          mental: { intelligence: 3, wits: 3, resolve: 2 },    // sum=8, allocated=5
          physical: { strength: 3, dexterity: 3, stamina: 2 },  // sum=8, allocated=5
          social: { presence: 3, manipulation: 3, composure: 2 }, // sum=8, allocated=5
        },
        skills: {
          mental: { academics: 0, computer: 0, crafts: 0, investigation: 0, medicine: 0, occult: 0, politics: 0, science: 0 },
          physical: { athletics: 0, brawl: 0, drive: 0, firearms: 0, larceny: 0, stealth: 0, survival: 0, weaponry: 0 },
          social: { animalKen: 0, empathy: 0, expression: 0, intimidation: 0, persuasion: 0, socialize: 0, streetwise: 0, subterfuge: 0 },
        },
        arcana: { death: 3, matter: 2, fate: 1 },
        gnosis: 1,
      })

      const result = yield* validateCreationRules(character).pipe(Effect.flip)
      expect(result._tag).toBe("CreationRuleViolation")
    }),
  )

  it.effect("validates arcana: 6 total dots, 2 of first 3 must be ruling", () =>
    Effect.gen(function* () {
      // Moros ruling: Matter, Death. This has 2 ruling in top 3 — valid.
      const valid = yield* createCharacter({
        name: "Test", concept: "Test", virtue: "Hope", vice: "Sloth",
        path: "Moros", order: "Mysterium",
        attributes: {
          mental: { intelligence: 3, wits: 2, resolve: 2 },
          physical: { strength: 2, dexterity: 2, stamina: 2 },
          social: { presence: 2, manipulation: 3, composure: 3 },
        },
        skills: {
          mental: { academics: 2, computer: 1, crafts: 0, investigation: 3, medicine: 0, occult: 3, politics: 0, science: 2 },
          physical: { athletics: 2, brawl: 0, drive: 1, firearms: 0, larceny: 0, stealth: 2, survival: 1, weaponry: 1 },
          social: { animalKen: 0, empathy: 0, expression: 1, intimidation: 0, persuasion: 2, socialize: 0, streetwise: 1, subterfuge: 0 },
        },
        arcana: { death: 3, matter: 2, fate: 1 }, // 6 total, death+matter are ruling
        gnosis: 1,
      })
      const result = yield* validateCreationRules(valid)
      expect(result).toBeUndefined()

      // Now test invalid: no ruling arcana in top 3
      const invalid = yield* createCharacter({
        name: "Test", concept: "Test", virtue: "Hope", vice: "Sloth",
        path: "Moros", order: "Mysterium",
        attributes: {
          mental: { intelligence: 3, wits: 2, resolve: 2 },
          physical: { strength: 2, dexterity: 2, stamina: 2 },
          social: { presence: 2, manipulation: 3, composure: 3 },
        },
        skills: {
          mental: { academics: 2, computer: 1, crafts: 0, investigation: 3, medicine: 0, occult: 3, politics: 0, science: 2 },
          physical: { athletics: 2, brawl: 0, drive: 1, firearms: 0, larceny: 0, stealth: 2, survival: 1, weaponry: 1 },
          social: { animalKen: 0, empathy: 0, expression: 1, intimidation: 0, persuasion: 2, socialize: 0, streetwise: 1, subterfuge: 0 },
        },
        arcana: { fate: 3, mind: 2, space: 1 }, // 6 total, but NO ruling (Moros ruling = Matter/Death)
        gnosis: 1,
      })
      const invalidResult = yield* validateCreationRules(invalid).pipe(Effect.flip)
      expect(invalidResult._tag).toBe("CreationRuleViolation")
    }),
  )

  it.effect("validates rote specialties must come from order's rote skills", () =>
    Effect.gen(function* () {
      // Mysterium rote skills: Investigation, Occult, Survival
      const valid = yield* validateRoteSpecialties(
        "Mysterium",
        [
          { skill: "Investigation", specialty: "Crime Scenes" },
          { skill: "Occult", specialty: "Supernal Lore" },
          { skill: "Survival", specialty: "Urban" },
        ],
      )
      expect(valid).toBeUndefined()

      // Invalid: Athletics is not a Mysterium rote skill
      const invalid = yield* validateRoteSpecialties(
        "Mysterium",
        [
          { skill: "Investigation", specialty: "Crime Scenes" },
          { skill: "Athletics", specialty: "Running" },
          { skill: "Occult", specialty: "Supernal Lore" },
        ],
      ).pipe(Effect.flip)

      expect(invalid._tag).toBe("CreationRuleViolation")
    }),
  )

  it.effect("wisdom tradeoff: sacrifice dots for XP, minimum wisdom 5", () =>
    Effect.gen(function* () {
      // Starting wisdom is 7. Trade 1 dot for 5 XP.
      const result1 = yield* applyWisdomTradeoff(7, 1)
      expect(result1.wisdom).toBe(6)
      expect(result1.bonusXP).toBe(5)

      // Trade max 2 dots (7 → 5) for 10 XP
      const result2 = yield* applyWisdomTradeoff(7, 2)
      expect(result2.wisdom).toBe(5)
      expect(result2.bonusXP).toBe(10)

      // Can't go below 5
      const invalid = yield* applyWisdomTradeoff(7, 3).pipe(Effect.flip)
      expect(invalid._tag).toBe("CreationRuleViolation")
    }),
  )

  it.effect("validates 3 skill specialties, each for a skill with dots", () =>
    Effect.gen(function* () {
      const valid = yield* validateSkillSpecialties(
        [
          { skill: "Occult", specialty: "Supernal" },
          { skill: "Investigation", specialty: "Crime Scenes" },
          { skill: "Stealth", specialty: "Shadowing" },
        ],
        { occult: 3, investigation: 2, stealth: 2 },
      )
      expect(valid).toBeUndefined()

      // Wrong count
      const tooFew = yield* validateSkillSpecialties(
        [{ skill: "Occult", specialty: "Supernal" }],
        { occult: 3 },
      ).pipe(Effect.flip)
      expect(tooFew._tag).toBe("CreationRuleViolation")

      // Specialty in skill with 0 dots
      const noDots = yield* validateSkillSpecialties(
        [
          { skill: "Occult", specialty: "Supernal" },
          { skill: "Science", specialty: "Physics" },
          { skill: "Firearms", specialty: "Pistols" },
        ],
        { occult: 3, science: 0, firearms: 0 },
      ).pipe(Effect.flip)
      expect(noDots._tag).toBe("CreationRuleViolation")
    }),
  )

  it.effect("active spell penalty: -2 per spell beyond gnosis", () =>
    Effect.gen(function* () {
      // Gnosis 1: 1 free spell, penalty starts at 2nd
      expect(yield* activeSpellPenalty(1, 0)).toBe(0)
      expect(yield* activeSpellPenalty(1, 1)).toBe(0)
      expect(yield* activeSpellPenalty(1, 2)).toBe(-2)
      expect(yield* activeSpellPenalty(1, 3)).toBe(-4)

      // Gnosis 3: 3 free spells
      expect(yield* activeSpellPenalty(3, 3)).toBe(0)
      expect(yield* activeSpellPenalty(3, 5)).toBe(-4)
    }),
  )
})
