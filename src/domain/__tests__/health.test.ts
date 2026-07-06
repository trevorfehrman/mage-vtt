import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import type { HealthBox } from "../damage"
import {
  createHealthTrack,
  applyDamage,
  woundPenalty,
  healDamage,
  isIncapacitated,
} from "../health"

// Track creation is the module's one effectful door (it can fail on a bad
// size); the rules leaves under test are plain functions (ADR-0014).
const freshTrack = (size: number) => Effect.runSync(createHealthTrack(size))

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
    expect(track.every((b: HealthBox) => b === "empty")).toBe(true)

    const after = applyDamage(track, "bashing")

    expect(after[0]).toBe("bashing")
    expect(after[1]).toBe("empty")

    // Apply two more
    const after2 = applyDamage(after, "bashing")
    const after3 = applyDamage(after2, "bashing")

    expect(after3[0]).toBe("bashing")
    expect(after3[1]).toBe("bashing")
    expect(after3[2]).toBe("bashing")
    expect(after3[3]).toBe("empty")
  })

  it("lethal damage sorts left of bashing damage", () => {
    let track = freshTrack(5)

    // Apply 2 bashing then 1 lethal
    track = applyDamage(track, "bashing")
    track = applyDamage(track, "bashing")
    track = applyDamage(track, "lethal")

    // Lethal should be leftmost, then bashing
    expect(track[0]).toBe("lethal")
    expect(track[1]).toBe("bashing")
    expect(track[2]).toBe("bashing")
    expect(track[3]).toBe("empty")
  })

  it("aggravated sorts left of lethal and bashing", () => {
    let track = freshTrack(5)

    track = applyDamage(track, "bashing")
    track = applyDamage(track, "lethal")
    track = applyDamage(track, "aggravated")

    expect(track[0]).toBe("aggravated")
    expect(track[1]).toBe("lethal")
    expect(track[2]).toBe("bashing")
    expect(track[3]).toBe("empty")
  })

  it("full bashing track + bashing upgrades rightmost bashing to lethal", () => {
    let track = freshTrack(3)

    // Fill with bashing
    track = applyDamage(track, "bashing")
    track = applyDamage(track, "bashing")
    track = applyDamage(track, "bashing")

    expect(track).toEqual(["bashing", "bashing", "bashing"])

    // Overflow: one more bashing upgrades rightmost to lethal
    track = applyDamage(track, "bashing")

    expect(track[0]).toBe("lethal")
    expect(track[1]).toBe("bashing")
    expect(track[2]).toBe("bashing")
  })

  it("full track + lethal upgrades rightmost bashing to lethal", () => {
    let track = freshTrack(3)

    track = applyDamage(track, "bashing")
    track = applyDamage(track, "bashing")
    track = applyDamage(track, "bashing")

    // Apply lethal to a full bashing track
    track = applyDamage(track, "lethal")

    // Rightmost bashing upgraded to lethal, then sorted
    expect(track[0]).toBe("lethal")
    expect(track[1]).toBe("bashing")
    expect(track[2]).toBe("bashing")
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
    const filled = track.filter((b: HealthBox) => b !== "empty").length
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
})
