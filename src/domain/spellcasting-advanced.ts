import { Match, Schema } from "effect"

// Pure rules leaves (ADR-0014): plain functions; the resistance-mode dispatch
// goes through Match, and the Order rote-skill table is total over the closed
// Order vocabulary.

// --- Order rote skills (for rote specialty bonus) ---

export const OrderName = Schema.Literals([
  "Adamantine Arrow",
  "Free Council",
  "Guardians of the Veil",
  "Mysterium",
  "Silver Ladder",
])
export type OrderName = typeof OrderName.Type

const ORDER_ROTE_SKILLS: Record<OrderName, readonly string[]> = {
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

export const magicResistance = (input: {
  mode: "contested" | "automated"
  resistanceAttribute: number
  targetGnosis?: number
  spendWillpower: boolean
}): MagicResistanceResult =>
  Match.value(input.mode).pipe(
    // Contested: Resistance Attribute + Gnosis (if mage) + 3 if spending WP
    Match.when("contested", () => {
      const pool =
        input.resistanceAttribute +
        (input.targetGnosis ?? 0) +
        (input.spendWillpower ? 3 : 0)
      return new MagicResistanceResult({ mode: "contested", dicePool: pool })
    }),
    // Automated: subtract Resistance from casting pool + 2 if spending WP
    Match.when("automated", () => {
      const subtract = input.resistanceAttribute + (input.spendWillpower ? 2 : 0)
      return new MagicResistanceResult({ mode: "automated", subtractFromPool: subtract })
    }),
    Match.exhaustive,
  )

export const combinedSpellRequirements = (spellCount: number): CombinedSpellReqs => {
  // Gnosis 3 for 2, 6 for 3, 9 for 4
  const minGnosis = (spellCount - 1) * 3
  // -2 per additional spell beyond the first
  const dicePenalty = (spellCount - 1) * -2
  // Each component needs +1 Arcanum dot above normal
  const extraArcanumDots = 1

  return new CombinedSpellReqs({ minGnosis, dicePenalty, extraArcanumDots })
}

export const spellTolerance = (input: {
  stamina: number
  activeSpellsOnTarget: number
}): number => {
  const excess = Math.max(0, input.activeSpellsOnTarget - input.stamina)
  return excess === 0 ? 0 : -excess
}

export const roteSpecialtyBonus = (order: OrderName, skill: string): number =>
  ORDER_ROTE_SKILLS[order].includes(skill) ? 1 : 0

export const extendedCastingTargets = (input: {
  potency: number
  targets: number
  durationSteps: number
}): ExtendedCastingTargets => {
  // Extended casting: successes accumulate toward a target
  // Base: 1 success per potency + 1 per extra target + 1 per duration step
  const targetSuccesses =
    input.potency + Math.max(0, input.targets - 1) + Math.max(0, input.durationSteps - 1)
  return new ExtendedCastingTargets({ targetSuccesses: Math.max(1, targetSuccesses) })
}

export const transitorDurationPenalty = (steps: number): number => {
  // 1 turn = 0, 2 turns = -2, 3 min = -4, 5 turns = -6, 10 turns = -8
  if (steps <= 1) return 0
  return (steps - 1) * -2
}

export const advancedProlongedDurationPenalty = (steps: number): number => {
  // With +1 Arcanum: 1 scene = 0, 24hr = -2, 2 days = -4, 1 week = -6, 1 month = -8, indefinite = -10
  if (steps <= 1) return 0
  return (steps - 1) * -2
}
