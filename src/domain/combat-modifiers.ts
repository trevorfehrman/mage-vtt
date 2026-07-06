import { Match, Schema } from "effect"

// Pure rules leaves (ADR-0014): every function here only computes, so they are
// plain functions — no Effect wrapper. Closed-key tables are total over their
// Literals vocabulary; literal dispatch goes through Match.exhaustive.

// --- Specified targets (page 165) ---

export const TargetLocation = Schema.Literals([
  "torso",
  "leg",
  "arm",
  "head",
  "hand",
  "eye",
])
export type TargetLocation = typeof TargetLocation.Type

export const SPECIFIED_TARGETS: Record<TargetLocation, number> = {
  torso: -1,
  leg: -2,
  arm: -2,
  head: -3,
  hand: -4,
  eye: -5,
}

// --- Vocabularies ---

export const RangeBand = Schema.Literals(["short", "medium", "long"])
export type RangeBand = typeof RangeBand.Type

export const ConcealmentLevel = Schema.Literals(["barely", "partially", "substantially"])
export type ConcealmentLevel = typeof ConcealmentLevel.Type

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

export const defenseAgainstMultiple = (
  baseDefense: number,
  attackerCount: number,
): number => Math.max(0, baseDefense - Math.max(0, attackerCount - 1))

export const dodgePool = (defense: number): DodgeResult =>
  new DodgeResult({ dodgeValue: defense * 2, losesAction: true })

export const specifiedTargetPenalty = (location: TargetLocation): number =>
  SPECIFIED_TARGETS[location]

export const rangePenalty = (range: RangeBand): number =>
  Match.value(range).pipe(
    Match.when("short", () => 0),
    Match.when("medium", () => -2),
    Match.when("long", () => -4),
    Match.exhaustive,
  )

export const concealment = (level: ConcealmentLevel): number =>
  Match.value(level).pipe(
    Match.when("barely", () => -1),
    Match.when("partially", () => -2),
    Match.when("substantially", () => -3),
    Match.exhaustive,
  )

export const chargingAttack = (speed: number): ChargeResult =>
  new ChargeResult({ maxDistance: speed * 2, losesDefense: true })

export const grappleInitiate = (input: {
  strength: number
  brawl: number
  targetDefense: number
}): GrapplePool =>
  new GrapplePool({
    dicePool: Math.max(0, input.strength + input.brawl - input.targetDefense),
  })

export const grappleBreakFree = (input: {
  strength: number
  brawl: number
  attackerStrength: number
}): GrapplePool =>
  new GrapplePool({
    dicePool: Math.max(0, input.strength + input.brawl - input.attackerStrength),
  })

export const knockoutCheck = (input: {
  damage: number
  targetSize: number
}): KnockoutResult =>
  new KnockoutResult({
    possibleKnockout: input.damage >= input.targetSize,
    headHitPenalty: -3,
  })

export const fallingDamage = (yards: number): FallingDamageResult => {
  if (yards >= 30) {
    return new FallingDamageResult({ damage: 10, type: "lethal" })
  }
  return new FallingDamageResult({
    damage: Math.max(1, Math.floor(yards / 3)),
    type: "bashing",
  })
}
