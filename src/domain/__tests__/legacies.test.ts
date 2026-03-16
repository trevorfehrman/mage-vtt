import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  LEGACIES,
  canJoinLegacy,
  getAttainmentsForGnosis,
} from "../legacies"

describe("Legacies", () => {
  it.effect("reference data contains example legacies from the book", () =>
    Effect.gen(function* () {
      expect(LEGACIES.length).toBeGreaterThanOrEqual(6)

      const names = LEGACIES.map((l) => l.name)
      expect(names).toContain("Perfected Adept")
      expect(names).toContain("Subtle One")
    }),
  )

  it.effect("each legacy has 3 attainments at gnosis 3, 5, and 7", () =>
    Effect.gen(function* () {
      for (const legacy of LEGACIES) {
        expect(legacy.attainments).toHaveLength(3)
        expect(legacy.attainments[0].gnosisRequirement).toBe(3)
        expect(legacy.attainments[1].gnosisRequirement).toBe(5)
        expect(legacy.attainments[2].gnosisRequirement).toBe(7)
      }
    }),
  )

  it.effect("can join legacy when meeting prerequisites", () =>
    Effect.gen(function* () {
      // Perfected Adept requires Gnosis 3, Life 2 (primary), Prime 1
      const result = yield* canJoinLegacy({
        legacyName: "Perfected Adept",
        gnosis: 3,
        arcana: { life: 2, mind: 1 },
      })

      expect(result.canJoin).toBe(true)
    }),
  )

  it.effect("cannot join legacy without prerequisites", () =>
    Effect.gen(function* () {
      const result = yield* canJoinLegacy({
        legacyName: "Perfected Adept",
        gnosis: 2, // needs 3
        arcana: { life: 2, mind: 1 },
      })

      expect(result.canJoin).toBe(false)
      expect(result.reason).toBeDefined()
    }),
  )

  it.effect("attainments unlock progressively with gnosis", () =>
    Effect.gen(function* () {
      const atGnosis3 = yield* getAttainmentsForGnosis("Perfected Adept", 3, { life: 2, mind: 1 })
      expect(atGnosis3).toHaveLength(1)

      const atGnosis5 = yield* getAttainmentsForGnosis("Perfected Adept", 5, { life: 3, mind: 1 })
      expect(atGnosis5).toHaveLength(2)

      const atGnosis7 = yield* getAttainmentsForGnosis("Perfected Adept", 7, { life: 4, mind: 1 })
      expect(atGnosis7).toHaveLength(3)
    }),
  )
})
