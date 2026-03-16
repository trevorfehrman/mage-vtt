import { Effect, Schema } from "effect"

// --- Paradox base dice by Gnosis (page 127) ---

const GNOSIS_PARADOX_DICE: Record<number, number> = {
  1: 1, 2: 1, 3: 2, 4: 2, 5: 3,
  6: 3, 7: 4, 8: 4, 9: 5, 10: 5,
}

// --- Paradox severity thresholds (page 127) ---

const SEVERITY_TABLE = [
  { min: 0, max: 0, severity: "none" as const },
  { min: 1, max: 1, severity: "havoc" as const },
  { min: 2, max: 2, severity: "bedlam" as const },
  { min: 3, max: 3, severity: "anomaly" as const },
  { min: 4, max: 4, severity: "branding" as const },
  { min: 5, max: Infinity, severity: "manifestation" as const },
]

type ParadoxSeverity = "none" | "havoc" | "bedlam" | "anomaly" | "branding" | "manifestation"

// --- Types ---

export class ParadoxPool extends Schema.Class<ParadoxPool>("ParadoxPool")({
  baseDice: Schema.Number.check(Schema.isInt()),
  modifiers: Schema.Array(Schema.Struct({ source: Schema.String, dice: Schema.Number })),
  totalDice: Schema.Number.check(Schema.isInt()),
}) {}

export class ParadoxResult extends Schema.Class<ParadoxResult>("ParadoxResult")({
  severity: Schema.Literals(["none", "havoc", "bedlam", "anomaly", "branding", "manifestation"]),
  successes: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  castingPenalty: Schema.Number.check(Schema.isInt()),
}) {}

// --- Public API ---

export const calculateParadoxPool = Effect.fn("Paradox.calculatePool")(function* (input: {
  gnosis: number
  isRote?: boolean
  usesMagicalTool?: boolean
  sleeperWitnesses?: boolean
  priorParadoxRollsThisScene?: number
  manaMitigation?: number
}) {
  const baseDice = GNOSIS_PARADOX_DICE[input.gnosis] ?? 1
  const modifiers: Array<{ source: string; dice: number }> = []

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

  if (input.sleeperWitnesses) {
    modifiers.push({ source: "Sleeper witnesses", dice: 2 })
  }

  if (input.manaMitigation && input.manaMitigation > 0) {
    modifiers.push({ source: "Mana mitigation", dice: -input.manaMitigation })
  }

  const totalDice = Math.max(
    0,
    baseDice + modifiers.reduce((s, m) => s + m.dice, 0),
  )

  return new ParadoxPool({ baseDice, modifiers, totalDice })
})

export const resolveParadox = Effect.fn("Paradox.resolve")(function* (
  successes: number,
) {
  const entry = SEVERITY_TABLE.find(
    (e) => successes >= e.min && successes <= e.max,
  )
  const severity: ParadoxSeverity = entry?.severity ?? "none"

  return new ParadoxResult({
    severity,
    successes,
    castingPenalty: successes === 0 ? 0 : -successes,
  })
})
