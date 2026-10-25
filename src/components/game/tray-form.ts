import { Array as Arr, Option, Schema } from "effect"
import { WILLPOWER_BONUS_DICE } from "#/domain/willpower-economy"

/**
 * The dice tray's strip words (MAG-47), the pure half: what the shrunk strip
 * says about the options a throw carries, in the tall tray's own words.
 */

/** The options' own words: the tall tray's buttons and the strip both read
 * them here, so the two forms can't name an option differently. */
export const OPTION_WORDS = {
  again: (threshold: number) => `${threshold}-ag`,
  rote: "Rote",
  hidden: "Hidden",
  willpower: `WP +${WILLPOWER_BONUS_DICE}`,
} as const

/** The options a throw carries, as the tall tray reads them. */
const ThrowOptions = Schema.Struct({
  againThreshold: Schema.Number,
  isRoteAction: Schema.Boolean,
  visibility: Schema.Literals(["public", "hidden"]),
  spendWillpower: Schema.Boolean,
})

/** What the strip says about a throw: each option that differs from a plain
 * 10-again public roll, in the tall tray's order and words. */
export const trayOptionWords = (o: typeof ThrowOptions.Type): ReadonlyArray<string> =>
  Arr.getSomes([
    o.againThreshold !== 10 ? Option.some(OPTION_WORDS.again(o.againThreshold)) : Option.none(),
    o.isRoteAction ? Option.some(OPTION_WORDS.rote) : Option.none(),
    o.visibility === "hidden" ? Option.some(OPTION_WORDS.hidden) : Option.none(),
    o.spendWillpower ? Option.some(OPTION_WORDS.willpower) : Option.none(),
  ])
