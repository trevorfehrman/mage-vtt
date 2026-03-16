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

export class DiceRollResult extends Schema.Class<DiceRollResult>("DiceRollResult")({
  poolSize: Schema.Number.check(Schema.isInt()),
  rolls: Schema.Array(Schema.Number),
  explosions: Schema.Array(Schema.Number),
  successes: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  isChanceDie: Schema.Boolean,
  isDramaticFailure: Schema.Boolean,
  isExceptionalSuccess: Schema.Boolean,
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

export const rollPool = Effect.fn("DicePool.roll")(function* (pool: DicePool) {
  const isChanceDie = pool.size <= 0
  const diceToRoll = isChanceDie ? 1 : pool.size

  const rolls = yield* rollNDice(diceToRoll)
  const successes = countSuccesses(rolls, isChanceDie)

  return new DiceRollResult({
    poolSize: pool.size,
    rolls,
    explosions: [],
    successes,
    isChanceDie,
    isDramaticFailure: isChanceDie && rolls[0] === 1,
    isExceptionalSuccess: successes >= EXCEPTIONAL_THRESHOLD,
  })
})

export const resolveExplosions = Effect.fn("DicePool.resolveExplosions")(function* (
  result: DiceRollResult,
) {
  const explosions: Array<number> = [...result.explosions]
  let toReroll = result.rolls.filter((r) => r === 10).length

  while (toReroll > 0) {
    const newRolls = yield* rollNDice(toReroll)
    explosions.push(...newRolls)
    toReroll = newRolls.filter((r) => r === 10).length
  }

  const allRolls = [...result.rolls, ...explosions]
  const successes = countSuccesses(allRolls, result.isChanceDie)

  return new DiceRollResult({
    poolSize: result.poolSize,
    rolls: result.rolls,
    explosions,
    successes,
    isChanceDie: result.isChanceDie,
    isDramaticFailure: result.isDramaticFailure,
    isExceptionalSuccess: successes >= EXCEPTIONAL_THRESHOLD,
  })
})
