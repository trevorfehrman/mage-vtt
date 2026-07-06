import { Effect, Schema } from "effect"
import { Mana } from "./quantities"

// Pure rules leaves are plain functions (ADR-0014); only `spendMana` stays
// Effect — it carries the typed InsufficientMana failure. Closed-key tables
// (Gnosis ranks, Path ruling arcana) are total over Literals vocabularies.

/** Gnosis runs 1–10; tables keyed by it are total. */
export const GnosisRank = Schema.Literals([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
export type GnosisRank = typeof GnosisRank.Type

// --- Gnosis → Mana per turn (page 76) ---

const MANA_PER_TURN: Record<GnosisRank, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 10,
  10: 15,
}

// --- Path ruling arcana ---

export const PathName = Schema.Literals([
  "Acanthus",
  "Mastigos",
  "Moros",
  "Obrimos",
  "Thyrsus",
])
export type PathName = typeof PathName.Type

const PATH_RULING: Record<PathName, readonly string[]> = {
  Acanthus: ["time", "fate"],
  Mastigos: ["space", "mind"],
  Moros: ["matter", "death"],
  Obrimos: ["forces", "prime"],
  Thyrsus: ["life", "spirit"],
}

// The sheet's `path` is a free string off persisted data, so membership is a
// guard, not an assumption — an unrecognized Path simply rules nothing.
const isPathName = Schema.is(PathName)

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

// --- Errors ---

/**
 * Rules/precondition failure (ADR-0010): the declared cast (or other spend)
 * costs more Mana than the sheet holds. Raised by `spendMana` before any write,
 * so a blocked cast leaves the sheet untouched.
 */
export class InsufficientMana extends Schema.TaggedErrorClass<InsufficientMana>()(
  "InsufficientMana",
  {
    current: Schema.Number,
    required: Schema.Number,
  },
) {}

// --- Public API ---

/**
 * Spend Mana from a current total: the pure leaf of the casting Mana economy
 * (ADR-0008). Returns the remainder, or fails `InsufficientMana` — a sheet can
 * never go negative or half-update.
 */
export const spendMana = Effect.fn("Mana.spend")(function* (
  current: Mana,
  cost: Mana,
) {
  if (cost > current) {
    return yield* new InsufficientMana({ current, required: cost })
  }
  return Mana.make(current - cost)
})

export const manaPerTurnByGnosis = (gnosis: GnosisRank): number =>
  MANA_PER_TURN[gnosis]

export const isRulingArcanum = (path: string, arcanum: string): boolean =>
  isPathName(path) && PATH_RULING[path].includes(arcanum.toLowerCase())

export const improvisedManaCost = (path: string, arcanum: string): Mana =>
  Mana.make(isRulingArcanum(path, arcanum) ? 0 : 1)

export const patternRestoration = (input: { gnosis: number }): PatternRestorationInfo =>
  new PatternRestorationInfo({
    manaCostPerWound: 3,
    dailyLimit: restorationDailyLimit(input.gnosis),
  })

export const patternScouring = (): PatternScouringInfo =>
  new PatternScouringInfo({
    manaGained: 3,
    attributeDotsLost: 1,
    restorationTime: "24 hours",
  })

export const oblation = (input: {
  gnosis: number
  composure: number
  hallowRating: number
}): OblationInfo =>
  new OblationInfo({
    dicePool: input.gnosis + input.composure,
    maxManaPerDay: input.hallowRating,
  })

export const startingMana = (wisdom: number): number => wisdom
