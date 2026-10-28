import { Option } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  DERANGEMENTS,
  DERANGEMENT_PAIRS,
  DerangementName,
  LASTING,
  bedlamHold,
  pairDepth,
  derangement,
  derangementStands,
  findDerangement,
  holdWords,
  partnerOf,
  severeFormOf,
  standingDerangements,
  weaknessSentence,
  weaknessWords,
  withoutPair,
  type HeldDerangement,
  type Moment,
} from "../derangements"
import { SceneId } from "../ids"
import { makeAldousSheet } from "../testing/fixtures"

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

describe("A held derangement (MAG-60)", () => {
  const at = 1_000_000
  const scene = Option.some(SceneId.make("scene-1"))
  const phobia: HeldDerangement = { name: "Phobia", hold: LASTING }
  const depression: HeldDerangement = { name: "Depression", hold: { _tag: "scene", sceneId: SceneId.make("scene-1") } }
  const anxiety: HeldDerangement = { name: "Anxiety", hold: { _tag: "until", expiresAt: at + 1 } }

  it("a lasting one stands whatever the moment", () => {
    expect(derangementStands(phobia, { wisdom: 6, sceneId: Option.none(), at })).toBe(true)
    expect(derangementStands(phobia, { wisdom: 10, sceneId: Option.none(), at })).toBe(true)
  })

  it("a scene-bound one stands only while that Scene is the open one", () => {
    expect(derangementStands(depression, { wisdom: 7, sceneId: scene, at })).toBe(true)
    expect(derangementStands(depression, { wisdom: 7, sceneId: Option.some(SceneId.make("scene-2")), at })).toBe(false)
    expect(derangementStands(depression, { wisdom: 7, sceneId: Option.none(), at })).toBe(false)
  })

  it("a clocked one stands until its expiry", () => {
    expect(derangementStands(anxiety, { wisdom: 2, sceneId: Option.none(), at })).toBe(true)
    expect(derangementStands(anxiety, { wisdom: 2, sceneId: Option.none(), at: at + 1 })).toBe(false)
  })

  it("standingDerangements keeps the marked order", () => {
    const now: Moment = { wisdom: 6, sceneId: scene, at }
    expect(standingDerangements([anxiety, phobia, depression], now).map((d) => d.name)).toEqual([
      "Anxiety", "Phobia", "Depression",
    ])
  })

  it("the Bedlam mark binds to the Scene at Wisdom 5+ and needs one open", () => {
    expect(bedlamHold(7, scene, at)).toEqual(Option.some({ _tag: "scene", sceneId: "scene-1" }))
    expect(bedlamHold(5, Option.none(), at)).toEqual(Option.none())
  })

  it("the Bedlam mark stamps the Wisdom table's clock at Wisdom 4 and below, scene or no scene", () => {
    expect(bedlamHold(4, Option.none(), at)).toEqual(Option.some({ _tag: "until", expiresAt: at + 2 * 3_600_000 }))
    expect(bedlamHold(2, scene, at)).toEqual(Option.some({ _tag: "until", expiresAt: at + 24 * 3_600_000 }))
  })

  it("taking a name drops its partner too: one pair, one depth", () => {
    expect(withoutPair([phobia, depression, anxiety], "Hysteria")).toEqual([depression, anxiety])
    expect(withoutPair([phobia, depression, anxiety], "Phobia")).toEqual([depression, anxiety])
    expect(withoutPair([phobia, depression, anxiety], "Fugue")).toEqual([phobia, depression, anxiety])
  })

  it("a pair's depth on the sheet is whichever form is held, named by the mild one", () => {
    expect(pairDepth([phobia, depression], "Phobia")).toEqual(Option.some(phobia))
    expect(pairDepth([{ name: "Hysteria", hold: LASTING }], "Phobia")).toEqual(
      Option.some({ name: "Hysteria", hold: LASTING }),
    )
    expect(pairDepth([depression], "Phobia")).toEqual(Option.none())
  })

  it("the Chronicle's words for each hold; Fixation's Bedlam carries the book's note", () => {
    expect(holdWords(phobia, 6)).toBe("lasting")
    expect(holdWords(depression, 7)).toBe("Bedlam, this scene")
    expect(holdWords(anxiety, 2)).toBe("Bedlam, 24 hours")
    expect(holdWords({ name: "Fixation", hold: depression.hold }, 7)).toBe(
      "Bedlam, this scene — runs a die roll's worth of scenes (p. 269)",
    )
  })

  it("a held list decodes through the sheet, and an unknown hold does not", () => {
    const sheet = makeAldousSheet({ derangements: [phobia, { name: "Anxiety", hold: { _tag: "until", expiresAt: 5 } }] })
    expect(sheet.derangementsHeld.map((d) => d.name)).toEqual(["Phobia", "Anxiety"])
    expect(() =>
      makeAldousSheet({ derangements: [{ name: "Phobia", hold: { _tag: "forever" } } as never] }),
    ).toThrow()
  })

  it("the weakness in a few words", () => {
    expect(weaknessWords(derangement("Depression").bedlam)).toBe("−1 Death")
    expect(weaknessWords(derangement("Hysteria").bedlam)).toBe("−2 vs the fear")
    expect(weaknessWords(derangement("Fugue").bedlam)).toBe("")
  })

  it("the weakness as the book's sentence", () => {
    expect(weaknessSentence(derangement("Melancholia").bedlam)).toBe(
      "−2 dice to contest or counter Death magic, and −2 to the Resistance Attribute against it.",
    )
    expect(weaknessSentence(derangement("Avoidance").bedlam)).toBe(
      "The avoided person, place or thing cannot be targeted with magic.",
    )
  })
})
