import { Option } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { SceneId } from "#/domain/ids"
import { clockWords, chipOrder } from "../derangement-accordion-look"

describe("the derangement accordion's look (MAG-60)", () => {
  it("lasting ones stand first, then the Bedlam ones, each as marked", () => {
    const names = chipOrder([
      { name: "Depression", hold: { _tag: "scene", sceneId: SceneId.make("s") } },
      { name: "Suspicion", hold: { _tag: "lasting" } },
      { name: "Anxiety", hold: { _tag: "until", expiresAt: 5 } },
      { name: "Phobia", hold: { _tag: "lasting" } },
    ]).map((d) => d.name)
    expect(names).toEqual(["Suspicion", "Phobia", "Depression", "Anxiety"])
  })

  it("the clock in the fewest words", () => {
    expect(clockWords(40 * 60_000, 0)).toEqual(Option.some("40m"))
    expect(clockWords(2 * 3_600_000 + 1, 0)).toEqual(Option.some("2h"))
    expect(clockWords(24 * 3_600_000 + 40_000, 0)).toEqual(Option.some("24h"))
    expect(clockWords(47 * 3_600_000, 0)).toEqual(Option.some("47h"))
    expect(clockWords(5 * 86_400_000, 0)).toEqual(Option.some("5d"))
    expect(clockWords(10, 10)).toEqual(Option.none())
  })
})
