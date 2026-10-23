import { describe, expect, it } from "@effect/vitest"
import {
  faceLook,
  poolClass,
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
      border: "1px solid var(--will)",
      background: "color-mix(in srgb, var(--will) 45%, transparent)",
    })
    expect(poolLook("arcanum", false)).toEqual(poolLook("loose", false))
    // Named, an Arcanum's dice wear its Supernal realm's metal (Death → Stygia).
    expect(poolLook("arcanum", false, "Death")).toEqual({
      border: "1px solid var(--realm-stygia)",
      background: "color-mix(in srgb, var(--realm-stygia) 22%, transparent)",
    })
    // The Tides' dice are a HOLE: red rim, opaque scorch center (the one die
    // darker than the felt), the red burning in from the rim (owner 2026-10-22).
    expect(poolLook("paradox", false)).toEqual({
      border: "1px solid var(--paradox)",
      background: "var(--scorch)",
      boxShadow: "inset 0 0 3px 1px color-mix(in srgb, var(--paradox) 70%, transparent)",
    })
    // No die of the mage's carries an inset burn.
    expect(poolLook("sheet", false).boxShadow).toBeUndefined()
    expect(poolLook("willpower", false).boxShadow).toBeUndefined()
    // High Speech is white: the one ink that is no identity's.
    expect(poolLook("highSpeech", false).border).toBe("1px solid var(--ink)")
    // Reality's base die wears the sheet's green, and is a hole too (owner 2026-10-22 evening).
    expect(poolLook("paradoxBase", false)).toEqual({
      border: "1px solid var(--accent)",
      background: "var(--scorch)",
      boxShadow: "inset 0 0 3px 1px color-mix(in srgb, var(--accent) 70%, transparent)",
    })
  })

  it("reality's holes name their burn ink and breathe; ghosts and reduced-motion owners get the still burn", () => {
    expect(poolClass("paradox", false, false)).toBe("mv-hole-paradox mv-hole-breathe")
    expect(poolClass("paradox", false, null)).toBe("mv-hole-paradox mv-hole-breathe")
    expect(poolClass("paradoxBase", false, false)).toBe("mv-hole-base mv-hole-breathe")
    expect(poolClass("paradox", true, false)).toBe("mv-hole-paradox")
    expect(poolClass("paradox", false, true)).toBe("mv-hole-paradox")
    expect(poolClass("sheet", false, false)).toBe("")
    expect(poolClass("willpower", false, false)).toBe("")
  })

  it("ghosts in the die's own ink: dashed, transparent, faded", () => {
    expect(poolLook("paradox", true)).toEqual({
      border: "1px dashed var(--paradox)",
      background: "transparent",
      opacity: 0.45,
    })
  })

  it("only an Arcanum's dice carry a glyph; reality's section says whose the red ones are", () => {
    expect(poolHasGlyph("arcanum")).toBe(true)
    expect(poolHasGlyph("paradox")).toBe(false)
    expect(poolHasGlyph("paradoxBase")).toBe(false)
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
