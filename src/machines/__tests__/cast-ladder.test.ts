import { describe, expect, test } from "@effect/vitest"
import { createActor } from "xstate"
import type { CastEntry } from "#/domain/activity"
import { CastStatus } from "#/domain/cast"
import { castLadderMachine, ladderControls } from "../cast-ladder"
import type { Id } from "../../../convex/_generated/dataModel"

/**
 * Projection tests (issue #43): Cast document snapshot in → machine/UI state
 * out, including rehydration mid-ladder — the machine never owns pending
 * state, so any snapshot must land it on the document's rung directly.
 */

const snapshot = (status: CastStatus): CastEntry => ({
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
})

describe("castLadderMachine — a projection of the document", () => {
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
      input: { cast: snapshot("paradoxRolled") },
    })
    actor.start()
    actor.send({ type: "SYNC", cast: snapshot("voided") })
    expect(actor.getSnapshot().value).toBe("voided")
    actor.stop()
  })
})

describe("ladderControls — buttons only for the viewer's role", () => {
  const caster = { isStoryteller: false, isCaster: true }
  const storyteller = { isStoryteller: true, isCaster: false }
  const spectator = { isStoryteller: false, isCaster: false }

  test("the wings: owner kills (and may ready a tool), ST engages or declines", () => {
    expect(ladderControls("draft", caster)).toEqual(["kill", "tool"])
    expect(ladderControls("draft", storyteller)).toEqual(["engage", "decline"])
    expect(ladderControls("draft", spectator)).toEqual([])
  })

  test("negotiation: ST liability buttons and caster tool live here (issue #44)", () => {
    expect(ladderControls("engaged", storyteller)).toEqual([
      "negotiate",
      "lockLiabilities",
      "cancel",
      "void",
    ])
    expect(ladderControls("engaged", caster)).toEqual(["tool", "cancel"])
    expect(ladderControls("liabilitiesLocked", caster)).toEqual([
      "lockIntention",
      "cancel",
    ])
    expect(ladderControls("liabilitiesLocked", storyteller)).toEqual([
      "cancel",
      "void",
    ])
  })

  test("past the point of no return: no cancel anywhere, only the beats and void", () => {
    expect(ladderControls("intentionLocked", storyteller)).toEqual([
      "rollParadox",
      "void",
    ])
    expect(ladderControls("intentionLocked", caster)).toEqual([])
    expect(ladderControls("paradoxRolled", caster)).toEqual(["contain"])
    expect(ladderControls("paradoxRolled", storyteller)).toEqual(["void"])
    expect(ladderControls("contained", caster)).toEqual(["rollCast"])
    expect(ladderControls("contained", spectator)).toEqual([])
  })

  test("terminal rungs offer nothing to anyone", () => {
    for (const status of ["resolved", "cancelled", "voided"] as const) {
      expect(ladderControls(status, caster)).toEqual([])
      expect(ladderControls(status, storyteller)).toEqual([])
      expect(ladderControls(status, spectator)).toEqual([])
    }
  })
})
