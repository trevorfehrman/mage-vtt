import { describe, expect, it } from "@effect/vitest"
import {
  decodeActiveCombat,
  rolledEntries,
  timeline,
  type CombatParticipant,
} from "../combat-tracker"

/**
 * Pure leaves of the Combat tracker (issue #60, ADR-0014): the timeline's
 * display order and the queue-leaf projection. Plain `it()` — no Effect, no
 * dice; the coinflip authority (`findNextActor`) is the flows' concern, and
 * the display honours its stamped answer rather than re-drawing fate.
 */

const sheet = (
  id: string,
  overrides: Partial<CombatParticipant> = {},
): CombatParticipant =>
  ({
    kind: "sheet",
    characterId: `char-${id}`,
    id,
    name: id,
    ...overrides,
  }) as CombatParticipant

const rolled = (
  id: string,
  ticks: number,
  chain: { wits?: number; dexterity?: number; composure?: number; willpower?: number } = {},
): CombatParticipant =>
  sheet(id, {
    initiative: {
      roll: 5,
      total: 10,
      dexterity: chain.dexterity ?? 2,
      composure: chain.composure ?? 2,
      wits: chain.wits ?? 2,
      willpower: chain.willpower ?? 2,
    },
    ticks,
    spentTicks: 0,
  })

describe("CombatTracker.timeline (issue #60)", () => {
  it("orders rolled participants by Ticks ascending", () => {
    const order = timeline({
      participants: [rolled("slow", 5), rolled("now", 0), rolled("mid", 3)],
    })
    expect(order.map((p) => p.id)).toEqual(["now", "mid", "slow"])
  })

  it("unrolled participants trail in roster order", () => {
    const order = timeline({
      participants: [sheet("late-b"), rolled("now", 0), sheet("late-a")],
    })
    expect(order.map((p) => p.id)).toEqual(["now", "late-b", "late-a"])
  })

  it("the stamped next actor leads a Tick tie, whatever the chain says", () => {
    // fate's answer (nextActorId) must not be contradicted by the display,
    // even when the house chain would order the tie the other way.
    const order = timeline({
      participants: [
        rolled("sharp", 2, { wits: 4 }),
        rolled("chosen", 2, { wits: 1 }),
      ],
      nextActorId: "chosen",
    })
    expect(order.map((p) => p.id)).toEqual(["chosen", "sharp"])
  })

  it("a Tick tie without the next actor falls to the house chain", () => {
    const order = timeline({
      participants: [
        rolled("dull", 4, { wits: 1 }),
        rolled("sharp", 4, { wits: 3 }),
        rolled("now", 0),
      ],
      nextActorId: "now",
    })
    expect(order.map((p) => p.id)).toEqual(["now", "sharp", "dull"])
  })

  it("a full tie keeps roster order — display stays stable, fate is the flows' door", () => {
    const order = timeline({
      participants: [rolled("first", 2), rolled("second", 2)],
    })
    expect(order.map((p) => p.id)).toEqual(["first", "second"])
  })
})

describe("CombatTracker.rolledEntries (issue #60)", () => {
  it("projects only rolled participants, chain stats from the stamp", () => {
    const entries = rolledEntries([
      rolled("a", 3, { wits: 4, dexterity: 3, composure: 2, willpower: 5 }),
      sheet("unrolled"),
    ])
    expect(entries).toEqual([
      {
        participantId: "a",
        ticks: 3,
        wits: 4,
        dexterity: 3,
        composure: 2,
        willpower: 5,
      },
    ])
  })
})

describe("CombatTracker.decodeActiveCombat (issue #60)", () => {
  const row = {
    _id: "combat-1",
    _creationTime: 1,
    sessionId: "session-1",
    sceneId: "scene-1",
    status: "active",
    participants: [
      {
        kind: "manual",
        id: "p1",
        name: "Ghoul α",
        stats: { dexterity: 3, composure: 2, wits: 2, willpower: 3 },
      },
    ],
    seq: 1,
    startedAt: 10,
  }

  it("decodes a live row, dropping the timestamp columns", () => {
    const combat = decodeActiveCombat(row)
    expect(combat).not.toBeNull()
    expect(combat!.id).toBe("combat-1")
    expect(combat!.status).toBe("active")
    expect(combat!.participants).toHaveLength(1)
    expect(combat!.nextActorId).toBeUndefined()
  })

  it("null passes through — no Combat is an answer", () => {
    expect(decodeActiveCombat(null)).toBeNull()
  })

  it("a corrupt row degrades to null instead of taking the tracker down", () => {
    expect(decodeActiveCombat({ ...row, status: "paused" })).toBeNull()
  })
})
