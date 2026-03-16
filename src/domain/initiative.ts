import { Effect, Random, Schema } from "effect"

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
  ticks: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
}) {}

export class ActionResult extends Schema.Class<ActionResult>("ActionResult")({
  participantId: Schema.String,
  newTicks: Schema.Number.check(Schema.isInt()),
}) {}

export class NextActorResult extends Schema.Class<NextActorResult>("NextActorResult")({
  participantId: Schema.String,
  ticksAdvanced: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
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

export const resolveTickOrder = Effect.fn("Initiative.resolveOrder")(function* (
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

  // Sort by tiebreaker priority: Wits > Dex > Composure > Willpower
  const sorted = [...rolls].sort((a, b) => {
    if (a.total !== b.total) return b.total - a.total // higher total first
    if ((a.wits ?? 0) !== (b.wits ?? 0)) return (b.wits ?? 0) - (a.wits ?? 0)
    if (a.dexterity !== b.dexterity) return b.dexterity - a.dexterity
    if (a.composure !== b.composure) return b.composure - a.composure
    if ((a.willpower ?? 0) !== (b.willpower ?? 0)) return (b.willpower ?? 0) - (a.willpower ?? 0)
    return 0
  })

  return sorted.map(
    (r) =>
      new TickEntry({
        participantId: r.participantId,
        ticks: highest - r.total,
      }),
  )
})

export const applyActionCost = Effect.fn("Initiative.applyActionCost")(function* (input: {
  participantId: string
  currentTicks: number
  action: keyof typeof ACTION_COSTS
}) {
  const cost = ACTION_COSTS[input.action]

  return new ActionResult({
    participantId: input.participantId,
    newTicks: input.currentTicks + cost,
  })
})

export const findNextActor = Effect.fn("Initiative.findNextActor")(function* (
  entries: ReadonlyArray<{ participantId: string; ticks: number }>,
) {
  // Find minimum ticks
  const minTicks = Math.min(...entries.map((e) => e.ticks))

  // Find the participant with minimum ticks (first one if tie)
  const next = entries.find((e) => e.ticks === minTicks)!

  return new NextActorResult({
    participantId: next.participantId,
    ticksAdvanced: minTicks,
  })
})
