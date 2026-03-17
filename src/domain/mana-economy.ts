import { Effect, Schema } from "effect"

// --- Gnosis → Mana per turn (page 76) ---

const MANA_PER_TURN = [1, 2, 3, 4, 5, 6, 7, 8, 10, 15] as const

// --- Path ruling arcana ---

const PATH_RULING: Record<string, readonly string[]> = {
  Acanthus: ["time", "fate"],
  Mastigos: ["space", "mind"],
  Moros: ["matter", "death"],
  Obrimos: ["forces", "prime"],
  Thyrsus: ["life", "spirit"],
}

// --- Pattern Restoration daily limits by Gnosis (page 77) ---

function restorationDailyLimit(gnosis: number): number {
  if (gnosis <= 4) return 1
  if (gnosis <= 6) return 2
  if (gnosis <= 9) return 3
  return 4
}

// --- Types ---

export class PatternRestorationInfo extends Schema.Class<PatternRestorationInfo>("PatternRestorationInfo")({
  manaCostPerWound: Schema.Number.check(Schema.isInt()),
  dailyLimit: Schema.Number.check(Schema.isInt()),
}) {}

export class PatternScouringInfo extends Schema.Class<PatternScouringInfo>("PatternScouringInfo")({
  manaGained: Schema.Number.check(Schema.isInt()),
  attributeDotsLost: Schema.Number.check(Schema.isInt()),
  restorationTime: Schema.String,
}) {}

export class OblationInfo extends Schema.Class<OblationInfo>("OblationInfo")({
  dicePool: Schema.Number.check(Schema.isInt()),
  maxManaPerDay: Schema.Number.check(Schema.isInt()),
}) {}

// --- Public API ---

export const manaPerTurnByGnosis = Effect.fn("Mana.perTurn")(function* (gnosis: number) {
  return MANA_PER_TURN[gnosis - 1] ?? 1
})

export const isRulingArcanum = Effect.fn("Mana.isRuling")(function* (
  path: string,
  arcanum: string,
) {
  const ruling = PATH_RULING[path]
  if (!ruling) return false
  return ruling.includes(arcanum.toLowerCase())
})

export const improvisedManaCost = Effect.fn("Mana.improvisedCost")(function* (
  path: string,
  arcanum: string,
) {
  const ruling = PATH_RULING[path]
  if (!ruling) return 1
  return ruling.includes(arcanum.toLowerCase()) ? 0 : 1
})

export const patternRestoration = Effect.fn("Mana.patternRestoration")(function* (input: {
  gnosis: number
}) {
  return new PatternRestorationInfo({
    manaCostPerWound: 3,
    dailyLimit: restorationDailyLimit(input.gnosis),
  })
})

export const patternScouring = Effect.fn("Mana.patternScouring")(function* () {
  return new PatternScouringInfo({
    manaGained: 3,
    attributeDotsLost: 1,
    restorationTime: "24 hours",
  })
})

export const oblation = Effect.fn("Mana.oblation")(function* (input: {
  gnosis: number
  composure: number
  hallowRating: number
}) {
  return new OblationInfo({
    dicePool: input.gnosis + input.composure,
    maxManaPerDay: input.hallowRating,
  })
})

export const startingMana = Effect.fn("Mana.startingMana")(function* (wisdom: number) {
  return wisdom
})
