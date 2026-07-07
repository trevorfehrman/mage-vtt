import { Effect, Schema } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { HealthTrack, healthBox, type HealthBox } from "../damage"
import {
  createHealthTrack,
  applyDamage,
  woundPenalty,
  healDamage,
  healResistantBashing,
  isIncapacitated,
} from "../health"

// Track creation is the module's one effectful door (it can fail on a bad
// size); the rules leaves under test are plain functions (ADR-0014).
const freshTrack = (size: number) => Effect.runSync(createHealthTrack(size))

const severities = (track: ReadonlyArray<HealthBox>) => track.map((b) => b.severity)

describe("Health Track", () => {
  it.effect("track creation rejects sizes outside 1-20", () =>
    Effect.gen(function* () {
      const error = yield* createHealthTrack(0).pipe(Effect.flip)
      expect(error._tag).toBe("HealthTrackError")
    }),
  )

  it("bashing damage fills the leftmost empty box", () => {
    const track = freshTrack(7)

    expect(track).toHaveLength(7)
    expect(track.every((b) => b.severity === "empty" && !b.resistant)).toBe(true)

    const after = applyDamage(track, "bashing")

    expect(after[0]).toEqual(healthBox("bashing"))
    expect(after[1]).toEqual(healthBox("empty"))

    // Apply two more
    const after2 = applyDamage(after, "bashing")
    const after3 = applyDamage(after2, "bashing")

    expect(severities(after3)).toEqual([
      "bashing", "bashing", "bashing", "empty", "empty", "empty", "empty",
    ])
  })

  it("lethal damage sorts left of bashing damage", () => {
    let track = freshTrack(5)

    // Apply 2 bashing then 1 lethal
    track = applyDamage(track, "bashing")
    track = applyDamage(track, "bashing")
    track = applyDamage(track, "lethal")

    // Lethal should be leftmost, then bashing
    expect(severities(track)).toEqual(["lethal", "bashing", "bashing", "empty", "empty"])
  })

  it("aggravated sorts left of lethal and bashing", () => {
    let track = freshTrack(5)

    track = applyDamage(track, "bashing")
    track = applyDamage(track, "lethal")
    track = applyDamage(track, "aggravated")

    expect(severities(track)).toEqual(["aggravated", "lethal", "bashing", "empty", "empty"])
  })

  it("full bashing track + bashing upgrades rightmost bashing to lethal", () => {
    let track = freshTrack(3)

    // Fill with bashing
    track = applyDamage(track, "bashing")
    track = applyDamage(track, "bashing")
    track = applyDamage(track, "bashing")

    expect(severities(track)).toEqual(["bashing", "bashing", "bashing"])

    // Overflow: one more bashing upgrades rightmost to lethal
    track = applyDamage(track, "bashing")

    expect(severities(track)).toEqual(["lethal", "bashing", "bashing"])
  })

  it("full track + lethal upgrades rightmost bashing to lethal", () => {
    let track = freshTrack(3)

    track = applyDamage(track, "bashing")
    track = applyDamage(track, "bashing")
    track = applyDamage(track, "bashing")

    // Apply lethal to a full bashing track
    track = applyDamage(track, "lethal")

    // Rightmost bashing upgraded to lethal, then sorted
    expect(severities(track)).toEqual(["lethal", "bashing", "bashing"])
  })

  it("wound penalty increases as track fills from the right", () => {
    let track = freshTrack(7)

    // No damage = no penalty
    expect(woundPenalty(track)).toBe(0)

    // Fill 4 boxes (3 from last = 5th box) — no penalty yet
    track = applyDamage(track, "bashing")
    track = applyDamage(track, "bashing")
    track = applyDamage(track, "bashing")
    track = applyDamage(track, "bashing")
    expect(woundPenalty(track)).toBe(0)

    // 5th box filled (3rd from last) — penalty -1
    track = applyDamage(track, "bashing")
    expect(woundPenalty(track)).toBe(-1)

    // 6th box (2nd from last) — penalty -2
    track = applyDamage(track, "bashing")
    expect(woundPenalty(track)).toBe(-2)

    // 7th box (last) — penalty -3
    track = applyDamage(track, "bashing")
    expect(woundPenalty(track)).toBe(-3)
  })

  it("healing removes rightmost damage of specified type", () => {
    let track = freshTrack(5)
    track = applyDamage(track, "bashing")
    track = applyDamage(track, "bashing")
    track = applyDamage(track, "lethal")

    // Heal one bashing — rightmost bashing removed
    track = healDamage(track, "bashing")
    const filled = track.filter((b) => b.severity !== "empty").length
    expect(filled).toBe(2) // lethal + 1 bashing remain
  })

  it("incapacitated when last health box is filled", () => {
    let track = freshTrack(3)
    expect(isIncapacitated(track)).toBe(false)

    track = applyDamage(track, "bashing")
    track = applyDamage(track, "bashing")
    expect(isIncapacitated(track)).toBe(false)

    track = applyDamage(track, "bashing")
    expect(isIncapacitated(track)).toBe(true)
  })

  // --- Resistant damage (issue #41): the dot beneath the box ---

  it("resistant damage marks the box it fills", () => {
    const track = applyDamage(freshTrack(5), "bashing", { resistant: true })

    expect(track[0]).toEqual(healthBox("bashing", true))
    expect(track[1]).toEqual(healthBox("empty"))
  })

  it("the resistant dot travels with its wound as the track re-sorts", () => {
    // The book's bookkeeping: a resistant bashing wound moves right as harder
    // damage sorts in front of it, dot and all.
    let track = freshTrack(5)
    track = applyDamage(track, "bashing", { resistant: true })
    track = applyDamage(track, "lethal")
    track = applyDamage(track, "aggravated")

    expect(track[0]).toEqual(healthBox("aggravated"))
    expect(track[1]).toEqual(healthBox("lethal"))
    expect(track[2]).toEqual(healthBox("bashing", true))
  })

  it("resistance is per-wound: siblings of the same severity keep their own dots", () => {
    let track = freshTrack(5)
    track = applyDamage(track, "bashing")
    track = applyDamage(track, "bashing", { resistant: true })
    track = applyDamage(track, "bashing")

    expect(track.map((b) => b.resistant)).toEqual([false, true, false, false, false])
  })

  it("an overflow-upgraded resistant wound keeps its dot", () => {
    let track = freshTrack(2)
    track = applyDamage(track, "bashing", { resistant: true })
    track = applyDamage(track, "bashing", { resistant: true })

    // Overflow: plain bashing upgrades the rightmost resistant bashing to
    // lethal — the wound compounds, its dot stays (issue #41; the ST can
    // hand-edit disagreement).
    track = applyDamage(track, "bashing")

    expect(track[0]).toEqual(healthBox("lethal", true))
    expect(track[1]).toEqual(healthBox("bashing", true))
  })

  it("healing a resistant wound clears its dot with it", () => {
    let track = freshTrack(3)
    track = applyDamage(track, "bashing", { resistant: true })

    track = healDamage(track, "bashing")

    expect(track).toEqual([healthBox("empty"), healthBox("empty"), healthBox("empty")])
  })

  // --- Void's containment undo (issue #43) ---

  it("healResistantBashing clears only Resistant bashing, up to the count", () => {
    const track: ReadonlyArray<HealthBox> = [
      healthBox("lethal"),
      healthBox("bashing", true),
      healthBox("bashing"),
      healthBox("bashing", true),
      healthBox("empty"),
    ]

    const healed = healResistantBashing(track, 2)

    // Both resistant bashing wounds cleared; the plain one and the lethal stay.
    expect(healed).toEqual([
      healthBox("lethal"),
      healthBox("bashing"),
      healthBox("empty"),
      healthBox("empty"),
      healthBox("empty"),
    ])
  })

  it("healResistantBashing clears what exists when asked for more", () => {
    const track: ReadonlyArray<HealthBox> = [
      healthBox("bashing", true),
      healthBox("empty"),
    ]

    expect(healResistantBashing(track, 3)).toEqual([
      healthBox("empty"),
      healthBox("empty"),
    ])
  })

  // --- Stored-shape decoding (issue #41): legacy strings and the pair ---

  it("decodes legacy severity strings as non-resistant boxes, pairs as themselves", () => {
    const track = Schema.decodeUnknownSync(HealthTrack)([
      "lethal",
      { severity: "bashing", resistant: true },
      "empty",
    ])

    expect(track).toEqual([
      healthBox("lethal"),
      healthBox("bashing", true),
      healthBox("empty"),
    ])
  })

  it("rejects a box outside the vocabulary", () => {
    expect(() => Schema.decodeUnknownSync(HealthTrack)(["mangled"])).toThrow()
    expect(() =>
      Schema.decodeUnknownSync(HealthTrack)([{ severity: "bashing" }]),
    ).toThrow()
  })
})
