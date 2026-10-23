import { describe, expect, it } from "@effect/vitest"
import {
  faceLook,
  poolClass,
  poolHasGlyph,
  poolLook,
  settleOpacity,
  shapeClass,
  type PoolInput,
  type PoolKind,
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

describe("pool mode (an unrolled die on the felt)", () => {
  const pool = (kind: PoolKind, over: Partial<PoolInput> = {}) => poolLook({ kind, ghost: false, lit: false, ...over })
  const ghostOf = (kind: PoolKind) => pool(kind, { ghost: true })
  const cls = (kind: PoolKind, reduced: boolean | null, over: Partial<PoolInput> = {}) =>
    poolClass({ kind, ghost: false, lit: false, ...over }, reduced)

  it("colors a sheet die verdigris with a solid inside border", () => {
    expect(pool("sheet")).toEqual({
      border: "1px solid var(--accent)",
      background: "color-mix(in srgb, var(--accent) 22%, transparent)",
    })
  })

  it("keeps every provenance ink the felt already speaks", () => {
    expect(pool("loose").border).toBe("1px solid var(--dim)")
    expect(pool("willpower")).toEqual({
      border: "1px solid var(--will)",
      background: "color-mix(in srgb, var(--will) 45%, transparent)",
    })
    expect(pool("arcanum")).toEqual(pool("loose"))
    // Named, an Arcanum's dice wear its Supernal realm's metal (Death → Stygia).
    expect(pool("arcanum", { arcanum: "Death" })).toEqual({
      border: "1px solid var(--realm-stygia)",
      background: "color-mix(in srgb, var(--realm-stygia) 22%, transparent)",
    })
    // The Tides' dice are a HOLE: red rim, opaque scorch center (the one die
    // darker than the felt), the red burning in from the rim (owner 2026-10-22).
    expect(pool("paradox")).toEqual({
      border: "1px solid var(--paradox)",
      background: "var(--scorch)",
      boxShadow: "inset 0 0 3px 1px color-mix(in srgb, var(--paradox) 70%, transparent)",
    })
    // No die of the mage's carries an inset burn.
    expect(pool("sheet").boxShadow).toBeUndefined()
    expect(pool("willpower").boxShadow).toBeUndefined()
    // High Speech is white: the one ink that is no identity's.
    expect(pool("highSpeech").border).toBe("1px solid var(--ink)")
    // Reality's base die wears the sheet's green, and is a hole too (owner 2026-10-22 evening).
    expect(pool("paradoxBase")).toEqual({
      border: "1px solid var(--accent)",
      background: "var(--scorch)",
      boxShadow: "inset 0 0 3px 1px color-mix(in srgb, var(--accent) 70%, transparent)",
    })
  })

  it("reality's holes name their burn ink and breathe; ghosts and reduced-motion owners get the still burn", () => {
    expect(cls("paradox", false)).toBe("mv-hole-paradox mv-hole-breathe")
    expect(cls("paradox", null)).toBe("mv-hole-paradox mv-hole-breathe")
    expect(cls("paradoxBase", false)).toBe("mv-hole-base mv-hole-breathe")
    expect(cls("paradox", false, { ghost: true })).toBe("mv-hole-paradox")
    expect(cls("paradox", true)).toBe("mv-hole-paradox")
    expect(cls("sheet", false)).toBe("")
    expect(cls("willpower", false)).toBe("")
  })

  it("ghosts in the die's own ink: dashed, transparent, faded", () => {
    expect(ghostOf("paradox")).toEqual({
      border: "1px dashed var(--paradox)",
      background: "transparent",
      opacity: 0.45,
    })
  })

  // MAG-16: the Cast card's group hover (2026-10-22 evening) — every die of
  // the hovered kind glows in its own ink. The old FeltDie held this; the
  // unified die takes it so the pre-roll rungs can move over.
  it("lit, a die of the mage's fills deeper in its own ink and wears a ring and a glow outside the box", () => {
    expect(pool("sheet", { lit: true })).toEqual({
      border: "1px solid var(--accent)",
      background: "color-mix(in srgb, var(--accent) 45%, transparent)",
      boxShadow: "0 0 0 1px var(--accent), 0 0 8px 1px color-mix(in srgb, var(--accent) 70%, transparent)",
    })
    // An Arcanum's lit glow is its realm's metal, like its rim.
    expect(pool("arcanum", { arcanum: "Forces", lit: true }).boxShadow).toBe(
      "0 0 0 1px var(--realm-aether), 0 0 8px 1px color-mix(in srgb, var(--realm-aether) 70%, transparent)",
    )
  })

  it("lit, a hole keeps its scorch and its inset burn and adds the same ring and glow outside", () => {
    expect(pool("paradox", { lit: true })).toEqual({
      border: "1px solid var(--paradox)",
      background: "var(--scorch)",
      boxShadow:
        "inset 0 0 3px 1px color-mix(in srgb, var(--paradox) 70%, transparent), 0 0 0 1px var(--paradox), 0 0 8px 1px color-mix(in srgb, var(--paradox) 70%, transparent)",
    })
    expect(pool("paradoxBase", { lit: true }).background).toBe("var(--scorch)")
  })

  it("a ghost does not light — a price being weighed stays still and faint under the pointer", () => {
    expect(pool("sheet", { ghost: true, lit: true })).toEqual(ghostOf("sheet"))
    expect(pool("paradox", { ghost: true, lit: true })).toEqual(ghostOf("paradox"))
  })

  it("a lit hole holds its breath: the glow is the attention, the breathing stops", () => {
    expect(cls("paradox", false, { lit: true })).toBe("mv-hole-paradox")
    expect(cls("paradoxBase", null, { lit: true })).toBe("mv-hole-base")
    expect(cls("sheet", false, { lit: true })).toBe("")
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

describe("the group hover (the badges work)", () => {
  it("settles the other groups back a step while one is lit", () => {
    expect(settleOpacity("willpower", "sheet")).toBe(0.4)
  })

  it("leaves the lit group, and every group when none is lit, at full strength", () => {
    expect(settleOpacity("willpower", "willpower")).toBe(1)
    expect(settleOpacity(null, "sheet")).toBe(1)
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
    expect(face(0, { ghost: true })).toEqual(poolLook({ kind: "sheet", ghost: true, lit: false }))
    // A rolled Paradox face ghost keeps the outcome tone's red: a different axis
    // from the pool die's provenance neutral.
    expect(face(0, { ghost: true, tone: "paradox" })).toEqual({
      border: "1px dashed var(--paradox)",
      background: "transparent",
      opacity: 0.45,
    })
  })
})
