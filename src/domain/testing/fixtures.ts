import { Exit } from "effect"
import { CharacterSheet } from "../character"
import { CharacterId, PlayerId, SessionId, SessionMemberId } from "../ids"

/**
 * Shared flow-test fixtures: the canonical Aldous sheet (a Moros of the
 * Mysterium — ruling Matter/Death, Death 3 / Matter 2 / Prime 1) and the
 * failure-tag extractor the flow suites assert with.
 */

export const makeAldousSheet = (
  overrides: Partial<ConstructorParameters<typeof CharacterSheet>[0]> = {},
) =>
  new CharacterSheet({
    id: CharacterId.make("char-aldous"),
    sessionId: SessionId.make("session-1"),
    userId: PlayerId.make("user-aldous"),
    sessionMemberId: SessionMemberId.make("member-aldous"),
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

/** The `_tag` of a flow's typed failure, or null on success / defect. */
export const failureTag = (exit: Exit.Exit<unknown, unknown>) => {
  if (!Exit.isFailure(exit)) return null
  const fail = exit.cause.reasons.find((r) => r._tag === "Fail") as
    | { error: { _tag: string } }
    | undefined
  return fail?.error._tag ?? null
}
