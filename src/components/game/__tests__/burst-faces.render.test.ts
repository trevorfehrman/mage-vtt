// @vitest-environment jsdom
import { createElement } from "react"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "@effect/vitest"
import { BurstFaces } from "#/components/game/BurstFaces"

/**
 * MAG-18, the render half: a chain is one cluster with a tether between each
 * generation, a legacy explosion stands alone, ghosting follows the combined
 * index, eaten ghosts trail, and reduced motion skips the entrance.
 */
afterEach(cleanup)

const values = (root: ParentNode) =>
  [...root.querySelectorAll("[data-face]")].map((d) => d.textContent)

describe("BurstFaces", () => {
  it("draws a chain as one cluster, each child tethered to the die before it", () => {
    const { container } = render(
      createElement(BurstFaces, {
        rolls: [10, 3],
        roteRerolls: [],
        explosions: [
          { value: 10, parentIndex: 0 },
          { value: 8, parentIndex: 2 },
        ],
        again: 10,
        reduced: true,
      }),
    )
    const clusters = [...container.querySelectorAll("[data-burst]")]
    expect(clusters.map((c) => c.getAttribute("data-burst"))).toEqual(["chain", "one"])
    expect(values(clusters[0]!)).toEqual(["10", "10", "8"])
    expect(clusters[0]!.querySelectorAll("[data-tether]")).toHaveLength(2)
    expect(
      [...clusters[0]!.querySelectorAll("[data-generation]")].map((d) => d.getAttribute("data-generation")),
    ).toEqual(["0", "1", "2"])
    expect(clusters[1]!.querySelectorAll("[data-tether]")).toHaveLength(0)
  })

  it("legacy parentless explosions fall back to the inline render, no tethers", () => {
    const { container } = render(
      createElement(BurstFaces, {
        rolls: [10, 8],
        roteRerolls: [],
        explosions: [
          { value: 7, parentIndex: null },
          { value: 9, parentIndex: null },
        ],
        again: 10,
        reduced: true,
      }),
    )
    expect(values(container)).toEqual(["10", "8", "7", "9"])
    expect(container.querySelectorAll("[data-tether]")).toHaveLength(0)
    expect([...container.querySelectorAll("[data-burst]")].every((c) => c.getAttribute("data-burst") === "one")).toBe(true)
  })

  it("ghosts the contained successes with the ghost title, and trails the eaten dice", () => {
    const { container } = render(
      createElement(BurstFaces, {
        rolls: [8, 9],
        roteRerolls: [],
        explosions: [],
        again: 10,
        reduced: true,
        contained: 1,
        ghostTitle: "Contained",
        eaten: 2,
        tone: "paradox",
      }),
    )
    const faces = [...container.querySelectorAll("[data-face]")] as HTMLElement[]
    expect(faces.map((f) => f.textContent)).toEqual(["8", "9", "", ""])
    expect(faces[0]!.style.border).toContain("solid")
    expect(faces[1]!.style.border).toContain("dashed")
    expect(faces[1]!.title).toBe("Contained")
    expect(faces[2]!.style.border).toContain("dashed")
    expect(faces[3]!.style.border).toContain("dashed")
  })

  it("a child enters hidden when motion is on, and stands at once when reduced", () => {
    const props = {
      rolls: [10],
      roteRerolls: [],
      explosions: [{ value: 6, parentIndex: 0 }],
      again: 10,
    }
    const moving = render(createElement(BurstFaces, { ...props, reduced: false })).container
    const still = render(createElement(BurstFaces, { ...props, reduced: true })).container
    const childOf = (root: ParentNode) =>
      root.querySelector('[data-generation="1"]') as HTMLElement
    expect(childOf(moving).style.opacity).toBe("0")
    expect(childOf(still).style.opacity).not.toBe("0")
  })
})
