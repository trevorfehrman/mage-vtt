import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { createCharacter, validateCreationRules } from "../character"

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

  it.effect("computes derived stats correctly", () =>
    Effect.gen(function* () {
      const character = yield* createCharacter({
        name: "Testmage",
        concept: "Test",
        virtue: "Hope",
        vice: "Sloth",
        path: "Obrimos",
        order: "Silver Ladder",
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
        gnosis: 1,
      })

      // Health = Stamina(2) + Size(5) = 7
      expect(character.health).toBe(7)
      // Obrimos gives +1 Resolve
      // Willpower = Resolve(3+1) + Composure(2) = 6
      expect(character.willpower).toBe(6)
      // Defense = lower of Dexterity(3) or Wits(3) + Athletics(2) = 3 + 2 = 5
      expect(character.defense).toBe(5)
      // Initiative = Dexterity(3) + Composure(2) = 5
      expect(character.initiative).toBe(5)
      // Speed = Strength(2) + Dexterity(3) + 5 = 10
      expect(character.speed).toBe(10)
      // Max Mana at Gnosis 1 = 10
      expect(character.maxMana).toBe(10)
    }),
  )

  it.effect("path resistance bonus applies correctly", () =>
    Effect.gen(function* () {
      // Moros gives +1 Composure
      const moros = yield* createCharacter({
        name: "Test", concept: "Test", virtue: "Hope", vice: "Sloth",
        path: "Moros", order: "Mysterium",
        attributes: {
          mental: { intelligence: 2, wits: 2, resolve: 2 },
          physical: { strength: 2, dexterity: 2, stamina: 2 },
          social: { presence: 2, manipulation: 2, composure: 2 },
        },
        skills: {
          mental: { academics: 2, computer: 1, crafts: 0, investigation: 3, medicine: 0, occult: 3, politics: 0, science: 2 },
          physical: { athletics: 2, brawl: 0, drive: 1, firearms: 0, larceny: 0, stealth: 2, survival: 1, weaponry: 1 },
          social: { animalKen: 0, empathy: 0, expression: 1, intimidation: 0, persuasion: 2, socialize: 0, streetwise: 1, subterfuge: 0 },
        },
        arcana: { death: 3, matter: 2, fate: 1 },
        gnosis: 1,
      })

      // Composure is 2, but Moros gives +1 = effective 3 for derived stats
      // Willpower = Resolve(2) + Composure(2+1) = 5
      expect(moros.willpower).toBe(5)
      // Initiative = Dexterity(2) + Composure(2+1) = 5
      expect(moros.initiative).toBe(5)

      // Mastigos gives +1 Resolve
      const mastigos = yield* createCharacter({
        name: "Test2", concept: "Test", virtue: "Hope", vice: "Sloth",
        path: "Mastigos", order: "Mysterium",
        attributes: {
          mental: { intelligence: 2, wits: 2, resolve: 2 },
          physical: { strength: 2, dexterity: 2, stamina: 2 },
          social: { presence: 2, manipulation: 2, composure: 2 },
        },
        skills: {
          mental: { academics: 2, computer: 1, crafts: 0, investigation: 3, medicine: 0, occult: 3, politics: 0, science: 2 },
          physical: { athletics: 2, brawl: 0, drive: 1, firearms: 0, larceny: 0, stealth: 2, survival: 1, weaponry: 1 },
          social: { animalKen: 0, empathy: 0, expression: 1, intimidation: 0, persuasion: 2, socialize: 0, streetwise: 1, subterfuge: 0 },
        },
        arcana: { space: 3, mind: 2, fate: 1 },
        gnosis: 1,
      })

      // Willpower = Resolve(2+1) + Composure(2) = 5
      expect(mastigos.willpower).toBe(5)
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
})
