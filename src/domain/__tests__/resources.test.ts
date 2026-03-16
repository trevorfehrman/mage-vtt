import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  createResourceTracker,
  spendResource,
  recoverResource,
} from "../resources"

describe("Resources", () => {
  it.effect("creates a resource tracker with current = max", () =>
    Effect.gen(function* () {
      const willpower = yield* createResourceTracker("willpower", 5)

      expect(willpower.name).toBe("willpower")
      expect(willpower.current).toBe(5)
      expect(willpower.max).toBe(5)
    }),
  )

  it.effect("spending reduces current, cannot go below 0", () =>
    Effect.gen(function* () {
      const wp = yield* createResourceTracker("willpower", 5)
      const after = yield* spendResource(wp, 2)

      expect(after.current).toBe(3)
      expect(after.max).toBe(5)

      // Can't spend more than current
      const error = yield* spendResource(after, 4).pipe(Effect.flip)
      expect(error._tag).toBe("InsufficientResource")
    }),
  )

  it.effect("recovering increases current, cannot exceed max", () =>
    Effect.gen(function* () {
      let wp = yield* createResourceTracker("willpower", 5)
      wp = yield* spendResource(wp, 3) // current = 2

      const after = yield* recoverResource(wp, 2)
      expect(after.current).toBe(4)

      // Can't exceed max
      const capped = yield* recoverResource(after, 10)
      expect(capped.current).toBe(5)
    }),
  )

  it.effect("mana respects per-turn spending limit from gnosis", () =>
    Effect.gen(function* () {
      // Gnosis 1: max mana 10, 1 per turn
      const mana = yield* createResourceTracker("mana", 10)
      const after = yield* spendResource(mana, 1, { perTurnLimit: 1 })
      expect(after.current).toBe(9)

      // Can't spend more than per-turn limit
      const error = yield* spendResource(mana, 2, { perTurnLimit: 1 }).pipe(Effect.flip)
      expect(error._tag).toBe("InsufficientResource")
    }),
  )
})
