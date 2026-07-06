import { Schema } from "effect"
import { WisdomRank } from "./wisdom"

// Pure rules leaves (ADR-0014): plain functions; the duration table is total
// over its severity-kind × Wisdom-rank vocabularies, so no lookup can miss.

// --- Paradox Duration by Wisdom (page 268) ---

/** The Paradox severities that persist long enough to have a duration. */
export const ParadoxDurationKind = Schema.Literals([
  "bedlam",
  "anomaly",
  "branding",
  "manifestation",
])
export type ParadoxDurationKind = typeof ParadoxDurationKind.Type

const DURATION_TABLE: Record<ParadoxDurationKind, Record<WisdomRank, number>> = {
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

export const paradoxDuration = (
  type: ParadoxDurationKind,
  wisdom: WisdomRank,
): ParadoxDuration =>
  new ParadoxDuration({ type, wisdom, minutes: DURATION_TABLE[type][wisdom] })

export const paradoxBacklash = (paradoxSuccesses: number): BacklashResult =>
  new BacklashResult({
    resistantBashingDamage: paradoxSuccesses,
    paradoxContained: true,
  })

export const brandingSeverity = (arcanumDots: number): BrandingInfo => {
  // Highest bracket at or below the dots; below 1 dot falls to the weakest brand.
  const entry =
    [...BRANDING_TABLE].reverse().find((e) => arcanumDots >= e.minDots) ??
    BRANDING_TABLE[0]

  return new BrandingInfo({
    name: entry.name,
    socialPenalty: entry.socialPenalty,
    arcanumDots,
  })
}

export const anomalyArea = (arcanumDots: number): number => arcanumDots * 20
