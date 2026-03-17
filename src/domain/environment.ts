import { Effect, Schema } from "effect"

// --- Fire (page 180) ---

const FIRE_SIZE_DAMAGE: Record<string, number> = { torch: 1, bonfire: 2, inferno: 3 }
const FIRE_HEAT_MODIFIER: Record<string, number> = { candle: 0, torch: 1, bonfire: 2, chemical: 3 }

export const FIRE_SIZES = Object.keys(FIRE_SIZE_DAMAGE)

export class FireDamageResult extends Schema.Class<FireDamageResult>("FireDamageResult")({
  lethalPerTurn: Schema.Number.check(Schema.isInt()),
}) {}

// --- Electrocution (page 178) ---

const ELECTROCUTION_DAMAGE: Record<string, number> = { minor: 4, moderate: 6, severe: 8, extreme: 10 }

export class ElectrocutionResult extends Schema.Class<ElectrocutionResult>("ElectrocutionResult")({
  bashingPerTurn: Schema.Number.check(Schema.isInt()),
  armorApplies: Schema.Boolean,
}) {}

// --- Explosives (pages 178-179) ---

interface ExplosiveDef { name: string; damage: number; blastRadius: number }

export const EXPLOSIVES: ReadonlyArray<ExplosiveDef> = [
  { name: "incendiary", damage: 2, blastRadius: 3 },
  { name: "concussion", damage: 4, blastRadius: 5 },
  { name: "fragmentation", damage: 4, blastRadius: 10 },
  { name: "high_explosive", damage: 6, blastRadius: 15 },
]

export class ExplosiveResult extends Schema.Class<ExplosiveResult>("ExplosiveResult")({
  damage: Schema.Number.check(Schema.isInt()),
  blastRadius: Schema.Number.check(Schema.isInt()),
}) {}

// --- Drug effects (pages 176-177) ---

interface DrugDef {
  name: string
  poolPenalty: number
  affectedPools: readonly string[]
  duration: string
}

const DRUGS: Record<string, DrugDef> = {
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

export const fireDamage = Effect.fn("Env.fire")(function* (input: {
  size: string
  heat: string
}) {
  const sizeDmg = FIRE_SIZE_DAMAGE[input.size] ?? 1
  const heatMod = FIRE_HEAT_MODIFIER[input.heat] ?? 0
  return new FireDamageResult({ lethalPerTurn: sizeDmg + heatMod })
})

export const electrocutionDamage = Effect.fn("Env.electrocution")(function* (
  severity: string,
) {
  return new ElectrocutionResult({
    bashingPerTurn: ELECTROCUTION_DAMAGE[severity] ?? 4,
    armorApplies: false,
  })
})

export const explosiveDamage = Effect.fn("Env.explosive")(function* (input: {
  type: string
  isProne: boolean
}) {
  const explosive = EXPLOSIVES.find((e) => e.name === input.type)
  const baseDamage = explosive?.damage ?? 4
  const damage = input.isProne ? Math.max(0, baseDamage - 2) : baseDamage

  return new ExplosiveResult({
    damage,
    blastRadius: explosive?.blastRadius ?? 5,
  })
})

export const poisonResistance = Effect.fn("Env.poison")(function* (input: {
  stamina: number
  resolve: number
  toxicity: number
}) {
  return new PoisonResult({
    resistPool: input.stamina + input.resolve,
    lethalDamage: input.toxicity,
  })
})

export const deprivationDamage = Effect.fn("Env.deprivation")(function* (input: {
  stamina: number
  resolve: number
  daysWithoutWater: number
  daysWithoutFood: number
}) {
  const waterThreshold = input.stamina
  const foodThreshold = input.stamina + input.resolve

  let bashingPerDay = 0
  if (input.daysWithoutWater > waterThreshold) bashingPerDay += 1
  if (input.daysWithoutFood > foodThreshold) bashingPerDay += 1

  return new DeprivationResult({
    bashingPerDay,
    thresholdDays: waterThreshold,
  })
})

export const fatiguePenalty = Effect.fn("Env.fatigue")(function* (hoursAwake: number) {
  if (hoursAwake <= 24) return 0
  return -Math.floor((hoursAwake - 24) / 6)
})

export const temperaturePenalty = Effect.fn("Env.temperature")(function* (hoursExposed: number) {
  return hoursExposed === 0 ? 0 : -hoursExposed
})

export const drugEffects = Effect.fn("Env.drugs")(function* (drugName: string) {
  const drug = DRUGS[drugName]
  if (!drug) return { poolPenalty: 0, affectedPools: [] as string[], duration: "unknown" }
  return drug
})
