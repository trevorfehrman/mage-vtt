import { describe, expect, it } from "@effect/vitest"
import { trayOptionWords } from "#/components/game/tray-form"

/**
 * MAG-47: the strip names the options a throw carries in the tall tray's
 * own words (ADR-0014).
 */
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
