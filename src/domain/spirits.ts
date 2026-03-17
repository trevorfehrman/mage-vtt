import { Effect, Schema } from "effect"

// --- Spirit Rank Table (page 319) ---

interface SpiritRankDef {
  rank: number
  title: string
  attributeDots: number
  traitRange: string
  maxEssence: number
}

export const SPIRIT_RANKS: ReadonlyArray<SpiritRankDef> = [
  { rank: 1, title: "Squire/Page", attributeDots: 5, traitRange: "5-8", maxEssence: 10 },
  { rank: 2, title: "Knight", attributeDots: 7, traitRange: "9-14", maxEssence: 15 },
  { rank: 3, title: "Baron/Baroness", attributeDots: 9, traitRange: "15-25", maxEssence: 20 },
  { rank: 4, title: "Count/Countess", attributeDots: 12, traitRange: "26-35", maxEssence: 25 },
  { rank: 5, title: "Earl (lesser god)", attributeDots: 15, traitRange: "36-50", maxEssence: 50 },
]

// --- Numina (pages 323-325) ---

interface NumenDef {
  name: string
  description: string
  dicePool: string
}

export const NUMINA: ReadonlyArray<NumenDef> = [
  { name: "Blast", description: "Spirit attacks a target with a damaging supernatural assault.", dicePool: "Power + Finesse - target's Defense" },
  { name: "Claim", description: "Spirit possesses a living host, overriding its will.", dicePool: "Power + Finesse vs. Resolve + Composure" },
  { name: "Discorporation", description: "Spirit dissolves into ephemera to escape or hide.", dicePool: "Power + Resistance" },
  { name: "Fetter", description: "Spirit anchors itself to a physical object or place.", dicePool: "Power + Finesse" },
  { name: "Gauntlet Breach", description: "Spirit crosses from Shadow Realm to material world or vice versa.", dicePool: "Power + Finesse" },
  { name: "Harrow", description: "Spirit induces fear or emotional disturbance in a target.", dicePool: "Power + Finesse vs. Resolve + Composure" },
  { name: "Living Fetter", description: "Spirit anchors to a living host without full possession.", dicePool: "Power + Finesse vs. Resolve + Composure" },
  { name: "Materialize", description: "Spirit manifests a physical body in the material world.", dicePool: "Power + Finesse" },
  { name: "Material Vision", description: "Spirit perceives the material world from the Shadow.", dicePool: "Power + Finesse" },
  { name: "Reaching", description: "Spirit uses other Numina across the Gauntlet.", dicePool: "Power + Finesse" },
  { name: "Soul Snatch", description: "Spirit tears a soul from its body, devouring it for Essence.", dicePool: "Power + Finesse vs. Resolve + Composure" },
]

// --- Types ---

export class Spirit extends Schema.Class<Spirit>("Spirit")({
  name: Schema.String,
  rank: Schema.Number.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 5 })),
  power: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)),
  finesse: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)),
  resistance: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)),
  willpower: Schema.Number.check(Schema.isInt()),
  essence: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  influences: Schema.Array(Schema.Struct({ name: Schema.String, dots: Schema.Number })),
  numina: Schema.Array(Schema.String),
}) {}

export class SpiritDerivedStats extends Schema.Class<SpiritDerivedStats>("SpiritDerivedStats")({
  initiative: Schema.Number.check(Schema.isInt()),
  defense: Schema.Number.check(Schema.isInt()),
  speed: Schema.Number.check(Schema.isInt()),
}) {}

// --- Public API ---

export const createSpirit = Effect.fn("Spirit.create")(function* (input: {
  name: string
  rank: number
  power: number
  finesse: number
  resistance: number
  willpower: number
  essence: number
  influences: ReadonlyArray<{ name: string; dots: number }>
  numina: ReadonlyArray<string>
}) {
  return new Spirit(input)
})

export const spiritDerivedStats = Effect.fn("Spirit.derivedStats")(function* (input: {
  power: number
  finesse: number
  resistance: number
  speciesFactor: number
}) {
  return new SpiritDerivedStats({
    initiative: input.finesse + input.resistance,
    defense: Math.max(input.power, input.finesse),
    speed: input.power + input.finesse + input.speciesFactor,
  })
})
