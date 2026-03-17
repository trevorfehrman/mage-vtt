import { Effect, Schema } from "effect"

// --- Paradox Duration by Wisdom (page 268) ---

const DURATION_TABLE: Record<string, Record<number, number>> = {
  // Wisdom → minutes
  bedlam: { 10: 30, 9: 60, 8: 60, 7: 120, 6: 120, 5: 360, 4: 720, 3: 1440, 2: 2880, 1: 2880 },
  anomaly: { 10: 60, 9: 120, 8: 360, 7: 720, 6: 1440, 5: 1440, 4: 1440, 3: 4320, 2: 10080, 1: 43200 },
  branding: { 10: 60, 9: 120, 8: 360, 7: 720, 6: 1440, 5: 1440, 4: 1440, 3: 4320, 2: 10080, 1: 43200 },
  manifestation: { 10: 60, 9: 120, 8: 360, 7: 720, 6: 1440, 5: 1440, 4: 1440, 3: 4320, 2: 10080, 1: 43200 },
}

// --- Branding severity by arcanum dots (pages 272-273) ---

const BRANDING_TABLE = [
  { minDots: 1, name: "Uncanny Nimbus", socialPenalty: 0 },
  { minDots: 2, name: "Witch's Mark", socialPenalty: 0 },
  { minDots: 3, name: "Disfigurement", socialPenalty: -1 },
  { minDots: 4, name: "Bestial Feature", socialPenalty: -3 },
  { minDots: 5, name: "Inhuman Feature", socialPenalty: -5 },
]

// --- Types ---

export class ParadoxDuration extends Schema.Class<ParadoxDuration>("ParadoxDuration")({
  type: Schema.String,
  wisdom: Schema.Number.check(Schema.isInt()),
  minutes: Schema.Number.check(Schema.isInt()),
}) {}

export class BacklashResult extends Schema.Class<BacklashResult>("BacklashResult")({
  resistantBashingDamage: Schema.Number.check(Schema.isInt()),
  paradoxContained: Schema.Boolean,
}) {}

export class BrandingInfo extends Schema.Class<BrandingInfo>("BrandingInfo")({
  name: Schema.String,
  socialPenalty: Schema.Number.check(Schema.isInt()),
  arcanumDots: Schema.Number.check(Schema.isInt()),
}) {}

// --- Public API ---

export const paradoxDuration = Effect.fn("ParadoxEffects.duration")(function* (
  type: string,
  wisdom: number,
) {
  const table = DURATION_TABLE[type]
  const minutes = table?.[wisdom] ?? 60

  return new ParadoxDuration({ type, wisdom, minutes })
})

export const paradoxBacklash = Effect.fn("ParadoxEffects.backlash")(function* (
  paradoxSuccesses: number,
) {
  return new BacklashResult({
    resistantBashingDamage: paradoxSuccesses,
    paradoxContained: true,
  })
})

export const brandingSeverity = Effect.fn("ParadoxEffects.branding")(function* (
  arcanumDots: number,
) {
  const entry = BRANDING_TABLE.findLast((e) => arcanumDots >= e.minDots) ?? BRANDING_TABLE[0]

  return new BrandingInfo({
    name: entry.name,
    socialPenalty: entry.socialPenalty,
    arcanumDots,
  })
})

export const anomalyArea = Effect.fn("ParadoxEffects.anomalyArea")(function* (
  arcanumDots: number,
) {
  return arcanumDots * 20
})
