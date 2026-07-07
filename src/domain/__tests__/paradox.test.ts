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

  it("witness count carries the book's flat +2 — one Sleeper or a crowd (issue #44)", () => {
    // The count is fiction detail the table negotiates; the modifier is the
    // book's flat "+2, one or more Sleepers witnesses the magic" (p. 125).
    const one = calculateParadoxPool({ gnosis: 3, witnessCount: 1 })
    expect(one.totalDice).toBe(4)
    expect(one.modifiers).toEqual([{ source: "Sleeper witnesses (1)", dice: 2 }])

    const crowd = calculateParadoxPool({ gnosis: 3, witnessCount: 12 })
    expect(crowd.totalDice).toBe(4)
    expect(crowd.modifiers).toEqual([{ source: "Sleeper witnesses (12)", dice: 2 }])
  })

  it("witness count takes precedence over the coarse boolean, including zero", () => {
    // The ST pressed the count down to none: the Scene-toggle default stands aside.
    const pool = calculateParadoxPool({
      gnosis: 3,
      sleeperWitnesses: true,
      witnessCount: 0,
    })
    expect(pool.totalDice).toBe(2)
    expect(pool.modifiers).toEqual([])
  })

  it("discretionary modifiers ride the pool verbatim, either direction (issue #44)", () => {
    const pool = calculateParadoxPool({
      gnosis: 3,
      discretionaryModifiers: [
        { source: "Ley line nexus", dice: 2 },
        { source: "Consecrated ground", dice: -1 },
      ],
    })
    // base 2, +2 ley line, -1 ground = 3
    expect(pool.totalDice).toBe(3)
    expect(pool.modifiers).toEqual([
      { source: "Ley line nexus", dice: 2 },
      { source: "Consecrated ground", dice: -1 },
    ])
  })

  it("the pool still floors at zero under heavy discretionary reductions", () => {
    const pool = calculateParadoxPool({
      gnosis: 3,
      discretionaryModifiers: [{ source: "Demesne", dice: -5 }],
    })
    expect(pool.totalDice).toBe(0)
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
