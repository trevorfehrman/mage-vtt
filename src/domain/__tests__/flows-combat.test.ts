import { Effect, Random } from "effect"
import { describe, expect, it } from "@effect/vitest"
import type { CombatParticipant } from "../combat-tracker"
import {
  addParticipant,
  endCombat,
  removeParticipant,
  rollCombatInitiative,
  spendTicks,
  startCombat,
} from "../flows/combat"
import { closeScene } from "../flows/scene"
import { CombatId, PlayerId, SceneId, SessionId } from "../ids"
import { Membership } from "../membership"
import { failureTag, makeAldousSheet } from "../testing/fixtures"
import {
  makeInMemory,
  type StoredCombat,
  type StoredScene,
} from "../testing/in-memory"

/**
 * Flow tests for the Combat clock (issue #60, PRD #40), asserted at the port
 * boundary through the in-memory adapter with seeded dice. The scripted
 * lifecycle: the ST sounds the clash inside the active Scene, seats both
 * participant kinds, faces roll their own initiative (distance-from-highest
 * Ticks), the ST bills every cost by hand, fate breaks full ties out loud
 * (issue #59), and the Combat ends so the next can begin — plus the refusal
 * matrix on the ADR-0010 taxonomy.
 */

const SESSION = SessionId.make("session-1")
const ALDOUS_USER = PlayerId.make("user-aldous")
const BIANCA_USER = PlayerId.make("user-bianca")
const ST_USER = PlayerId.make("user-stella")
const OUTSIDER = PlayerId.make("user-vagrant")

const aldous = new Membership({
  userId: ALDOUS_USER,
  sessionId: SESSION,
  role: "player",
  displayName: "Aldous",
})
const bianca = new Membership({
  userId: BIANCA_USER,
  sessionId: SESSION,
  role: "player",
  displayName: "Bianca",
})
const stella = new Membership({
  userId: ST_USER,
  sessionId: SESSION,
  role: "storyteller",
  displayName: "Stella",
})

// Aldous: Dex 2 / Comp 3 / Wits 2 (the shared fixture); Bianca re-skins it.
const aldousSheet = makeAldousSheet()
const biancaSheet = makeAldousSheet({
  id: "char-bianca",
  userId: "user-bianca",
  sessionMemberId: "member-bianca",
  name: "Bianca",
})

const activeScene = (): StoredScene => ({
  id: SceneId.make("scene-1"),
  sessionId: SESSION,
  name: "The Docks",
  status: "active",
  sleeperWitnesses: false,
  openedAt: 0,
})

const activeCombat = (
  participants: ReadonlyArray<CombatParticipant> = [],
  overrides: Partial<StoredCombat> = {},
): StoredCombat => ({
  id: CombatId.make("combat-prior"),
  sessionId: SESSION,
  sceneId: SceneId.make("scene-1"),
  status: "active",
  participants,
  seq: participants.length,
  startedAt: 0,
  ...overrides,
})

const sheetFace = (
  id: string,
  characterId: string,
  name: string,
): CombatParticipant => ({ kind: "sheet", characterId, id, name })

const npcFace = (
  id: string,
  name: string,
  stats = { dexterity: 3, composure: 2, wits: 2, willpower: 3 },
): CombatParticipant => ({ kind: "manual", stats, id, name })

/** A face mid-fight: rolled initiative, current Ticks, spends accrued. */
const rolled = (
  face: CombatParticipant,
  init: { roll: number; total: number },
  ticks: number,
  spentTicks = 0,
): CombatParticipant => ({
  ...face,
  initiative: {
    roll: init.roll,
    total: init.total,
    ...(face.kind === "manual"
      ? face.stats
      : { dexterity: 2, composure: 3, wits: 2, willpower: 5 }),
  },
  ticks,
  spentTicks,
})

const seed = (
  actor: { userId: PlayerId; isDev?: boolean },
  opts: {
    scenes?: ReadonlyArray<StoredScene>
    combats?: ReadonlyArray<StoredCombat>
  } = {},
) =>
  makeInMemory({
    members: [aldous, bianca, stella],
    actor: { userId: actor.userId, isDev: actor.isDev ?? false },
    sheets: [aldousSheet, biancaSheet],
    ...(opts.scenes ? { scenes: opts.scenes } : {}),
    ...(opts.combats ? { combats: opts.combats } : {}),
  })

describe("Flows.combat.startCombat (issue #60)", () => {
  it.effect("the Storyteller sounds the clash: active row in the Scene, system entry", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { scenes: [activeScene()] })

      const combatId = yield* startCombat({ sessionId: SESSION }).pipe(
        Effect.provide(store.layer),
      )

      expect(store.combats).toHaveLength(1)
      const combat = store.combats[0]!
      expect(combat.id).toBe(combatId)
      expect(combat.status).toBe("active")
      expect(combat.sceneId).toBe("scene-1")
      expect(combat.participants).toEqual([])

      expect(store.messages).toHaveLength(1)
      const entry = store.messages[0]!
      expect(entry.visibility).toBe("system")
      expect(entry.text).toContain("Combat begins")
      expect(entry.text).toContain("The Docks")
      expect(entry.override).toBeNull()
    }),
  )

  it.effect("downtime refuses NoActiveScene — a Combat is a child of a Scene", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      const exit = yield* startCombat({ sessionId: SESSION }).pipe(
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("NoActiveScene")
      expect(store.combats).toHaveLength(0)
    }),
  )

  it.effect("a second concurrent Combat is refused CombatAlreadyActive", () =>
    Effect.gen(function* () {
      const store = seed(
        { userId: ST_USER },
        { scenes: [activeScene()], combats: [activeCombat()] },
      )

      const exit = yield* startCombat({ sessionId: SESSION }).pipe(
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("CombatAlreadyActive")
      expect(store.combats).toHaveLength(1)
    }),
  )

  it.effect("a player is refused NotStoryteller, zero writes", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ALDOUS_USER }, { scenes: [activeScene()] })

      const exit = yield* startCombat({ sessionId: SESSION }).pipe(
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("NotStoryteller")
      expect(store.combats).toHaveLength(0)
    }),
  )

  it.effect("a non-member is refused NotAMember", () =>
    Effect.gen(function* () {
      const store = seed({ userId: OUTSIDER }, { scenes: [activeScene()] })

      const exit = yield* startCombat({ sessionId: SESSION }).pipe(
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("NotAMember")
    }),
  )

  it.effect("serial Combats: start, end, start again — one Scene, each its own entry", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { scenes: [activeScene()] })

      yield* startCombat({ sessionId: SESSION }).pipe(Effect.provide(store.layer))
      yield* endCombat({ sessionId: SESSION }).pipe(Effect.provide(store.layer))
      yield* startCombat({ sessionId: SESSION }).pipe(Effect.provide(store.layer))

      expect(store.combats.map((c) => c.status)).toEqual(["ended", "active"])
      expect(store.combats[0]!.endedAt).toBeDefined()
      expect(store.messages).toHaveLength(3)
      expect(store.messages[1]!.text).toContain("Combat ends")
    }),
  )
})

describe("Flows.combat: a Combat is a child of its Scene (issue #60)", () => {
  it.effect("closing the Scene ends the running Combat, narrated in the close entry", () =>
    Effect.gen(function* () {
      const store = seed(
        { userId: ST_USER },
        { scenes: [activeScene()], combats: [activeCombat([npcFace("p1", "Ghoul α")])] },
      )

      yield* closeScene({ sessionId: SESSION }).pipe(Effect.provide(store.layer))

      expect(store.combats[0]!.status).toBe("ended")
      expect(store.combats[0]!.endedAt).toBeDefined()
      // One atomic close entry carries the cascade (ADR-0009) — no orphaned
      // Combat blocking the next Scene's clash.
      expect(store.messages).toHaveLength(1)
      expect(store.messages[0]!.text).toContain("closed the Scene")
      expect(store.messages[0]!.text).toContain("Combat")
    }),
  )
})

describe("Flows.combat.endCombat (issue #60)", () => {
  it.effect("no running Combat is refused NoActiveCombat", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { scenes: [activeScene()] })

      const exit = yield* endCombat({ sessionId: SESSION }).pipe(
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("NoActiveCombat")
    }),
  )

  it.effect("a player is refused NotStoryteller, the Combat runs on", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ALDOUS_USER }, { combats: [activeCombat()] })

      const exit = yield* endCombat({ sessionId: SESSION }).pipe(
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("NotStoryteller")
      expect(store.combats[0]!.status).toBe("active")
    }),
  )
})

describe("Flows.combat.addParticipant (issue #60)", () => {
  it.effect("the sheet lane seats a real character: named off the sheet, quiet write", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { combats: [activeCombat()] })

      yield* addParticipant({
        sessionId: SESSION,
        characterId: "char-aldous",
      }).pipe(Effect.provide(store.layer))

      const combat = store.combats[0]!
      expect(combat.participants).toHaveLength(1)
      const p = combat.participants[0]!
      expect(p.kind).toBe("sheet")
      expect(p.id).toBe("p1")
      expect(p.name).toBe("Aldous")
      expect(p.initiative).toBeUndefined()
      expect(combat.seq).toBe(1)
      // Roster edits are bookkeeping, not dramatic beats.
      expect(store.messages).toHaveLength(0)
    }),
  )

  it.effect("the same character can't be seated twice: DuplicateCombatant", () =>
    Effect.gen(function* () {
      const store = seed(
        { userId: ST_USER },
        { combats: [activeCombat([sheetFace("p1", "char-aldous", "Aldous")])] },
      )

      const exit = yield* addParticipant({
        sessionId: SESSION,
        characterId: "char-aldous",
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("DuplicateCombatant")
      expect(store.combats[0]!.participants).toHaveLength(1)
    }),
  )

  it.effect("a character from another session isn't there: DocumentNotFound", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { combats: [activeCombat()] })

      const exit = yield* addParticipant({
        sessionId: SESSION,
        characterId: "char-elsewhere",
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("DocumentNotFound")
    }),
  )

  it.effect("the hand-entered lane stores the paper NPC exactly as written — no sheet touched", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { combats: [activeCombat()] })

      yield* addParticipant({
        sessionId: SESSION,
        name: "Ghoul α",
        dexterity: 3,
        composure: 2,
        wits: 2,
        willpower: 4,
      }).pipe(Effect.provide(store.layer))

      const p = store.combats[0]!.participants[0]!
      expect(p.kind).toBe("manual")
      expect(p.name).toBe("Ghoul α")
      expect(p.kind === "manual" && p.stats).toEqual({
        dexterity: 3,
        composure: 2,
        wits: 2,
        willpower: 4,
      })
      // Hand-entered rows never touch a sheet.
      expect(store.sheetPatches).toHaveLength(0)
    }),
  )

  it.effect("both lanes at once is refused InvalidCombatant", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { combats: [activeCombat()] })

      const exit = yield* addParticipant({
        sessionId: SESSION,
        characterId: "char-aldous",
        name: "Ghoul α",
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("InvalidCombatant")
    }),
  )

  it.effect("a hand-entered row without its stats is refused InvalidCombatant", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { combats: [activeCombat()] })

      const exit = yield* addParticipant({
        sessionId: SESSION,
        name: "Ghoul α",
        dexterity: 3,
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("InvalidCombatant")
    }),
  )

  it.effect("a blank name is refused InvalidCombatant", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { combats: [activeCombat()] })

      const exit = yield* addParticipant({
        sessionId: SESSION,
        name: "   ",
        dexterity: 3,
        composure: 2,
        wits: 2,
        willpower: 4,
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("InvalidCombatant")
    }),
  )

  it.effect("a player is refused NotStoryteller — the roster is the ST's", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ALDOUS_USER }, { combats: [activeCombat()] })

      const exit = yield* addParticipant({
        sessionId: SESSION,
        characterId: "char-aldous",
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("NotStoryteller")
    }),
  )
})

describe("Flows.combat.removeParticipant (issue #60)", () => {
  it.effect("removes a face mid-Combat; a settled next actor elsewhere survives", () =>
    Effect.gen(function* () {
      const store = seed(
        { userId: ST_USER },
        {
          combats: [
            activeCombat(
              [
                rolled(npcFace("p1", "Ghoul α"), { roll: 8, total: 13 }, 0),
                rolled(npcFace("p2", "Ghoul β"), { roll: 3, total: 8 }, 5),
              ],
              { nextActorId: "p1" },
            ),
          ],
        },
      )

      yield* removeParticipant({ sessionId: SESSION, participantId: "p2" }).pipe(
        Effect.provide(store.layer),
      )

      const combat = store.combats[0]!
      expect(combat.participants.map((p) => p.id)).toEqual(["p1"])
      expect(combat.nextActorId).toBe("p1")
    }),
  )

  it.effect("removing the next actor resettles who's up", () =>
    Effect.gen(function* () {
      const store = seed(
        { userId: ST_USER },
        {
          combats: [
            activeCombat(
              [
                rolled(npcFace("p1", "Ghoul α"), { roll: 8, total: 13 }, 0),
                rolled(npcFace("p2", "Ghoul β"), { roll: 3, total: 8 }, 5),
              ],
              { nextActorId: "p1" },
            ),
          ],
        },
      )

      yield* removeParticipant({ sessionId: SESSION, participantId: "p1" }).pipe(
        Effect.provide(store.layer),
        Random.withSeed("resettle"),
      )

      expect(store.combats[0]!.nextActorId).toBe("p2")
    }),
  )

  it.effect("an unknown face is refused ParticipantNotInCombat", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { combats: [activeCombat()] })

      const exit = yield* removeParticipant({
        sessionId: SESSION,
        participantId: "p9",
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("ParticipantNotInCombat")
    }),
  )

  it.effect("a player is refused NotStoryteller", () =>
    Effect.gen(function* () {
      const store = seed(
        { userId: ALDOUS_USER },
        { combats: [activeCombat([npcFace("p1", "Ghoul α")])] },
      )

      const exit = yield* removeParticipant({
        sessionId: SESSION,
        participantId: "p1",
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("NotStoryteller")
      expect(store.combats[0]!.participants).toHaveLength(1)
    }),
  )
})

describe("Flows.combat.rollCombatInitiative (issue #60)", () => {
  const seated = () =>
    activeCombat([
      sheetFace("p1", "char-aldous", "Aldous"),
      sheetFace("p2", "char-bianca", "Bianca"),
      npcFace("p3", "Ghoul α"),
    ])

  it.effect("a player clicks their own face: sheet stats, a public Roll, no Override", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ALDOUS_USER }, { combats: [seated()] })

      yield* rollCombatInitiative({ sessionId: SESSION, participantId: "p1" }).pipe(
        Effect.provide(store.layer),
        Random.withSeed("own-face"),
      )

      const p = store.combats[0]!.participants[0]!
      // Aldous off the fixture sheet: Dex 2, Comp 3, Wits 2, Willpower 5.
      expect(p.initiative).toBeDefined()
      expect(p.initiative!.dexterity).toBe(2)
      expect(p.initiative!.composure).toBe(3)
      expect(p.initiative!.wits).toBe(2)
      expect(p.initiative!.total).toBe(p.initiative!.roll + 5)
      // The only rolled face owes nothing and is up.
      expect(p.ticks).toBe(0)
      expect(store.combats[0]!.nextActorId).toBe("p1")

      // The roll lands in the Activity feed like any Roll (ADR-0003/0009).
      expect(store.rolls).toHaveLength(1)
      const roll = store.rolls[0]!
      expect(roll.userId).toBe(ALDOUS_USER)
      expect(roll.visibility).toBe("public")
      expect(roll.override).toBeNull()
      expect(roll.summary).toContain("rolls initiative")
      expect(roll.summary).toContain(`= ${p.initiative!.total}`)
    }),
  )

  it.effect("a player clicking another player's face is refused NotYourCharacter", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ALDOUS_USER }, { combats: [seated()] })

      const exit = yield* rollCombatInitiative({
        sessionId: SESSION,
        participantId: "p2",
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("NotYourCharacter")
      expect(store.rolls).toHaveLength(0)
    }),
  )

  it.effect("the ST rolls for an absent player: Override-stamped, attributed to the owner", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { combats: [seated()] })

      yield* rollCombatInitiative({ sessionId: SESSION, participantId: "p1" }).pipe(
        Effect.provide(store.layer),
        Random.withSeed("in-stead"),
      )

      const roll = store.rolls[0]!
      expect(roll.userId).toBe(ALDOUS_USER)
      expect(roll.override).not.toBeNull()
      expect(roll.override!.kind).toBe("storyteller-action")
      expect(roll.override!.invokedByUserId).toBe(ST_USER)
    }),
  )

  it.effect("the ST rolls an NPC face plain: hand stats, no Override", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { combats: [seated()] })

      yield* rollCombatInitiative({ sessionId: SESSION, participantId: "p3" }).pipe(
        Effect.provide(store.layer),
        Random.withSeed("npc-face"),
      )

      const p = store.combats[0]!.participants[2]!
      expect(p.initiative!.dexterity).toBe(3)
      expect(p.initiative!.composure).toBe(2)
      const roll = store.rolls[0]!
      expect(roll.userId).toBe(ST_USER)
      expect(roll.override).toBeNull()
    }),
  )

  it.effect("a player clicking an NPC face is refused NotStoryteller", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ALDOUS_USER }, { combats: [seated()] })

      const exit = yield* rollCombatInitiative({
        sessionId: SESSION,
        participantId: "p3",
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("NotStoryteller")
    }),
  )

  it.effect("a second click on the same face is refused InitiativeAlreadyRolled", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ALDOUS_USER }, { combats: [seated()] })

      yield* rollCombatInitiative({ sessionId: SESSION, participantId: "p1" }).pipe(
        Effect.provide(store.layer),
        Random.withSeed("first-click"),
      )
      const exit = yield* rollCombatInitiative({
        sessionId: SESSION,
        participantId: "p1",
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("InitiativeAlreadyRolled")
      expect(store.rolls).toHaveLength(1)
    }),
  )

  it.effect("an unknown face is refused ParticipantNotInCombat", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { combats: [seated()] })

      const exit = yield* rollCombatInitiative({
        sessionId: SESSION,
        participantId: "p9",
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("ParticipantNotInCombat")
    }),
  )

  it.effect("Ticks are distance-from-highest across every rolled face", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { combats: [seated()] })
      const layer = store.layer

      yield* rollCombatInitiative({ sessionId: SESSION, participantId: "p1" }).pipe(
        Effect.provide(layer),
        Random.withSeed("field-1"),
      )
      yield* rollCombatInitiative({ sessionId: SESSION, participantId: "p2" }).pipe(
        Effect.provide(layer),
        Random.withSeed("field-2"),
      )
      yield* rollCombatInitiative({ sessionId: SESSION, participantId: "p3" }).pipe(
        Effect.provide(layer),
        Random.withSeed("field-3"),
      )

      const rolledFaces = store.combats[0]!.participants
      const highest = Math.max(...rolledFaces.map((p) => p.initiative!.total))
      for (const p of rolledFaces) {
        expect(p.ticks).toBe(highest - p.initiative!.total)
      }
      // Exactly one face is up at 0 Ticks, and it's the settled next actor.
      const leaders = rolledFaces.filter((p) => p.ticks === 0)
      expect(leaders.map((p) => p.id)).toContain(store.combats[0]!.nextActorId)
    }),
  )
})

describe("Flows.combat.spendTicks (issue #60)", () => {
  const midFight = (overrides: Partial<StoredCombat> = {}) =>
    activeCombat(
      [
        rolled(npcFace("p1", "Ghoul α"), { roll: 8, total: 13 }, 0),
        rolled(npcFace("p2", "Ghoul β"), { roll: 3, total: 8 }, 5),
        npcFace("p3", "Latecomer"),
      ],
      { nextActorId: "p1", ...overrides },
    )

  it.effect("a preset Attack bills 3 Ticks and resettles who's up", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { combats: [midFight()] })

      yield* spendTicks({
        sessionId: SESSION,
        participantId: "p1",
        action: "attack",
      }).pipe(Effect.provide(store.layer))

      const p = store.combats[0]!.participants[0]!
      expect(p.ticks).toBe(3)
      expect(p.spentTicks).toBe(3)
      // The clock moved: β at 5 still waits, α at 3 is up again.
      expect(store.combats[0]!.nextActorId).toBe("p1")
      // Billing is bookkeeping — no Activity entry.
      expect(store.messages).toHaveLength(0)
    }),
  )

  it.effect("a Cast bills 5 and hands the turn on", () =>
    Effect.gen(function* () {
      // β waits at 4, not 5 — a Cast would otherwise land α in a dead tie,
      // and this test is about the handover, not the coinflip.
      const store = seed(
        { userId: ST_USER },
        {
          combats: [
            activeCombat(
              [
                rolled(npcFace("p1", "Ghoul α"), { roll: 8, total: 13 }, 0),
                rolled(npcFace("p2", "Ghoul β"), { roll: 4, total: 9 }, 4),
              ],
              { nextActorId: "p1" },
            ),
          ],
        },
      )

      yield* spendTicks({
        sessionId: SESSION,
        participantId: "p1",
        action: "castSpell",
      }).pipe(Effect.provide(store.layer))

      expect(store.combats[0]!.participants[0]!.ticks).toBe(5)
      expect(store.combats[0]!.nextActorId).toBe("p2")
    }),
  )

  it.effect("Aim 2 bills 2 Ticks and leaves +2-next-attack chrome on the chip", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { combats: [midFight()] })

      yield* spendTicks({
        sessionId: SESSION,
        participantId: "p1",
        action: "aim",
        count: 2,
      }).pipe(Effect.provide(store.layer))

      const p = store.combats[0]!.participants[0]!
      expect(p.ticks).toBe(2)
      expect(p.reminder).toEqual({ kind: "aim", bonus: 2 })
    }),
  )

  it.effect("Dodge defaults to 1 tick of +1 Defense", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { combats: [midFight()] })

      yield* spendTicks({
        sessionId: SESSION,
        participantId: "p1",
        action: "dodge",
      }).pipe(Effect.provide(store.layer))

      expect(store.combats[0]!.participants[0]!.reminder).toEqual({
        kind: "dodge",
        bonus: 1,
      })
    }),
  )

  it.effect("the next non-Aim/non-Dodge cost clears the chrome — displayed memory only", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { combats: [midFight()] })

      yield* spendTicks({
        sessionId: SESSION,
        participantId: "p1",
        action: "aim",
        count: 3,
      }).pipe(Effect.provide(store.layer))
      yield* spendTicks({
        sessionId: SESSION,
        participantId: "p1",
        action: "attack",
      }).pipe(Effect.provide(store.layer))

      const p = store.combats[0]!.participants[0]!
      expect(p.reminder).toBeUndefined()
      expect(p.ticks).toBe(6)
      expect(p.spentTicks).toBe(6)
    }),
  )

  it.effect("Aim stacked on Aim re-stamps the chrome, never accumulates it", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { combats: [midFight()] })

      yield* spendTicks({
        sessionId: SESSION,
        participantId: "p1",
        action: "aim",
        count: 1,
      }).pipe(Effect.provide(store.layer))
      yield* spendTicks({
        sessionId: SESSION,
        participantId: "p1",
        action: "aim",
        count: 2,
      }).pipe(Effect.provide(store.layer))

      expect(store.combats[0]!.participants[0]!.reminder).toEqual({
        kind: "aim",
        bonus: 2,
      })
    }),
  )

  it.effect("a free-typed cost bills exactly what the ST typed", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { combats: [midFight()] })

      yield* spendTicks({
        sessionId: SESSION,
        participantId: "p1",
        cost: 7,
      }).pipe(Effect.provide(store.layer))

      expect(store.combats[0]!.participants[0]!.ticks).toBe(7)
      expect(store.combats[0]!.nextActorId).toBe("p2")
    }),
  )

  it.effect("the refusal matrix of the cost lanes: InvalidTickSpend throughout", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { combats: [midFight()] })
      const layer = store.layer
      const attempt = (extra: Record<string, unknown>) =>
        spendTicks({
          sessionId: SESSION,
          participantId: "p1",
          ...extra,
        } as Parameters<typeof spendTicks>[0]).pipe(Effect.provide(layer), Effect.exit)

      // A preset action carries its own cost.
      expect(failureTag(yield* attempt({ action: "attack", cost: 4 }))).toBe(
        "InvalidTickSpend",
      )
      // Aim/Dodge pick 1–3, never a free cost; 4 ticks is not a choice.
      expect(failureTag(yield* attempt({ action: "aim", cost: 2 }))).toBe(
        "InvalidTickSpend",
      )
      expect(failureTag(yield* attempt({ action: "aim", count: 4 }))).toBe(
        "InvalidTickSpend",
      )
      // A count belongs to Aim or Dodge.
      expect(failureTag(yield* attempt({ cost: 3, count: 2 }))).toBe(
        "InvalidTickSpend",
      )
      // The clock needs a lane, and a cost it can mean.
      expect(failureTag(yield* attempt({}))).toBe("InvalidTickSpend")
      expect(failureTag(yield* attempt({ cost: 0 }))).toBe("InvalidTickSpend")
      expect(failureTag(yield* attempt({ cost: 2.5 }))).toBe("InvalidTickSpend")

      // Nothing was billed by any of it.
      expect(store.combats[0]!.participants[0]!.ticks).toBe(0)
    }),
  )

  it.effect("billing an unrolled face is refused InitiativeNotRolled", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, { combats: [midFight()] })

      const exit = yield* spendTicks({
        sessionId: SESSION,
        participantId: "p3",
        action: "attack",
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("InitiativeNotRolled")
    }),
  )

  it.effect("a player is refused NotStoryteller — only the ST conducts the clock", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ALDOUS_USER }, { combats: [midFight()] })

      const exit = yield* spendTicks({
        sessionId: SESSION,
        participantId: "p1",
        action: "attack",
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("NotStoryteller")
      expect(store.combats[0]!.participants[0]!.ticks).toBe(0)
    }),
  )

  it.effect("a full tie at the front ends in a logged coinflip (issue #59)", () =>
    Effect.gen(function* () {
      // Identical twins at 5 Ticks; the runner at 0 bills himself past them.
      const store = seed(
        { userId: ST_USER },
        {
          combats: [
            activeCombat(
              [
                rolled(npcFace("p1", "Castor"), { roll: 5, total: 10 }, 5),
                rolled(npcFace("p2", "Pollux"), { roll: 5, total: 10 }, 5),
                rolled(npcFace("p3", "Runner"), { roll: 9, total: 15 }, 0),
              ],
              { nextActorId: "p3" },
            ),
          ],
        },
      )

      yield* spendTicks({
        sessionId: SESSION,
        participantId: "p3",
        cost: 10,
      }).pipe(Effect.provide(store.layer), Random.withSeed("gemini"))

      // Fate spoke, and said so: one system line naming the tie and the pick.
      expect(store.messages).toHaveLength(1)
      const fate = store.messages[0]!
      expect(fate.visibility).toBe("system")
      expect(fate.text).toContain("Fate breaks the tie")
      expect(fate.text).toContain("Castor")
      expect(fate.text).toContain("Pollux")
      expect(["p1", "p2"]).toContain(store.combats[0]!.nextActorId)
    }),
  )
})
