import { Effect, Schema } from "effect"

// --- Types ---

export class ResourceTracker extends Schema.Class<ResourceTracker>("ResourceTracker")({
  name: Schema.String,
  current: Schema.Number.check(Schema.isInt()),
  max: Schema.Number.check(Schema.isInt()),
}) {}

// --- Errors ---

export class InsufficientResource extends Schema.TaggedErrorClass<InsufficientResource>()(
  "InsufficientResource",
  { message: Schema.String },
) {}

// --- Public API ---

export const createResourceTracker = Effect.fn("Resource.create")(function* (
  name: string,
  max: number,
) {
  return new ResourceTracker({ name, current: max, max })
})

export const spendResource = Effect.fn("Resource.spend")(function* (
  tracker: ResourceTracker,
  amount: number,
  options?: { perTurnLimit?: number },
) {
  if (options?.perTurnLimit !== undefined && amount > options.perTurnLimit) {
    yield* new InsufficientResource({
      message: `Cannot spend ${amount} ${tracker.name} — per-turn limit is ${options.perTurnLimit}`,
    })
  }

  if (amount > tracker.current) {
    yield* new InsufficientResource({
      message: `Cannot spend ${amount} ${tracker.name} — only ${tracker.current} remaining`,
    })
  }

  return new ResourceTracker({
    ...tracker,
    current: tracker.current - amount,
  })
})

export const recoverResource = Effect.fn("Resource.recover")(function* (
  tracker: ResourceTracker,
  amount: number,
) {
  return new ResourceTracker({
    ...tracker,
    current: Math.min(tracker.current + amount, tracker.max),
  })
})
