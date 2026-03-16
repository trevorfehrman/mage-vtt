import { Effect, Schema } from "effect"

// --- Types ---

export class MaintainCheck extends Schema.Class<MaintainCheck>("MaintainCheck")({
  canMaintain: Schema.Boolean,
  penalty: Schema.Number.check(Schema.isInt()),
  activeCount: Schema.Number.check(Schema.isInt()),
  gnosisLimit: Schema.Number.check(Schema.isInt()),
}) {}

export class RelinquishResult extends Schema.Class<RelinquishResult>("RelinquishResult")({
  willpowerDotCost: Schema.Number.check(Schema.isInt()),
  remainingWillpowerDots: Schema.Number.check(Schema.isInt()),
  canNoLongerDismiss: Schema.Boolean,
}) {}

// --- Errors ---

export class SpellControlError extends Schema.TaggedErrorClass<SpellControlError>()(
  "SpellControlError",
  { message: Schema.String },
) {}

// --- Public API ---

export const canMaintainSpell = Effect.fn("SpellControl.canMaintain")(function* (input: {
  gnosis: number
  currentlyMaintained: number
}) {
  // Spells up to gnosis are free. Each beyond gnosis incurs -2 to further casting.
  const excess = Math.max(0, input.currentlyMaintained - input.gnosis + 1)
  const penalty = excess === 0 ? 0 : excess * -2

  return new MaintainCheck({
    canMaintain: true, // you can always maintain, just with penalties
    penalty,
    activeCount: input.currentlyMaintained + 1,
    gnosisLimit: input.gnosis,
  })
})

export const relinquishSpell = Effect.fn("SpellControl.relinquish")(function* (input: {
  currentWillpowerDots: number
}) {
  if (input.currentWillpowerDots <= 0) {
    yield* new SpellControlError({
      message: "Cannot relinquish spell — no Willpower dots to sacrifice",
    })
  }

  return new RelinquishResult({
    willpowerDotCost: 1,
    remainingWillpowerDots: input.currentWillpowerDots - 1,
    canNoLongerDismiss: true,
  })
})
