import { describe, expect, it } from "@effect/vitest"
import {
  faceLook,
  poolHasGlyph,
  poolLook,
  shapeClass,
} from "#/components/game/die-look"

/**
 * MAG-13: the unified die's look rules, the pure half (ADR-0014). The owner's
 * four decisions from the 2026-10-22 tour are pinned here: 4px radius, a 1px
 * border INSIDE the box as every die's base outline (rings stay outside as
 * box-shadow), one ghost recipe (own ink, dashed, 45%), and the 20/24 ladder.
 */
describe("the one diamond geometry", () => {
  it("shares box, radius and grid between sizes; only the box changes", () => {
    expect(shapeClass("sm")).toBe("grid size-[20px] place-items-center rounded-[4px]")
    expect(shapeClass("md")).toBe("grid size-[24px] place-items-center rounded-[4px]")
  })
})

describe("pool mode (the FeltDie job)", () => {
  it("colors a sheet die verdigris with a solid inside border", () => {
    expect(poolLook("sheet", false)).toEqual({
      border: "1px solid var(--accent)",
      background: "color-mix(in srgb, var(--accent) 22%, transparent)",
    })
  })

  it("keeps every provenance ink the felt already speaks", () => {
    expect(poolLook("loose", false).border).toBe("1px solid var(--dim)")
    expect(poolLook("willpower", false)).toEqual({
      border: "1px solid var(--ember)",
      background: "var(--ember-glow)",
    })
    // The Tides die is circumstance's: the loose neutral, the glyph says reality
    // (provenance grammar, owner 2026-10-22).
    expect(poolLook("paradox", false)).toEqual(poolLook("loose", false))
    // Reality's base die wears the sheet's green; only the glyph says Paradox.
    expect(poolLook("paradoxBase", false)).toEqual(poolLook("sheet", false))
  })

  it("ghosts in the die's own ink: dashed, transparent, faded", () => {
    expect(poolLook("paradox", true)).toEqual({
      border: "1px dashed var(--dim)",
      background: "transparent",
      opacity: 0.45,
    })
  })

  it("only the Paradox kinds carry the torn-circle glyph", () => {
    expect(poolHasGlyph("paradox")).toBe(true)
    expect(poolHasGlyph("paradoxBase")).toBe(true)
    expect(poolHasGlyph("sheet")).toBe(false)
    expect(poolHasGlyph("loose")).toBe(false)
    expect(poolHasGlyph("willpower")).toBe(false)
  })
})

describe("face mode (the Die job)", () => {
  const face = (v: number, over: Partial<Parameters<typeof faceLook>[0]> = {}) =>
    faceLook({ v, again: 10, chance: false, tone: undefined, ring: undefined, ghost: false, ...over })

  it("fills a success with the success ink; the border is the same ink so the box stays the pool's", () => {
    expect(face(8)).toEqual({
      border: "1px solid var(--rail-success)",
      background: "var(--rail-success)",
      color: "var(--primary-foreground)",
    })
  })

  it("rings an explosive face in accent, outside the box", () => {
    expect(face(10).boxShadow).toBe("0 0 0 1px var(--accent)")
    expect(face(9, { again: 9 }).boxShadow).toBe("0 0 0 1px var(--accent)")
    expect(face(8).boxShadow).toBeUndefined()
  })

  it("outlines a miss with a faint inside border — the die is still a die", () => {
    expect(face(3)).toEqual({
      border: "1px solid var(--dim2)",
      background: "var(--raise)",
      color: "var(--dim)",
    })
  })

  it("reads the chance die from the domain: 1 burns --bad, 10 hits, 8 misses", () => {
    expect(face(1, { chance: true })).toMatchObject({ background: "var(--bad)", border: "1px solid var(--bad)", color: "var(--primary-foreground)" })
    expect(face(10, { chance: true })).toMatchObject({ background: "var(--rail-success)" })
    expect(face(8, { chance: true })).toMatchObject({ background: "var(--raise)" })
  })

  it("tones reality's dice --paradox: fill, ring, and the dim-red miss outline", () => {
    expect(face(8, { tone: "paradox" })).toMatchObject({ background: "var(--paradox)", border: "1px solid var(--paradox)" })
    expect(face(10, { tone: "paradox" }).boxShadow).toBe("0 0 0 1px var(--paradox)")
    expect(face(3, { tone: "paradox" }).border).toBe("1px solid color-mix(in srgb, var(--paradox) 45%, transparent)")
  })

  it("explicit rings win: rote is neutral, exp is the ring ink", () => {
    expect(face(3, { ring: "rote" }).boxShadow).toBe("0 0 0 1px var(--dim2)")
    expect(face(3, { ring: "exp" }).boxShadow).toBe("0 0 0 1px var(--accent)")
    expect(face(3, { ring: "exp", tone: "paradox" }).boxShadow).toBe("0 0 0 1px var(--paradox)")
  })

  it("ghosts with the ONE ghost recipe — a face ghost equals a pool ghost of the same ink", () => {
    expect(face(0, { ghost: true })).toEqual(poolLook("sheet", true))
    // A rolled Paradox face ghost keeps the outcome tone's red: a different axis
    // from the pool die's provenance neutral.
    expect(face(0, { ghost: true, tone: "paradox" })).toEqual({
      border: "1px dashed var(--paradox)",
      background: "transparent",
      opacity: 0.45,
    })
  })
})
