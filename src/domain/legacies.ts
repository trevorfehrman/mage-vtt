import { Effect, Schema } from "effect"

// --- Types ---

interface Attainment {
  name: string
  gnosisRequirement: number
  arcanaRequirements: Record<string, number>
  description: string
}

interface LegacyDef {
  name: string
  parentPath: string
  parentOrder: string
  primaryArcanum: string
  attainments: ReadonlyArray<Attainment>
}

export class JoinResult extends Schema.Class<JoinResult>("JoinResult")({
  canJoin: Schema.Boolean,
  reason: Schema.optional(Schema.String),
}) {}

// --- Legacy Reference Data (Appendix One, pages 348-369) ---

export const LEGACIES: ReadonlyArray<LegacyDef> = [
  {
    name: "Perfected Adept",
    parentPath: "Thyrsus",
    parentOrder: "Adamantine Arrow",
    primaryArcanum: "life",
    attainments: [
      { name: "Honing the Form", gnosisRequirement: 3, arcanaRequirements: { life: 2, mind: 1 }, description: "Enhance physical capabilities through Life magic without casting a spell." },
      { name: "Perfecting the Form", gnosisRequirement: 5, arcanaRequirements: { life: 3 }, description: "Further refine physical attributes, gaining supernatural resilience." },
      { name: "Transcending the Form", gnosisRequirement: 7, arcanaRequirements: { life: 4 }, description: "Achieve peak physical perfection, transcending mortal limitations." },
    ],
  },
  {
    name: "Subtle One",
    parentPath: "Mastigos",
    parentOrder: "Guardians of the Veil",
    primaryArcanum: "mind",
    attainments: [
      { name: "Mental Veil", gnosisRequirement: 3, arcanaRequirements: { mind: 2, fate: 1 }, description: "Cloud minds of observers, making the mage less noticeable." },
      { name: "Psychic Shroud", gnosisRequirement: 5, arcanaRequirements: { mind: 3 }, description: "Deeper mental concealment, affecting memory and perception." },
      { name: "Living Shadow", gnosisRequirement: 7, arcanaRequirements: { mind: 4 }, description: "Become virtually invisible to mundane and magical senses." },
    ],
  },
  {
    name: "Uncrowned King",
    parentPath: "Mastigos",
    parentOrder: "Silver Ladder",
    primaryArcanum: "mind",
    attainments: [
      { name: "Commanding Aura", gnosisRequirement: 3, arcanaRequirements: { mind: 2, fate: 1 }, description: "Project authority that compels others to obey." },
      { name: "Sovereign Will", gnosisRequirement: 5, arcanaRequirements: { mind: 3 }, description: "Impose will upon groups, commanding loyalty without spells." },
      { name: "Crown of the Supernal", gnosisRequirement: 7, arcanaRequirements: { mind: 4 }, description: "Absolute psychic dominion over those in the mage's presence." },
    ],
  },
  {
    name: "Walker in Mists",
    parentPath: "Acanthus",
    parentOrder: "Free Council",
    primaryArcanum: "space",
    attainments: [
      { name: "Step Sideways", gnosisRequirement: 3, arcanaRequirements: { life: 1, space: 2 }, description: "Slip between spaces, moving through small gaps and barriers." },
      { name: "Misty Path", gnosisRequirement: 5, arcanaRequirements: { space: 3 }, description: "Create short-range teleportation without formal spellcasting." },
      { name: "Between Worlds", gnosisRequirement: 7, arcanaRequirements: { space: 4 }, description: "Step between realms, crossing the Gauntlet without Spirit magic." },
    ],
  },
  {
    name: "Dreamer",
    parentPath: "Acanthus",
    parentOrder: "Mysterium",
    primaryArcanum: "mind",
    attainments: [
      { name: "Lucid Dreaming", gnosisRequirement: 3, arcanaRequirements: { mind: 2, space: 1 }, description: "Control own dreams and enter the Astral Realm through sleep." },
      { name: "Dreamwalker", gnosisRequirement: 5, arcanaRequirements: { mind: 3 }, description: "Enter and influence the dreams of others." },
      { name: "Dream Shaper", gnosisRequirement: 7, arcanaRequirements: { mind: 4 }, description: "Reshape the Astral landscape and create lasting dreamscapes." },
    ],
  },
  {
    name: "Forge Master",
    parentPath: "Moros",
    parentOrder: "Free Council",
    primaryArcanum: "matter",
    attainments: [
      { name: "Craftsman's Eye", gnosisRequirement: 3, arcanaRequirements: { matter: 2, prime: 1 }, description: "Perceive the fundamental structure of objects and materials." },
      { name: "Shaping Touch", gnosisRequirement: 5, arcanaRequirements: { matter: 3 }, description: "Reshape materials by touch without formal spellcasting." },
      { name: "Transmutation", gnosisRequirement: 7, arcanaRequirements: { matter: 4 }, description: "Transmute substances at will, turning lead to gold or steel to glass." },
    ],
  },
]

// --- Public API ---

export const canJoinLegacy = Effect.fn("Legacy.canJoin")(function* (input: {
  legacyName: string
  gnosis: number
  arcana: Record<string, number>
}) {
  const legacy = LEGACIES.find((l) => l.name === input.legacyName)
  if (!legacy) {
    return new JoinResult({ canJoin: false, reason: `Unknown legacy: ${input.legacyName}` })
  }

  // Must have Gnosis 3+ to join any legacy
  if (input.gnosis < 3) {
    return new JoinResult({ canJoin: false, reason: `Gnosis must be 3+, currently ${input.gnosis}` })
  }

  // Check first attainment's arcana prerequisites
  const firstAttainment = legacy.attainments[0]
  for (const [arcanum, required] of Object.entries(firstAttainment.arcanaRequirements)) {
    const current = input.arcana[arcanum] ?? 0
    if (current < required) {
      return new JoinResult({
        canJoin: false,
        reason: `Requires ${arcanum} ${required}+, currently ${current}`,
      })
    }
  }

  return new JoinResult({ canJoin: true })
})

export const getAttainmentsForGnosis = Effect.fn("Legacy.getAttainments")(function* (
  legacyName: string,
  gnosis: number,
  arcana: Record<string, number>,
) {
  const legacy = LEGACIES.find((l) => l.name === legacyName)
  if (!legacy) return []

  return legacy.attainments.filter((att) => {
    if (gnosis < att.gnosisRequirement) return false
    // Check arcana requirements
    for (const [arcanum, required] of Object.entries(att.arcanaRequirements)) {
      if ((arcana[arcanum] ?? 0) < required) return false
    }
    return true
  })
})
