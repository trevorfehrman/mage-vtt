import { Effect, Match, Option, Schema } from "effect"

// --- Types ---

interface MeritDefinition {
  readonly name: string
  readonly minDots: number
  readonly maxDots: number
  readonly prerequisites: ReadonlyArray<Prerequisite>
  readonly description: string
  readonly page: number
}

type Prerequisite =
  | { readonly _tag: "awakened" }
  | { readonly _tag: "noMerit"; readonly meritName: string }
  | { readonly _tag: "hasMerit"; readonly meritName: string }

interface MeritSelection {
  meritName: string
  dots: number
}

// --- Errors ---

export class MeritValidationError extends Schema.TaggedErrorClass<MeritValidationError>()(
  "MeritValidationError",
  { message: Schema.String },
) {}

// --- Mage-specific Merit reference data ---

export const MAGE_MERITS: ReadonlyArray<MeritDefinition> = [
  {
    name: "Artifact",
    minDots: 3,
    maxDots: 5,
    prerequisites: [{ _tag: "awakened" }],
    description: "A magical item of mysterious origin from the Supernal World. Cost: 2 + highest Arcanum dots + 1 per additional power.",
    page: 81,
  },
  {
    name: "Destiny",
    minDots: 1,
    maxDots: 5,
    prerequisites: [{ _tag: "awakened" }],
    description: "The character is fated for great things. Provides bonus dice equal to dots on one roll per chapter, but also attracts a bane.",
    page: 83,
  },
  {
    name: "Dream",
    minDots: 1,
    maxDots: 5,
    prerequisites: [],
    description: "The character receives prophetic or insightful dreams. Provides bonus dice on relevant rolls.",
    page: 84,
  },
  {
    name: "Enhanced Item",
    minDots: 1,
    maxDots: 5,
    prerequisites: [],
    description: "An item whose properties have been altered by magic, such as a sword with higher Durability or a wall made transparent.",
    page: 84,
  },
  {
    name: "Familiar",
    minDots: 3,
    maxDots: 4,
    prerequisites: [{ _tag: "awakened" }],
    description: "A spirit aide mystically bonded to the mage. 3 dots for immaterial, 4 for embodied.",
    page: 85,
  },
  {
    name: "Hallow",
    minDots: 1,
    maxDots: 5,
    prerequisites: [{ _tag: "hasMerit", meritName: "Sanctum" }],
    description: "A place of power that generates Mana. Generates dots-per-day in Mana points.",
    page: 84,
  },
  {
    name: "High Speech",
    minDots: 1,
    maxDots: 1,
    prerequisites: [{ _tag: "awakened" }],
    description: "The mage knows the Atlantean High Speech. Provides +2 bonus to spellcasting when spoken aloud.",
    page: 86,
  },
  {
    name: "Occultation",
    minDots: 1,
    maxDots: 3,
    prerequisites: [{ _tag: "awakened" }, { _tag: "noMerit", meritName: "Fame" }],
    description: "The mage's presence is supernaturally masked. Imposes penalty on attempts to scrutinize the mage's resonance.",
    page: 88,
  },
  {
    name: "Sanctum",
    minDots: 1,
    maxDots: 5,
    prerequisites: [],
    description: "A secure place where the mage lives and works magic. Size and security scale with dots.",
    page: 89,
  },
]

// --- Pure rules leaves (ADR-0014) ---

/**
 * One prerequisite checked against the names the character would hold after
 * the selection. `holds` covers current Merits and the selection together.
 */
const prerequisiteFailure = (
  merit: MeritDefinition,
  prereq: Prerequisite,
  holds: (meritName: string) => boolean,
): Option.Option<MeritValidationError> =>
  Match.value(prereq).pipe(
    // All mage characters are awakened; the prerequisite exists for the data's sake.
    Match.tag("awakened", () => Option.none()),
    Match.tag("noMerit", ({ meritName }) =>
      holds(meritName)
        ? Option.some(
            new MeritValidationError({
              message: `${merit.name} cannot be taken with ${meritName}`,
            }),
          )
        : Option.none(),
    ),
    Match.tag("hasMerit", ({ meritName }) =>
      holds(meritName)
        ? Option.none()
        : Option.some(
            new MeritValidationError({ message: `${merit.name} requires ${meritName}` }),
          ),
    ),
    Match.exhaustive,
  )

// --- Public API ---

export const validateMeritSelections = Effect.fn("Merits.validate")(function* (input: {
  selections: ReadonlyArray<MeritSelection>
  maxDots: number
  currentMerits: ReadonlyArray<MeritSelection>
}) {
  const { selections, maxDots, currentMerits } = input

  // Check total dots
  const totalDots = selections.reduce((sum, s) => sum + s.dots, 0)
  if (totalDots > maxDots) {
    return yield* new MeritValidationError({
      message: `Total Merit dots ${totalDots} exceeds maximum ${maxDots}`,
    })
  }

  const holds = (meritName: string) =>
    currentMerits.some((m) => m.meritName === meritName) ||
    selections.some((s) => s.meritName === meritName)

  for (const selection of selections) {
    // Find the Merit definition — a free-string name, so the miss is real
    const merit = Option.fromUndefinedOr(
      MAGE_MERITS.find((m) => m.name === selection.meritName),
    )
    if (Option.isNone(merit)) {
      return yield* new MeritValidationError({
        message: `Unknown Merit: "${selection.meritName}"`,
      })
    }

    // Check dots are in range
    if (selection.dots < merit.value.minDots || selection.dots > merit.value.maxDots) {
      return yield* new MeritValidationError({
        message: `${merit.value.name} requires ${merit.value.minDots}-${merit.value.maxDots} dots, got ${selection.dots}`,
      })
    }

    // Check prerequisites
    for (const prereq of merit.value.prerequisites) {
      const failure = prerequisiteFailure(merit.value, prereq, holds)
      if (Option.isSome(failure)) {
        return yield* failure.value
      }
    }
  }
})
