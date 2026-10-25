import { describe, expect, it } from "@effect/vitest"
import {
  DEFAULT_INSTRUMENT_FORM,
  flipInstrumentForm,
  readInstrumentForm,
} from "#/components/game/instrument-form"

/**
 * MAG-47/53: the rail instruments' two forms, the pure half (ADR-0014). The
 * viewer's choice is a stored string that may be missing or stale, so
 * reading it never throws.
 */
describe("the viewer's chosen form", () => {
  it("reads a stored form back", () => {
    expect(readInstrumentForm("tall")).toBe("tall")
    expect(readInstrumentForm("shrunk")).toBe("shrunk")
  })

  it("falls back to the default for anything else", () => {
    expect(readInstrumentForm(null)).toBe(DEFAULT_INSTRUMENT_FORM)
    expect(readInstrumentForm("open")).toBe(DEFAULT_INSTRUMENT_FORM)
    expect(readInstrumentForm(1)).toBe(DEFAULT_INSTRUMENT_FORM)
  })

  it("starts shrunk: most throws need none of the tall tray's controls", () => {
    expect(DEFAULT_INSTRUMENT_FORM).toBe("shrunk")
  })

  it("flips between the two forms", () => {
    expect(flipInstrumentForm("shrunk")).toBe("tall")
    expect(flipInstrumentForm("tall")).toBe("shrunk")
  })
})
