import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import {
  Cast,
  castPoolAfterParadox,
  containmentCap,
  deriveAccumulator,
  isCommitted,
  isOnStage,
  isUnresolved,
  toGnosisRank,
  waitingOn,
  type CastStatus,
} from "../cast"
import { healthBox, type HealthTrack } from "../damage"
import { CharacterId, SceneId } from "../ids"

/**
 * Pure-leaf tests for the Cast vocabulary (issue #43, ADR-0016): the status
 * ladder's classification predicates, the derived per-(Scene, caster) Paradox
 * accumulator (ADR-0012 — read from resolved Cast history, never a tally),
 * the containment cap, and the climax pool arithmetic.
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

describe("Cast status ladder (ADR-0016)", () => {
  const expectations: ReadonlyArray<
    [CastStatus, { unresolved: boolean; onStage: boolean; committed: boolean; waiting: "storyteller" | "caster" | null }]
  > = [
    ["draft", { unresolved: true, onStage: false, committed: false, waiting: "storyteller" }],
    ["engaged", { unresolved: true, onStage: true, committed: false, waiting: "storyteller" }],
    ["liabilitiesLocked", { unresolved: true, onStage: true, committed: false, waiting: "caster" }],
    ["intentionLocked", { unresolved: true, onStage: true, committed: true, waiting: "storyteller" }],
    ["paradoxRolled", { unresolved: true, onStage: true, committed: true, waiting: "caster" }],
    ["contained", { unresolved: true, onStage: true, committed: true, waiting: "caster" }],
    ["resolved", { unresolved: false, onStage: false, committed: false, waiting: null }],
    ["cancelled", { unresolved: false, onStage: false, committed: false, waiting: null }],
    ["voided", { unresolved: false, onStage: false, committed: false, waiting: null }],
  ]

  it("classifies every rung: unresolved, on stage, committed, and who is waited on", () => {
    for (const [status, expected] of expectations) {
      expect({ status, unresolved: isUnresolved(status) }).toEqual({ status, unresolved: expected.unresolved })
      expect({ status, onStage: isOnStage(status) }).toEqual({ status, onStage: expected.onStage })
      expect({ status, committed: isCommitted(status) }).toEqual({ status, committed: expected.committed })
      expect({ status, waiting: waitingOn(status) }).toEqual({ status, waiting: expected.waiting })
    }
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
      makeCast({ id: "cast-6", status: "contained", updatedAt: 6 }),
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

describe("toGnosisRank", () => {
  it("passes rules-legal ranks through and clamps the fudged edges", () => {
    expect(toGnosisRank(3)).toBe(3)
    expect(toGnosisRank(0)).toBe(1)
    expect(toGnosisRank(10)).toBe(10)
  })
})
