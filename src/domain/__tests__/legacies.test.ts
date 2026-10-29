import { Option, Schema } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  ATTAINMENT_GATES,
  LEGACIES,
  LEGACY_NAMES,
  attainmentsHeld,
  attainmentsReached,
  findLegacy,
  joinRefusal,
  legaciesOpenTo,
  legacy,
  rulingArcanaWith,
  shortfall,
  toSheetLegacy,
  type LegacyTraits,
} from "../legacies"
import { Legacy } from "../character"

/** A sheet's traits for a prerequisite to read: the named dots, the rest zero. */
const traits = (
  gnosis: number,
  arcana: LegacyTraits["arcana"] = {},
  skills: LegacyTraits["skills"] = {},
): LegacyTraits => ({ gnosis, arcana, skills })

describe("Legacy catalog", () => {
  it("is the book's seven, each once, in the appendix's order", () => {
    expect(LEGACIES.map((l) => l.name)).toEqual([...LEGACY_NAMES])
    expect(new Set(LEGACY_NAMES).size).toBe(7)
    expect(LEGACIES.map((l) => l.page)).toEqual([346, 349, 352, 355, 358, 361, 364])
  })

  it("every Legacy climbs the three gates in order: Gnosis 3, 5, 7", () => {
    for (const l of LEGACIES) {
      expect(l.attainments.map((a) => a.gnosis)).toEqual([...ATTAINMENT_GATES])
    }
  })

  it("the primary Arcanum leads every attainment at 2, then 3, then 4 dots", () => {
    for (const l of LEGACIES) {
      expect(l.attainments.map((a) => a.arcana[0]?.arcanum)).toEqual([l.primary, l.primary, l.primary])
      expect(l.attainments.map((a) => a.arcana[0]?.dots)).toEqual([2, 3, 4])
    }
  })

  it("carries the page's facts: Paths, orders, primaries, the Left-Handed two", () => {
    expect(legacy("Perfected Adept")).toMatchObject({ path: "Obrimos", order: "Adamantine Arrow", primary: "life" })
    expect(legacy("Subtle Ones")).toMatchObject({ path: "Mastigos", order: "Guardians of the Veil", primary: "mind" })
    expect(legacy("Uncrowned Kings")).toMatchObject({ path: "Moros", order: "Free Council", primary: "mind" })
    expect(legacy("Walkers in Mists")).toMatchObject({ path: "Acanthus", order: "Mysterium", primary: "space" })
    expect(legacy("Orphans of Proteus")).toMatchObject({ path: "Thyrsus", primary: "life" })
    expect(legacy("Scelesti")).toMatchObject({ path: "any", primary: "spirit" })
    expect(legacy("Tremere Lich")).toMatchObject({ path: "Moros", primary: "death" })
    expect(LEGACIES.filter((l) => l.leftHanded).map((l) => l.name)).toEqual(["Scelesti", "Tremere Lich"])
  })

  it("names the attainments as the appendix prints them", () => {
    expect(legacy("Perfected Adept").attainments.map((a) => a.name)).toEqual(["Body Temple", "Chi Force", "Perfect Body"])
    expect(legacy("Subtle Ones").attainments.map((a) => a.name)).toEqual(["The Subtle Dance", "False Presence", "Occlude the Mind"])
    expect(legacy("Walkers in Mists").attainments.map((a) => a.name)).toEqual(["Peer into the Mists", "Mist Haven", "Paths Through the Mists"])
    expect(legacy("Uncrowned Kings").attainments.map((a) => a.name)).toEqual(["Nigredo", "Albedo", "Rubedo"])
  })

  it("records the first attainments' Skills, including the Orphans' either/or", () => {
    expect(legacy("Perfected Adept").attainments[0].skills).toEqual([{ _tag: "skill", skill: "athletics", dots: 3 }])
    expect(legacy("Perfected Adept").attainments[1].skills).toEqual([{ _tag: "skill", skill: "brawl", dots: 3 }])
    expect(legacy("Orphans of Proteus").attainments[0].skills).toEqual([
      { _tag: "anyOf", options: [{ skill: "animalKen", dots: 2 }, { skill: "survival", dots: 2 }] },
    ])
  })

  it("the synergistic Arcanum rides at the attainment's own degree, the same one for the 2nd and 3rd", () => {
    // p. 367: the 3rd's rider uses "the same synergistic Arcanum used for the 2nd attainment".
    for (const l of LEGACIES) {
      const [, second, third] = l.attainments
      if (second.synergy !== undefined && third.synergy !== undefined) {
        expect(third.synergy.arcanum).toBe(second.synergy.arcanum)
      }
      for (const a of l.attainments) {
        if (a.synergy !== undefined) expect(a.synergy.dots).toBe(a.arcana[0]?.dots)
      }
    }
    // The Scelesti's 1st carries its own conjunctional rider, Death 2 (p. 362).
    expect(legacy("Scelesti").attainments.map((a) => a.synergy?.arcanum)).toEqual(["death", "time", "time"])
    expect(legacy("Perfected Adept").attainments[1].synergy?.arcanum).toBe("forces")
    expect(legacy("Uncrowned Kings").attainments[2].synergy?.arcanum).toBe("prime")
  })

  it("an open-string lookup misses as a value: a shopped or founded Legacy is not an error", () => {
    expect(findLegacy("Subtle Ones")._tag).toBe("Some")
    expect(findLegacy("Bokor")._tag).toBe("None")
    expect(findLegacy("Totally Made Up")._tag).toBe("None")
  })

  it("a Path's mages are called to its Legacies, an order's to the one it teaches, everyone to the Scelesti", () => {
    expect(legaciesOpenTo("Thyrsus", "Silver Ladder").map((l) => l.name)).toEqual(["Orphans of Proteus", "Scelesti"])
    expect(legaciesOpenTo("Acanthus", "Guardians of the Veil").map((l) => l.name)).toEqual([
      "Subtle Ones", "Walkers in Mists", "Scelesti",
    ])
    expect(legaciesOpenTo("Moros", "Mysterium").map((l) => l.name)).toEqual([
      "Uncrowned Kings", "Walkers in Mists", "Scelesti", "Tremere Lich",
    ])
  })
})

describe("Legacy gates and prerequisites", () => {
  const adept = legacy("Perfected Adept")

  it("Gnosis alone opens the gates, one at 3, two at 5, three at 7", () => {
    expect(attainmentsReached(adept, 2).length).toBe(0)
    expect(attainmentsReached(adept, 3).map((a) => a.name)).toEqual(["Body Temple"])
    expect(attainmentsReached(adept, 6).length).toBe(2)
    expect(attainmentsReached(adept, 7).length).toBe(3)
  })

  it("a shortfall names the first thing missing: Gnosis, then the Arcana, then the Skills", () => {
    const body = adept.attainments[0]
    expect(shortfall(body, traits(2, { life: 2, prime: 1 }, { athletics: 3 }))).toEqual(Option.some("Gnosis 3, currently 2"))
    expect(shortfall(body, traits(3, { life: 1, prime: 1 }, { athletics: 3 }))).toEqual(Option.some("life 2, currently 1"))
    expect(shortfall(body, traits(3, { life: 2 }, { athletics: 3 }))).toEqual(Option.some("prime 1, currently 0"))
    expect(shortfall(body, traits(3, { life: 2, prime: 1 }, { athletics: 2 }))).toEqual(Option.some("athletics 3"))
    expect(shortfall(body, traits(3, { life: 2, prime: 1 }, { athletics: 3 }))).toEqual(Option.none())
  })

  it("an either/or Skill is met by either", () => {
    const skin = legacy("Orphans of Proteus").attainments[0]
    expect(shortfall(skin, traits(3, { life: 2, mind: 1 }, { survival: 2 }))).toEqual(Option.none())
    expect(shortfall(skin, traits(3, { life: 2, mind: 1 }, { animalKen: 2 }))).toEqual(Option.none())
    expect(shortfall(skin, traits(3, { life: 2, mind: 1 }, { animalKen: 1, survival: 1 }))).toEqual(
      Option.some("animalKen 2 or survival 2"),
    )
  })

  it("held attainments need gate and prerequisites both; initiation is the first attainment's", () => {
    expect(attainmentsHeld(adept, traits(7, { life: 4, prime: 1 }, { athletics: 3, brawl: 3 })).length).toBe(3)
    // Gnosis 7 but Life still at 3: Perfect Body waits.
    expect(attainmentsHeld(adept, traits(7, { life: 3, prime: 1 }, { athletics: 3, brawl: 3 })).map((a) => a.name)).toEqual([
      "Body Temple", "Chi Force",
    ])
    expect(joinRefusal(adept, traits(3, { life: 2, prime: 1 }, { athletics: 1 }))).toEqual(Option.some("athletics 3"))
    expect(joinRefusal(adept, traits(3, { life: 2, prime: 1 }, { athletics: 3 }))).toEqual(Option.none())
  })

  it("the primary Arcanum joins the Path's Ruling two, without doubling one already there", () => {
    // Perfected Adept: Life for an Obrimos, whose Ruling are Forces and Prime (p. 345's own example).
    expect(rulingArcanaWith(adept, "Obrimos")).toEqual(["forces", "prime", "life"])
    // Orphans of Proteus: Life is already Thyrsus' own.
    expect(rulingArcanaWith(legacy("Orphans of Proteus"), "Thyrsus")).toEqual(["life", "spirit"])
  })

  it("writes onto the sheet as the sheet's own Legacy shape", () => {
    const written = toSheetLegacy(legacy("Walkers in Mists"))
    expect(written).toEqual({
      name: "Walkers in Mists",
      attainments: ["Peer into the Mists", "Mist Haven", "Paths Through the Mists"],
    })
    expect(Schema.is(Legacy)(written)).toBe(true)
  })
})
