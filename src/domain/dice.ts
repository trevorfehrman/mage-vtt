import { Effect, Random, Schema } from "effect"
import { ComponentDots, PoolSize, Successes } from "./quantities"

// --- Schemas ---

// A Trait toggled into a pool (see CONTEXT.md): Gnosis is its own kind, not an
// attribute — casting pools are Gnosis + Arcanum.
export const PoolComponentType = Schema.Literals([
  "attribute",
  "skill",
  "arcanum",
  "gnosis",
  "modifier",
])
export type PoolComponentType = typeof PoolComponentType.Type

export class PoolComponent extends Schema.Class<PoolComponent>("PoolComponent")({
  type: PoolComponentType,
  name: Schema.String,
  dots: ComponentDots,
}) {}

// The raw, pre-decode shape of a pool component as it crosses the wire / Convex
// arg boundary. `buildPool` decodes these into branded `PoolComponent`s; the seam
// and the `diceRolls` row persist this raw form. One named home for the triple.
export const RawPoolComponent = Schema.Struct({
  type: Schema.String,
  name: Schema.String,
  dots: Schema.Number,
})
export type RawPoolComponent = typeof RawPoolComponent.Type

// The builder tier's component (issue #53): what the sheet toggles in and the
// dice-pool machine accumulates — domain-typed kind, plain name and dots. The
// one home for the shape the machine, hook, and builder all speak; it narrows
// to `RawPoolComponent` at the wire.
export const PoolComponentInput = Schema.Struct({
  type: PoolComponentType,
  name: Schema.String,
  dots: Schema.Number,
})
export type PoolComponentInput = typeof PoolComponentInput.Type

export class DicePool extends Schema.Class<DicePool>("DicePool")({
  components: Schema.Array(PoolComponent),
  size: PoolSize,
}) {}

export const RollVisibility = Schema.Literals(["public", "hidden"])
export type RollVisibility = typeof RollVisibility.Type

export class DiceRollResult extends Schema.Class<DiceRollResult>("DiceRollResult")({
  poolSize: PoolSize,
  rolls: Schema.Array(Schema.Number),
  explosions: Schema.Array(Schema.Number),
  successes: Successes,
  isChanceDie: Schema.Boolean,
  isDramaticFailure: Schema.Boolean,
  isExceptionalSuccess: Schema.Boolean,
  visibility: RollVisibility,
  againThreshold: Schema.Number.check(Schema.isInt()), // 10 = normal, 9 = 9-again, 8 = 8-again
  isRoteAction: Schema.Boolean,
  roteRerolls: Schema.Array(Schema.Number),
}) {}

// --- Errors ---

export class InvalidPoolComponent extends Schema.TaggedErrorClass<InvalidPoolComponent>()(
  "InvalidPoolComponent",
  { message: Schema.String },
) {}

// --- Die-outcome rules ---
// One source of truth for what a single die face means (issue #25): the roll
// math below and the client's Die renderer both consume these plain predicates
// (pure rules leaves, ADR-0014).

const SUCCESS_THRESHOLD = 8
const EXCEPTIONAL_THRESHOLD = 5
const CHANCE_DIE_SUCCESS = 10
const CHANCE_DIE_DRAMATIC_FAILURE = 1

/** A normal die succeeds on 8+; a chance die only on 10. */
export const isDieSuccess = (value: number, isChanceDie: boolean): boolean =>
  isChanceDie ? value === CHANCE_DIE_SUCCESS : value >= SUCCESS_THRESHOLD

/** Only a chance die showing 1 is the dramatic failure. */
export const isDieDramaticFailure = (value: number, isChanceDie: boolean): boolean =>
  isChanceDie && value === CHANCE_DIE_DRAMATIC_FAILURE

/** A die at or above the pool's again threshold explodes; chance dice never do. */
export const isDieExplosive = (
  value: number,
  againThreshold: number,
  isChanceDie: boolean,
): boolean => !isChanceDie && value >= againThreshold

// --- Internal helpers ---

const rollD10 = Random.nextIntBetween(1, 10)

/** n sequential d10 draws; zero draws for n = 0. Draw order is the seeded-test contract. */
const rollNDice = (n: number) => Effect.replicateEffect(rollD10, n)

/**
 * Cascading N-again rerolls: every die in a batch at or above the threshold
 * earns another draw, until a batch yields none. Effect v4 dropped
 * Effect.iterate/Effect.loop, so the cascade recurses through flatMap —
 * batches are drawn in order, so seeded draw sequences match the old while loop.
 */
const cascadeExplosions = (
  count: number,
  threshold: number,
): Effect.Effect<ReadonlyArray<number>> =>
  count <= 0
    ? Effect.succeed([])
    : Effect.flatMap(rollNDice(count), (batch) =>
        Effect.map(
          cascadeExplosions(batch.filter((r) => r >= threshold).length, threshold),
          (rest) => [...batch, ...rest],
        ),
      )

const countSuccesses = (rolls: ReadonlyArray<number>, chanceDie: boolean): Successes =>
  Successes.make(rolls.filter((r) => isDieSuccess(r, chanceDie)).length)

// --- Public API ---

export const buildPool = Effect.fn("DicePool.build")(function* (
  rawComponents: ReadonlyArray<RawPoolComponent>,
) {
  const components = yield* Effect.forEach(rawComponents, (raw) =>
    Schema.decodeUnknownEffect(PoolComponent)(raw).pipe(
      Effect.mapError(
        () => new InvalidPoolComponent({ message: `Invalid component: ${raw.name}` }),
      ),
    ),
  )

  const size = PoolSize.make(components.reduce((sum, c) => sum + c.dots, 0))

  return new DicePool({ components, size })
})

export const rollPool = Effect.fn("DicePool.roll")(function* (
  pool: DicePool,
  options?: {
    visibility?: RollVisibility
    againThreshold?: number // 10 = normal, 9 = 9-again, 8 = 8-again
    roteAction?: boolean
  },
) {
  const isChanceDie = pool.size <= 0
  const diceToRoll = isChanceDie ? 1 : pool.size
  const againThreshold = options?.againThreshold ?? 10
  const isRoteAction = options?.roteAction ?? false

  const rolls = yield* rollNDice(diceToRoll)

  // Rote action: reroll all failed dice once
  const roteRerolls =
    isRoteAction && !isChanceDie
      ? yield* rollNDice(rolls.filter((r) => !isDieSuccess(r, false)).length)
      : []

  // Again explosions (10-again, 9-again, or 8-again)
  const explosions = isChanceDie
    ? []
    : yield* cascadeExplosions(
        [...rolls, ...roteRerolls].filter((r) => r >= againThreshold).length,
        againThreshold,
      )

  const allRolls = [...rolls, ...roteRerolls, ...explosions]
  const successes = countSuccesses(allRolls, isChanceDie)

  return new DiceRollResult({
    poolSize: pool.size,
    rolls,
    explosions,
    successes,
    isChanceDie,
    isDramaticFailure: isChanceDie && rolls[0] === CHANCE_DIE_DRAMATIC_FAILURE,
    isExceptionalSuccess: successes >= EXCEPTIONAL_THRESHOLD,
    visibility: options?.visibility ?? "public",
    againThreshold,
    isRoteAction,
    roteRerolls,
  })
})

export const resolveExplosions = Effect.fn("DicePool.resolveExplosions")(function* (
  result: DiceRollResult,
) {
  const threshold = result.againThreshold
  const explosions = [
    ...result.explosions,
    ...(yield* cascadeExplosions(
      result.rolls.filter((r) => r >= threshold).length,
      threshold,
    )),
  ]

  const allRolls = [...result.rolls, ...result.roteRerolls, ...explosions]
  const successes = countSuccesses(allRolls, result.isChanceDie)

  return new DiceRollResult({
    poolSize: result.poolSize,
    rolls: result.rolls,
    explosions,
    successes,
    isChanceDie: result.isChanceDie,
    isDramaticFailure: result.isDramaticFailure,
    isExceptionalSuccess: successes >= EXCEPTIONAL_THRESHOLD,
    visibility: result.visibility,
    againThreshold: result.againThreshold,
    isRoteAction: result.isRoteAction,
    roteRerolls: result.roteRerolls,
  })
})
