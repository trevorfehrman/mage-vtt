import { Effect, Random, Schema } from "effect"

// --- Schemas ---

const PoolComponentType = Schema.Literals(["attribute", "skill", "arcanum", "modifier"])

const Dots = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: -10, maximum: 10 }),
)

export class PoolComponent extends Schema.Class<PoolComponent>("PoolComponent")({
  type: PoolComponentType,
  name: Schema.String,
  dots: Dots,
}) {}

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

// --- Internal helpers ---

const SUCCESS_THRESHOLD = 8
const EXCEPTIONAL_THRESHOLD = 5

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
  chanceDie
    ? rolls.filter((r) => r === 10).length
    : rolls.filter((r) => r >= SUCCESS_THRESHOLD).length

// --- Public API ---

export const buildPool = Effect.fn("DicePool.build")(function* (
  rawComponents: ReadonlyArray<{
    type: string
    name: string
    dots: number
  }>,
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
    const failures = rolls.filter((r) => r < SUCCESS_THRESHOLD)
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
    isDramaticFailure: isChanceDie && rolls[0] === 1,
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
