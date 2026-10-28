import { Effect, Schema } from "effect"
import type { PoolComponentInput } from "./dice"
import { Destiny } from "./quantities"

/**
 * The Destiny economy (MAG-67; Mage p. 81): a mage with the Destiny Merit has
 * a purse of destiny dice each chapter — twice the dots — "added to any
 * rolls". The player stages pips by hand on the sheet; they land in the pool
 * as a `purse` component, and the roll flow debits the purse on resolve, as
 * Willpower's spend does. The purse refills by the player's own mark
 * (`markSheet`), never by the roll.
 */

/** The component name the staged pips carry — the one string the tray and the record read. */
export const DESTINY_COMPONENT_NAME = "Destiny"

/**
 * Rules/precondition failure (ADR-0010): more Destiny staged than the purse
 * holds. Raised before any write, so a blocked spend leaves the sheet untouched.
 */
export class InsufficientDestiny extends Schema.TaggedError<InsufficientDestiny>()(
  "InsufficientDestiny",
  { current: Schema.Number, asked: Schema.Number },
) {}

/** The pool component the staged pips land: typed `purse`, so the roll flow debits the sheet by its dots. */
export const purseComponent = (dice: number): PoolComponentInput => ({
  type: "purse",
  name: DESTINY_COMPONENT_NAME,
  dots: dice,
})

/** Spend `dice` from the purse: the remainder, or `InsufficientDestiny`. */
export const spendDestiny = Effect.fn("Destiny.spend")(function* (current: Destiny, dice: number) {
  if (dice > current) {
    return yield* new InsufficientDestiny({ current, asked: dice })
  }
  return Destiny.make(current - dice)
})
