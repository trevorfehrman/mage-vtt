import { Effect, Option } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { AttributeKey, SkillKey } from "../trait-keys"
import {
  MERITS,
  MERIT_NAMES,
  creationCost,
  findMerit,
  merit,
  meritsOf,
  ratingAllows,
  ratingText,
  validateMeritSelections,
  diceOf,
  bonusTo,
  unlocks,
  purseOf,
  sourcesOf,
  turns,
  type MeritTraits,
} from "../merits"

describe("Merit catalog", () => {
  it("is total over the closed names, each once, in four families", () => {
    expect(MERITS.map((m) => m.name)).toEqual([...MERIT_NAMES])
    expect(new Set(MERIT_NAMES).size).toBe(MERIT_NAMES.length)
    // Fourteen Awakened Merits (Mage pp. 80–89), the rest the Rulebook's.
    expect(meritsOf("awakened").map((m) => m.name)).toEqual([
      "Artifact", "Destiny", "Dream", "Enhanced Item", "Familiar", "Hallow", "High Speech",
      "Imbued Item", "Library", "Occultation", "Sanctum", "Sleepwalker Retainer", "Thrall",
    ])
    expect(meritsOf("mental").length).toBe(7)
    expect(meritsOf("physical").length).toBe(23)
    expect(meritsOf("social").length).toBe(10)
  })

  it("reads the ratings as the book prints them", () => {
    expect(ratingText(merit("High Speech").rating)).toBe("•")
    expect(ratingText(merit("Occultation").rating)).toBe("• to •••")
    expect(ratingText(merit("Striking Looks").rating)).toBe("•• or ••••")
    expect(ratingText(merit("Familiar").rating)).toBe("••• or ••••")
    expect(ratingText(merit("Artifact").rating)).toBe("••• or higher")
    expect(ratingText(merit("Imbued Item").rating)).toBe("•• or higher")
  })

  it("rating rules: fixed, range, either, at least", () => {
    expect(ratingAllows(merit("High Speech").rating, 1)).toBe(true)
    expect(ratingAllows(merit("High Speech").rating, 2)).toBe(false)
    expect(ratingAllows(merit("Occultation").rating, 3)).toBe(true)
    expect(ratingAllows(merit("Occultation").rating, 4)).toBe(false)
    expect(ratingAllows(merit("Striking Looks").rating, 3)).toBe(false)
    expect(ratingAllows(merit("Striking Looks").rating, 4)).toBe(true)
    expect(ratingAllows(merit("Artifact").rating, 2)).toBe(false)
    expect(ratingAllows(merit("Artifact").rating, 7)).toBe(true)
    // Sanctum: Size and Security, five each (Mage p. 87).
    expect(ratingAllows(merit("Sanctum").rating, 10)).toBe(true)
  })

  it("carries the book's facts: creation-only, named instances, the Fighting Style rungs", () => {
    expect(MERITS.filter((m) => m.creationOnly).map((m) => m.name)).toEqual([
      "Common Sense", "Eidetic Memory", "Encyclopedic Knowledge", "Ambidextrous", "Giant",
    ])
    expect(merit("Allies").instance).toBe("named")
    expect(merit("Status").instance).toBe("named")
    expect(merit("Resources").instance).toBe("single")
    const boxing = merit("Fighting Style: Boxing")
    expect(boxing.tiers?.map((t) => t.name)).toEqual([
      "Body Blow", "Duck and Weave", "Combination Blows", "Haymaker", "Brutal Blow",
    ])
    expect(merit("Fighting Style: Two Weapons").tiers?.length).toBe(4)
    expect(merit("High Speech").page).toEqual({ book: "mage", page: 84 })
    expect(merit("Fast Reflexes").effect).toBe("+1 Initiative per dot.")
  })

  it("an open-string lookup misses as a value", () => {
    expect(findMerit("Danger Sense").pipe((o) => o._tag)).toBe("Some")
    expect(findMerit("Unseen Sense")._tag).toBe("None")
    expect(findMerit("Totally Made Up")._tag).toBe("None")
  })

  it("the fifth dot costs two from the creation budget", () => {
    expect(creationCost(3)).toBe(3)
    expect(creationCost(5)).toBe(6)
  })
})

/** A sheet's traits for a prerequisite to read: zeros, with the named dots set. */
const traits = (
  attributes: Partial<Record<AttributeKey, number>> = {},
  skills: Partial<Record<SkillKey, number>> = {},
): MeritTraits => ({
  attributes: { ...Object.fromEntries(AttributeKey.literals.map((k) => [k, 0])), ...attributes } as Record<AttributeKey, number>,
  skills: { ...Object.fromEntries(SkillKey.literals.map((k) => [k, 0])), ...skills } as Record<SkillKey, number>,
})

describe("Merit creation validation", () => {
  it.effect("accepts a selection within the seven-dot budget", () =>
    Effect.gen(function* () {
      const ok = yield* validateMeritSelections({
        selections: [
          { name: "Destiny", dots: 3 },
          { name: "Dream", dots: 3 },
          { name: "High Speech", dots: 1 },
        ],
        maxDots: 7,
        currentMerits: [],
        traits: traits(),
      })
      expect(ok).toBeUndefined()
    }),
  )

  it.effect("refuses a selection over budget, counting the fifth dot twice", () =>
    Effect.gen(function* () {
      // 5 dots cost 6, plus 2 = 8
      const err = yield* validateMeritSelections({
        selections: [
          { name: "Destiny", dots: 5 },
          { name: "Danger Sense", dots: 2 },
        ],
        maxDots: 7,
        currentMerits: [],
        traits: traits(),
      }).pipe(Effect.flip)
      expect(err._tag).toBe("MeritValidationError")
      expect(err.message).toContain("8")
    }),
  )

  it.effect("refuses dots outside the rating", () =>
    Effect.gen(function* () {
      const err = yield* validateMeritSelections({
        selections: [{ name: "High Speech", dots: 3 }],
        maxDots: 7,
        currentMerits: [],
        traits: traits(),
      }).pipe(Effect.flip)
      expect(err.message).toBe("High Speech is rated •, not •••")
    }),
  )

  it.effect("attribute and skill prerequisites read the traits; unrated is zero", () =>
    Effect.gen(function* () {
      const ok = yield* validateMeritSelections({
        selections: [{ name: "Disarm", dots: 2 }],
        maxDots: 7,
        currentMerits: [],
        traits: traits({ dexterity: 3 }, { weaponry: 2 }),
      })
      expect(ok).toBeUndefined()

      const err = yield* validateMeritSelections({
        selections: [{ name: "Disarm", dots: 2 }],
        maxDots: 7,
        currentMerits: [],
        traits: traits({ dexterity: 3 }),
      }).pipe(Effect.flip)
      expect(err.message).toBe("Disarm requires weaponry 2")
    }),
  )

  it.effect("Iron Stamina takes Stamina 3 or Resolve 3", () =>
    Effect.gen(function* () {
      const ok = yield* validateMeritSelections({
        selections: [{ name: "Iron Stamina", dots: 1 }],
        maxDots: 7,
        currentMerits: [],
        traits: traits({ resolve: 3 }),
      })
      expect(ok).toBeUndefined()

      const err = yield* validateMeritSelections({
        selections: [{ name: "Iron Stamina", dots: 1 }],
        maxDots: 7,
        currentMerits: [],
        traits: traits({ stamina: 2, resolve: 2 }),
      }).pipe(Effect.flip)
      expect(err.message).toBe("Iron Stamina requires stamina or resolve 3")
    }),
  )

  it.effect("Merit prerequisites count Merits held and Merits selected together", () =>
    Effect.gen(function* () {
      // Hallow needs a Sanctum — one selected alongside counts
      const ok = yield* validateMeritSelections({
        selections: [
          { name: "Sanctum", dots: 1 },
          { name: "Hallow", dots: 2 },
        ],
        maxDots: 7,
        currentMerits: [],
        traits: traits(),
      })
      expect(ok).toBeUndefined()

      const err = yield* validateMeritSelections({
        selections: [{ name: "Hallow", dots: 2 }],
        maxDots: 7,
        currentMerits: [],
        traits: traits(),
      }).pipe(Effect.flip)
      expect(err.message).toBe("Hallow requires Sanctum 1")

      // Fresh Start needs Fast Reflexes at two dots, not one
      const low = yield* validateMeritSelections({
        selections: [{ name: "Fresh Start", dots: 1 }],
        maxDots: 7,
        currentMerits: [{ name: "Fast Reflexes", dots: 1 }],
        traits: traits(),
      }).pipe(Effect.flip)
      expect(low.message).toBe("Fresh Start requires Fast Reflexes 2")
    }),
  )

  it.effect("Occultation cannot be taken with Fame", () =>
    Effect.gen(function* () {
      const err = yield* validateMeritSelections({
        selections: [{ name: "Occultation", dots: 2 }],
        maxDots: 7,
        currentMerits: [{ name: "Fame", dots: 1 }],
        traits: traits(),
      }).pipe(Effect.flip)
      expect(err.message).toBe("Occultation cannot be taken with Fame")
    }),
  )
})

// --- The typed mechanic (MAG-59 grill, 2026-10-27): what the app can act on ---

describe("Merit mechanic: the dice a turned key adds", () => {
  it("Danger Sense turns for two dice; a story Merit turns for none and does not turn", () => {
    expect(diceOf({ name: "Danger Sense", dots: 2 })).toBe(2)
    expect(turns({ name: "Danger Sense", dots: 2 })).toBe(true)
    expect(diceOf({ name: "Barfly", dots: 1 })).toBe(0)
    expect(turns({ name: "Barfly", dots: 1 })).toBe(false)
  })
})

describe("Merit mechanic: dice by dots, and the numbers that read higher", () => {
  it("Status adds a die a dot; Striking Looks adds one at •• and two at ••••", () => {
    expect(diceOf({ name: "Status", dots: 3, label: "Mysterium" })).toBe(3)
    expect(diceOf({ name: "Striking Looks", dots: 2 })).toBe(1)
    expect(diceOf({ name: "Striking Looks", dots: 4 })).toBe(2)
  })

  it("a sheet's holdings raise a derived number: Fast Reflexes •• is +2 Initiative, Giant is +1 Size, Iron Stamina cancels wound penalty a dot", () => {
    const held = [
      { name: "Fast Reflexes", dots: 2 },
      { name: "Giant", dots: 4 },
      { name: "Iron Stamina", dots: 1 },
      { name: "Barfly", dots: 1 },
    ] as const
    expect(bonusTo(held, "initiative")).toBe(2)
    expect(bonusTo(held, "size")).toBe(1)
    expect(bonusTo(held, "woundPenalty")).toBe(1)
    expect(bonusTo(held, "speed")).toBe(0)
    // the sources, for the sheet's few words: "Fast Reflexes +2"
    expect(sourcesOf(held, "initiative")).toEqual([{ held: { name: "Fast Reflexes", dots: 2 }, bonus: 2 }])
    expect(sourcesOf(held, "speed")).toEqual([])
  })
})

describe("Merit mechanic: the gate and the purse", () => {
  it("a sheet unlocks High Speech by holding a Merit whose mechanic gates the chant, not by its name", () => {
    expect(unlocks([{ name: "High Speech", dots: 1 }], "highSpeech")).toBe(true)
    expect(unlocks([{ name: "Resources", dots: 2 }], "highSpeech")).toBe(false)
    expect(unlocks([], "highSpeech")).toBe(false)
  })

  it("Destiny •• is a purse of four; a sheet without a purse Merit has none", () => {
    const held = [{ name: "Resources", dots: 2 }, { name: "Destiny", dots: 2 }] as const
    expect(Option.getOrNull(purseOf(held))).toEqual({ held: { name: "Destiny", dots: 2 }, capacity: 4 })
    expect(Option.isNone(purseOf([{ name: "Resources", dots: 2 }]))).toBe(true)
    expect(turns({ name: "Destiny", dots: 2 })).toBe(true)
  })
})
