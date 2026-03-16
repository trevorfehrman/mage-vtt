import { Effect, Schema } from "effect"

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
  | { type: "awakened" }
  | { type: "noMerit"; meritName: string }
  | { type: "hasMerit"; meritName: string }

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
    prerequisites: [{ type: "awakened" }],
    description: "A magical item of mysterious origin from the Supernal World. Cost: 2 + highest Arcanum dots + 1 per additional power.",
    page: 81,
  },
  {
    name: "Destiny",
    minDots: 1,
    maxDots: 5,
    prerequisites: [{ type: "awakened" }],
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
    prerequisites: [{ type: "awakened" }],
    description: "A spirit aide mystically bonded to the mage. 3 dots for immaterial, 4 for embodied.",
    page: 85,
  },
  {
    name: "Hallow",
    minDots: 1,
    maxDots: 5,
    prerequisites: [{ type: "hasMerit", meritName: "Sanctum" }],
    description: "A place of power that generates Mana. Generates dots-per-day in Mana points.",
    page: 84,
  },
  {
    name: "High Speech",
    minDots: 1,
    maxDots: 1,
    prerequisites: [{ type: "awakened" }],
    description: "The mage knows the Atlantean High Speech. Provides +2 bonus to spellcasting when spoken aloud.",
    page: 86,
  },
  {
    name: "Occultation",
    minDots: 1,
    maxDots: 3,
    prerequisites: [{ type: "awakened" }, { type: "noMerit", meritName: "Fame" }],
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
    yield* new MeritValidationError({
      message: `Total Merit dots ${totalDots} exceeds maximum ${maxDots}`,
    })
  }

  for (const selection of selections) {
    // Find the Merit definition
    const merit = MAGE_MERITS.find((m) => m.name === selection.meritName)
    if (!merit) {
      yield* new MeritValidationError({
        message: `Unknown Merit: "${selection.meritName}"`,
      })
      continue
    }

    // Check dots are in range
    if (selection.dots < merit.minDots || selection.dots > merit.maxDots) {
      yield* new MeritValidationError({
        message: `${merit.name} requires ${merit.minDots}-${merit.maxDots} dots, got ${selection.dots}`,
      })
    }

    // Check prerequisites
    for (const prereq of merit.prerequisites) {
      if (prereq.type === "noMerit") {
        const hasForbidden = currentMerits.some((m) => m.meritName === prereq.meritName)
          || selections.some((s) => s.meritName === prereq.meritName)
        if (hasForbidden) {
          yield* new MeritValidationError({
            message: `${merit.name} cannot be taken with ${prereq.meritName}`,
          })
        }
      }
      if (prereq.type === "hasMerit") {
        const hasRequired = currentMerits.some((m) => m.meritName === prereq.meritName)
          || selections.some((s) => s.meritName === prereq.meritName)
        if (!hasRequired) {
          yield* new MeritValidationError({
            message: `${merit.name} requires ${prereq.meritName}`,
          })
        }
      }
      // "awakened" prerequisite: all mage characters pass this, no check needed
    }
  }
})
