import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import { KnownRote } from "../character"
import { sortRotes } from "../rote-order"

/**
 * Rotes ordered by Arcanum (issue #88): the sheet's Rotes section mirrors the
 * dashboard tiles' canonical order — row-major over the five Realm columns
 * (Prime, Fate, Mind, Spirit, Death, then Forces, Time, Space, Life, Matter) —
 * with ties broken by spell level, then name. Pure leaf, plain-function tests
 * (ADR-0014).
 */

const decodeRote = Schema.decodeUnknownSync(KnownRote)

const rote = (
  name: string,
  spellArcanum: string,
  spellLevel: number,
): KnownRote =>
  decodeRote({
    name,
    spellName: `${name} (spell)`,
    spellArcanum,
    spellLevel,
    order: "Mysterium",
    pool: {
      attribute: "Intelligence",
      skills: ["Occult"],
      arcanum: spellArcanum,
    },
  })

describe("sortRotes", () => {
  it("orders by the dashboard tiles' canonical Arcana order", () => {
    const matter = rote("Alchemist's Touch", "Matter", 1)
    const death = rote("Grim Sight", "Death", 1)
    const prime = rote("Supernal Vision", "Prime", 1)
    const forces = rote("Kinetic Blow", "Forces", 1)

    expect(sortRotes([matter, forces, death, prime]).map((r) => r.name)).toEqual([
      "Supernal Vision", // Prime — first tile
      "Grim Sight", // Death — closes the first row
      "Kinetic Blow", // Forces — opens the second row
      "Alchemist's Touch", // Matter — last tile
    ])
  })

  it("breaks ties within an Arcanum by spell level", () => {
    const three = rote("Quicken Corpse", "Death", 3)
    const one = rote("Grim Sight", "Death", 1)
    const two = rote("Ghost Gate", "Death", 2)

    expect(sortRotes([three, one, two]).map((r) => r.spellLevel)).toEqual([1, 2, 3])
  })

  it("breaks level ties by name — Corvin's Death pair precedes his Matter rote", () => {
    const matter = rote("Rube Goldberg's", "Matter", 1)
    const seal = rote("The Seal of", "Death", 1)
    const clamor = rote("Clamor of the", "Death", 1)

    expect(sortRotes([matter, seal, clamor]).map((r) => r.name)).toEqual([
      "Clamor of the",
      "The Seal of",
      "Rube Goldberg's",
    ])
  })

  it("leaves the input untouched and handles the empty list", () => {
    const matter = rote("Alchemist's Touch", "Matter", 1)
    const death = rote("Grim Sight", "Death", 1)
    const input = [matter, death]

    expect(sortRotes(input)).not.toBe(input)
    expect(input.map((r) => r.name)).toEqual(["Alchemist's Touch", "Grim Sight"])
    expect(sortRotes([])).toEqual([])
  })
})
