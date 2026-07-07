import { Schema } from "effect"

// Pure rules leaves (ADR-0014): plain functions over total tables. Every table
// here is keyed by a closed Literals vocabulary, so lookups are total — a
// typo'd key is a compile error, never a silently-wrong default.

// --- Fire (page 180) ---

export const FireSize = Schema.Literals(["torch", "bonfire", "inferno"])
export type FireSize = typeof FireSize.Type

export const FireHeat = Schema.Literals(["candle", "torch", "bonfire", "chemical"])
export type FireHeat = typeof FireHeat.Type

const FIRE_SIZE_DAMAGE: Record<FireSize, number> = { torch: 1, bonfire: 2, inferno: 3 }
const FIRE_HEAT_MODIFIER: Record<FireHeat, number> = { candle: 0, torch: 1, bonfire: 2, chemical: 3 }

export class FireDamageResult extends Schema.Class<FireDamageResult>("FireDamageResult")({
  lethalPerTurn: Schema.Number.check(Schema.isInt()),
}) {}

// --- Electrocution (page 178) ---

export const ElectrocutionSeverity = Schema.Literals(["minor", "moderate", "severe", "extreme"])
export type ElectrocutionSeverity = typeof ElectrocutionSeverity.Type

const ELECTROCUTION_DAMAGE: Record<ElectrocutionSeverity, number> = {
  minor: 4,
  moderate: 6,
  severe: 8,
  extreme: 10,
}

export class ElectrocutionResult extends Schema.Class<ElectrocutionResult>("ElectrocutionResult")({
  bashingPerTurn: Schema.Number.check(Schema.isInt()),
  armorApplies: Schema.Boolean,
}) {}

// --- Explosives (pages 178-179) ---

export const ExplosiveType = Schema.Literals([
  "incendiary",
  "concussion",
  "fragmentation",
  "high_explosive",
])
export type ExplosiveType = typeof ExplosiveType.Type

export const EXPLOSIVES: Record<ExplosiveType, { damage: number; blastRadius: number }> = {
  incendiary: { damage: 2, blastRadius: 3 },
  concussion: { damage: 4, blastRadius: 5 },
  fragmentation: { damage: 4, blastRadius: 10 },
  high_explosive: { damage: 6, blastRadius: 15 },
}

export class ExplosiveResult extends Schema.Class<ExplosiveResult>("ExplosiveResult")({
  damage: Schema.Number.check(Schema.isInt()),
  blastRadius: Schema.Number.check(Schema.isInt()),
}) {}

// --- Drug effects (pages 176-177) ---

export const DrugName = Schema.Literals([
  "alcohol",
  "marijuana",
  "hallucinogens",
  "cocaine",
  "heroin",
])
export type DrugName = typeof DrugName.Type

const DrugDef = Schema.Struct({
  name: Schema.String,
  poolPenalty: Schema.Number,
  affectedPools: Schema.Array(Schema.String),
  duration: Schema.String,
})
type DrugDef = typeof DrugDef.Type

const DRUGS: Record<DrugName, DrugDef> = {
  alcohol: { name: "Alcohol", poolPenalty: -1, affectedPools: ["dexterity", "intelligence", "wits"], duration: "1 die fades per hour" },
  marijuana: { name: "Marijuana", poolPenalty: -1, affectedPools: ["dexterity", "intelligence", "resolve", "wits"], duration: "(8 - Stamina) hours" },
  hallucinogens: { name: "Hallucinogens", poolPenalty: -2, affectedPools: ["all"], duration: "(8 - Stamina) hours" },
  cocaine: { name: "Cocaine/Speed", poolPenalty: -1, affectedPools: ["social"], duration: "1-2 hours" },
  heroin: { name: "Heroin/Morphine", poolPenalty: -2, affectedPools: ["all"], duration: "(8 - Stamina) hours" },
}

// --- Types ---

export class PoisonResult extends Schema.Class<PoisonResult>("PoisonResult")({
  resistPool: Schema.Number.check(Schema.isInt()),
  lethalDamage: Schema.Number.check(Schema.isInt()),
}) {}

export class DeprivationResult extends Schema.Class<DeprivationResult>("DeprivationResult")({
  bashingPerDay: Schema.Number.check(Schema.isInt()),
  thresholdDays: Schema.Number.check(Schema.isInt()),
}) {}

// --- Public API ---

export const fireDamage = (input: { size: FireSize; heat: FireHeat }): FireDamageResult =>
  new FireDamageResult({
    lethalPerTurn: FIRE_SIZE_DAMAGE[input.size] + FIRE_HEAT_MODIFIER[input.heat],
  })

export const electrocutionDamage = (severity: ElectrocutionSeverity): ElectrocutionResult =>
  new ElectrocutionResult({
    bashingPerTurn: ELECTROCUTION_DAMAGE[severity],
    armorApplies: false,
  })

export const explosiveDamage = (input: {
  type: ExplosiveType
  isProne: boolean
}): ExplosiveResult => {
  const explosive = EXPLOSIVES[input.type]
  return new ExplosiveResult({
    damage: input.isProne ? Math.max(0, explosive.damage - 2) : explosive.damage,
    blastRadius: explosive.blastRadius,
  })
}

export const poisonResistance = (input: {
  stamina: number
  resolve: number
  toxicity: number
}): PoisonResult =>
  new PoisonResult({
    resistPool: input.stamina + input.resolve,
    lethalDamage: input.toxicity,
  })

export const deprivationDamage = (input: {
  stamina: number
  resolve: number
  daysWithoutWater: number
  daysWithoutFood: number
}): DeprivationResult => {
  const waterThreshold = input.stamina
  const foodThreshold = input.stamina + input.resolve

  let bashingPerDay = 0
  if (input.daysWithoutWater > waterThreshold) bashingPerDay += 1
  if (input.daysWithoutFood > foodThreshold) bashingPerDay += 1

  return new DeprivationResult({
    bashingPerDay,
    thresholdDays: waterThreshold,
  })
}

export const fatiguePenalty = (hoursAwake: number): number => {
  if (hoursAwake <= 24) return 0
  return -Math.floor((hoursAwake - 24) / 6)
}

export const temperaturePenalty = (hoursExposed: number): number =>
  hoursExposed === 0 ? 0 : -hoursExposed

export const drugEffects = (drugName: DrugName): DrugDef => DRUGS[drugName]
