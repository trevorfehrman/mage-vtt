import { Effect, Schema } from "effect"

// --- Types ---

export class RelinquishResult extends Schema.Class<RelinquishResult>("RelinquishResult")({
  willpowerDotCost: Schema.Number.check(Schema.isInt()),
  remainingWillpowerDots: Schema.Number.check(Schema.isInt()),
  canNoLongerDismiss: Schema.Boolean,
}) {}

// --- Errors ---

export class SpellControlError extends Schema.TaggedError<SpellControlError>()(
  "SpellControlError",
  { message: Schema.String },
) {}

// --- Public API ---

// The "−2 per spell beyond Gnosis" maintenance penalty once here was a rule
// the book does not have (Mage p. 75 caps active spells at Gnosis + 3, no
// penalty); it was never called and went with MAG-75, whose notebook holds
// standing spells as notes no rule reads (ADR-0027).

// Stays Effect: relinquishing can fail with a typed error.
export const relinquishSpell = Effect.fn("SpellControl.relinquish")(function* (input: {
  currentWillpowerDots: number
}) {
  if (input.currentWillpowerDots <= 0) {
    return yield* new SpellControlError({
      message: "Cannot relinquish spell — no Willpower dots to sacrifice",
    })
  }

  return new RelinquishResult({
    willpowerDotCost: 1,
    remainingWillpowerDots: input.currentWillpowerDots - 1,
    canNoLongerDismiss: true,
  })
})
