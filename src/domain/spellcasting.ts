import { Schema } from "effect"
import { WILLPOWER_BONUS_DICE } from "./willpower-economy"

// Pure rules leaves (ADR-0014): the whole casting-math surface is plain
// functions — nothing here fails or touches the world. The sympathetic
// connection vocabulary is closed, so an unknown level is a compile error,
// not a runtime failure.

// --- Types ---

interface DiceBonus {
  source: string
  dice: number
}

interface DicePenalty {
  source: string
  dice: number // negative
}

export class CastingPool extends Schema.Class<CastingPool>("CastingPool")({
  method: Schema.Literals(["improvised", "rote"]),
  baseDice: Schema.Number.check(Schema.isInt()),
  bonuses: Schema.Array(Schema.Struct({ source: Schema.String, dice: Schema.Number })),
  penalties: Schema.Array(Schema.Struct({ source: Schema.String, dice: Schema.Number })),
  factorPenalty: Schema.Number.check(Schema.isInt()),
  totalDice: Schema.Number.check(Schema.isInt()),
  isVulgar: Schema.Boolean,
  manaCost: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
}) {}

// --- Sympathetic connection penalties (page 115) ---

export const SympatheticConnection = Schema.Literals([
  "intimate",
  "known",
  "acquainted",
  "encountered",
  "described",
  "unknown",
])
export type SympatheticConnection = typeof SympatheticConnection.Type

const SYMPATHETIC_PENALTIES: Record<SympatheticConnection, number> = {
  intimate: -2,
  known: -4,
  acquainted: -6,
  encountered: -8,
  described: -10,
  unknown: -12, // practically impossible
}

// --- Helpers ---

/** Spell factor penalty (page 118): Potency 1 free, then -2 per point. */
function potencyPenalty(potency: number): number {
  if (potency <= 1) return 0
  return (potency - 1) * -2
}

/**
 * Target-count penalty (page 118): the doubling brackets 1/2/4/8/16 map to
 * 0/-2/-4/-6/-8; past 16 each further doubling is -2 more. Counts off a
 * bracket pay the -8 floor (pre-existing behavior, preserved).
 */
const TARGET_COUNT_PENALTY: Record<number, number> = {
  1: 0,
  2: -2,
  4: -4,
  8: -6,
  16: -8,
}

function targetCountPenalty(targets: number): number {
  if (targets <= 1) return 0
  const exact = TARGET_COUNT_PENALTY[targets]
  if (exact !== undefined) return exact
  let penalty = -8
  let threshold = 16
  while (threshold < targets) {
    threshold *= 2
    penalty -= 2
  }
  return penalty
}

function sumDice(
  base: number,
  bonuses: ReadonlyArray<DiceBonus>,
  penalties: ReadonlyArray<DicePenalty>,
  factorPenalty: number,
): number {
  const bonusTotal = bonuses.reduce((s, b) => s + b.dice, 0)
  const penaltyTotal = penalties.reduce((s, p) => s + p.dice, 0)
  return base + bonusTotal + penaltyTotal + factorPenalty
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// --- Public API ---

export const calculateImprovisedPool = (input: {
  gnosis: number
  arcanumDots: number
  highSpeech?: boolean
  willpower?: boolean
  sympatheticConnection?: SympatheticConnection
}): CastingPool => {
  const baseDice = input.gnosis + input.arcanumDots
  const bonuses: Array<DiceBonus> = []
  const penalties: Array<DicePenalty> = []
  let manaCost = 0
  let isVulgar = false

  if (input.highSpeech) {
    bonuses.push({ source: "High Speech", dice: 2 })
  }

  if (input.willpower) {
    bonuses.push({ source: "Willpower", dice: WILLPOWER_BONUS_DICE })
  }

  if (input.sympatheticConnection) {
    penalties.push({
      source: `Sympathetic (${capitalize(input.sympatheticConnection)})`,
      dice: SYMPATHETIC_PENALTIES[input.sympatheticConnection],
    })
    isVulgar = true // sympathetic spells are always vulgar
    manaCost += 1 // costs 1 Mana
  }

  const totalDice = sumDice(baseDice, bonuses, penalties, 0)

  return new CastingPool({
    method: "improvised",
    baseDice,
    bonuses,
    penalties,
    factorPenalty: 0,
    totalDice,
    isVulgar,
    manaCost,
  })
}

export const calculateRotePool = (input: {
  attributeDots: number
  skillDots: number
  arcanumDots: number
  highSpeech?: boolean
  willpower?: boolean
}): CastingPool => {
  const baseDice = input.attributeDots + input.skillDots + input.arcanumDots
  const bonuses: Array<DiceBonus> = []

  if (input.highSpeech) {
    bonuses.push({ source: "High Speech", dice: 2 })
  }

  if (input.willpower) {
    bonuses.push({ source: "Willpower", dice: WILLPOWER_BONUS_DICE })
  }

  const totalDice = sumDice(baseDice, bonuses, [], 0)

  return new CastingPool({
    method: "rote",
    baseDice,
    bonuses,
    penalties: [],
    factorPenalty: 0,
    totalDice,
    isVulgar: false,
    manaCost: 0,
  })
}

export const applySpellFactors = (
  pool: CastingPool,
  factors: {
    potency?: number
    targets?: number
    // duration and area to be added
  },
): CastingPool => {
  let factorPen = 0

  if (factors.potency && factors.potency > 1) {
    factorPen += potencyPenalty(factors.potency)
  }

  if (factors.targets && factors.targets > 1) {
    factorPen += targetCountPenalty(factors.targets)
  }

  const totalDice = sumDice(pool.baseDice, [...pool.bonuses], [...pool.penalties], factorPen)

  return new CastingPool({
    ...pool,
    factorPenalty: factorPen,
    totalDice,
  })
}

// --- Duration penalty table (pages 119-120) ---

export const calculateDurationPenalty = (
  _type: "transitory" | "prolonged",
  steps: number,
): number => {
  // Step 1 is the default (0 penalty), each step beyond is -2
  if (steps <= 1) return 0
  return (steps - 1) * -2
}

// --- Size penalty table (page 118) ---

export const calculateSizePenalty = (size: number): number => {
  if (size <= 20) return 0
  if (size <= 30) return -2
  if (size <= 40) return -4
  if (size <= 50) return -6
  if (size <= 60) return -8
  // Beyond 60: -8 + -2 per +10 size
  return -8 + Math.ceil((size - 60) / 10) * -2
}

// --- Area-affecting penalty tables (page 118) ---

export const calculateAreaPenalty = (radiusYards: number, advanced: boolean): number => {
  if (advanced) {
    // Advanced: 1→0, 4→-2, 16→-4, 64→-6, 256→-8
    if (radiusYards <= 1) return 0
    if (radiusYards <= 4) return -2
    if (radiusYards <= 16) return -4
    if (radiusYards <= 64) return -6
    if (radiusYards <= 256) return -8
    // Beyond: -8 + -2 per ×4
    let penalty = -8
    let threshold = 256
    while (threshold < radiusYards) {
      threshold *= 4
      penalty -= 2
    }
    return penalty
  }

  // Basic: 1→0, 2→-2, 4→-4, 8→-6, 16→-8
  if (radiusYards <= 1) return 0
  if (radiusYards <= 2) return -2
  if (radiusYards <= 4) return -4
  if (radiusYards <= 8) return -6
  if (radiusYards <= 16) return -8
  // Beyond: -8 + -2 per ×2
  let penalty = -8
  let threshold = 16
  while (threshold < radiusYards) {
    threshold *= 2
    penalty -= 2
  }
  return penalty
}

// --- Aimed spell range (page 116) ---

export const calculateAimedSpellRange = (
  gnosis: number,
): { short: number; medium: number; long: number } => {
  const short = gnosis * 10
  return { short, medium: short * 2, long: short * 4 }
}
