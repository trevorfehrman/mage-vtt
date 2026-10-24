// @vitest-environment jsdom
import { createElement } from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "@effect/vitest"
import { HealthLine, PoolNumerals } from "#/components/game/CastHeaderStats"
import { makeAldousSheet } from "#/domain/testing/fixtures"

/**
 * MAG-48: the live cast's header carries the caster's depletables. A pending
 * spend reads as the number that would be left, in ember; a box being bet
 * in backlash ghosts in ember.
 */
afterEach(cleanup)

describe("the Cast header's stats", () => {
  it("shows Will and Mana as current/max at rest", () => {
    render(createElement(PoolNumerals, { sheet: makeAldousSheet(), pendingMana: 0, pendingWillpower: 0 }))
    expect(screen.getByTitle("Willpower").textContent).toBe("6/6")
    expect(screen.getByTitle("Mana").textContent).toBe("10/10")
  })

  it("shows a pending spend as what would be left, in ember", () => {
    render(createElement(PoolNumerals, { sheet: makeAldousSheet(), pendingMana: 3, pendingWillpower: 1 }))
    const mana = screen.getByTitle(/^Mana — 3 pending/)
    expect(mana.textContent).toBe("7/10")
    expect(screen.getByText("7").style.color).toBe("var(--ember)")
    expect(screen.getByTitle(/^Willpower — 1 pending/).textContent).toBe("5/6")
  })

  it("ghosts the first empty boxes a backlash bet would fill", () => {
    const { container } = render(
      createElement(HealthLine, {
        track: makeAldousSheet({
          healthTrack: ["bashing", "empty", "empty", "empty", "empty", "empty", "empty"],
        }).healthTrack,
        ghosts: 2,
      }),
    )
    const dashed = [...container.querySelectorAll<HTMLElement>("span.mv-data")].filter(
      (box) => box.style.borderStyle === "dashed",
    )
    expect(dashed).toHaveLength(2)
  })
})
