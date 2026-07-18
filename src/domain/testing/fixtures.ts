import { Exit, Schema } from "effect"
import { CharacterSheet } from "../character"

/**
 * Shared flow-test fixtures: the canonical Aldous sheet (a Moros of the
 * Mysterium — ruling Matter/Death, Death 3 / Matter 2 / Prime 1) and the
 * failure-tag extractor the flow suites assert with.
 *
 * The sheet is *decoded*, not constructed — the same boundary translation the
 * adapters do — so the fixture speaks plain numbers and the branded
 * quantities (issue #35) are minted by the schema.
 */

export const makeAldousSheet = (
  overrides: Partial<typeof CharacterSheet.Encoded> = {},
) =>
  Schema.decodeUnknownSync(CharacterSheet)({
    id: "char-aldous",
    sessionId: "session-1",
    userId: "user-aldous",
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
    ...overrides,
  })

/**
 * The Corvin sheet — the playtest character (data/characters/
 * example-character.json): a Moros of the Mysterium, Occult 3, whose
 * own-Order Rotes make him the Rote Specialty fixture (issue #87).
 */
export const makeCorvinSheet = (
  overrides: Partial<typeof CharacterSheet.Encoded> = {},
) =>
  Schema.decodeUnknownSync(CharacterSheet)({
    id: "char-corvin",
    sessionId: "session-1",
    userId: "user-corvin",
    sessionMemberId: "member-corvin",
    name: "Corvin Ashe",
    shadowName: "Tessellate",
    concept: "Forensic accountant turned relic hunter",
    virtue: "Prudence",
    vice: "Greed",
    path: "Moros",
    order: "Mysterium",
    gnosis: 2,
    attributes: {
      mental: { intelligence: 3, wits: 2, resolve: 3 },
      physical: { strength: 2, dexterity: 3, stamina: 2 },
      social: { presence: 2, manipulation: 2, composure: 2 },
    },
    skills: {
      mental: { academics: 2, computer: 0, crafts: 0, investigation: 2, medicine: 1, occult: 3, politics: 0, science: 3 },
      physical: { athletics: 2, brawl: 1, drive: 1, firearms: 0, larceny: 1, stealth: 2, survival: 0, weaponry: 0 },
      social: { animalKen: 0, empathy: 1, expression: 0, intimidation: 0, persuasion: 1, socialize: 1, streetwise: 0, subterfuge: 1 },
    },
    arcana: { death: 2, matter: 3, prime: 1 },
    healthTrack: ["empty", "empty", "empty", "empty", "empty", "empty", "empty"],
    willpowerCurrent: 6,
    manaCurrent: 11,
    ...overrides,
  })

/**
 * A raw characters-table doc decoded to the sheet artifact — the adapters'
 * boundary translation, for seeding test stores. Extra doc keys
 * (`_creationTime`) are ignored by the decode; `_id` maps to `id`.
 */
export const sheetFromDoc = (doc: Record<string, unknown> & { _id: string }) =>
  Schema.decodeUnknownSync(CharacterSheet)({ ...doc, id: doc._id })

/** The `_tag` of a flow's typed failure, or null on success / defect. */
export const failureTag = (exit: Exit.Exit<unknown, unknown>) => {
  if (!Exit.isFailure(exit)) return null
  const fail = exit.cause.reasons.find((r) => r._tag === "Fail") as
    | { error: { _tag: string } }
    | undefined
  return fail?.error._tag ?? null
}
