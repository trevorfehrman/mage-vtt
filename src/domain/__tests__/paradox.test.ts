import { describe, expect, it } from "@effect/vitest"
import { calculateParadoxPool, resolveParadox } from "../paradox"

describe("Paradox", () => {
  it("base paradox dice from gnosis table", () => {
    expect(calculateParadoxPool({ gnosis: 1 }).baseDice).toBe(1)
    expect(calculateParadoxPool({ gnosis: 2 }).baseDice).toBe(1)
    expect(calculateParadoxPool({ gnosis: 3 }).baseDice).toBe(2)
    expect(calculateParadoxPool({ gnosis: 5 }).baseDice).toBe(3)
    expect(calculateParadoxPool({ gnosis: 10 }).baseDice).toBe(5)
  })

  it("modifiers: +1 per successive roll, -1 rote, -1 tool, +2 sleeper witnesses", () => {
    const pool = calculateParadoxPool({
      gnosis: 3,
      isRote: true,
      usesMagicalTool: true,
      sleeperWitnesses: true,
      priorParadoxRollsThisScene: 2,
    })

    // base 2, +2 successive, -1 rote, -1 tool, +2 sleepers = 4
    expect(pool.totalDice).toBe(4)
  })

  it("mana mitigation reduces paradox pool", () => {
    const pool = calculateParadoxPool({
      gnosis: 3,
      manaMitigation: 1,
    })

    // base 2, -1 mana = 1
    expect(pool.totalDice).toBe(1)
  })

  it("paradox severity from successes: 1=Havoc, 2=Bedlam, 3=Anomaly, 4=Branding, 5=Manifestation", () => {
    const havoc = resolveParadox(1)
    expect(havoc.severity).toBe("havoc")
    expect(havoc.castingPenalty).toBe(-1)

    const bedlam = resolveParadox(2)
    expect(bedlam.severity).toBe("bedlam")
    expect(bedlam.castingPenalty).toBe(-2)

    const manifestation = resolveParadox(5)
    expect(manifestation.severity).toBe("manifestation")
    expect(manifestation.castingPenalty).toBe(-5)
  })

  it("zero successes means no paradox", () => {
    const none = resolveParadox(0)
    expect(none.severity).toBe("none")
    expect(none.castingPenalty).toBe(0)
  })
})
