import { Effect, Match, Option, Schema } from "effect"
import {
  getSessionScopedSheet,
  requireSessionCharacter,
  requireStoryteller,
  type Membership,
} from "../authz"
import {
  rolledEntries,
  type Combat,
  type CombatParticipant,
} from "../combat-tracker"
import { DiceRollResult } from "../dice"
import { CharacterId, SessionId } from "../ids"
import {
  ACTION_COSTS,
  applyActionCost,
  findNextActor,
  resolveTickOrder,
  rollInitiative,
  type CoinFlip,
} from "../initiative"
import { GameStore } from "../ports/game-store"
import { PoolSize, Successes } from "../quantities"
import { requireActiveScene } from "./scene"

/**
 * The Combat clock flows (issue #60, PRD #40): the FFX tick timeline walked
 * end to end — lifecycle, roster, initiative clicks, and the hand-billed
 * clock. Everything conducting is Storyteller-authority (start, end, roster
 * edits, every cost); the one player door is the initiative click on their
 * own face, which walks `requireSessionCharacter`'s ladder so an ST or Dev
 * acting in a player's stead is possible but Override-stamped (ADR-0015).
 *
 * Nothing ever auto-advances or auto-bills (ADR-0015): the app computes and
 * displays; the Storyteller pays every cost by hand. "Who's up" is settled
 * server-side each time the timeline changes — `findNextActor`'s house chain,
 * then a *logged* coinflip (issue #59) — so every screen highlights the same
 * face and fate never acts silently.
 */

// --- Errors (ADR-0010, co-located with the flows that raise them) ---

/** Rules/precondition: one Combat at a time — end it before the next. */
export class CombatAlreadyActive extends Schema.TaggedErrorClass<CombatAlreadyActive>()(
  "CombatAlreadyActive",
  { sessionId: SessionId },
) {}

/** Rules/precondition: this door needs a running Combat, and none is. */
export class NoActiveCombat extends Schema.TaggedErrorClass<NoActiveCombat>()(
  "NoActiveCombat",
  { sessionId: SessionId },
) {}

/** Rules/precondition: the named combatant isn't on the tracker. */
export class ParticipantNotInCombat extends Schema.TaggedErrorClass<ParticipantNotInCombat>()(
  "ParticipantNotInCombat",
  { participantId: Schema.String },
) {}

/** Rules/precondition: a character joins a Combat once. */
export class DuplicateCombatant extends Schema.TaggedErrorClass<DuplicateCombatant>()(
  "DuplicateCombatant",
  { characterId: CharacterId },
) {}

/** Validation: a roster entry that no reading could mean. */
export class InvalidCombatant extends Schema.TaggedErrorClass<InvalidCombatant>()(
  "InvalidCombatant",
  { message: Schema.String },
) {}

/** Rules/precondition: that face already rolled — one d10 per Combat. */
export class InitiativeAlreadyRolled extends Schema.TaggedErrorClass<InitiativeAlreadyRolled>()(
  "InitiativeAlreadyRolled",
  { participantId: Schema.String },
) {}

/** Rules/precondition: no Ticks to bill before the d10 lands. */
export class InitiativeNotRolled extends Schema.TaggedErrorClass<InitiativeNotRolled>()(
  "InitiativeNotRolled",
  { participantId: Schema.String },
) {}

/** Validation: a cost declaration that no ruling could mean. */
export class InvalidTickSpend extends Schema.TaggedErrorClass<InvalidTickSpend>()(
  "InvalidTickSpend",
  { message: Schema.String },
) {}

// --- Shared helpers ---

/** A whole stat the hand-entered roster can carry — representability, not creation legality. */
const HandStat = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 0, maximum: 15 }),
)

/** `HandStats` with the add door's range checks — the one home of the checked block. */
const CheckedHandStats = Schema.Struct({
  dexterity: HandStat,
  composure: HandStat,
  wits: HandStat,
  willpower: HandStat,
})

/** The precondition every mid-Combat door shares: a running Combat, or the refusal. */
const requireActiveCombat = Effect.fn("Flows.combat.requireActiveCombat")(function* (
  sessionId: SessionId,
) {
  const store = yield* GameStore
  const active = yield* store.getActiveCombat(sessionId)
  if (Option.isNone(active)) {
    return yield* new NoActiveCombat({ sessionId })
  }
  return active.value
})

const requireParticipant = Effect.fn("Flows.combat.requireParticipant")(function* (
  combat: Combat,
  participantId: string,
) {
  const participant = combat.participants.find((p) => p.id === participantId)
  if (!participant) {
    return yield* new ParticipantNotInCombat({ participantId })
  }
  return participant
})

/**
 * Settle "who's up" (issue #59): `findNextActor` over the rolled roster —
 * the house chain, then a coinflip that must be *logged*, never silent. The
 * fate line is attributed to whoever moved the timeline. Returns the value
 * `CombatPatch.nextActorId` expects: `null` clears a queue gone empty.
 */
const settleNextActor = Effect.fn("Flows.combat.settleNextActor")(function* (
  sessionId: SessionId,
  participants: ReadonlyArray<CombatParticipant>,
  actor: Membership,
) {
  const store = yield* GameStore
  const next = yield* findNextActor(rolledEntries(participants))
  if (Option.isNone(next)) return null

  if (next.value.flip !== undefined) {
    yield* store.insertMessage({
      sessionId,
      sender: { userId: actor.userId, displayName: actor.displayName },
      text: flipNarration(participants, next.value.flip),
      visibility: "system",
    })
  }
  return next.value.participantId
})

/** "Fate breaks the tie between A and B — A acts first." */
const flipNarration = (
  participants: ReadonlyArray<CombatParticipant>,
  flip: CoinFlip,
): string => {
  const nameOf = (id: string) =>
    participants.find((p) => p.id === id)?.name ?? id
  const tied = flip.participantIds.map(nameOf).join(" and ")
  return `Fate breaks the tie between ${tied} — ${nameOf(flip.order[0]!)} acts first.`
}

// --- The lifecycle ---

export const StartCombatArgs = Schema.Struct({
  sessionId: Schema.String,
})
export type StartCombatArgs = typeof StartCombatArgs.Type

/**
 * The Storyteller sounds the clash: a Combat opens inside the active Scene —
 * a child of the Scene, not a mode. One at a time; serially many; downtime
 * (no Scene) refuses, because a Combat without a Scene has no home.
 */
export const startCombat = Effect.fn("Flows.combat.startCombat")(function* (
  args: StartCombatArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  const storyteller = yield* requireStoryteller(sessionId)
  const store = yield* GameStore

  const scene = yield* requireActiveScene(sessionId)
  const active = yield* store.getActiveCombat(sessionId)
  if (Option.isSome(active)) {
    return yield* new CombatAlreadyActive({ sessionId })
  }

  const combatId = yield* store.insertCombat({ sessionId, sceneId: scene.id })

  yield* store.insertMessage({
    sessionId,
    sender: { userId: storyteller.userId, displayName: storyteller.displayName },
    text: `${storyteller.displayName} sounds the clash — Combat begins in "${scene.name}".`,
    visibility: "system",
  })

  return combatId
})

export const EndCombatArgs = StartCombatArgs
export type EndCombatArgs = typeof EndCombatArgs.Type

/** The Storyteller ends the Combat; the Scene continues around it. */
export const endCombat = Effect.fn("Flows.combat.endCombat")(function* (
  args: EndCombatArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  const storyteller = yield* requireStoryteller(sessionId)
  const store = yield* GameStore

  const combat = yield* requireActiveCombat(sessionId)
  yield* store.patchCombat(combat.id, { status: "ended" })

  yield* store.insertMessage({
    sessionId,
    sender: { userId: storyteller.userId, displayName: storyteller.displayName },
    text: `${storyteller.displayName} calls it — Combat ends.`,
    visibility: "system",
  })

  return combat.id
})

// --- The roster ---

export const AddParticipantArgs = Schema.Struct({
  sessionId: Schema.String,
  /** Sheet-backed lane: the real character to seat on the tracker. */
  characterId: Schema.optionalKey(Schema.String),
  /** Hand-entered lane: the paper NPC exactly as written. */
  name: Schema.optionalKey(Schema.String),
  dexterity: Schema.optionalKey(Schema.Number),
  composure: Schema.optionalKey(Schema.Number),
  wits: Schema.optionalKey(Schema.Number),
  willpower: Schema.optionalKey(Schema.Number),
})
export type AddParticipantArgs = typeof AddParticipantArgs.Type

/**
 * The Storyteller seats a combatant: a sheet-backed character (stats read
 * from the real sheet at roll time) or a hand-entered row carrying hand-typed
 * numbers that never touch a sheet. Two lanes, one door — exactly one per
 * add. A quiet write: the tracker shows the roster live; the log narrates
 * dramatic beats, not bookkeeping.
 */
export const addParticipant = Effect.fn("Flows.combat.addParticipant")(function* (
  args: AddParticipantArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  yield* requireStoryteller(sessionId)
  const store = yield* GameStore

  const combat = yield* requireActiveCombat(sessionId)

  const handFields = [args.name, args.dexterity, args.composure, args.wits, args.willpower]
  if (args.characterId !== undefined && handFields.some((f) => f !== undefined)) {
    return yield* new InvalidCombatant({
      message: "A combatant is a character reference or a hand-entered row — not both.",
    })
  }

  const participant = yield* args.characterId !== undefined
    ? sheetCombatant(combat, sessionId, args.characterId)
    : handCombatant(combat, args)

  yield* store.patchCombat(combat.id, {
    participants: [...combat.participants, participant],
    seq: combat.seq + 1,
  })

  return participant.id
})

/** The sheet lane: session-scoped, deduplicated, named off the sheet. */
const sheetCombatant = Effect.fn("Flows.combat.sheetCombatant")(function* (
  combat: Combat,
  sessionId: SessionId,
  characterId: string,
) {
  const id = CharacterId.make(characterId)
  // A character outside this session isn't there (DocumentNotFound, not a
  // leak); no ownership ladder — seating the roster is the ST's own act.
  const sheet = yield* getSessionScopedSheet(sessionId, id)
  const seated = combat.participants.some(
    (p) => p.kind === "sheet" && p.characterId === characterId,
  )
  if (seated) {
    return yield* new DuplicateCombatant({ characterId: id })
  }
  const participant: CombatParticipant = {
    kind: "sheet",
    characterId,
    id: `p${combat.seq + 1}`,
    name: sheet.shadowName ?? sheet.name,
  }
  return participant
})

/** The hand-entered lane: a name and four whole stats, or the refusal. */
const handCombatant = Effect.fn("Flows.combat.handCombatant")(function* (
  combat: Combat,
  args: AddParticipantArgs,
) {
  const name = args.name?.trim() ?? ""
  if (name.length === 0) {
    return yield* new InvalidCombatant({ message: "A combatant needs a name." })
  }
  const stats = yield* Schema.decodeUnknownEffect(CheckedHandStats)({
    dexterity: args.dexterity,
    composure: args.composure,
    wits: args.wits,
    willpower: args.willpower,
  }).pipe(
    Effect.mapError(
      () =>
        new InvalidCombatant({
          message:
            "A hand-entered combatant needs whole Dexterity, Composure, Wits, and Willpower (0–15).",
        }),
    ),
  )
  const participant: CombatParticipant = {
    kind: "manual",
    stats,
    id: `p${combat.seq + 1}`,
    name,
  }
  return participant
})

export const RemoveParticipantArgs = Schema.Struct({
  sessionId: Schema.String,
  participantId: Schema.String,
})
export type RemoveParticipantArgs = typeof RemoveParticipantArgs.Type

/** The Storyteller unseats a combatant mid-Combat; "who's up" resettles. */
export const removeParticipant = Effect.fn("Flows.combat.removeParticipant")(
  function* (args: RemoveParticipantArgs) {
    const sessionId = SessionId.make(args.sessionId)
    const storyteller = yield* requireStoryteller(sessionId)
    const store = yield* GameStore

    const combat = yield* requireActiveCombat(sessionId)
    yield* requireParticipant(combat, args.participantId)

    const remaining = combat.participants.filter((p) => p.id !== args.participantId)
    // The settled answer survives unless it named the removed face.
    const nextActorId =
      combat.nextActorId !== undefined && combat.nextActorId !== args.participantId
        ? combat.nextActorId
        : yield* settleNextActor(sessionId, remaining, storyteller)

    yield* store.patchCombat(combat.id, {
      participants: remaining,
      nextActorId,
    })

    return combat.id
  },
)

// --- Initiative ---

export const RollCombatInitiativeArgs = Schema.Struct({
  sessionId: Schema.String,
  participantId: Schema.String,
})
export type RollCombatInitiativeArgs = typeof RollCombatInitiativeArgs.Type

/**
 * The initiative click (PRD #40 story 11): d10 + Dexterity + Composure, once
 * per face per Combat. A sheet-backed face is its player's own door — the
 * `requireSessionCharacter` ladder lets the owner roll unmarked and stamps an
 * Override on an ST or Dev rolling in their stead; a hand-entered face is the
 * Storyteller's own roster act, plain. The roll lands in the Activity feed
 * like any Roll (ADR-0003/0009); starting Ticks are distance-from-highest
 * (`resolveTickOrder`), re-resolved over every rolled face so the timeline
 * agrees with itself, accrued action costs preserved.
 */
export const rollCombatInitiative = Effect.fn("Flows.combat.rollCombatInitiative")(
  function* (args: RollCombatInitiativeArgs) {
    const sessionId = SessionId.make(args.sessionId)
    const store = yield* GameStore

    const combat = yield* requireActiveCombat(sessionId)
    const participant = yield* requireParticipant(combat, args.participantId)

    // Authority before the dice: whose face is this?
    const acting = yield* Match.value(participant).pipe(
      Match.when({ kind: "sheet" }, (p) =>
        Effect.gen(function* () {
          const sheet = yield* requireSessionCharacter(
            sessionId,
            CharacterId.make(p.characterId),
          )
          // Attribution follows the character's owner (ADR-0006); the ladder
          // above already stamped any in-stead Override.
          const member = yield* store.getMembership(sessionId, sheet.userId)
          // Widened to plain numbers: the participant stamp is raw
          // primitives (ADR-0011), not the sheet's branded dots.
          const stats: { dexterity: number; composure: number; wits: number; willpower: number } = {
            dexterity: sheet.attributes.physical.dexterity,
            composure: sheet.attributes.social.composure,
            wits: sheet.attributes.mental.wits,
            willpower: sheet.willpower,
          }
          return { member, stats }
        }),
      ),
      Match.when({ kind: "manual" }, (p) =>
        Effect.map(requireStoryteller(sessionId), (member) => ({
          member,
          stats: p.stats,
        })),
      ),
      Match.exhaustive,
    )

    if (participant.initiative !== undefined) {
      return yield* new InitiativeAlreadyRolled({ participantId: participant.id })
    }

    const roll = yield* rollInitiative({
      participantId: participant.id,
      dexterity: acting.stats.dexterity,
      composure: acting.stats.composure,
    })

    const stamped: CombatParticipant = {
      ...participant,
      initiative: { roll: roll.roll, total: roll.total, ...acting.stats },
      spentTicks: 0,
    }
    const participants = combat.participants.map((p) =>
      p.id === participant.id ? stamped : p,
    )

    // Distance-from-highest over every rolled face: a new high total shifts
    // the whole field consistently; Ticks already billed as costs survive.
    const rolled = participants.filter((p) => p.initiative !== undefined)
    const order = yield* resolveTickOrder(
      rolled.map((p) => ({
        participantId: p.id,
        total: p.initiative!.total,
        roll: p.initiative!.roll,
        dexterity: p.initiative!.dexterity,
        composure: p.initiative!.composure,
        wits: p.initiative!.wits,
        willpower: p.initiative!.willpower,
      })),
    )
    const ticksOf = Object.fromEntries(
      order.entries.map((e) => [e.participantId, e.ticks]),
    )
    const updated = participants.map((p) =>
      p.initiative !== undefined
        ? { ...p, ticks: (ticksOf[p.id] ?? 0) + (p.spentTicks ?? 0) }
        : p,
    )

    const nextActorId = yield* settleNextActor(sessionId, updated, acting.member)
    yield* store.patchCombat(combat.id, { participants: updated, nextActorId })

    yield* store.insertRoll({
      sessionId,
      member: acting.member,
      components: [
        { type: "attribute", name: "Dexterity", dots: acting.stats.dexterity },
        { type: "attribute", name: "Composure", dots: acting.stats.composure },
      ],
      // Initiative is a total, not a success count — the summary carries the
      // meaning; the die face and components show the arithmetic.
      result: new DiceRollResult({
        poolSize: PoolSize.make(1),
        rolls: [roll.roll],
        explosions: [],
        roteRerolls: [],
        successes: Successes.make(0),
        isChanceDie: false,
        isDramaticFailure: false,
        isExceptionalSuccess: false,
        visibility: "public",
        againThreshold: 10,
        isRoteAction: false,
      }),
      summary: `${participant.name} rolls initiative — ${roll.roll} + Dexterity ${acting.stats.dexterity} + Composure ${acting.stats.composure} = ${roll.total}.`,
    })

    return combat.id
  },
)

// --- The clock ---

export const SpendTicksArgs = Schema.Struct({
  sessionId: Schema.String,
  participantId: Schema.String,
  /** Preset lane: a named action's book cost. */
  action: Schema.optionalKey(
    Schema.Literals(["attack", "castSpell", "move", "useItem", "aim", "dodge"]),
  ),
  /** Aim/Dodge sub-choice: how many ticks of the 1-per-tick action. */
  count: Schema.optionalKey(Schema.Number),
  /** Free-type lane: the Storyteller's own number. */
  cost: Schema.optionalKey(Schema.Number),
})
export type SpendTicksArgs = typeof SpendTicksArgs.Type

/** A free-typed or aim/dodge tick count the clock can mean. */
const SpendableTicks = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 1, maximum: 100 }),
)
const AimDodgeCount = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 1, maximum: 3 }),
)

/**
 * The three cost lanes, one door (the `draftCast` posture): a preset action's
 * book cost via `applyActionCost`, Aim/Dodge priced per tick with reminder
 * chrome, or the Storyteller's free-typed number — exactly one per bill.
 * Dispatch is `Match.exhaustive` over the closed action set (ADR-0018): a
 * new action literal is a compile error here, never a silent free-lane fall.
 */
const resolveSpend = Effect.fn("Flows.combat.resolveSpend")(function* (
  args: SpendTicksArgs,
  participantId: string,
  currentTicks: number,
) {
  return yield* Match.value(args.action ?? ("free" as const)).pipe(
    Match.whenOr("attack", "castSpell", "move", "useItem", (action) =>
      args.count !== undefined || args.cost !== undefined
        ? new InvalidTickSpend({
            message:
              "A preset action carries its own cost — no count or free cost with it.",
          })
        : Effect.succeed({
            ticks:
              applyActionCost({ participantId, currentTicks, action }).newTicks -
              currentTicks,
            reminder: null,
          }),
    ),
    Match.whenOr("aim", "dodge", (action) => {
      if (args.cost !== undefined) {
        return new InvalidTickSpend({
          message: "Aim and Dodge are priced per tick — pick 1, 2, or 3, not a free cost.",
        })
      }
      const count = args.count ?? 1
      if (!Schema.is(AimDodgeCount)(count)) {
        return new InvalidTickSpend({
          message: `Aim and Dodge take 1, 2, or 3 ticks, got ${args.count}.`,
        })
      }
      return Effect.succeed({
        ticks: count * ACTION_COSTS[action],
        reminder: { kind: action, bonus: count },
      })
    }),
    Match.when("free", () => {
      if (args.cost === undefined) {
        return new InvalidTickSpend({
          message: "Name an action or type a cost — the clock needs one.",
        })
      }
      if (args.count !== undefined) {
        return new InvalidTickSpend({
          message: "A tick count belongs to Aim or Dodge.",
        })
      }
      if (!Schema.is(SpendableTicks)(args.cost)) {
        return new InvalidTickSpend({
          message: `A cost is a whole 1–100 ticks, got ${args.cost}.`,
        })
      }
      return Effect.succeed({ ticks: args.cost, reminder: null })
    }),
    Match.exhaustive,
  )
})

/**
 * The Storyteller bills an action (ADR-0015: the app computes and displays,
 * never auto-bills — this door is the only way Ticks move). Three lanes:
 * a preset cost (Attack 3, Cast 5, Move 3, Use item 3), Aim/Dodge with a
 * 1/2/3 sub-choice that leaves reminder chrome on the chip (+N next attack /
 * +N Defense — displayed memory, never enforced), and a free-typed cost.
 * Any non-Aim/non-Dodge cost clears the chip's reminder. A quiet write but
 * for fate: only a tie-breaking coinflip narrates itself (issue #59).
 */
export const spendTicks = Effect.fn("Flows.combat.spendTicks")(function* (
  args: SpendTicksArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  const storyteller = yield* requireStoryteller(sessionId)
  const store = yield* GameStore

  const combat = yield* requireActiveCombat(sessionId)
  const participant = yield* requireParticipant(combat, args.participantId)
  if (participant.ticks === undefined) {
    return yield* new InitiativeNotRolled({ participantId: participant.id })
  }
  const currentTicks = participant.ticks

  const spend = yield* resolveSpend(args, participant.id, currentTicks)

  const { reminder: _oldReminder, ...bare } = participant
  const billed: CombatParticipant = {
    ...bare,
    ticks: currentTicks + spend.ticks,
    spentTicks: (participant.spentTicks ?? 0) + spend.ticks,
    // Aim/Dodge leave their chrome; any other cost clears what was there.
    ...(spend.reminder !== null ? { reminder: spend.reminder } : {}),
  }
  const participants = combat.participants.map((p) =>
    p.id === participant.id ? billed : p,
  )

  const nextActorId = yield* settleNextActor(sessionId, participants, storyteller)
  yield* store.patchCombat(combat.id, { participants, nextActorId })

  return combat.id
})
