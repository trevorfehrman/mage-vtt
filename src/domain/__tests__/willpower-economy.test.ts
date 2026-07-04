import { Effect, Exit } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  InsufficientWillpower,
  spendWillpower,
  WILLPOWER_BONUS_DICE,
} from "../willpower-economy"

describe("willpower economy", () => {
  it.effect("spending a point returns the remainder", () =>
    Effect.gen(function* () {
      expect(yield* spendWillpower(6)).toBe(5)
      expect(yield* spendWillpower(1)).toBe(0)
    }),
  )

  it.effect("spending at 0 fails InsufficientWillpower", () =>
    Effect.gen(function* () {
      const exit = yield* spendWillpower(0).pipe(Effect.exit)

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const fail = exit.cause.reasons.find((r) => r._tag === "Fail") as
          | { error: InsufficientWillpower }
          | undefined
        expect(fail?.error._tag).toBe("InsufficientWillpower")
        expect(fail?.error.current).toBe(0)
      }
    }),
  )

  it("the heroic-effort bonus is +3 dice (page 75)", () => {
    expect(WILLPOWER_BONUS_DICE).toBe(3)
  })
})
