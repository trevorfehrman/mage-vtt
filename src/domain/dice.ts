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

/**
 * One exploded die and its lineage (issue #122): `value` is the face rolled;
 * `parentIndex` points at the die that spawned it — an index into the roll's
 * combined sequence ([...rolls, ...roteRerolls, ...explosions]), always a die
 * that was itself at or above the again threshold in a prior generation.
 * `null` means parentless: a record stored before lineage existed.
 */
export const Explosion = Schema.Struct({
  value: Schema.Number,
  parentIndex: Schema.NullOr(Schema.Number),
})
export type Explosion = typeof Explosion.Type

/**
 * A stored explosion as the decode boundary receives it: documents written
 * before issue #122 hold the bare face. The heal lives in
 * `normalizeExplosions`; the persisted column stays a union superset of both
 * generations (the `HealthBoxDoc` precedent) while new writes are always
 * parented structs.
 */
export const StoredExplosion = Schema.Union([Schema.Number, Explosion])
export type StoredExplosion = typeof StoredExplosion.Type

/** Heal one stored explosion: a legacy bare face becomes a parentless struct. */
export const normalizeExplosion = (stored: StoredExplosion): Explosion =>
  typeof stored === "number" ? { value: stored, parentIndex: null } : stored

/** Heal a stored explosion list at the decode boundary — never a crash. */
export const normalizeExplosions = (
  stored: ReadonlyArray<StoredExplosion>,
): Array<Explosion> => stored.map(normalizeExplosion)

/** The faces alone, either generation — what a flat projection renders. */
export const explosionValues = (
  stored: ReadonlyArray<StoredExplosion>,
): Array<number> => stored.map((e) => normalizeExplosion(e).value)

/**
 * Heal a Cast document's two explosion columns at a decode boundary (#122):
 * each column that is present collapses its stored faces to parented structs,
 * an absent column stays absent (so `optionalKey` decode and feed projection
 * both preserve "never written"). The seam decode (`convexLive.decodeCast`)
 * and the feed projection (`activity.castEntry`) share this one door, so the
 * heal can never drift between the two boundaries.
 */
export const healCastExplosions = (columns: {
  readonly paradoxExplosions?: ReadonlyArray<StoredExplosion> | undefined
  readonly castExplosions?: ReadonlyArray<StoredExplosion> | undefined
}): {
  paradoxExplosions?: Array<Explosion>
  castExplosions?: Array<Explosion>
} => ({
  ...(columns.paradoxExplosions !== undefined
    ? { paradoxExplosions: normalizeExplosions(columns.paradoxExplosions) }
    : {}),
  ...(columns.castExplosions !== undefined
    ? { castExplosions: normalizeExplosions(columns.castExplosions) }
    : {}),
})

/**
 * One die in the burst order (issue #126): what a felt renders when it draws
 * lineage. `index` is the die's position in the roll's combined sequence
 * ([...rolls, ...roteRerolls, ...explosions]) — the same indexing
 * `parentIndex` speaks — so it doubles as a row-unique render key.
 */
export const BurstDie = Schema.Struct({
  value: Schema.Number,
  index: Schema.Number,
  kind: Schema.Literals(["roll", "rote", "explosion"]),
})
export type BurstDie = typeof BurstDie.Type

/**
 * The burst order (issue #126): the roll's dice regrouped so every explosion
 * stands beside its cause — each base die followed by the chain it spawned,
 * generation after generation. `cascadeExplosions` draws exactly one child
 * per trigger, so lineage is a set of chains, never a tree: within a cluster,
 * each die after the first burst from the die immediately before it.
 *
 * Chains follow only the FIRST claimant of a parent, and only forward (a
 * child is always drawn after its parent), so malformed parentage — cycles,
 * self-references, duplicate claimants, out-of-range indices — can never
 * loop or crash. Whatever no chain reaches (parentless legacy explosions,
 * unhonorable parentage) renders inline at the row's end in stored order,
 * one single-die cluster each — exactly the render before lineage existed.
 */
export const burstClusters = (
  rolls: ReadonlyArray<number>,
  roteRerolls: ReadonlyArray<number>,
  explosions: ReadonlyArray<Explosion>,
): Array<Array<BurstDie>> => {
  const baseCount = rolls.length + roteRerolls.length
  const indexed = explosions.map((e, i) => ({
    value: e.value,
    parentIndex: e.parentIndex,
    index: baseCount + i,
  }))
  const chainFrom = (parentIdx: number): Array<BurstDie> => {
    const child = indexed.find(
      (e) => e.parentIndex === parentIdx && e.index > parentIdx,
    )
    return child === undefined
      ? []
      : [
          { value: child.value, index: child.index, kind: "explosion" as const },
          ...chainFrom(child.index),
        ]
  }
  const base: Array<BurstDie> = [
    ...rolls.map((value, i) => ({ value, index: i, kind: "roll" as const })),
    ...roteRerolls.map((value, i) => ({
      value,
      index: rolls.length + i,
      kind: "rote" as const,
    })),
  ]
  const clusters = base.map((d) => [d, ...chainFrom(d.index)])
  const placed = clusters.flat().map((d) => d.index)
  const orphans = indexed
    .filter((e) => !placed.includes(e.index))
    .map((e): Array<BurstDie> => [
      { value: e.value, index: e.index, kind: "explosion" },
    ])
  return [...clusters, ...orphans]
}

export class DiceRollResult extends Schema.Class<DiceRollResult>("DiceRollResult")({
  poolSize: PoolSize,
  rolls: Schema.Array(Schema.Number),
  explosions: Schema.Array(Explosion),
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

export class InvalidPoolComponent extends Schema.TaggedError<InvalidPoolComponent>()(
  "InvalidPoolComponent",
  { message: Schema.String },
) {}

// --- Die-outcome rules ---
// One source of truth for what a single die face means (issue #25): the roll
// math below and the client's Die renderer both consume these plain predicates
// (pure rules leaves, ADR-0014).

const SUCCESS_THRESHOLD = 8
/** Five successes make any roll exceptional (WoD p. 125); the Havoc Wisdom roll reads it too. */
export const EXCEPTIONAL_THRESHOLD = 5
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

/** The combined-sequence indices of the dice at or above the threshold. */
const triggerIndices = (
  dice: ReadonlyArray<number>,
  threshold: number,
  offset: number,
): ReadonlyArray<number> =>
  dice.flatMap((r, i) => (r >= threshold ? [offset + i] : []))

/**
 * Cascading N-again rerolls: every die in a batch at or above the threshold
 * earns another draw, until a batch yields none. Effect v4 dropped
 * Effect.iterate/Effect.loop, so the cascade recurses through flatMap —
 * batches are drawn in order, so seeded draw sequences match the old while loop.
 *
 * The lineage thread (issue #122): `parents` carries the trigger dice's
 * indices in the roll's combined sequence, one child drawn per trigger in
 * order, so each child's `parentIndex` is the die that spawned it;
 * `nextIndex` is the combined-sequence index the batch's first child takes,
 * so chain explosions (a 10 whose child is also a 10) link generation to
 * generation.
 */
const cascadeExplosions = (
  parents: ReadonlyArray<number>,
  threshold: number,
  nextIndex: number,
): Effect.Effect<ReadonlyArray<Explosion>> =>
  parents.length === 0
    ? Effect.succeed([])
    : Effect.flatMap(rollNDice(parents.length), (batch) => {
        const children = batch.map((value, i) => ({
          value,
          parentIndex: parents[i]!,
        }))
        return Effect.map(
          cascadeExplosions(
            triggerIndices(batch, threshold, nextIndex),
            threshold,
            nextIndex + children.length,
          ),
          (rest) => [...children, ...rest],
        )
      })

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

  // Again explosions (10-again, 9-again, or 8-again): triggers in the
  // initial dice spawn the first generation, indexed off the combined
  // sequence so every child records the die that spawned it (issue #122).
  const initial = [...rolls, ...roteRerolls]
  const explosions = isChanceDie
    ? []
    : yield* cascadeExplosions(
        triggerIndices(initial, againThreshold, 0),
        againThreshold,
        initial.length,
      )

  const allRolls = [...initial, ...explosions.map((e) => e.value)]
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
      triggerIndices(result.rolls, threshold, 0),
      threshold,
      result.rolls.length + result.roteRerolls.length + result.explosions.length,
    )),
  ]

  const allRolls = [
    ...result.rolls,
    ...result.roteRerolls,
    ...explosions.map((e) => e.value),
  ]
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
