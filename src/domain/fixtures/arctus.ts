/**
 * Arctus — pre-built Moros/Mysterium character for seeding.
 * Matches the test fixture from character.test.ts.
 */
export const arctusData = {
  name: "Arctus",
  shadowName: "The Little Bear",
  concept: "Occult investigator seeking forbidden knowledge",
  virtue: "Justice" as const,
  vice: "Pride" as const,
  path: "Moros" as const,
  order: "Mysterium" as const,
  gnosis: 1,
  attributes: {
    mental: { intelligence: 3, wits: 2, resolve: 2 },
    physical: { strength: 2, dexterity: 2, stamina: 2 },
    social: { presence: 2, manipulation: 3, composure: 3 },
  },
  skills: {
    mental: {
      academics: 2,
      computer: 0,
      crafts: 0,
      investigation: 3,
      medicine: 0,
      occult: 4,
      politics: 0,
      science: 2,
    },
    physical: {
      athletics: 1,
      brawl: 0,
      drive: 1,
      firearms: 0,
      larceny: 2,
      stealth: 2,
      survival: 1,
      weaponry: 0,
    },
    social: {
      animalKen: 0,
      empathy: 1,
      expression: 0,
      intimidation: 0,
      persuasion: 1,
      socialize: 1,
      streetwise: 1,
      subterfuge: 0,
    },
  },
  arcana: {
    death: 3,
    matter: 2,
    prime: 1,
  },
} as const
