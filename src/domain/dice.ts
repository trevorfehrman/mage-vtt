import { Effect, Random, Schema } from "effect"

// --- Schemas ---

// A Trait toggled into a pool (see CONTEXT.md): Gnosis is its own kind, not an
// attribute — casting pools are Gnosis + Arcanum.
const PoolComponentType = Schema.Literals([
  "attribute",
  "skill",
  "arcanum",
  "gnosis",
  "modifier",
])

const Dots = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: -10, maximum: 10 }),
)

export class PoolComponent extends Schema.Class<PoolComponent>("PoolComponent")({
  type: PoolComponentType,
  name: Schema.String,
  dots: Dots,
}) {}

// The raw, pre-decode shape of a pool component as it crosses the wire / Convex
// arg boundary. `buildPool` decodes these into branded `PoolComponent`s; the seam
// and the `diceRolls` row persist this raw form. One named home for the triple.
export type RawPoolComponent = { type: string; name: string; dots: number }

export class DicePool extends Schema.Class<DicePool>("DicePool")({
  components: Schema.Array(PoolComponent),
  size: Schema.Number.check(Schema.isInt()),
}) {}

const RollVisibilitySchema = Schema.Literals(["public", "hidden"])
export type RollVisibility = typeof RollVisibilitySchema.Type

export class DiceRollResult extends Schema.Class<DiceRollResult>("DiceRollResult")({
  poolSize: Schema.Number.check(Schema.isInt()),
  rolls: Schema.Array(Schema.Number),
  explosions: Schema.Array(Schema.Number),
  successes: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  isChanceDie: Schema.Boolean,
  isDramaticFailure: Schema.Boolean,
  isExceptionalSuccess: Schema.Boolean,
  visibility: RollVisibilitySchema,
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

const rollNDice = (n: number) =>
  Effect.gen(function* () {
    const rolls: Array<number> = []
    for (let i = 0; i < n; i++) {
      rolls.push(yield* rollD10)
    }
    return rolls
  })

const countSuccesses = (rolls: ReadonlyArray<number>, chanceDie: boolean): number =>
  rolls.filter((r) => isDieSuccess(r, chanceDie)).length

// --- Public API ---

export const buildPool = Effect.fn("DicePool.build")(function* (
  rawComponents: ReadonlyArray<RawPoolComponent>,
) {
  const components: Array<PoolComponent> = []

  for (const raw of rawComponents) {
    const component = yield* Schema.decodeUnknownEffect(PoolComponent)(raw).pipe(
      Effect.mapError(
        () => new InvalidPoolComponent({ message: `Invalid component: ${raw.name}` }),
      ),
    )
    components.push(component)
  }

  const size = components.reduce((sum, c) => sum + c.dots, 0)

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
  const roteRerolls: Array<number> = []
  if (isRoteAction && !isChanceDie) {
    const failures = rolls.filter((r) => !isDieSuccess(r, false))
    if (failures.length > 0) {
      const rerolls = yield* rollNDice(failures.length)
      roteRerolls.push(...rerolls)
    }
  }

  // Again explosions (10-again, 9-again, or 8-again)
  const explosions: Array<number> = []
  if (!isChanceDie) {
    const allInitialRolls = [...rolls, ...roteRerolls]
    let toReroll = allInitialRolls.filter((r) => r >= againThreshold).length

    while (toReroll > 0) {
      const newRolls = yield* rollNDice(toReroll)
      explosions.push(...newRolls)
      toReroll = newRolls.filter((r) => r >= againThreshold).length
    }
  }

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
  const explosions: Array<number> = [...result.explosions]
  let toReroll = result.rolls.filter((r) => r >= threshold).length

  while (toReroll > 0) {
    const newRolls = yield* rollNDice(toReroll)
    explosions.push(...newRolls)
    toReroll = newRolls.filter((r) => r >= threshold).length
  }

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
