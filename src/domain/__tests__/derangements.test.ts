import { Option } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  DERANGEMENTS,
  DERANGEMENT_PAIRS,
  DerangementName,
  derangement,
  findDerangement,
  partnerOf,
  severeFormOf,
} from "../derangements"

describe("Derangement catalog", () => {
  it("is the book's nine pairs, eighteen names, mild first", () => {
    expect(DERANGEMENT_PAIRS.length).toBe(9)
    expect(DERANGEMENTS.length).toBe(18)
    expect(DERANGEMENTS.slice(0, 9).every((d) => d.severity === "mild")).toBe(true)
    expect(DERANGEMENTS.slice(9).every((d) => d.severity === "severe")).toBe(true)
  })

  it("the pairing is total and symmetric, and crosses severity", () => {
    for (const name of DerangementName.literals) {
      const self = derangement(name)
      const other = derangement(partnerOf(name))
      expect(other.partner).toBe(name)
      expect(other.severity).not.toBe(self.severity)
    }
    expect(partnerOf("Depression")).toBe("Melancholia")
    expect(partnerOf("Fugue")).toBe("Avoidance")
  })

  it("only a mild derangement has a severe form to worsen into", () => {
    expect(severeFormOf("Phobia")).toEqual(Option.some("Hysteria"))
    expect(severeFormOf("Hysteria")).toEqual(Option.none())
  })

  it("the three starred extreme forms are the severe halves of the last three pairs", () => {
    expect(DERANGEMENTS.filter((d) => d.extreme).map((d) => d.name)).toEqual([
      "Schizophrenia", "Multiple Personality", "Fugue",
    ])
  })

  it("carries the Bedlam weaknesses from Mage pp. 269–271", () => {
    expect(derangement("Depression").bedlam).toEqual({ _tag: "arcanum", arcanum: "death", penalty: 1 })
    expect(derangement("Melancholia").bedlam).toEqual({ _tag: "arcanum", arcanum: "death", penalty: 2 })
    expect(derangement("Paranoia").bedlam).toEqual({ _tag: "arcanum", arcanum: "mind", penalty: 2 })
    expect(derangement("Anxiety").bedlam).toEqual({ _tag: "arcanum", arcanum: "fate", penalty: 2 })
    expect(derangement("Vocalization").bedlam).toEqual({ _tag: "arcanum", arcanum: "spirit", penalty: 1 })
    expect(derangement("Hysteria").bedlam).toEqual({ _tag: "fearedSource", penalty: 2 })
    expect(derangement("Megalomania").bedlam).toEqual({ _tag: "wisdomRolls", penalty: 2 })
    expect(derangement("Obsessive Compulsion").bedlam).toEqual({ _tag: "spellcastingElsewhere", penalty: 2 })
    expect(derangement("Irrationality").bedlam._tag).toBe("covertImprobable")
    expect(derangement("Avoidance").bedlam._tag).toBe("cannotTargetAvoided")
    expect(derangement("Fugue").bedlam._tag).toBe("none")
  })

  it("the severe resist rolls that carry a penalty say so", () => {
    expect(derangement("Obsessive Compulsion").resist).toBe("Resolve + Composure at −2")
    expect(derangement("Paranoia").resist).toBe("Resolve + Composure at −2")
    expect(derangement("Depression").resist).toBe("Resolve + Composure")
  })

  it("an open-string lookup misses as a value", () => {
    expect(Option.isSome(findDerangement("Depression"))).toBe(true)
    expect(Option.isNone(findDerangement("Chronic Optimism"))).toBe(true)
  })
})
