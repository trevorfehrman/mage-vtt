import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  createHealthTrack,
  applyDamage,
  woundPenalty,
  type HealthBox,
} from "../health"

describe("Health Track", () => {
  it.effect("bashing damage fills the leftmost empty box", () =>
    Effect.gen(function* () {
      const track = yield* createHealthTrack(7)

      expect(track.boxes).toHaveLength(7)
      expect(track.boxes.every((b: HealthBox) => b === "empty")).toBe(true)

      const after = yield* applyDamage(track, "bashing")

      expect(after.boxes[0]).toBe("bashing")
      expect(after.boxes[1]).toBe("empty")

      // Apply two more
      const after2 = yield* applyDamage(after, "bashing")
      const after3 = yield* applyDamage(after2, "bashing")

      expect(after3.boxes[0]).toBe("bashing")
      expect(after3.boxes[1]).toBe("bashing")
      expect(after3.boxes[2]).toBe("bashing")
      expect(after3.boxes[3]).toBe("empty")
    }),
  )

  it.effect("lethal damage sorts left of bashing damage", () =>
    Effect.gen(function* () {
      let track = yield* createHealthTrack(5)

      // Apply 2 bashing then 1 lethal
      track = yield* applyDamage(track, "bashing")
      track = yield* applyDamage(track, "bashing")
      track = yield* applyDamage(track, "lethal")

      // Lethal should be leftmost, then bashing
      expect(track.boxes[0]).toBe("lethal")
      expect(track.boxes[1]).toBe("bashing")
      expect(track.boxes[2]).toBe("bashing")
      expect(track.boxes[3]).toBe("empty")
    }),
  )

  it.effect("aggravated sorts left of lethal and bashing", () =>
    Effect.gen(function* () {
      let track = yield* createHealthTrack(5)

      track = yield* applyDamage(track, "bashing")
      track = yield* applyDamage(track, "lethal")
      track = yield* applyDamage(track, "aggravated")

      expect(track.boxes[0]).toBe("aggravated")
      expect(track.boxes[1]).toBe("lethal")
      expect(track.boxes[2]).toBe("bashing")
      expect(track.boxes[3]).toBe("empty")
    }),
  )

  it.effect("full bashing track + bashing upgrades rightmost bashing to lethal", () =>
    Effect.gen(function* () {
      let track = yield* createHealthTrack(3)

      // Fill with bashing
      track = yield* applyDamage(track, "bashing")
      track = yield* applyDamage(track, "bashing")
      track = yield* applyDamage(track, "bashing")

      expect(track.boxes).toEqual(["bashing", "bashing", "bashing"])

      // Overflow: one more bashing upgrades rightmost to lethal
      track = yield* applyDamage(track, "bashing")

      expect(track.boxes[0]).toBe("lethal")
      expect(track.boxes[1]).toBe("bashing")
      expect(track.boxes[2]).toBe("bashing")
    }),
  )

  it.effect("full track + lethal upgrades rightmost bashing to lethal", () =>
    Effect.gen(function* () {
      let track = yield* createHealthTrack(3)

      track = yield* applyDamage(track, "bashing")
      track = yield* applyDamage(track, "bashing")
      track = yield* applyDamage(track, "bashing")

      // Apply lethal to a full bashing track
      track = yield* applyDamage(track, "lethal")

      // Rightmost bashing upgraded to lethal, then sorted
      expect(track.boxes[0]).toBe("lethal")
      expect(track.boxes[1]).toBe("bashing")
      expect(track.boxes[2]).toBe("bashing")
    }),
  )

  it.effect("wound penalty increases as track fills from the right", () =>
    Effect.gen(function* () {
      let track = yield* createHealthTrack(7)

      // No damage = no penalty
      expect(yield* woundPenalty(track)).toBe(0)

      // Fill 4 boxes (3 from last = 5th box) — no penalty yet
      track = yield* applyDamage(track, "bashing")
      track = yield* applyDamage(track, "bashing")
      track = yield* applyDamage(track, "bashing")
      track = yield* applyDamage(track, "bashing")
      expect(yield* woundPenalty(track)).toBe(0)

      // 5th box filled (3rd from last) — penalty -1
      track = yield* applyDamage(track, "bashing")
      expect(yield* woundPenalty(track)).toBe(-1)

      // 6th box (2nd from last) — penalty -2
      track = yield* applyDamage(track, "bashing")
      expect(yield* woundPenalty(track)).toBe(-2)

      // 7th box (last) — penalty -3
      track = yield* applyDamage(track, "bashing")
      expect(yield* woundPenalty(track)).toBe(-3)
    }),
  )
})
