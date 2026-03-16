import { Effect, Schema } from "effect"

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

const SYMPATHETIC_PENALTIES: Record<string, number> = {
  intimate: -2,
  known: -4,
  acquainted: -6,
  encountered: -8,
  described: -10,
  unknown: -12, // practically impossible
}

// --- Spell factor penalty tables (page 118) ---

const POTENCY_PENALTY: Record<number, number> = {
  1: 0,
  2: -2,
  3: -4,
  4: -6,
  5: -8,
  // 6+: -8 + -2 per additional
}

const TARGET_COUNT_PENALTY: Record<number, number> = {
  1: 0,
  2: -2,
  4: -4,
  8: -6,
  16: -8,
  // 32+: -8 + -2 per doubling
}

// --- Errors ---

export class SpellcastingError extends Schema.TaggedErrorClass<SpellcastingError>()(
  "SpellcastingError",
  { message: Schema.String },
) {}

// --- Helpers ---

function potencyPenalty(potency: number): number {
  if (potency <= 1) return 0
  if (potency <= 5) return POTENCY_PENALTY[potency] ?? 0
  // Beyond 5: base -8 + -2 per extra
  return -8 + (potency - 5) * -2
}

function targetCountPenalty(targets: number): number {
  if (targets <= 1) return 0
  // Find the bracket
  const brackets = [1, 2, 4, 8, 16]
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (targets <= brackets[i]) continue
    if (targets === brackets[i]) return TARGET_COUNT_PENALTY[brackets[i]] ?? 0
  }
  // Exact match or compute
  if (TARGET_COUNT_PENALTY[targets] !== undefined) return TARGET_COUNT_PENALTY[targets]
  // Each doubling from 16 is -2 more
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

// --- Public API ---

export const calculateImprovisedPool = Effect.fn("Spellcasting.improvisedPool")(function* (input: {
  gnosis: number
  arcanumDots: number
  highSpeech?: boolean
  sympatheticConnection?: string
}) {
  const baseDice = input.gnosis + input.arcanumDots
  const bonuses: Array<DiceBonus> = []
  const penalties: Array<DicePenalty> = []
  let manaCost = 0
  let isVulgar = false

  if (input.highSpeech) {
    bonuses.push({ source: "High Speech", dice: 2 })
  }

  if (input.sympatheticConnection) {
    const penalty = SYMPATHETIC_PENALTIES[input.sympatheticConnection]
    if (penalty === undefined) {
      yield* new SpellcastingError({
        message: `Unknown sympathetic connection level: ${input.sympatheticConnection}`,
      })
    }
    penalties.push({
      source: `Sympathetic (${input.sympatheticConnection.charAt(0).toUpperCase() + input.sympatheticConnection.slice(1)})`,
      dice: penalty ?? 0,
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
})

export const calculateRotePool = Effect.fn("Spellcasting.rotePool")(function* (input: {
  attributeDots: number
  skillDots: number
  arcanumDots: number
  highSpeech?: boolean
}) {
  const baseDice = input.attributeDots + input.skillDots + input.arcanumDots
  const bonuses: Array<DiceBonus> = []

  if (input.highSpeech) {
    bonuses.push({ source: "High Speech", dice: 2 })
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
})

export const applySpellFactors = Effect.fn("Spellcasting.applyFactors")(function* (
  pool: CastingPool,
  factors: {
    potency?: number
    targets?: number
    // duration and area to be added
  },
) {
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
})

// --- Duration penalty table (pages 119-120) ---

export const calculateDurationPenalty = Effect.fn("Spellcasting.durationPenalty")(function* (
  type: "transitory" | "prolonged",
  steps: number,
) {
  // Step 1 is the default (0 penalty), each step beyond is -2
  if (steps <= 1) return 0
  return (steps - 1) * -2
})

// --- Size penalty table (page 118) ---

export const calculateSizePenalty = Effect.fn("Spellcasting.sizePenalty")(function* (
  size: number,
) {
  if (size <= 20) return 0
  if (size <= 30) return -2
  if (size <= 40) return -4
  if (size <= 50) return -6
  if (size <= 60) return -8
  // Beyond 60: -8 + -2 per +10 size
  return -8 + Math.ceil((size - 60) / 10) * -2
})

// --- Area-affecting penalty tables (page 118) ---

export const calculateAreaPenalty = Effect.fn("Spellcasting.areaPenalty")(function* (
  radiusYards: number,
  advanced: boolean,
) {
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
})

// --- Aimed spell range (page 116) ---

export const calculateAimedSpellRange = Effect.fn("Spellcasting.aimedRange")(function* (
  gnosis: number,
) {
  const short = gnosis * 10
  return { short, medium: short * 2, long: short * 4 }
})
