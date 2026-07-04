import { Effect, Schema } from "effect"

/**
 * The Willpower economy (PRD #11, issue #12): spending a point of Willpower is
 * the heroic-effort choice — +3 dice on any Roll or cast (page 75). The spend
 * is declared by the player; the bonus and the deduction are the engine's.
 */

/** The dice a spent Willpower point buys (page 75). */
export const WILLPOWER_BONUS_DICE = 3

// --- Errors ---

/**
 * Rules/precondition failure (ADR-0010): a Willpower spend was declared on an
 * empty pool. Raised by `spendWillpower` before any write, so a blocked spend
 * leaves the sheet untouched.
 */
export class InsufficientWillpower extends Schema.TaggedErrorClass<InsufficientWillpower>()(
  "InsufficientWillpower",
  {
    current: Schema.Number,
  },
) {}

// --- Public API ---

/**
 * Spend one Willpower point from a current total: the pure leaf of the
 * Willpower economy. Returns the remainder, or fails `InsufficientWillpower` —
 * a sheet can never go negative or half-update.
 */
export const spendWillpower = Effect.fn("Willpower.spend")(function* (
  current: number,
) {
  if (current < 1) {
    return yield* new InsufficientWillpower({ current })
  }
  return current - 1
})
