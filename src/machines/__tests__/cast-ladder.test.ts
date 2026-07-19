import { describe, expect, test } from "@effect/vitest"
import { createActor } from "xstate"
import type { CastEntry } from "#/domain/activity"
import { CastStatus } from "#/domain/cast"
import { castLadderMachine, ladderControls, ladderRung } from "../cast-ladder"
import type { Id } from "../../../convex/_generated/dataModel"

/**
 * Projection tests (issue #43, ADR-0022): Cast document snapshot in →
 * machine/UI state out, including rehydration mid-ladder — the machine never
 * owns pending state, so any snapshot must land it on the document's rung
 * directly. The two-colored rungs split their controls on the document's
 * stamps, not on extra statuses.
 */

const snapshot = (
  status: CastStatus,
  overrides?: Partial<CastEntry>,
): CastEntry => ({
  _tag: "cast",
  _id: "cast-1" as Id<"casts">,
  timestamp: 0,
  characterId: "char-aldous" as Id<"characters">,
  casterUserId: "user-aldous",
  casterName: "Aldous",
  status,
  arcanum: "death",
  level: 2,
  usesMagicalTool: false,
  declaredComponents: [
    { type: "gnosis", name: "Gnosis", dots: 1 },
    { type: "arcanum", name: "Death", dots: 3 },
  ],
  declaredPool: 4,
  spellManaCost: 0,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
})

/** The frozen seed that flips The Price to the caster's phase. */
const TIDES = { witnessCount: 0, circumstances: [], priorParadoxRolls: 0 }

describe("castLadderMachine — a projection of the document", () => {
  test("an unstarted actor's snapshot — the card's first render — already sits on the rung", () => {
    // @xstate/react reads getSnapshot() before the actor starts (the start
    // lands in an effect), so the first render must never see `deriving` —
    // the card dispatches the rung through Match.exhaustive and an
    // off-vocabulary value would throw into the route boundary (issue #67).
    for (const status of CastStatus.literals) {
      const actor = createActor(castLadderMachine, {
        input: { cast: snapshot(status) },
      })
      expect(actor.getSnapshot().value).toBe(status)
    }
  })

  test("ladderRung passes rungs through and resolves a mid-derive frame to the document", () => {
    for (const status of CastStatus.literals) {
      expect(ladderRung(status, snapshot(status))).toBe(status)
    }
    expect(ladderRung("deriving", snapshot("price"))).toBe("price")
  })

  test("rehydrates onto every rung directly from a snapshot", () => {
    for (const status of CastStatus.literals) {
      const actor = createActor(castLadderMachine, {
        input: { cast: snapshot(status) },
      })
      actor.start()
      expect(actor.getSnapshot().value).toBe(status)
      actor.stop()
    }
  })

  test("SYNC walks the machine along with the document", () => {
    const actor = createActor(castLadderMachine, {
      input: { cast: snapshot("draft") },
    })
    actor.start()

    for (const status of CastStatus.literals) {
      actor.send({ type: "SYNC", cast: snapshot(status) })
      expect(actor.getSnapshot().value).toBe(status)
      expect(actor.getSnapshot().context.cast.status).toBe(status)
    }
    actor.stop()
  })

  test("a SYNC backwards (a void mid-ladder) still lands on the document's rung", () => {
    const actor = createActor(castLadderMachine, {
      input: { cast: snapshot("paradox") },
    })
    actor.start()
    actor.send({ type: "SYNC", cast: snapshot("voided") })
    expect(actor.getSnapshot().value).toBe("voided")
    actor.stop()
  })
})

describe("ladderControls — buttons only for the viewer's role and phase", () => {
  const caster = { isStoryteller: false, isCaster: true }
  const storyteller = { isStoryteller: true, isCaster: false }
  const spectator = { isStoryteller: false, isCaster: false }

  test("the wings: owner kills, ST engages or declines — the tool is a sheet fact (issue #107)", () => {
    expect(ladderControls(snapshot("draft"), caster)).toEqual(["kill"])
    expect(ladderControls(snapshot("draft"), storyteller)).toEqual(["engage", "decline"])
    expect(ladderControls(snapshot("draft"), spectator)).toEqual([])
  })

  test("The Price, fluid: ST assembles and freezes, either bails", () => {
    expect(ladderControls(snapshot("price"), storyteller)).toEqual([
      "adjust",
      "lockPrice",
      "cancel",
      "void",
    ])
    expect(ladderControls(snapshot("price"), caster)).toEqual(["cancel"])
    expect(ladderControls(snapshot("price"), spectator)).toEqual([])
  })

  test("The Price, frozen: the caster commits or bails; the ST is hands-off but for the repair", () => {
    const frozen = snapshot("price", { tides: TIDES })
    expect(ladderControls(frozen, caster)).toEqual(["commit", "cancel"])
    expect(ladderControls(frozen, storyteller)).toEqual(["cancel", "void"])
    expect(ladderControls(frozen, spectator)).toEqual([])
  })

  test("Paradox: the ST's roll, then the caster's cockpit — no cancel past the commit", () => {
    expect(ladderControls(snapshot("paradox"), storyteller)).toEqual([
      "rollParadox",
      "void",
    ])
    expect(ladderControls(snapshot("paradox"), caster)).toEqual([])

    const rolled = snapshot("paradox", { tides: TIDES, paradoxSuccesses: 2 })
    expect(ladderControls(rolled, caster)).toEqual(["contain", "release"])
    expect(ladderControls(rolled, storyteller)).toEqual(["void"])
    expect(ladderControls(rolled, spectator)).toEqual([])
  })

  test("terminal rungs offer nothing to anyone", () => {
    for (const status of ["resolved", "cancelled", "voided"] as const) {
      expect(ladderControls(snapshot(status), caster)).toEqual([])
      expect(ladderControls(snapshot(status), storyteller)).toEqual([])
      expect(ladderControls(snapshot(status), spectator)).toEqual([])
    }
  })
})
