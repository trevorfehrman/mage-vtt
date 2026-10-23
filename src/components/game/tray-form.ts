import { Array as Arr, Option, Schema } from "effect"
import { WILLPOWER_BONUS_DICE } from "#/domain/willpower-economy"

/**
 * The dice tray's two forms (MAG-47), the pure half: the **shrunk** strip
 * (one line — the count, the options a throw carries, Roll) and the **tall**
 * tray (every control). The viewer chooses with the grip and the choice is
 * theirs, remembered by `use-tray-form`; nothing switches it on its own.
 */
export const TrayForm = Schema.Literals(["shrunk", "tall"])
export type TrayForm = typeof TrayForm.Type

/** Owner, 2026-10-23: "much of the time i do not need all these controls". */
export const DEFAULT_TRAY_FORM: TrayForm = "shrunk"

const decodeTrayForm = Schema.decodeUnknownOption(TrayForm)

/** A stored choice may be missing or stale: anything else reads as the default. */
export const readTrayForm = (raw: unknown): TrayForm =>
  Option.getOrElse(decodeTrayForm(raw), () => DEFAULT_TRAY_FORM)

export const flipTrayForm = (form: TrayForm): TrayForm =>
  form === "shrunk" ? "tall" : "shrunk"

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
