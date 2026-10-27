import { describe, expect, it } from "@effect/vitest"
import { attainmentGnosis, SkillKey, specialtyComponentName } from "../character"
import { cycleBox, toggleResistant } from "../health"
import { makeAldousSheet } from "../testing/fixtures"

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
    expect(sheet.specialtyFor("occult")).toEqual({ skill: "occult", label: "Goetia" })
    expect(sheet.specialtyFor("science")).toBeUndefined()
  })

  it("a specialty naming no skill of the sheet's is refused", () => {
    expect(() =>
      makeAldousSheet({ skillSpecialties: [{ skill: "goetia" as never, label: "x" }] }),
    ).toThrow()
  })

  it("the pool names the +1 after the specialty", () => {
    expect(specialtyComponentName({ skill: "occult", label: "Goetia" })).toBe("Specialty: Goetia")
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

  it("attainments open at Gnosis 3, 5 and 7 (p. 93)", () => {
    expect(attainmentGnosis(0)).toBe(3)
    expect(attainmentGnosis(1)).toBe(5)
    expect(attainmentGnosis(2)).toBe(7)
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
