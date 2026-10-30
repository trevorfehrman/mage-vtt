import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { relinquishSpell } from "../spell-control"

describe("Spell Control", () => {
  it.effect("relinquishing a spell costs 1 willpower dot", () =>
    Effect.gen(function* () {
      const result = yield* relinquishSpell({
        currentWillpowerDots: 5,
      })

      expect(result.willpowerDotCost).toBe(1)
      expect(result.remainingWillpowerDots).toBe(4)
      expect(result.canNoLongerDismiss).toBe(true)
    }),
  )

  it.effect("cannot relinquish with 0 willpower dots", () =>
    Effect.gen(function* () {
      const error = yield* relinquishSpell({
        currentWillpowerDots: 0,
      }).pipe(Effect.flip)

      expect(error._tag).toBe("SpellControlError")
    }),
  )
})
