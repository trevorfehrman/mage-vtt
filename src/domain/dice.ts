import { Effect, Random, Schema } from "effect"

// A single die result (1-10)
export const DieResult = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 1, maximum: 10 }),
)
export type DieResult = typeof DieResult.Type

// A complete dice roll result
export class DiceResult extends Schema.Class<DiceResult>("DiceResult")({
  pool: Schema.Number.check(Schema.isInt()),
  rolls: Schema.Array(Schema.Number),
  explosions: Schema.Array(Schema.Number),
  successes: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  isChanceDie: Schema.Boolean,
  isDramaticFailure: Schema.Boolean,
  isExceptionalSuccess: Schema.Boolean,
}) {}

// Pure dice rolling logic — deterministic when given a random source
export const countSuccesses = (rolls: ReadonlyArray<number>): number =>
  rolls.filter((r) => r >= 8).length

export const isExplosion = (roll: number): boolean => roll === 10

// Roll a single d10 using Effect's Random
export const rollD10 = Effect.gen(function* () {
  const roll = yield* Random.nextIntBetween(1, 11) // 1-10 inclusive
  return roll
})
