import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import {
  Cast,
  castPoolAfterParadox,
  containmentCap,
  containmentOutlook,
  eatenDice,
  mitigationCap,
  deriveAccumulator,
  isCommitted,
  isOnStage,
  isUnresolved,
  sceneParadoxPips,
  sceneTides,
  stripTides,
  toGnosisRank,
  waitingOn,
  type CastStatus,
} from "../cast"
import { healthBox, type HealthTrack } from "../damage"
import { CharacterId, SceneId } from "../ids"

/**
 * Pure-leaf tests for the Cast vocabulary (issue #43, ADR-0016, ADR-0022): the
 * four-rung ladder's classification predicates and two-colored phases, the
 * Tides seed, the derived per-(Scene, caster) Paradox accumulator (ADR-0012 —
 * read from resolved Cast history, never a tally), the containment cap, and
 * the climax pool arithmetic.
 */

const SCENE = SceneId.make("scene-1")
const OTHER_SCENE = SceneId.make("scene-2")
const CASTER = CharacterId.make("char-aldous")
const OTHER_CASTER = CharacterId.make("char-briar")

const makeCast = (overrides: Partial<typeof Cast.Encoded> = {}): Cast =>
  Schema.decodeUnknownSync(Cast)({
    id: "cast-1",
    sessionId: "session-1",
    characterId: CASTER,
    casterUserId: "user-aldous",
    casterName: "Aldous",
    status: "resolved",
    arcanum: "death",
    level: 2,
    usesMagicalTool: false,
    declaredComponents: [
      { type: "gnosis", name: "Gnosis", dots: 1 },
      { type: "arcanum", name: "Death", dots: 3 },
    ],
    declaredPool: 4,
    spellManaCost: 0,
    sceneId: SCENE,
    updatedAt: 0,
    ...overrides,
  })

describe("Cast status ladder (ADR-0022: the four-rung collapse)", () => {
  const expectations: ReadonlyArray<
    [CastStatus, { unresolved: boolean; onStage: boolean; committed: boolean }]
  > = [
    ["draft", { unresolved: true, onStage: false, committed: false }],
    ["price", { unresolved: true, onStage: true, committed: false }],
    ["paradox", { unresolved: true, onStage: true, committed: true }],
    ["resolved", { unresolved: false, onStage: false, committed: false }],
    ["cancelled", { unresolved: false, onStage: false, committed: false }],
    ["voided", { unresolved: false, onStage: false, committed: false }],
  ]

  it("classifies every rung: unresolved, on stage, committed", () => {
    for (const [status, expected] of expectations) {
      expect({ status, unresolved: isUnresolved(status) }).toEqual({ status, unresolved: expected.unresolved })
      expect({ status, onStage: isOnStage(status) }).toEqual({ status, onStage: expected.onStage })
      expect({ status, committed: isCommitted(status) }).toEqual({ status, committed: expected.committed })
    }
  })
})

describe("waitingOn (ADR-0022: two-colored phases of one rung)", () => {
  const tides = { witnessCount: 2, circumstances: [], priorParadoxRolls: 0 }

  it("a draft waits on the Storyteller — engage or decline", () => {
    expect(waitingOn({ status: "draft" })).toBe("storyteller")
  })

  it("The Price waits on the Storyteller until the fix stamps the Tides", () => {
    expect(waitingOn({ status: "price" })).toBe("storyteller")
  })

  it("The Price waits on the caster once the Tides are stamped — insure, commit, or bail", () => {
    expect(waitingOn({ status: "price", tides })).toBe("caster")
  })

  it("Paradox waits on the Storyteller's own roll button", () => {
    expect(waitingOn({ status: "paradox", tides })).toBe("storyteller")
  })

  it("Paradox waits on the caster once successes are stamped — contain and release", () => {
    expect(waitingOn({ status: "paradox", tides, paradoxSuccesses: 0 })).toBe("caster")
  })

  it("terminals wait on no one", () => {
    expect(waitingOn({ status: "resolved" })).toBeNull()
    expect(waitingOn({ status: "cancelled" })).toBeNull()
    expect(waitingOn({ status: "voided" })).toBeNull()
  })
})

describe("stripTides (MAG-32: the seed a declaring caster reads off the strip)", () => {
  const scene = { witnessCount: 2, circumstances: [{ source: "Ley-line surge", dice: 1 }] }
  const pips = [
    { characterId: "char-a", casterName: "A", accumulator: 3 },
    { characterId: "char-b", casterName: "B", accumulator: 1 },
  ]

  it("reads the Scene's Tides and this caster's pips", () => {
    expect(stripTides(scene, pips, "char-b")).toEqual({
      witnessCount: 2,
      circumstances: [{ source: "Ley-line surge", dice: 1 }],
      priorParadoxRolls: 1,
    })
  })

  it("a caster with no pip has rolled no Paradox this Scene", () => {
    expect(stripTides(scene, pips, "char-c").priorParadoxRolls).toBe(0)
  })

  it("downtime, or a strip still loading, seeds nothing", () => {
    const calm = { witnessCount: 0, circumstances: [], priorParadoxRolls: 0 }
    expect(stripTides(null, pips, "char-a")).toEqual(calm)
    expect(stripTides(undefined, undefined, "char-a")).toEqual(calm)
  })
})

describe("sceneTides (ADR-0022: the scene-owned seed)", () => {
  const scene = {
    id: SCENE,
    witnessCount: 3,
    circumstances: [{ source: "Ley-line surge", dice: 2 }],
  }

  it("reads witnesses and circumstances off the Scene and derives the pips", () => {
    const casts = [
      makeCast({ id: "cast-1", updatedAt: 1 }),
      makeCast({ id: "cast-2", updatedAt: 2 }),
    ]
    expect(sceneTides(casts, scene, CASTER)).toEqual({
      witnessCount: 3,
      circumstances: [{ source: "Ley-line surge", dice: 2 }],
      priorParadoxRolls: 2,
    })
  })

  it("derives the pips per caster, grace and all", () => {
    const casts = [
      makeCast({ id: "cast-1", updatedAt: 1, paradoxIsDramaticFailure: true }),
    ]
    expect(sceneTides(casts, scene, CASTER).priorParadoxRolls).toBe(0)
  })

  it("downtime seeds nothing — no Scene, no Tides", () => {
    const casts = [makeCast({ id: "cast-1", updatedAt: 1 })]
    expect(sceneTides(casts, undefined, CASTER)).toEqual({
      witnessCount: 0,
      circumstances: [],
      priorParadoxRolls: 0,
    })
  })
})

describe("deriveAccumulator (ADR-0012: resolved Cast history, never a tally)", () => {
  it("counts one die per resolved Cast for the same (Scene, caster)", () => {
    const casts = [
      makeCast({ id: "cast-1", updatedAt: 1 }),
      makeCast({ id: "cast-2", updatedAt: 2 }),
    ]
    expect(deriveAccumulator(casts, SCENE, CASTER)).toBe(2)
  })

  it("ignores other scenes, other casters, and non-resolved statuses", () => {
    const casts = [
      makeCast({ id: "cast-1", updatedAt: 1 }),
      makeCast({ id: "cast-2", sceneId: OTHER_SCENE, updatedAt: 2 }),
      makeCast({ id: "cast-3", characterId: OTHER_CASTER, updatedAt: 3 }),
      // A voided Cast leaves no accumulator trace (ADR-0016).
      makeCast({ id: "cast-4", status: "voided", updatedAt: 4 }),
      makeCast({ id: "cast-5", status: "cancelled", updatedAt: 5 }),
      makeCast({ id: "cast-6", status: "paradox", updatedAt: 6 }),
    ]
    expect(deriveAccumulator(casts, SCENE, CASTER)).toBe(1)
  })

  it("accumulates nothing outside a Scene (downtime)", () => {
    const casts = [makeCast({ id: "cast-1", updatedAt: 1 })]
    expect(deriveAccumulator(casts, undefined, CASTER)).toBe(0)
  })

  it("a downtime Cast (no sceneId) never counts toward a Scene's accumulator", () => {
    const encoded: Record<string, unknown> = { ...makeCast({ id: "cast-1", updatedAt: 1 }) }
    delete encoded["sceneId"]
    const downtime = Schema.decodeUnknownSync(Cast)(encoded)
    expect(deriveAccumulator([downtime], SCENE, CASTER)).toBe(0)
  })

  it("forgives the increment of a most-recent dramatic-failure roll (the grace)", () => {
    const casts = [
      makeCast({ id: "cast-1", updatedAt: 1 }),
      makeCast({ id: "cast-2", updatedAt: 2, paradoxIsDramaticFailure: true }),
    ]
    expect(deriveAccumulator(casts, SCENE, CASTER)).toBe(1)
  })

  it("an older dramatic failure grants no grace once a later roll lands", () => {
    const casts = [
      makeCast({ id: "cast-1", updatedAt: 1, paradoxIsDramaticFailure: true }),
      makeCast({ id: "cast-2", updatedAt: 2 }),
    ]
    expect(deriveAccumulator(casts, SCENE, CASTER)).toBe(2)
  })

  it("never goes negative", () => {
    const casts = [makeCast({ id: "cast-1", updatedAt: 1, paradoxIsDramaticFailure: true })]
    expect(deriveAccumulator(casts, SCENE, CASTER)).toBe(0)
  })
})

describe("sceneParadoxPips (issue #44: the strip's per-caster accumulators)", () => {
  it("groups resolved Casts per caster and reports nonzero accumulators only", () => {
    const casts = [
      makeCast({ id: "cast-1", updatedAt: 1 }),
      makeCast({ id: "cast-2", updatedAt: 2 }),
      makeCast({ id: "cast-3", characterId: OTHER_CASTER, casterName: "Briar", updatedAt: 3 }),
      // Terminal-but-not-resolved and other-Scene rows leave no pips.
      makeCast({ id: "cast-4", status: "voided", updatedAt: 4 }),
      makeCast({ id: "cast-5", sceneId: OTHER_SCENE, updatedAt: 5 }),
    ]
    expect(sceneParadoxPips(casts, SCENE)).toEqual([
      { characterId: CASTER, casterName: "Aldous", accumulator: 2 },
      { characterId: OTHER_CASTER, casterName: "Briar", accumulator: 1 },
    ])
  })

  it("applies each caster's dramatic-failure grace independently", () => {
    const casts = [
      // Aldous's only roll was a dramatic failure: accumulator 0, no pip.
      makeCast({ id: "cast-1", updatedAt: 1, paradoxIsDramaticFailure: true }),
      makeCast({ id: "cast-2", characterId: OTHER_CASTER, casterName: "Briar", updatedAt: 2 }),
    ]
    expect(sceneParadoxPips(casts, SCENE)).toEqual([
      { characterId: OTHER_CASTER, casterName: "Briar", accumulator: 1 },
    ])
  })

  it("orders by accumulator descending, then name — a stable strip", () => {
    const casts = [
      makeCast({ id: "cast-1", characterId: OTHER_CASTER, casterName: "Briar", updatedAt: 1 }),
      makeCast({ id: "cast-2", updatedAt: 2 }),
      makeCast({ id: "cast-3", updatedAt: 3 }),
    ]
    expect(sceneParadoxPips(casts, SCENE).map((p) => p.casterName)).toEqual([
      "Aldous",
      "Briar",
    ])
  })

  it("no Scene, no pips (downtime)", () => {
    expect(sceneParadoxPips([makeCast({ id: "cast-1", updatedAt: 1 })], undefined)).toEqual([])
  })
})

describe("containmentCap (the martyr play: last box yes, death no)", () => {
  const track = (empties: number, filled: number): HealthTrack => [
    ...Array.from({ length: filled }, () => healthBox("bashing")),
    ...Array.from({ length: empties }, () => healthBox("empty")),
  ]

  it("caps at the Paradox successes when Health is plentiful", () => {
    expect(containmentCap(track(7, 0), 3)).toBe(3)
  })

  it("caps at the empty boxes when flesh runs short", () => {
    expect(containmentCap(track(2, 5), 4)).toBe(2)
  })

  it("allows the martyr play down to the last box", () => {
    expect(containmentCap(track(1, 6), 5)).toBe(1)
  })

  it("is zero on a full track", () => {
    expect(containmentCap(track(0, 7), 5)).toBe(0)
  })
})

describe("mitigationCap (issue #52: one die per Mana, after the spell takes its cut)", () => {
  it("caps at the pool when Mana is plentiful", () => {
    expect(mitigationCap(4, 10, 2)).toBe(4)
  })

  it("caps at the Mana left once the spell cost is reserved", () => {
    expect(mitigationCap(6, 3, 1)).toBe(2)
  })

  it("a spell cost eating the whole reserve leaves nothing to mitigate with", () => {
    expect(mitigationCap(5, 2, 2)).toBe(0)
  })

  it("clamps at zero when the spell costs more Mana than the caster holds", () => {
    expect(mitigationCap(5, 1, 3)).toBe(0)
  })

  it("a zero pool needs no mitigation regardless of wealth", () => {
    expect(mitigationCap(0, 10, 0)).toBe(0)
  })
})

describe("castPoolAfterParadox", () => {
  it("subtracts one die per uncontained success", () => {
    expect(castPoolAfterParadox(6, 3, 1)).toBe(4)
  })

  it("full containment leaves the declared pool whole", () => {
    expect(castPoolAfterParadox(6, 3, 3)).toBe(6)
  })

  it("may fall to zero or below — the chance die is rollPool's contract", () => {
    expect(castPoolAfterParadox(2, 4, 0)).toBe(-2)
  })
})

describe("eatenDice (the one ghost clamp — the bet's preview and the resolved record, #123)", () => {
  it("counts declared minus surviving, never below zero", () => {
    expect(eatenDice(5, 2)).toBe(3)
    expect(eatenDice(5, 5)).toBe(0)
    expect(eatenDice(3, 3)).toBe(0)
  })

  it("a pool eaten past zero ghosts everything — never more dice than exist", () => {
    expect(eatenDice(2, -3)).toBe(2)
    expect(eatenDice(0, 0)).toBe(0)
  })
})

describe("containmentOutlook (issue #45: the informed bet, double shrink and all)", () => {
  const track = (empties: number, filled: number): HealthTrack => [
    ...Array.from({ length: filled }, () => healthBox("bashing")),
    ...Array.from({ length: empties }, () => healthBox("empty")),
  ]

  it("containing nothing shrinks the pool once — uncontained successes only", () => {
    const outlook = containmentOutlook({
      track: track(7, 0),
      declaredPool: 5,
      paradoxSuccesses: 3,
      contained: 0,
    })
    expect(outlook.damage).toBe(0)
    expect(outlook.uncontained).toBe(3)
    expect(outlook.penaltyAfter).toBe(0)
    expect(outlook.newPenalty).toBe(0)
    expect(outlook.castPool).toBe(2)
    expect(outlook.eaten).toBe(3)
    expect(outlook.martyr).toBe(false)
  })

  it("eaten counts the felt's ghosts and never exceeds the pool", () => {
    // Uncontained 3 + new penalty −1 eats 4 of 5 declared dice.
    const shrunkTwice = containmentOutlook({
      track: track(3, 4),
      declaredPool: 5,
      paradoxSuccesses: 3,
      contained: 1,
    })
    expect(shrunkTwice.eaten).toBe(5 - shrunkTwice.castPool)
    // A pool eaten past zero ghosts everything — never more dice than exist.
    const overrun = containmentOutlook({
      track: track(7, 0),
      declaredPool: 2,
      paradoxSuccesses: 4,
      contained: 0,
    })
    expect(overrun.eaten).toBe(2)
  })

  it("containment into the last three boxes shrinks the pool twice", () => {
    // 4 of 7 boxes filled already: one contained wound lands in the 5th box —
    // the third-from-last — so the bet buys back one uncontained die but
    // costs a new −1 wound penalty: 5 − 2 − 1 = 2.
    const outlook = containmentOutlook({
      track: track(3, 4),
      declaredPool: 5,
      paradoxSuccesses: 3,
      contained: 1,
    })
    expect(outlook.damage).toBe(1)
    expect(outlook.uncontained).toBe(2)
    expect(outlook.penaltyBefore).toBe(0)
    expect(outlook.penaltyAfter).toBe(-1)
    expect(outlook.newPenalty).toBe(-1)
    expect(outlook.castPool).toBe(2)
  })

  it("a pre-existing penalty only counts its worsening as new", () => {
    // 5 of 7 filled: already at −1. Two more contained wounds reach the last
    // box: penalty −3, of which −2 is new. Pool: 6 − 1 − 3 = 2.
    const outlook = containmentOutlook({
      track: track(2, 5),
      declaredPool: 6,
      paradoxSuccesses: 3,
      contained: 2,
    })
    expect(outlook.penaltyBefore).toBe(-1)
    expect(outlook.penaltyAfter).toBe(-3)
    expect(outlook.newPenalty).toBe(-2)
    expect(outlook.castPool).toBe(2)
    expect(outlook.martyr).toBe(true)
  })

  it("the martyr play: filling the last box flags the unconsciousness rule", () => {
    const outlook = containmentOutlook({
      track: track(1, 6),
      declaredPool: 4,
      paradoxSuccesses: 2,
      contained: 1,
    })
    expect(outlook.martyr).toBe(true)
    // Double shrink to the floor and below: 4 − 1 − 3 = 0 — the chance die.
    expect(outlook.castPool).toBe(0)
  })
})

describe("toGnosisRank", () => {
  it("passes rules-legal ranks through and clamps the fudged edges", () => {
    expect(toGnosisRank(3)).toBe(3)
    expect(toGnosisRank(0)).toBe(1)
    expect(toGnosisRank(10)).toBe(10)
  })
})
