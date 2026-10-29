import { Option } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { legacyPlate, readingOf } from "../legacy-plate-look"
import { legacy, toSheetLegacy } from "#/domain/legacies"

describe("legacyPlate", () => {
  const kings = toSheetLegacy(legacy("Uncrowned Kings"))

  it("a catalog Legacy wears its primary Arcanum and Path; the rungs carry the gates and a reading", () => {
    const plate = legacyPlate(kings, 5)
    expect(plate.name).toBe("Uncrowned Kings")
    expect(plate.primary).toEqual(Option.some("mind"))
    expect(plate.path).toEqual(Option.some("Moros"))
    expect(plate.rungs.map((r) => [r.name, r.gnosis, r.reached])).toEqual([
      ["Nigredo", 3, true],
      ["Albedo", 5, true],
      ["Rubedo", 7, false],
    ])
    expect(plate.rungs.every((r) => Option.isSome(r.reading))).toBe(true)
    expect(plate.held).toBe(2)
  })

  it("Gnosis below the first gate reaches nothing; 7 reaches all", () => {
    expect(legacyPlate(kings, 1).held).toBe(0)
    expect(legacyPlate(kings, 7).held).toBe(3)
  })

  it("the Scelesti call any Path, so the plate wears none", () => {
    expect(legacyPlate(toSheetLegacy(legacy("Scelesti")), 3).path).toEqual(Option.none())
  })

  it("a Legacy the catalog does not know draws its own names without emblems or readings", () => {
    const bokor = legacyPlate({ name: "Bokor", attainments: ["Eyes of the Dead", "Bind the Shade"] }, 3)
    expect(bokor.primary).toEqual(Option.none())
    expect(bokor.path).toEqual(Option.none())
    expect(bokor.rungs.map((r) => r.name)).toEqual(["Eyes of the Dead", "Bind the Shade"])
    expect(bokor.rungs.every((r) => Option.isNone(r.reading))).toBe(true)
    expect(bokor.held).toBe(1)
  })

  it("a reading carries the page's words, its prerequisites as the page prints them, and the rider", () => {
    const orphans = legacy("Orphans of Proteus")
    const skin = readingOf(orphans.attainments[0], orphans.primary, true)
    expect(skin.text.startsWith("The mage gains the ability to regenerate wounds")).toBe(true)
    expect(skin.prerequisites).toBe("Gnosis 3, Life 2 (primary), Mind 1, Animal Ken 2 or Survival 2")
    expect(skin.rider).toEqual(Option.none())
    const gift = readingOf(orphans.attainments[1], orphans.primary, false)
    expect(gift.prerequisites).toBe("Gnosis 5, Life 3")
    expect(Option.getOrThrow(gift.rider).arcanum).toBe("Matter 3")
    expect(Option.getOrThrow(gift.rider).text.startsWith("If the mage also knows Matter 3")).toBe(true)
  })

  it("the prerequisites keep the page's Arcana order (p. 357: Matter before Mind)", () => {
    const kings = legacy("Uncrowned Kings")
    expect(readingOf(kings.attainments[0], kings.primary, true).prerequisites).toBe(
      "Gnosis 3, Matter 1, Mind 2 (primary), Crafts 2, Occult 1",
    )
  })
})
