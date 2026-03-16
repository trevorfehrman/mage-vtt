import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  canMaintainSpell,
  relinquishSpell,
} from "../spell-control"

describe("Spell Control", () => {
  it.effect("can maintain spells up to gnosis limit without penalty", () =>
    Effect.gen(function* () {
      // Gnosis 2 = 2 free maintained spells
      const ok = yield* canMaintainSpell({ gnosis: 2, currentlyMaintained: 1 })
      expect(ok.canMaintain).toBe(true)
      expect(ok.penalty).toBe(0)

      // At limit
      const atLimit = yield* canMaintainSpell({ gnosis: 2, currentlyMaintained: 2 })
      expect(atLimit.canMaintain).toBe(true)
      expect(atLimit.penalty).toBe(-2) // -2 per spell over gnosis

      // Over limit: gnosis 1, already maintaining 3, casting 4th = 3 over × -2
      const over = yield* canMaintainSpell({ gnosis: 1, currentlyMaintained: 3 })
      expect(over.canMaintain).toBe(true)
      expect(over.penalty).toBe(-6) // 3 spells over × -2
    }),
  )

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
