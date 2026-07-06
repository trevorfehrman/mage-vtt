import { Option } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  LEGACIES,
  canJoinLegacy,
  findLegacy,
  getAttainmentsForGnosis,
} from "../legacies"

// The rules leaves are plain functions (ADR-0014); the name lookup is the one
// thing that can miss, and it returns Option decoded here at the call site.
const perfectedAdept = Option.getOrThrow(findLegacy("Perfected Adept"))

describe("Legacies", () => {
  it("reference data contains example legacies from the book", () => {
    expect(LEGACIES.length).toBeGreaterThanOrEqual(6)

    const names = LEGACIES.map((l) => l.name)
    expect(names).toContain("Perfected Adept")
    expect(names).toContain("Subtle One")
  })

  it("looking up an unknown legacy is a miss, not an answer", () => {
    expect(Option.isNone(findLegacy("Totally Made Up Legacy"))).toBe(true)
  })

  it("each legacy has 3 attainments at gnosis 3, 5, and 7", () => {
    for (const legacy of LEGACIES) {
      expect(legacy.attainments).toHaveLength(3)
      expect(legacy.attainments[0].gnosisRequirement).toBe(3)
      expect(legacy.attainments[1].gnosisRequirement).toBe(5)
      expect(legacy.attainments[2].gnosisRequirement).toBe(7)
    }
  })

  it("can join legacy when meeting prerequisites", () => {
    // Perfected Adept requires Gnosis 3, Life 2 (primary), Mind 1
    const result = canJoinLegacy(perfectedAdept, 3, { life: 2, mind: 1 })

    expect(result.canJoin).toBe(true)
  })

  it("cannot join legacy without prerequisites", () => {
    const result = canJoinLegacy(perfectedAdept, 2 /* needs 3 */, { life: 2, mind: 1 })

    expect(result.canJoin).toBe(false)
    expect(result.reason).toBeDefined()
  })

  it("attainments unlock progressively with gnosis", () => {
    const atGnosis3 = getAttainmentsForGnosis(perfectedAdept, 3, { life: 2, mind: 1 })
    expect(atGnosis3).toHaveLength(1)

    const atGnosis5 = getAttainmentsForGnosis(perfectedAdept, 5, { life: 3, mind: 1 })
    expect(atGnosis5).toHaveLength(2)

    const atGnosis7 = getAttainmentsForGnosis(perfectedAdept, 7, { life: 4, mind: 1 })
    expect(atGnosis7).toHaveLength(3)
  })
})
