// @vitest-environment jsdom
import { createElement } from "react"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "@effect/vitest"
import { UnifiedDie } from "#/components/game/UnifiedDie"
import { shapeClass } from "#/components/game/die-look"

/**
 * MAG-13, the render half: both modes stand in the same box, the face
 * counter-rotates its value, reality's pool die carries the glyph, and a
 * skimmable die is a real button.
 */
afterEach(cleanup)

describe("UnifiedDie", () => {
  it("renders pool and face in the identical box", () => {
    const pool = render(
      createElement(UnifiedDie, { mode: "pool", kind: "sheet", title: "a sheet die", reduced: true }),
    ).container.firstElementChild!
    const face = render(
      createElement(UnifiedDie, { mode: "face", v: 8, again: 10 }),
    ).container.firstElementChild!
    for (const token of shapeClass("sm").split(" ")) {
      expect(pool.classList.contains(token), `pool has ${token}`).toBe(true)
      expect(face.classList.contains(token), `face has ${token}`).toBe(true)
    }
    expect(pool.tagName).toBe("SPAN")
    expect((face as HTMLElement).style.transform).toBe("rotate(45deg)")
    expect(face.textContent).toBe("8")
    expect((face.firstElementChild as HTMLElement).style.transform).toBe("rotate(-45deg)")
  })

  it("steps the ladder together: md is the 24px box in both modes", () => {
    const pool = render(
      createElement(UnifiedDie, { mode: "pool", kind: "loose", title: "t", reduced: true, size: "md" }),
    ).container.firstElementChild!
    const face = render(
      createElement(UnifiedDie, { mode: "face", v: 3, again: 10, size: "md" }),
    ).container.firstElementChild!
    expect(pool.classList.contains("size-[24px]")).toBe(true)
    expect(face.classList.contains("size-[24px]")).toBe(true)
    expect(face.classList.contains("text-[12px]")).toBe(true)
  })

  it("gives an Arcanum's dice its glyph, counter-rotated, and nothing else a glyph", () => {
    const paradox = render(
      createElement(UnifiedDie, { mode: "pool", kind: "arcanum", arcanum: "death", title: "t", reduced: true }),
    ).container
    const sheet = render(
      createElement(UnifiedDie, { mode: "pool", kind: "sheet", title: "t", reduced: true }),
    ).container
    expect(paradox.querySelector("svg")).not.toBeNull()
    expect((paradox.querySelector("svg")!.parentElement as HTMLElement).style.transform).toBe("rotate(-45deg)")
    expect(sheet.querySelector("svg")).toBeNull()
  })

  it("makes a skimmable die a button that skims", () => {
    let skimmed = 0
    const { container } = render(
      createElement(UnifiedDie, {
        mode: "pool", kind: "sheet", title: "skim me", reduced: true, onSkim: () => { skimmed += 1 },
      }),
    )
    const button = container.querySelector("button")!
    expect(button).not.toBeNull()
    expect(button.classList.contains("cursor-pointer")).toBe(true)
    fireEvent.click(button)
    expect(skimmed).toBe(1)
  })

  it("renders a face ghost as an empty diamond with the eaten-die title", () => {
    const ghost = render(
      createElement(UnifiedDie, { mode: "face", v: 0, again: 10, ghost: true }),
    ).container.firstElementChild as HTMLElement
    expect(ghost.textContent).toBe("")
    expect(ghost.title).toContain("never rolled")
    expect(ghost.style.transform).toBe("rotate(45deg)")
  })
})
