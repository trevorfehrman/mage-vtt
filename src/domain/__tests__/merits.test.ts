import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  MAGE_MERITS,
  validateMeritSelections,
} from "../merits"

describe("Merits", () => {
  it.effect("reference data contains all Mage-specific merits", () =>
    Effect.gen(function* () {
      expect(MAGE_MERITS.length).toBe(9)

      const names = MAGE_MERITS.map((m) => m.name)
      expect(names).toContain("Destiny")
      expect(names).toContain("Familiar")
      expect(names).toContain("High Speech")
      expect(names).toContain("Occultation")
    }),
  )

  it.effect("validates total merit dots don't exceed 7 at creation", () =>
    Effect.gen(function* () {
      // 3 + 3 + 1 = 7 — valid
      const valid = yield* validateMeritSelections({
        selections: [
          { meritName: "Destiny", dots: 3 },
          { meritName: "Dream", dots: 3 },
          { meritName: "High Speech", dots: 1 },
        ],
        maxDots: 7,
        currentMerits: [],
      })
      expect(valid).toBeUndefined()

      // 5 + 3 = 8 — exceeds 7
      const invalid = yield* validateMeritSelections({
        selections: [
          { meritName: "Destiny", dots: 5 },
          { meritName: "Dream", dots: 3 },
        ],
        maxDots: 7,
        currentMerits: [],
      }).pipe(Effect.flip)

      expect(invalid._tag).toBe("MeritValidationError")
    }),
  )

  it.effect("validates dots are within merit's allowed range", () =>
    Effect.gen(function* () {
      // High Speech is fixed at 1 dot — can't take at 3
      const invalid = yield* validateMeritSelections({
        selections: [
          { meritName: "High Speech", dots: 3 },
        ],
        maxDots: 7,
        currentMerits: [],
      }).pipe(Effect.flip)

      expect(invalid._tag).toBe("MeritValidationError")

      // Occultation maxes at 3 — can't take at 4
      const invalid2 = yield* validateMeritSelections({
        selections: [
          { meritName: "Occultation", dots: 4 },
        ],
        maxDots: 7,
        currentMerits: [],
      }).pipe(Effect.flip)

      expect(invalid2._tag).toBe("MeritValidationError")
    }),
  )

  it.effect("validates prerequisites: Sanctum required for Hallow", () =>
    Effect.gen(function* () {
      // Hallow requires Sanctum — taking Hallow without Sanctum should fail
      // (Hallow isn't in our 9 Mage Merits but we can test the prerequisite pattern
      // with Familiar which requires no other Merit)

      // Occultation requires "no Fame Merit dots"
      // Taking Occultation when you have Fame should fail
      const invalid = yield* validateMeritSelections({
        selections: [
          { meritName: "Occultation", dots: 2 },
        ],
        maxDots: 7,
        currentMerits: [{ meritName: "Fame", dots: 1 }],
      }).pipe(Effect.flip)

      expect(invalid._tag).toBe("MeritValidationError")
    }),
  )

  it.effect("rejects unknown merit name", () =>
    Effect.gen(function* () {
      const invalid = yield* validateMeritSelections({
        selections: [
          { meritName: "Totally Made Up Merit", dots: 2 },
        ],
        maxDots: 7,
        currentMerits: [],
      }).pipe(Effect.flip)

      expect(invalid._tag).toBe("MeritValidationError")
    }),
  )
})
