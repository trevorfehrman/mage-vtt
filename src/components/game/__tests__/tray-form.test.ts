import { describe, expect, it } from "@effect/vitest"
import {
  DEFAULT_TRAY_FORM,
  flipTrayForm,
  readTrayForm,
  trayOptionWords,
} from "#/components/game/tray-form"

/**
 * MAG-47: the dice tray's two forms, the pure half (ADR-0014). The viewer's
 * choice is a stored string that may be missing or stale, so reading it
 * never throws; the strip names the options a throw carries in the tall
 * tray's own words.
 */
describe("the viewer's chosen form", () => {
  it("reads a stored form back", () => {
    expect(readTrayForm("tall")).toBe("tall")
    expect(readTrayForm("shrunk")).toBe("shrunk")
  })

  it("falls back to the default for anything else", () => {
    expect(readTrayForm(null)).toBe(DEFAULT_TRAY_FORM)
    expect(readTrayForm("open")).toBe(DEFAULT_TRAY_FORM)
    expect(readTrayForm(1)).toBe(DEFAULT_TRAY_FORM)
  })

  it("starts shrunk: most throws need none of the tall tray's controls", () => {
    expect(DEFAULT_TRAY_FORM).toBe("shrunk")
  })

  it("flips between the two forms", () => {
    expect(flipTrayForm("shrunk")).toBe("tall")
    expect(flipTrayForm("tall")).toBe("shrunk")
  })
})

describe("the strip's option words", () => {
  const plain = {
    againThreshold: 10,
    isRoteAction: false,
    visibility: "public" as const,
    spendWillpower: false,
  }

  it("says nothing for a plain throw", () => {
    expect(trayOptionWords(plain)).toEqual([])
  })

  it("names every option that differs, in the tall tray's order and words", () => {
    expect(
      trayOptionWords({
        againThreshold: 9,
        isRoteAction: true,
        visibility: "hidden",
        spendWillpower: true,
      }),
    ).toEqual(["9-ag", "Rote", "Hidden", "WP +3"])
  })

  it("names 8-again alone", () => {
    expect(trayOptionWords({ ...plain, againThreshold: 8 })).toEqual(["8-ag"])
  })
})
