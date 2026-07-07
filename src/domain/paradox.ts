import { Match, Schema } from "effect"
import { GnosisRank } from "./mana-economy"

// Pure rules leaves (ADR-0014): plain functions. The Gnosis table is total
// over the 1–10 rank vocabulary, and severity resolution dispatches with
// Match instead of scanning a threshold table.

// --- Paradox base dice by Gnosis (page 127) ---

const GNOSIS_PARADOX_DICE: Record<GnosisRank, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 2,
  5: 3,
  6: 3,
  7: 4,
  8: 4,
  9: 5,
  10: 5,
}

// --- Paradox severity (page 127) ---

/** The one Paradox severity vocabulary — schema and type from a single home. */
export const ParadoxSeverity = Schema.Literals([
  "none",
  "havoc",
  "bedlam",
  "anomaly",
  "branding",
  "manifestation",
])
export type ParadoxSeverity = typeof ParadoxSeverity.Type

// --- Types ---

/** One named ± on a Paradox pool — the shape every modifier list speaks. */
export const ParadoxPoolModifier = Schema.Struct({
  source: Schema.String,
  dice: Schema.Number,
})
export type ParadoxPoolModifier = typeof ParadoxPoolModifier.Type

export class ParadoxPool extends Schema.Class<ParadoxPool>("ParadoxPool")({
  baseDice: Schema.Number.check(Schema.isInt()),
  modifiers: Schema.Array(ParadoxPoolModifier),
  totalDice: Schema.Number.check(Schema.isInt()),
}) {}

export class ParadoxResult extends Schema.Class<ParadoxResult>("ParadoxResult")({
  severity: ParadoxSeverity,
  successes: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  castingPenalty: Schema.Number.check(Schema.isInt()),
}) {}

// --- Public API ---

export const calculateParadoxPool = (input: {
  gnosis: GnosisRank
  isRote?: boolean
  usesMagicalTool?: boolean
  sleeperWitnesses?: boolean
  /**
   * The negotiated head count (issue #44) — fiction detail the table haggles
   * over; the dice stay the book's flat "+2, one or more Sleepers" (p. 125).
   * When present it overrules the coarse `sleeperWitnesses` boolean.
   */
  witnessCount?: number
  priorParadoxRollsThisScene?: number
  /** ST judgment calls (ADR-0015), each a named ± the table can read. */
  discretionaryModifiers?: ReadonlyArray<ParadoxPoolModifier>
  manaMitigation?: number
}): ParadoxPool => {
  const baseDice = GNOSIS_PARADOX_DICE[input.gnosis]
  const modifiers: Array<ParadoxPoolModifier> = []

  if (input.priorParadoxRollsThisScene && input.priorParadoxRollsThisScene > 0) {
    modifiers.push({
      source: "Successive Paradox rolls",
      dice: input.priorParadoxRollsThisScene,
    })
  }

  if (input.isRote) {
    modifiers.push({ source: "Rote casting", dice: -1 })
  }

  if (input.usesMagicalTool) {
    modifiers.push({ source: "Magical tool", dice: -1 })
  }

  if (input.witnessCount !== undefined) {
    if (input.witnessCount > 0) {
      modifiers.push({
        source: `Sleeper witnesses (${input.witnessCount})`,
        dice: 2,
      })
    }
  } else if (input.sleeperWitnesses) {
    modifiers.push({ source: "Sleeper witnesses", dice: 2 })
  }

  for (const m of input.discretionaryModifiers ?? []) {
    modifiers.push({ source: m.source, dice: m.dice })
  }

  if (input.manaMitigation && input.manaMitigation > 0) {
    modifiers.push({ source: "Mana mitigation", dice: -input.manaMitigation })
  }

  const totalDice = Math.max(
    0,
    baseDice + modifiers.reduce((s, m) => s + m.dice, 0),
  )

  return new ParadoxPool({ baseDice, modifiers, totalDice })
}

/** Severity thresholds (page 127): one step per success, capping at manifestation. */
const severityOf = (successes: number): ParadoxSeverity =>
  Match.value(successes).pipe(
    Match.when((s: number) => s <= 0, () => "none" as const),
    Match.when(1, () => "havoc" as const),
    Match.when(2, () => "bedlam" as const),
    Match.when(3, () => "anomaly" as const),
    Match.when(4, () => "branding" as const),
    Match.orElse(() => "manifestation" as const),
  )

export const resolveParadox = (successes: number): ParadoxResult =>
  new ParadoxResult({
    severity: severityOf(successes),
    successes,
    castingPenalty: successes === 0 ? 0 : -successes,
  })
