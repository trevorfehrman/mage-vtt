import { describe, expect, it } from "@effect/vitest"
import { BURST_BEAT, burstEntrance, burstPlan } from "#/components/game/burst-look"
import { ringInk } from "#/components/game/die-look"
import { entranceSpring } from "#/components/ui/entrance"

/**
 * MAG-18, the pure half: the burst order with each die's generation, the
 * entrance a child makes out of the die before it, and the tether's ink.
 */
describe("burstPlan", () => {
  it("numbers each die by its generation within its cluster, eaten ghosts trailing", () => {
    const plan = burstPlan({
      rolls: [10, 3],
      roteRerolls: [],
      explosions: [
        { value: 10, parentIndex: 0 },
        { value: 8, parentIndex: 2 },
      ],
      eaten: 1,
      contained: 0,
      chance: false,
    })
    expect(plan).toEqual([
      [
        { value: 10, index: 0, kind: "roll", generation: 0, ghost: false, chance: false, trigger: true },
        { value: 10, index: 2, kind: "explosion", generation: 1, ghost: false, chance: false, ring: "exp", trigger: true },
        { value: 8, index: 3, kind: "explosion", generation: 2, ghost: false, chance: false, ring: "exp", trigger: false },
      ],
      [{ value: 3, index: 1, kind: "roll", generation: 0, ghost: false, chance: false, trigger: false }],
      [{ value: 0, index: 4, kind: "eaten", generation: 0, ghost: true, chance: false, trigger: false }],
    ])
  })

  it("the contained successes ghost from the BURST row's end, misses passed over", () => {
    // Burst order: 10 — 8 (its child), then 3, then 9. Contained 2 ghosts
    // the 9 and the 8 — the last two successes the eye meets walking back.
    const plan = burstPlan({
      rolls: [10, 3, 9],
      roteRerolls: [],
      explosions: [{ value: 8, parentIndex: 0 }],
      eaten: 0,
      contained: 2,
      chance: false,
    })
    expect(plan.flat().map((d) => [d.value, d.ghost])).toEqual([
      [10, false],
      [8, true],
      [3, false],
      [9, true],
    ])
  })

  it("a chance die's 10 is its only success when the bet counts", () => {
    const plan = burstPlan({ rolls: [8], roteRerolls: [], explosions: [], eaten: 0, contained: 1, chance: true })
    expect(plan.flat().map((d) => [d.ghost, d.chance])).toEqual([[false, true]])
  })

  it("legacy parentless explosions stand alone at the row's end, generation 0", () => {
    const plan = burstPlan({
      rolls: [10],
      roteRerolls: [7],
      explosions: [{ value: 9, parentIndex: null }],
      eaten: 0,
      contained: 0,
      chance: false,
    })
    expect(plan).toEqual([
      [{ value: 10, index: 0, kind: "roll", generation: 0, ghost: false, chance: false, trigger: false }],
      [{ value: 7, index: 1, kind: "rote", generation: 0, ghost: false, chance: false, ring: "rote", trigger: false }],
      [{ value: 9, index: 2, kind: "explosion", generation: 0, ghost: false, chance: false, ring: "exp", trigger: false }],
    ])
  })
})

describe("burstEntrance", () => {
  it("the trigger stands; a child springs out of the die before it, each generation a beat later", () => {
    const base = burstEntrance(0, "sm", false)
    expect(base.initial).toBe(false)
    expect(base.transition).toEqual({ duration: 0 })

    const first = burstEntrance(1, "sm", false)
    expect(first.initial).toEqual({ x: -(20 + 12), scale: 0.4, opacity: 0 })
    expect(first.animate).toEqual({ x: 0, scale: 1, opacity: 1 })
    expect(first.transition).toEqual({ ...entranceSpring, delay: 0 })

    const second = burstEntrance(2, "md", false)
    expect(second.initial).toEqual({ x: -(24 + 12), scale: 0.4, opacity: 0 })
    expect(second.transition).toEqual({ ...entranceSpring, delay: BURST_BEAT })
  })

  it("reduced motion: the child simply stands beside its trigger", () => {
    const child = burstEntrance(2, "sm", true)
    expect(child.initial).toBe(false)
    expect(child.animate).toEqual({ x: 0, scale: 1, opacity: 1 })
    expect(child.transition).toEqual({ duration: 0 })
  })
})

describe("ringInk", () => {
  it("is the face's ring ink — and the plate's", () => {
    expect(ringInk(undefined)).toBe("var(--accent)")
    expect(ringInk("paradox")).toBe("var(--paradox)")
  })
})
