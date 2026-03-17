import { Effect, Schema } from "effect"

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

export const objectDurability = Effect.fn("World.objectDurability")(function* (input: {
  durability: number
  size: number
}) {
  return new ObjectStats({
    durability: input.durability,
    size: input.size,
    structure: input.durability + input.size,
  })
})

export const vehicleCrashDamage = Effect.fn("World.crashDamage")(function* (input: {
  vehicleSize: number
  speedMph: number
}) {
  return new CrashDamage({
    damage: input.vehicleSize + Math.floor(input.speedMph / 10),
    damageType: "bashing",
  })
})

// ================================================================
// GAUNTLET (Mage pp. 282-283)
// ================================================================

export const GAUNTLET_TABLE: Record<string, number> = {
  dense_urban: 5,
  suburbs: 4,
  small_town: 3,
  wilderness: 2,
  locus: 1,
  verge: 0,
}

export const gauntletStrength = Effect.fn("World.gauntlet")(function* (location: string) {
  return GAUNTLET_TABLE[location] ?? 3
})

// ================================================================
// ASTRAL PLANES (Mage pp. 283-286)
// ================================================================

const ASTRAL_TARGETS: Record<string, number> = {
  oneiros: 12,
  temenos: 16,
  dreamtime: 20,
}

export const astralJourneyTarget = Effect.fn("World.astralTarget")(function* (
  destination: string,
) {
  return ASTRAL_TARGETS[destination] ?? 12
})

// ================================================================
// DISBELIEF (Mage p. 274)
// ================================================================

export class DisbeliefInfo extends Schema.Class<DisbeliefInfo>("DisbeliefInfo")({
  dicePool: Schema.Number.check(Schema.isInt()),
  isExtended: Schema.Boolean,
  rollInterval: Schema.String,
}) {}

export const disbeliefPool = Effect.fn("World.disbelief")(function* (input: {
  resolve: number
  composure: number
}) {
  return new DisbeliefInfo({
    dicePool: input.resolve + input.composure,
    isExtended: true,
    rollInterval: "10 minutes",
  })
})

// ================================================================
// DUEL ARCANE (Mage pp. 286-289)
// ================================================================

export class DuelAttack extends Schema.Class<DuelAttack>("DuelAttack")({
  dicePool: Schema.Number.check(Schema.isInt()),
  damageType: Schema.Literals(["willpower"]),
}) {}

export const duelArcaneAttack = Effect.fn("World.duelAttack")(function* (input: {
  gnosis: number
  swordArcanum: number
  opponentShieldArcanum: number
}) {
  return new DuelAttack({
    dicePool: Math.max(0, input.gnosis + input.swordArcanum - input.opponentShieldArcanum),
    damageType: "willpower",
  })
})

// ================================================================
// SPIRIT ADVANCED (Mage pp. 317-322)
// ================================================================

const INFLUENCE_ESSENCE_COST = [1, 1, 2, 3, 5] // levels 1-5

export const spiritInfluenceCost = Effect.fn("World.spiritInfluence")(function* (level: number) {
  return INFLUENCE_ESSENCE_COST[level - 1] ?? 1
})

export class EssenceHarvest extends Schema.Class<EssenceHarvest>("EssenceHarvest")({
  dicePool: Schema.Number.check(Schema.isInt()),
}) {}

export const spiritEssenceHarvest = Effect.fn("World.essenceHarvest")(function* (input: {
  power: number
  finesse: number
  gauntletStrength: number
}) {
  return new EssenceHarvest({ dicePool: input.power + input.finesse })
})

// ================================================================
// SOUL MECHANICS (Mage pp. 276-277)
// ================================================================

export class SoulLossResult extends Schema.Class<SoulLossResult>("SoulLossResult")({
  wisdomLost: Schema.Number.check(Schema.isInt()),
  remainingWisdom: Schema.Number.check(Schema.isInt()),
  willpowerLost: Schema.Number.check(Schema.isInt()),
}) {}

export const soulLossProgression = Effect.fn("World.soulLoss")(function* (input: {
  weeksWithoutSoul: number
  currentWisdom: number
}) {
  const wisdomLost = Math.min(input.weeksWithoutSoul, input.currentWisdom - 1)
  const remainingWisdom = Math.max(1, input.currentWisdom - input.weeksWithoutSoul)

  // After Wisdom 1, start losing Willpower
  const excessWeeks = Math.max(0, input.weeksWithoutSoul - (input.currentWisdom - 1))
  const willpowerLost = excessWeeks

  return new SoulLossResult({ wisdomLost, remainingWisdom, willpowerLost })
})

// ================================================================
// DEMESNES (Mage pp. 280-281)
// ================================================================

export class DemesneInfo extends Schema.Class<DemesneInfo>("DemesneInfo")({
  rulingBonus: Schema.Number.check(Schema.isInt()),
  vulgarTreatedAsCovert: Schema.Boolean,
}) {}

export const demesneBonus = Effect.fn("World.demesne")(function* (_path: string) {
  return new DemesneInfo({
    rulingBonus: 1,
    vulgarTreatedAsCovert: true,
  })
})

// ================================================================
// DERANGEMENTS (WoD Core pp. 97-101)
// ================================================================

interface DerangementDef {
  name: string
  mild: boolean // mild or severe
  resistPool: string
  penalty: string
  trigger: string
}

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

export const derangementEffect = Effect.fn("World.derangement")(function* (name: string) {
  const d = DERANGEMENTS.find((dr) => dr.name === name)
  if (!d) return { penalty: "Unknown derangement", resistPool: "", trigger: "" }
  return d
})
