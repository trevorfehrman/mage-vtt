import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  WOD_GENERAL_MERITS,
  validateGeneralMerit,
} from "../general-merits"

describe("General Merits (WoD Core)", () => {
  it.effect("reference data contains mental, physical, and social merits", () =>
    Effect.gen(function* () {
      const mental = WOD_GENERAL_MERITS.filter((m) => m.category === "mental")
      const physical = WOD_GENERAL_MERITS.filter((m) => m.category === "physical")
      const social = WOD_GENERAL_MERITS.filter((m) => m.category === "social")

      expect(mental.length).toBeGreaterThan(3)
      expect(physical.length).toBeGreaterThan(10)
      expect(social.length).toBeGreaterThan(3)

      // Spot check known merits
      expect(WOD_GENERAL_MERITS.find((m) => m.name === "Eidetic Memory")).toBeDefined()
      expect(WOD_GENERAL_MERITS.find((m) => m.name === "Resources")).toBeDefined()
      expect(WOD_GENERAL_MERITS.find((m) => m.name === "Fast Reflexes")).toBeDefined()
    }),
  )

  it.effect("validates attribute prerequisites", () =>
    Effect.gen(function* () {
      // Fast Reflexes requires Dexterity 3
      const valid = yield* validateGeneralMerit({
        meritName: "Fast Reflexes",
        dots: 1,
        attributes: { dexterity: 3 },
        skills: {},
        currentMerits: [],
      })
      expect(valid).toBeUndefined()

      const invalid = yield* validateGeneralMerit({
        meritName: "Fast Reflexes",
        dots: 1,
        attributes: { dexterity: 2 },
        skills: {},
        currentMerits: [],
      }).pipe(Effect.flip)

      expect(invalid._tag).toBe("MeritValidationError")
    }),
  )

  it.effect("validates skill prerequisites", () =>
    Effect.gen(function* () {
      // Disarm requires Dexterity 3 and Weaponry 2
      const valid = yield* validateGeneralMerit({
        meritName: "Disarm",
        dots: 2,
        attributes: { dexterity: 3 },
        skills: { weaponry: 2 },
        currentMerits: [],
      })
      expect(valid).toBeUndefined()

      const invalid = yield* validateGeneralMerit({
        meritName: "Disarm",
        dots: 2,
        attributes: { dexterity: 3 },
        skills: { weaponry: 1 },
        currentMerits: [],
      }).pipe(Effect.flip)

      expect(invalid._tag).toBe("MeritValidationError")
    }),
  )

  it.effect("validates merit prerequisites (Fresh Start requires Fast Reflexes 2)", () =>
    Effect.gen(function* () {
      const valid = yield* validateGeneralMerit({
        meritName: "Fresh Start",
        dots: 1,
        attributes: {},
        skills: {},
        currentMerits: [{ name: "Fast Reflexes", dots: 2 }],
      })
      expect(valid).toBeUndefined()

      const invalid = yield* validateGeneralMerit({
        meritName: "Fresh Start",
        dots: 1,
        attributes: {},
        skills: {},
        currentMerits: [],
      }).pipe(Effect.flip)

      expect(invalid._tag).toBe("MeritValidationError")
    }),
  )

  it.effect("fighting styles are tracked as single merits with dot tiers", () =>
    Effect.gen(function* () {
      const boxing = WOD_GENERAL_MERITS.find((m) => m.name === "Fighting Style: Boxing")
      expect(boxing).toBeDefined()
      expect(boxing!.minDots).toBe(1)
      expect(boxing!.maxDots).toBe(5)
      expect(boxing!.tiers).toHaveLength(5)
      expect(boxing!.tiers![0].name).toBe("Body Blow")
      expect(boxing!.tiers![4].name).toBe("Brutal Blow")
    }),
  )
})
