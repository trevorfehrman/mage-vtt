import { Array as Arr, Effect, Option, Random, Schema } from "effect"
import { Ticks } from "./quantities"

// --- Action tick costs (homebrew from Scion: Hero) ---

export const ACTION_COSTS = {
  attack: 3,
  castSpell: 5,
  aim: 1, // per tick, +1 die to next attack
  move: 3,
  dodge: 1, // per tick, +1 Defense
  useItem: 3,
} as const

// --- Types ---

export class InitiativeRoll extends Schema.Class<InitiativeRoll>("InitiativeRoll")({
  participantId: Schema.String,
  roll: Schema.Number.check(Schema.isInt()),
  dexterity: Schema.Number.check(Schema.isInt()),
  composure: Schema.Number.check(Schema.isInt()),
  total: Schema.Number.check(Schema.isInt()),
}) {}

export class TickEntry extends Schema.Class<TickEntry>("TickEntry")({
  participantId: Schema.String,
  ticks: Ticks,
}) {}

export class ActionResult extends Schema.Class<ActionResult>("ActionResult")({
  participantId: Schema.String,
  newTicks: Schema.Number.check(Schema.isInt()),
}) {}

/**
 * Fate's visible hand (issue #59): when the whole house chain ties, a seeded
 * random draw decides — and reports itself, so the flow layer can log the
 * coinflip to the table ("fate says X"). Never silent, never insertion order.
 */
export const CoinFlip = Schema.Struct({
  /** The fully tied contestants, in the order the chain left them. */
  participantIds: Schema.Array(Schema.String),
  /** The order fate chose; index 0 wins. */
  order: Schema.Array(Schema.String),
})
export type CoinFlip = typeof CoinFlip.Type

export class TickOrder extends Schema.Class<TickOrder>("TickOrder")({
  entries: Schema.Array(TickEntry),
  /** One entry per fully tied group whose order a coinflip decided. */
  flips: Schema.Array(CoinFlip),
}) {}

export class NextActorResult extends Schema.Class<NextActorResult>("NextActorResult")({
  participantId: Schema.String,
  ticksAdvanced: Ticks,
  /** Present only when equal Ticks survived the whole chain — log it. */
  flip: Schema.optionalKey(CoinFlip),
}) {}

// --- Public API ---

export const rollInitiative = Effect.fn("Initiative.roll")(function* (input: {
  participantId: string
  dexterity: number
  composure: number
}) {
  const roll = yield* Random.nextIntBetween(1, 10)
  const total = roll + input.dexterity + input.composure

  return new InitiativeRoll({
    participantId: input.participantId,
    roll,
    dexterity: input.dexterity,
    composure: input.composure,
    total,
  })
})

// Pure rules leaves below (ADR-0014): plain functions — only what consumes
// Random (the roll, and the tie-ending coinflips of issue #59) stays Effect.

/** The stats the house tiebreak chain reads, in its order of authority. */
const ChainStats = Schema.Struct({
  wits: Schema.optionalKey(Schema.Number),
  dexterity: Schema.optionalKey(Schema.Number),
  composure: Schema.optionalKey(Schema.Number),
  willpower: Schema.optionalKey(Schema.Number),
})
type ChainStats = typeof ChainStats.Type

/** Wits > Dexterity > Composure > Willpower; 0 means the chain is exhausted. */
const byChain = (a: ChainStats, b: ChainStats): number =>
  (b.wits ?? 0) - (a.wits ?? 0) ||
  (b.dexterity ?? 0) - (a.dexterity ?? 0) ||
  (b.composure ?? 0) - (a.composure ?? 0) ||
  (b.willpower ?? 0) - (a.willpower ?? 0)

export const resolveTickOrder = Effect.fn("Initiative.resolveTickOrder")(function* (
  rolls: ReadonlyArray<{
    participantId: string
    total: number
    roll: number
    dexterity: number
    composure: number
    wits?: number
    willpower?: number
  }>,
) {
  const highest = Math.max(...rolls.map((r) => r.total))

  // Higher total acts first; ties walk the house chain.
  const sorted = [...rolls].sort((a, b) => b.total - a.total || byChain(a, b))

  // A run the chain could not split is fate's to order (issue #59) — a seeded
  // shuffle per run, drawn only when a run exists: chain-settled orders stay
  // byte-identical under a seed, no spurious randomness.
  const runs = Arr.isArrayNonEmpty(sorted)
    ? Arr.groupWith(sorted, (a, b) => a.total === b.total && byChain(a, b) === 0)
    : []
  const ordered = yield* Effect.forEach(runs, (run) =>
    run.length === 1
      ? Effect.succeed({ group: run as ReadonlyArray<(typeof run)[number]>, flip: Option.none<CoinFlip>() })
      : Effect.map(Random.shuffle(run), (shuffled) => ({
          group: shuffled,
          flip: Option.some<CoinFlip>({
            participantIds: run.map((r) => r.participantId),
            order: shuffled.map((r) => r.participantId),
          }),
        })),
  )

  return new TickOrder({
    entries: ordered
      .flatMap((o) => o.group)
      .map(
        (r) =>
          new TickEntry({
            participantId: r.participantId,
            ticks: Ticks.make(highest - r.total),
          }),
      ),
    flips: ordered.flatMap((o) => Option.toArray(o.flip)),
  })
})

export const applyActionCost = (input: {
  participantId: string
  currentTicks: number
  action: keyof typeof ACTION_COSTS
}): ActionResult =>
  new ActionResult({
    participantId: input.participantId,
    newTicks: input.currentTicks + ACTION_COSTS[input.action],
  })

/**
 * The next actor is a genuine miss on an empty tracker — an Option, not a `!`.
 * Equal Ticks resolve by the same discipline as initiative (issue #59): the
 * house chain, then a reported coinflip — the queue's answer to "who's up"
 * never depends on roster insertion order.
 */
export const findNextActor = Effect.fn("Initiative.findNextActor")(function* (
  entries: ReadonlyArray<
    { participantId: string; ticks: number } & ChainStats
  >,
) {
  if (entries.length === 0) return Option.none<NextActorResult>()

  const minTicks = Math.min(...entries.map((e) => e.ticks))
  const contenders = [...entries.filter((e) => e.ticks === minTicks)].sort(byChain)
  const tied = contenders.filter((c) => byChain(c, contenders[0]!) === 0)

  if (tied.length === 1) {
    return Option.some(
      new NextActorResult({
        participantId: tied[0]!.participantId,
        ticksAdvanced: Ticks.make(minTicks),
      }),
    )
  }

  const shuffled = yield* Random.shuffle(tied)
  return Option.some(
    new NextActorResult({
      participantId: shuffled[0]!.participantId,
      ticksAdvanced: Ticks.make(minTicks),
      flip: {
        participantIds: tied.map((t) => t.participantId),
        order: shuffled.map((t) => t.participantId),
      },
    }),
  )
})
