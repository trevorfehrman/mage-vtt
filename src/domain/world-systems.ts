import { Option, Schema } from "effect"

// Pure rules leaves (ADR-0014): plain functions throughout. Closed-key tables
// are total over their Literals vocabulary; the one genuine find-by-name
// (derangements) returns Option instead of synthesizing an "unknown" object.

// ================================================================
// OBJECTS & VEHICLES (WoD Core pp. 135-148)
// ================================================================

export class ObjectStats extends Schema.Class<ObjectStats>("ObjectStats")({
  durability: Schema.Number.check(Schema.isInt()),
  size: Schema.Number.check(Schema.isInt()),
  structure: Schema.Number.check(Schema.isInt()),
}) {}

export class CrashDamage extends Schema.Class<CrashDamage>("CrashDamage")({
  damage: Schema.Number.check(Schema.isInt()),
  damageType: Schema.Literals(["bashing", "lethal"]),
}) {}

export const objectDurability = (input: {
  durability: number
  size: number
}): ObjectStats =>
  new ObjectStats({
    durability: input.durability,
    size: input.size,
    structure: input.durability + input.size,
  })

export const vehicleCrashDamage = (input: {
  vehicleSize: number
  speedMph: number
}): CrashDamage =>
  new CrashDamage({
    damage: input.vehicleSize + Math.floor(input.speedMph / 10),
    damageType: "bashing",
  })

// ================================================================
// GAUNTLET (Mage pp. 282-283)
// ================================================================

export const GauntletLocation = Schema.Literals([
  "dense_urban",
  "suburbs",
  "small_town",
  "wilderness",
  "locus",
  "verge",
])
export type GauntletLocation = typeof GauntletLocation.Type

export const GAUNTLET_TABLE: Record<GauntletLocation, number> = {
  dense_urban: 5,
  suburbs: 4,
  small_town: 3,
  wilderness: 2,
  locus: 1,
  verge: 0,
}

export const gauntletStrength = (location: GauntletLocation): number =>
  GAUNTLET_TABLE[location]

// ================================================================
// ASTRAL PLANES (Mage pp. 283-286)
// ================================================================

export const AstralDestination = Schema.Literals(["oneiros", "temenos", "dreamtime"])
export type AstralDestination = typeof AstralDestination.Type

const ASTRAL_TARGETS: Record<AstralDestination, number> = {
  oneiros: 12,
  temenos: 16,
  dreamtime: 20,
}

export const astralJourneyTarget = (destination: AstralDestination): number =>
  ASTRAL_TARGETS[destination]

// ================================================================
// DISBELIEF (Mage p. 274)
// ================================================================

export class DisbeliefInfo extends Schema.Class<DisbeliefInfo>("DisbeliefInfo")({
  dicePool: Schema.Number.check(Schema.isInt()),
  isExtended: Schema.Boolean,
  rollInterval: Schema.String,
}) {}

export const disbeliefPool = (input: {
  resolve: number
  composure: number
}): DisbeliefInfo =>
  new DisbeliefInfo({
    dicePool: input.resolve + input.composure,
    isExtended: true,
    rollInterval: "10 minutes",
  })

// ================================================================
// DUEL ARCANE (Mage pp. 286-289)
// ================================================================

export class DuelAttack extends Schema.Class<DuelAttack>("DuelAttack")({
  dicePool: Schema.Number.check(Schema.isInt()),
  damageType: Schema.Literals(["willpower"]),
}) {}

export const duelArcaneAttack = (input: {
  gnosis: number
  swordArcanum: number
  opponentShieldArcanum: number
}): DuelAttack =>
  new DuelAttack({
    dicePool: Math.max(0, input.gnosis + input.swordArcanum - input.opponentShieldArcanum),
    damageType: "willpower",
  })

// ================================================================
// SPIRIT ADVANCED (Mage pp. 317-322)
// ================================================================

export const InfluenceLevel = Schema.Literals([1, 2, 3, 4, 5])
export type InfluenceLevel = typeof InfluenceLevel.Type

const INFLUENCE_ESSENCE_COST: Record<InfluenceLevel, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 3,
  5: 5,
}

export const spiritInfluenceCost = (level: InfluenceLevel): number =>
  INFLUENCE_ESSENCE_COST[level]

export class EssenceHarvest extends Schema.Class<EssenceHarvest>("EssenceHarvest")({
  dicePool: Schema.Number.check(Schema.isInt()),
}) {}

export const spiritEssenceHarvest = (input: {
  power: number
  finesse: number
  gauntletStrength: number
}): EssenceHarvest => new EssenceHarvest({ dicePool: input.power + input.finesse })

// ================================================================
// SOUL MECHANICS (Mage pp. 276-277)
// ================================================================

export class SoulLossResult extends Schema.Class<SoulLossResult>("SoulLossResult")({
  wisdomLost: Schema.Number.check(Schema.isInt()),
  remainingWisdom: Schema.Number.check(Schema.isInt()),
  willpowerLost: Schema.Number.check(Schema.isInt()),
}) {}

export const soulLossProgression = (input: {
  weeksWithoutSoul: number
  currentWisdom: number
}): SoulLossResult => {
  const wisdomLost = Math.min(input.weeksWithoutSoul, input.currentWisdom - 1)
  const remainingWisdom = Math.max(1, input.currentWisdom - input.weeksWithoutSoul)

  // After Wisdom 1, start losing Willpower
  const excessWeeks = Math.max(0, input.weeksWithoutSoul - (input.currentWisdom - 1))
  const willpowerLost = excessWeeks

  return new SoulLossResult({ wisdomLost, remainingWisdom, willpowerLost })
}

// ================================================================
// DEMESNES (Mage pp. 280-281)
// ================================================================

export class DemesneInfo extends Schema.Class<DemesneInfo>("DemesneInfo")({
  rulingBonus: Schema.Number.check(Schema.isInt()),
  vulgarTreatedAsCovert: Schema.Boolean,
}) {}

export const demesneBonus = (_path: string): DemesneInfo =>
  new DemesneInfo({
    rulingBonus: 1,
    vulgarTreatedAsCovert: true,
  })

// ================================================================
// DERANGEMENTS (WoD Core pp. 97-101)
// ================================================================

const DerangementDef = Schema.Struct({
  name: Schema.String,
  /** mild or severe */
  mild: Schema.Boolean,
  resistPool: Schema.String,
  penalty: Schema.String,
  trigger: Schema.String,
})
type DerangementDef = typeof DerangementDef.Type

export const DERANGEMENTS: ReadonlyArray<DerangementDef> = [
  { name: "Depression", mild: true, resistPool: "Resolve + Composure", penalty: "Lose 1 WP, can't spend WP for scene", trigger: "Failure or setback" },
  { name: "Melancholia", mild: false, resistPool: "Resolve + Composure", penalty: "-2 to all pools for scene", trigger: "Failure or setback" },
  { name: "Phobia", mild: true, resistPool: "Resolve + Composure", penalty: "-5 to attack trigger", trigger: "Encounter phobia trigger" },
  { name: "Hysteria", mild: false, resistPool: "Resolve + Composure", penalty: "Flee at full speed", trigger: "Encounter phobia trigger" },
  { name: "Narcissism", mild: true, resistPool: "Resolve + Composure", penalty: "-3 teamwork, -1 Social", trigger: "Denied attention or praise" },
  { name: "Megalomania", mild: false, resistPool: "Resolve + Composure", penalty: "-4 teamwork, -2 Social", trigger: "Authority challenged" },
  { name: "Fixation", mild: true, resistPool: "Resolve + Composure", penalty: "-1 to non-fixation tasks", trigger: "New interest or obsession" },
  { name: "Obsessive Compulsion", mild: false, resistPool: "Resolve + Composure at -2", penalty: "Must perform compulsion or -2 to all pools", trigger: "Stress" },
  { name: "Suspicion", mild: true, resistPool: "Resolve + Composure", penalty: "-1 Social", trigger: "Unfamiliar situation" },
  { name: "Paranoia", mild: false, resistPool: "Resolve + Composure", penalty: "-2 Social", trigger: "Any social interaction" },
  { name: "Inferiority Complex", mild: true, resistPool: "Resolve + Composure", penalty: "-1 to all rolls", trigger: "Challenging task" },
  { name: "Anxiety", mild: false, resistPool: "Resolve + Composure", penalty: "-2 to all rolls", trigger: "Stressful situation" },
  { name: "Vocalization", mild: true, resistPool: "Resolve + Composure", penalty: "Involuntary speech, -2 Stealth", trigger: "Stress" },
  { name: "Schizophrenia", mild: false, resistPool: "Resolve + Composure", penalty: "-2 Social, possible hallucinations", trigger: "Stress or unfamiliar environment" },
  { name: "Irrationality", mild: true, resistPool: "Resolve + Composure", penalty: "Act on irrational impulse", trigger: "Stress" },
  { name: "Multiple Personality", mild: false, resistPool: "Resolve + Composure", penalty: "Social Attributes rearranged 1-3 dots", trigger: "Extreme stress" },
  { name: "Avoidance", mild: true, resistPool: "Resolve + Composure", penalty: "-1 when confronting trigger", trigger: "Encounter avoidance trigger" },
  { name: "Fugue", mild: false, resistPool: "Resolve + Composure", penalty: "Lose time, automatic actions only", trigger: "Extreme stress or trigger" },
]

/** Find-by-name over an open name set: a miss is a value, not a default. */
export const findDerangement = (name: string): Option.Option<DerangementDef> =>
  Option.fromUndefinedOr(DERANGEMENTS.find((d) => d.name === name))
