import { Option } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { legacyPlate } from "../legacy-plate-look"
import { legacy, toSheetLegacy } from "#/domain/legacies"

describe("legacyPlate", () => {
  const kings = toSheetLegacy(legacy("Uncrowned Kings"))

  it("a catalog Legacy wears its primary Arcanum and nickname; the rungs carry the gates", () => {
    const plate = legacyPlate(kings, 5)
    expect(plate.name).toBe("Uncrowned Kings")
    expect(plate.primary).toEqual(Option.some("mind"))
    expect(plate.nickname).toEqual(Option.some("Coal-burners"))
    expect(plate.rungs).toEqual([
      { name: "Nigredo", gnosis: 3, reached: true },
      { name: "Albedo", gnosis: 5, reached: true },
      { name: "Rubedo", gnosis: 7, reached: false },
    ])
    expect(plate.held).toBe(2)
  })

  it("Gnosis below the first gate reaches nothing; 7 reaches all", () => {
    expect(legacyPlate(kings, 1).held).toBe(0)
    expect(legacyPlate(kings, 7).held).toBe(3)
  })

  it("a Legacy the catalog does not know draws its own names without an emblem", () => {
    const bokor = legacyPlate({ name: "Bokor", attainments: ["Eyes of the Dead", "Bind the Shade"] }, 3)
    expect(bokor.primary).toEqual(Option.none())
    expect(bokor.nickname).toEqual(Option.none())
    expect(bokor.rungs.map((r) => r.name)).toEqual(["Eyes of the Dead", "Bind the Shade"])
    expect(bokor.held).toBe(1)
  })
})
