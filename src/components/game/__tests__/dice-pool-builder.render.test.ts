// @vitest-environment jsdom
import { createElement } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest"
import { DicePoolBuilder } from "#/components/game/DicePoolBuilder"
import type { useDicePool } from "#/hooks/use-dice-pool"
import { TRAY_FORM_KEY as KEY } from "#/hooks/use-instrument-form"

/**
 * MAG-47: the tray's two forms. It starts shrunk, the grip flips it, and the
 * viewer's choice is remembered in this browser, so the next mount opens in
 * the form they left.
 */
type DicePoolAPI = ReturnType<typeof useDicePool>

const idlePool = (): DicePoolAPI => {
  const noop = () => {}
  return {
    state: "idle",
    context: {
      components: [],
      poolSize: 0,
      againThreshold: 9,
      isRoteAction: true,
      visibility: "public",
      spendWillpower: false,
      error: null,
    },
    canSpendWillpower: false,
    addComponent: noop,
    removeComponent: noop,
    toggleComponent: noop,
    isComponentActive: () => false,
    setAgainThreshold: noop,
    setRoteAction: noop,
    setSpendWillpower: noop,
    setVisibility: noop,
    roll: async () => {},
    reset: noop,
  } as unknown as DicePoolAPI
}

const mount = () => render(createElement(DicePoolBuilder, { pool: idlePool() }))
const grip = () => screen.getByRole("button", { name: /shrink the tray|show every option/i })

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe("the tray's two forms", () => {
  it("starts shrunk: the count, the options a throw carries, and Roll", () => {
    mount()
    expect(grip().getAttribute("aria-expanded")).toBe("false")
    expect(screen.getByText("chance die")).toBeTruthy()
    expect(screen.getByText("9-ag · Rote")).toBeTruthy()
    expect(screen.queryByText("Sweep")).toBeNull()
  })

  it("opens to every control at the grip, and remembers it", () => {
    mount()
    fireEvent.click(grip())
    expect(grip().getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByText("Sweep")).toBeTruthy()
    expect(window.localStorage.getItem(KEY)).toBe("tall")
  })

  it("mounts in the form the viewer left it", () => {
    window.localStorage.setItem(KEY, "tall")
    mount()
    expect(screen.getByText("Sweep")).toBeTruthy()
    fireEvent.click(grip())
    expect(screen.queryByText("Sweep")).toBeNull()
    expect(window.localStorage.getItem(KEY)).toBe("shrunk")
  })
})
