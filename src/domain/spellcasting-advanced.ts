import { Effect, Schema } from "effect"

// --- Order rote skills (for rote specialty bonus) ---

const ORDER_ROTE_SKILLS: Record<string, readonly string[]> = {
  "Adamantine Arrow": ["Athletics", "Intimidation", "Medicine"],
  "Free Council": ["Crafts", "Persuasion", "Science"],
  "Guardians of the Veil": ["Investigation", "Stealth", "Subterfuge"],
  "Mysterium": ["Investigation", "Occult", "Survival"],
  "Silver Ladder": ["Expression", "Persuasion", "Subterfuge"],
}

// --- Types ---

export class MagicResistanceResult extends Schema.Class<MagicResistanceResult>("MagicResistanceResult")({
  mode: Schema.Literals(["contested", "automated"]),
  dicePool: Schema.optional(Schema.Number),
  subtractFromPool: Schema.optional(Schema.Number),
}) {}

export class CombinedSpellReqs extends Schema.Class<CombinedSpellReqs>("CombinedSpellReqs")({
  minGnosis: Schema.Number.check(Schema.isInt()),
  dicePenalty: Schema.Number.check(Schema.isInt()),
  extraArcanumDots: Schema.Number.check(Schema.isInt()),
}) {}

export class ExtendedCastingTargets extends Schema.Class<ExtendedCastingTargets>("ExtendedCastingTargets")({
  targetSuccesses: Schema.Number.check(Schema.isInt()),
}) {}

// --- Public API ---

export const magicResistance = Effect.fn("Spellcasting.magicResistance")(function* (input: {
  mode: "contested" | "automated"
  resistanceAttribute: number
  targetGnosis?: number
  spendWillpower: boolean
}) {
  if (input.mode === "contested") {
    // Contested: Resistance Attribute + Gnosis (if mage) + 3 if spending WP
    let pool = input.resistanceAttribute + (input.targetGnosis ?? 0)
    if (input.spendWillpower) pool += 3
    return new MagicResistanceResult({ mode: "contested", dicePool: pool })
  }

  // Automated: subtract Resistance from casting pool + 2 if spending WP
  let subtract = input.resistanceAttribute
  if (input.spendWillpower) subtract += 2
  return new MagicResistanceResult({ mode: "automated", subtractFromPool: subtract })
})

export const combinedSpellRequirements = Effect.fn("Spellcasting.combinedReqs")(function* (
  spellCount: number,
) {
  // Gnosis 3 for 2, 6 for 3, 9 for 4
  const minGnosis = (spellCount - 1) * 3
  // -2 per additional spell beyond the first
  const dicePenalty = (spellCount - 1) * -2
  // Each component needs +1 Arcanum dot above normal
  const extraArcanumDots = 1

  return new CombinedSpellReqs({ minGnosis, dicePenalty, extraArcanumDots })
})

export const spellTolerance = Effect.fn("Spellcasting.spellTolerance")(function* (input: {
  stamina: number
  activeSpellsOnTarget: number
}) {
  const excess = Math.max(0, input.activeSpellsOnTarget - input.stamina)
  return excess === 0 ? 0 : -excess
})

export const roteSpecialtyBonus = Effect.fn("Spellcasting.roteSpecialty")(function* (
  order: string,
  skill: string,
) {
  const skills = ORDER_ROTE_SKILLS[order]
  if (!skills) return 0
  return skills.includes(skill) ? 1 : 0
})

export const extendedCastingTargets = Effect.fn("Spellcasting.extendedTargets")(function* (input: {
  potency: number
  targets: number
  durationSteps: number
}) {
  // Extended casting: successes accumulate toward a target
  // Base: 1 success per potency + 1 per extra target + 1 per duration step
  const targetSuccesses = input.potency + Math.max(0, input.targets - 1) + Math.max(0, input.durationSteps - 1)
  return new ExtendedCastingTargets({ targetSuccesses: Math.max(1, targetSuccesses) })
})

export const transitorDurationPenalty = Effect.fn("Spellcasting.transitoryPenalty")(function* (
  steps: number,
) {
  // 1 turn = 0, 2 turns = -2, 3 min = -4, 5 turns = -6, 10 turns = -8
  if (steps <= 1) return 0
  return (steps - 1) * -2
})

export const advancedProlongedDurationPenalty = Effect.fn("Spellcasting.advancedProlongedPenalty")(function* (
  steps: number,
) {
  // With +1 Arcanum: 1 scene = 0, 24hr = -2, 2 days = -4, 1 week = -6, 1 month = -8, indefinite = -10
  if (steps <= 1) return 0
  return (steps - 1) * -2
})
