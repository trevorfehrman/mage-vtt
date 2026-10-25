import { Option, Schema } from "effect"

/**
 * The rail's two instruments' forms, the pure half: the dice tray's **shrunk**
 * strip (one line — the count, the options a throw carries, Roll) and its
 * **tall** tray (every control), MAG-47; the message box's one line and its
 * tall form, MAG-53. The viewer chooses and the choice is theirs, remembered
 * per instrument by `use-instrument-form`; nothing switches it on its own.
 */
export const InstrumentForm = Schema.Literals(["shrunk", "tall"])
export type InstrumentForm = typeof InstrumentForm.Type

/** Owner, 2026-10-23: "much of the time i do not need all these controls". */
export const DEFAULT_INSTRUMENT_FORM: InstrumentForm = "shrunk"

const decodeInstrumentForm = Schema.decodeUnknownOption(InstrumentForm)

/** A stored choice may be missing or stale: anything else reads as the default. */
export const readInstrumentForm = (raw: unknown): InstrumentForm =>
  Option.getOrElse(decodeInstrumentForm(raw), () => DEFAULT_INSTRUMENT_FORM)

export const flipInstrumentForm = (form: InstrumentForm): InstrumentForm =>
  form === "shrunk" ? "tall" : "shrunk"
