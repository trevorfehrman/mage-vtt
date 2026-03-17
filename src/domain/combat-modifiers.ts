import { Effect, Schema } from "effect"

// --- Specified targets (page 165) ---

export const SPECIFIED_TARGETS: Record<string, number> = {
  torso: -1,
  leg: -2,
  arm: -2,
  head: -3,
  hand: -4,
  eye: -5,
}

// --- Types ---

export class DodgeResult extends Schema.Class<DodgeResult>("DodgeResult")({
  dodgeValue: Schema.Number.check(Schema.isInt()),
  losesAction: Schema.Boolean,
}) {}

export class ChargeResult extends Schema.Class<ChargeResult>("ChargeResult")({
  maxDistance: Schema.Number.check(Schema.isInt()),
  losesDefense: Schema.Boolean,
}) {}

export class GrapplePool extends Schema.Class<GrapplePool>("GrapplePool")({
  dicePool: Schema.Number.check(Schema.isInt()),
}) {}

export class KnockoutResult extends Schema.Class<KnockoutResult>("KnockoutResult")({
  possibleKnockout: Schema.Boolean,
  headHitPenalty: Schema.Number.check(Schema.isInt()),
}) {}

export class FallingDamageResult extends Schema.Class<FallingDamageResult>("FallingDamageResult")({
  damage: Schema.Number.check(Schema.isInt()),
  type: Schema.Literals(["bashing", "lethal"]),
}) {}

// --- Public API ---

export const defenseAgainstMultiple = Effect.fn("Combat.defenseMultiple")(function* (
  baseDefense: number,
  attackerCount: number,
) {
  return Math.max(0, baseDefense - Math.max(0, attackerCount - 1))
})

export const dodgePool = Effect.fn("Combat.dodge")(function* (defense: number) {
  return new DodgeResult({ dodgeValue: defense * 2, losesAction: true })
})

export const specifiedTargetPenalty = Effect.fn("Combat.specifiedTarget")(function* (
  location: string,
) {
  return SPECIFIED_TARGETS[location] ?? 0
})

export const rangePenalty = Effect.fn("Combat.rangePenalty")(function* (
  range: "short" | "medium" | "long",
) {
  if (range === "short") return 0
  if (range === "medium") return -2
  return -4
})

export const concealment = Effect.fn("Combat.concealment")(function* (
  level: "barely" | "partially" | "substantially",
) {
  if (level === "barely") return -1
  if (level === "partially") return -2
  return -3
})

export const chargingAttack = Effect.fn("Combat.charge")(function* (speed: number) {
  return new ChargeResult({ maxDistance: speed * 2, losesDefense: true })
})

export const grappleInitiate = Effect.fn("Combat.grappleInit")(function* (input: {
  strength: number
  brawl: number
  targetDefense: number
}) {
  return new GrapplePool({
    dicePool: Math.max(0, input.strength + input.brawl - input.targetDefense),
  })
})

export const grappleBreakFree = Effect.fn("Combat.grappleBreak")(function* (input: {
  strength: number
  brawl: number
  attackerStrength: number
}) {
  return new GrapplePool({
    dicePool: Math.max(0, input.strength + input.brawl - input.attackerStrength),
  })
})

export const knockoutCheck = Effect.fn("Combat.knockout")(function* (input: {
  damage: number
  targetSize: number
}) {
  return new KnockoutResult({
    possibleKnockout: input.damage >= input.targetSize,
    headHitPenalty: -3,
  })
})

export const fallingDamage = Effect.fn("Combat.falling")(function* (yards: number) {
  if (yards >= 30) {
    return new FallingDamageResult({ damage: 10, type: "lethal" })
  }
  return new FallingDamageResult({
    damage: Math.max(1, Math.floor(yards / 3)),
    type: "bashing",
  })
})
