import { Effect, Option, Random } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { attainmentGates, SkillKey, specialtyComponent, specialtyComponentName } from "../character"
import { buildPool, rollPool } from "../dice"
import { cycleBox, toggleResistant } from "../health"
import { makeAldousSheet, makeCorvinSheet } from "../testing/fixtures"

/**
 * The record beyond the ratings (P-MAG-15): unspent experience and Mana a
 * turn (MAG-57), Skill Specialties (MAG-58), the words (MAG-61), and the two
 * marking gestures the sheet shares with the Storyteller's form (MAG-63).
 */
describe("CharacterSheet: experience and Mana a turn (MAG-57)", () => {
  it("a row without the column has nothing unspent", () => {
    expect(makeAldousSheet().experience).toBe(0)
  })

  it("a stored balance reads as itself", () => {
    expect(makeAldousSheet({ experienceUnspent: 12 }).experience).toBe(12)
  })

  it("Mana a turn follows Gnosis (Mage p. 76): its own number to 8, then 10, then 15", () => {
    expect(makeAldousSheet({ gnosis: 1 }).manaPerTurn).toBe(1)
    expect(makeAldousSheet({ gnosis: 8 }).manaPerTurn).toBe(8)
    expect(makeAldousSheet({ gnosis: 9 }).manaPerTurn).toBe(10)
    expect(makeAldousSheet({ gnosis: 10 }).manaPerTurn).toBe(15)
  })
})

describe("CharacterSheet: Skill Specialties (MAG-58)", () => {
  it("the SkillKey vocabulary is exactly the sheet's skill keys", () => {
    const sheet = makeAldousSheet()
    const keys = [
      ...Object.keys(sheet.skills.mental),
      ...Object.keys(sheet.skills.physical),
      ...Object.keys(sheet.skills.social),
    ].sort()
    expect([...SkillKey.literals].sort()).toEqual(keys)
  })

  it("a row without the column carries none; a stored list reads back by skill", () => {
    expect(makeAldousSheet().specialties).toEqual([])
    const sheet = makeAldousSheet({
      skillSpecialties: [{ skill: "occult", label: "Goetia" }],
    })
    expect(Option.getOrUndefined(sheet.specialtyFor("occult"))).toEqual({ skill: "occult", label: "Goetia" })
    expect(Option.isNone(sheet.specialtyFor("science"))).toBe(true)
  })

  it("a specialty naming no skill of the sheet's is refused", () => {
    expect(() =>
      makeAldousSheet({ skillSpecialties: [{ skill: "goetia" as never, label: "x" }] }),
    ).toThrow()
  })

  it("the pool names the +1 after the specialty", () => {
    expect(specialtyComponentName({ skill: "occult", label: "Goetia" })).toBe("Specialty: Goetia")
    expect(specialtyComponent({ skill: "occult", label: "Goetia" })).toEqual({
      type: "modifier",
      name: "Specialty: Goetia",
      dots: 1,
    })
  })

  it("the +1 is offered only for a skill that carries a specialty", () => {
    const sheet = makeAldousSheet({ skillSpecialties: [{ skill: "occult", label: "Goetia" }] })
    expect(Option.isSome(sheet.specialtyComponentFor("occult"))).toBe(true)
    expect(Option.isNone(sheet.specialtyComponentFor("science"))).toBe(true)
    expect(Option.isNone(makeAldousSheet().specialtyComponentFor("occult"))).toBe(true)
  })

  it.effect("toggled in, the specialty is one more die in the built pool", () =>
    Effect.gen(function* () {
      const sheet = makeAldousSheet({ skillSpecialties: [{ skill: "occult", label: "Goetia" }] })
      const skill = { type: "skill" as const, name: "Occult", dots: 4 }
      const plus = Option.getOrThrow(sheet.specialtyComponentFor("occult"))
      const without = yield* buildPool([skill])
      const withIt = yield* buildPool([skill, plus])
      expect(withIt.size - without.size).toBe(1)
      const roll = yield* rollPool(withIt).pipe(Random.withSeed("goetia"))
      expect(roll.rolls).toHaveLength(5)
    }),
  )
})

describe("CharacterSheet: Merits (MAG-59)", () => {
  it("a row without the column holds none; a stored list reads back whole, each holding its own entry", () => {
    const bare = makeAldousSheet()
    expect(bare.meritsHeld).toEqual([])
    expect(bare.knowsHighSpeech).toBe(false)
    const sheet = makeAldousSheet({
      merits: [
        { name: "High Speech", dots: 1 },
        { name: "Allies", dots: 2, label: "Police" },
        { name: "Allies", dots: 3, label: "Criminals" },
      ],
    })
    expect(sheet.meritsHeld).toHaveLength(3)
    expect(sheet.knowsHighSpeech).toBe(true)
  })

  it("a Merit outside the catalog, or at no dots, is not representable", () => {
    expect(() => makeAldousSheet({ merits: [{ name: "Unseen Sense" as never, dots: 3 }] })).toThrow()
    expect(() => makeAldousSheet({ merits: [{ name: "Resources", dots: 0 }] })).toThrow()
    expect(() => makeAldousSheet({ merits: [{ name: "Sanctum", dots: 11 }] })).toThrow()
  })

  it("the template character holds High Speech; the bare fixture does not", () => {
    expect(makeCorvinSheet().knowsHighSpeech).toBe(true)
    expect(makeAldousSheet().knowsHighSpeech).toBe(false)
  })

  // The derived numbers read higher (grill 2026-10-27): Aldous is Dexterity 2,
  // Composure 3 (+1 Moros), Strength 2, Stamina 2 — Initiative 6, Speed 9,
  // Size 5, Health 7 on the plain sheet.
  it("Fast Reflexes raises Initiative, Fleet of Foot Speed, Giant Size and so Health", () => {
    const plain = makeAldousSheet()
    expect([plain.initiative, plain.speed, plain.size, plain.health]).toEqual([6, 9, 5, 7])
    const sheet = makeAldousSheet({
      merits: [
        { name: "Fast Reflexes", dots: 2 },
        { name: "Fleet of Foot", dots: 1 },
        { name: "Giant", dots: 4 },
      ],
    })
    expect([sheet.initiative, sheet.speed, sheet.size, sheet.health]).toEqual([8, 10, 6, 8])
  })

  it("Iron Stamina cancels a point of wound penalty a dot, never past zero", () => {
    const hurt = ["lethal", "lethal", "lethal", "lethal", "lethal", "lethal", "empty"] as const
    expect(makeAldousSheet({ healthTrack: hurt }).woundPenalty).toBe(-2)
    expect(makeAldousSheet({ healthTrack: hurt, merits: [{ name: "Iron Stamina", dots: 1 }] }).woundPenalty).toBe(-1)
    expect(makeAldousSheet({ healthTrack: hurt, merits: [{ name: "Iron Stamina", dots: 3 }] }).woundPenalty).toBe(0)
  })
})

describe("CharacterSheet: the words (MAG-61)", () => {
  it("nimbus, legacy, cabal and consilium are absent until written and read back whole", () => {
    const bare = makeAldousSheet()
    expect(bare.nimbus).toBeUndefined()
    expect(bare.legacy).toBeUndefined()
    const sheet = makeAldousSheet({
      nimbus: "Frost on every surface.",
      legacy: { name: "Bokor", attainments: ["Eyes of the Dead"] },
      cabal: "The Hollow Choir",
      consilium: "The Narrows",
    })
    expect(sheet.nimbus).toBe("Frost on every surface.")
    expect(sheet.legacy?.name).toBe("Bokor")
    expect(sheet.legacy?.attainments).toEqual(["Eyes of the Dead"])
    expect(sheet.cabal).toBe("The Hollow Choir")
    expect(sheet.consilium).toBe("The Narrows")
  })

  it("the words list only what is written, in the halo's order", () => {
    expect(makeAldousSheet().words).toEqual([])
    expect(makeAldousSheet({ cabal: "The Hollow Choir", nimbus: "Frost." }).words).toEqual([
      { label: "Nimbus", text: "Frost." },
      { label: "Cabal", text: "The Hollow Choir" },
    ])
  })

  it("attainments open at Gnosis 3, 5 and 7 (p. 93), and a Legacy holds at most three", () => {
    expect(attainmentGates({ name: "Bokor", attainments: ["Eyes", "Bind", "Command"] })).toEqual([
      { name: "Eyes", gnosis: 3 },
      { name: "Bind", gnosis: 5 },
      { name: "Command", gnosis: 7 },
    ])
    expect(attainmentGates({ name: "Bokor", attainments: ["Eyes"] })).toEqual([{ name: "Eyes", gnosis: 3 }])
    expect(() =>
      makeAldousSheet({ legacy: { name: "Bokor", attainments: ["a", "b", "c", "d"] } }),
    ).toThrow()
  })
})

describe("the marking gestures (MAG-63; issue #41, #118)", () => {
  it("a click cycles clear → bashing → lethal → aggravated → clear", () => {
    const clear = { severity: "empty", resistant: false } as const
    const b = cycleBox(clear)
    const l = cycleBox(b)
    const a = cycleBox(l)
    expect([b.severity, l.severity, a.severity]).toEqual(["bashing", "lethal", "aggravated"])
    expect(cycleBox(a)).toEqual(clear)
  })

  it("cycling back to clear drops the Resistant dot; an empty box cannot take one", () => {
    expect(cycleBox({ severity: "aggravated", resistant: true })).toEqual({
      severity: "empty",
      resistant: false,
    })
    expect(toggleResistant({ severity: "empty", resistant: false }).resistant).toBe(false)
    expect(toggleResistant({ severity: "lethal", resistant: false }).resistant).toBe(true)
    expect(toggleResistant({ severity: "lethal", resistant: true }).resistant).toBe(false)
  })
})
