// @vitest-environment jsdom
import { createElement } from "react"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "@effect/vitest"
import { Felt } from "#/components/game/Felt"

/**
 * MAG-12: the felt is one surface. Its look lives on `.mv-felt` (border, wash,
 * radius, focus ring); each site brings only its own layout, and the tray's
 * tap-to-add rides through as plain div props.
 */
afterEach(cleanup)

describe("Felt", () => {
  it("draws the felt surface and nothing inline", () => {
    const { container } = render(createElement(Felt, null, "dice"))
    const felt = container.firstElementChild as HTMLElement
    expect(felt.tagName).toBe("DIV")
    expect(felt.className).toBe("mv-felt")
    expect(felt.getAttribute("style")).toBeNull()
    expect(felt.textContent).toBe("dice")
  })

  it("keeps a site's layout classes beside the surface", () => {
    const { container } = render(createElement(Felt, { className: "mt-1.5" }))
    expect(container.firstElementChild!.className).toBe("mv-felt mt-1.5")
  })

  it("passes a tray's button props through", () => {
    let taps = 0
    const { container } = render(
      createElement(Felt, {
        role: "button",
        tabIndex: 0,
        title: "Tap the felt to add a die",
        onClick: () => { taps += 1 },
      }),
    )
    const felt = container.firstElementChild as HTMLElement
    expect(felt.getAttribute("role")).toBe("button")
    expect(felt.tabIndex).toBe(0)
    expect(felt.title).toBe("Tap the felt to add a die")
    fireEvent.click(felt)
    expect(taps).toBe(1)
  })
})
