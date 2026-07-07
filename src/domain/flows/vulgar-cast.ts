import { Effect, Option, Schema } from "effect"
import {
  requireMember,
  requireRepairAuthority,
  requireSessionCharacter,
  requireStoryteller,
} from "../authz"
import {
  CastStatus,
  castPoolAfterParadox,
  containmentCap,
  deriveAccumulator,
  effectiveWitnessCount,
  isCommitted,
  isOnStage,
  isUnresolved,
  toGnosisRank,
  type Cast,
} from "../cast"
import { ArcanumName } from "../character"
import { buildPool, rollPool, type RawPoolComponent } from "../dice"
import { applyDamage, healResistantBashing, isIncapacitated } from "../health"
import { CastId, CharacterId, SessionId } from "../ids"
import { improvisedManaCost, spendMana } from "../mana-economy"
import {
  calculateParadoxPool,
  resolveParadox,
  type ParadoxPoolModifier,
} from "../paradox"
import { GameStore } from "../ports/game-store"
import { DocumentNotFound } from "../ports/errors"
import { Mana } from "../quantities"
import { ArcanumTooWeak, InvalidCastDeclaration, outcomeOf } from "./casting"

/**
 * The Vulgar Cast ladder (issue #43, PRD #39, ADR-0016): one flow per dramatic
 * beat, each checking actor authority and document status and refusing on the
 * ADR-0010 taxonomy — the first mutual contract under ADR-0015's second
 * regime. The Cast document is the single source of truth; every beat lands
 * one atomic Activity entry (ADR-0009) so spectators experience the reveals as
 * separate gasps.
 *
 *   draftCast → engageCast (ST) → lockLiabilities (ST) → lockIntention
 *   (caster; Mana committed; POINT OF NO RETURN) → rollParadox (ST's own
 *   button; chance die at zero dice) → containParadox (caster; Resistant
 *   bashing; auto-skipped at zero successes) → rollCastDice (caster's own
 *   button; declared pool − uncontained successes) → resolved
 *
 * Exits: killDraft (owner) / declineDraft (ST) / cancelCast (either party,
 * pre-commitment) → cancelled; voidCast (ST repair, any live stage, Override-
 * stamped, restores Mana and Health, leaves no accumulator trace) → voided.
 * No timeouts anywhere — pending Casts persist until a human moves them.
 *
 * Caster beats walk `requireSessionCharacter`'s authority ladder, so the
 * caster acts unmarked while an ST or Dev acting in their stead is possible
 * but Override-stamped (ADR-0015: visible rule-bending is a feature; silent
 * is impossible). The Paradox roll is Storyteller-gated outright.
 */

// --- Errors (ADR-0010, co-located with the flows that raise them) ---

/** Rules/precondition: one unresolved Cast per character — the queue means something. */
export class CastAlreadyPending extends Schema.TaggedErrorClass<CastAlreadyPending>()(
  "CastAlreadyPending",
  {
    characterId: CharacterId,
    pendingCastId: CastId,
  },
) {}

/** Rules/precondition: the stage is exclusive — one engaged Cast at a time. */
export class StageOccupied extends Schema.TaggedErrorClass<StageOccupied>()(
  "StageOccupied",
  {
    sessionId: SessionId,
    onStageCastId: CastId,
    casterName: Schema.String,
  },
) {}

/**
 * Rules/precondition: the beat fired against the wrong rung of the ladder —
 * out of order, already taken, or the Cast is terminal. Inside the contract
 * this refusal is symmetric: it answers the Storyteller as readily as the
 * caster (ADR-0015). `needed` is display prose, not vocabulary — some beats
 * accept a band of rungs.
 */
export class CastStatusConflict extends Schema.TaggedErrorClass<CastStatusConflict>()(
  "CastStatusConflict",
  {
    castId: CastId,
    status: CastStatus,
    needed: Schema.String,
  },
) {}

/** Validation: a liability edit that no ruling could mean (issue #44). */
export class InvalidLiability extends Schema.TaggedErrorClass<InvalidLiability>()(
  "InvalidLiability",
  { message: Schema.String },
) {}

/** Validation: the mitigation declaration itself is malformed or pointless. */
export class InvalidMitigation extends Schema.TaggedErrorClass<InvalidMitigation>()(
  "InvalidMitigation",
  { message: Schema.String },
) {}

/** Rules/precondition: containment outside 0..min(successes, empty boxes). */
export class InvalidContainment extends Schema.TaggedErrorClass<InvalidContainment>()(
  "InvalidContainment",
  {
    message: Schema.String,
    cap: Schema.Number,
  },
) {}

// --- Shared helpers ---

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** The session-scoped Cast read: a Cast outside this session isn't there. */
const requireCast = Effect.fn("Flows.vulgarCast.requireCast")(function* (
  sessionId: SessionId,
  castId: CastId,
) {
  const store = yield* GameStore
  const cast = yield* store.getCast(castId)
  if (cast.sessionId !== sessionId) {
    return yield* new DocumentNotFound({ table: "casts", id: castId })
  }
  return cast
})

/** The ladder's order enforcement: this beat exists only on `needed`. */
const requireStatus = Effect.fn("Flows.vulgarCast.requireStatus")(function* (
  cast: Cast,
  needed: CastStatus,
) {
  if (cast.status !== needed) {
    return yield* new CastStatusConflict({
      castId: cast.id,
      status: cast.status,
      needed,
    })
  }
})

/**
 * A beat field that a prior beat must have stamped: absence at this rung is a
 * document-corruption bug, not a client-actionable failure (Fail/Die split).
 */
const stamped = <A>(value: A | undefined, field: string): Effect.Effect<A> =>
  value === undefined
    ? Effect.die(new Error(`Cast document missing ${field} at its status rung`))
    : Effect.succeed(value)

/**
 * A named dice modifier as pool components, chunked to the ±10 a component
 * holds (a deep-Scene accumulator can outgrow one box).
 */
const modifierComponents = (name: string, dots: number): Array<RawPoolComponent> => {
  const components: Array<RawPoolComponent> = []
  for (let rest = dots; rest !== 0; ) {
    const chunk = rest > 0 ? Math.min(rest, 10) : Math.max(rest, -10)
    components.push({ type: "modifier", name, dots: chunk })
    rest -= chunk
  }
  return components
}

/**
 * The Paradox pool's inputs as the engage beat stamped them and the
 * negotiation edited them (issue #44). Rows written before the witness count
 * existed fall back to the coarse boolean ("one or more" = 1).
 */
const paradoxInputs = Effect.fn("Flows.vulgarCast.paradoxInputs")(function* (
  cast: Cast,
) {
  const gnosis = yield* stamped(cast.gnosis, "gnosis")
  yield* stamped(cast.sleeperWitnesses, "sleeperWitnesses")
  const priorParadoxRolls = yield* stamped(cast.priorParadoxRolls, "priorParadoxRolls")
  return {
    gnosis: toGnosisRank(gnosis),
    usesMagicalTool: cast.usesMagicalTool,
    witnessCount: effectiveWitnessCount(cast),
    priorParadoxRollsThisScene: priorParadoxRolls,
    discretionaryModifiers: cast.discretionaryModifiers ?? [],
  }
})

/** Attribution follows the character's owner (ADR-0006), as in every cast flow. */
const casterMembership = Effect.fn("Flows.vulgarCast.casterMembership")(function* (
  cast: Cast,
) {
  const store = yield* GameStore
  return yield* store.getMembership(cast.sessionId, cast.casterUserId)
})

// --- The beats ---

export interface DraftCastArgs {
  readonly sessionId: string
  readonly characterId: string
  readonly arcanum: string
  readonly level: number
  readonly intent?: string
  readonly usesMagicalTool?: boolean
}

const DraftDeclaration = Schema.Struct({
  arcanum: ArcanumName,
  level: Schema.Number.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 5 }),
  ),
})

/**
 * The caster declares a Vulgar Cast into the wings: free, no Storyteller
 * attention needed, no mechanical weight until engaged. The declared pool
 * (Gnosis + Arcanum) and spell Mana cost freeze here — the sheet as it stands
 * at declaration is the sheet the Cast plays from.
 */
export const draftCast = Effect.fn("Flows.vulgarCast.draftCast")(function* (
  args: DraftCastArgs,
) {
  const sessionId = SessionId.make(args.sessionId)

  const declaration = yield* Schema.decodeUnknownEffect(DraftDeclaration)({
    arcanum: args.arcanum,
    level: args.level,
  }).pipe(
    Effect.mapError(
      () =>
        new InvalidCastDeclaration({
          message: `Not a castable declaration: ${args.arcanum} ${args.level}`,
        }),
    ),
  )

  const store = yield* GameStore
  const sheet = yield* requireSessionCharacter(
    sessionId,
    CharacterId.make(args.characterId),
  )

  const dots = sheet.arcana[declaration.arcanum] ?? 0
  if (dots < declaration.level) {
    return yield* new ArcanumTooWeak({
      arcanum: declaration.arcanum,
      level: declaration.level,
      dots,
    })
  }

  // One unresolved Cast per character — the queue means something (PRD #39).
  const casts = yield* store.listCasts(sessionId)
  const pending = casts.find(
    (c) => c.characterId === sheet.id && isUnresolved(c.status),
  )
  if (pending) {
    return yield* new CastAlreadyPending({
      characterId: sheet.id,
      pendingCastId: pending.id,
    })
  }

  const member = yield* store.getMembership(sheet.sessionId, sheet.userId)

  const declaredComponents: ReadonlyArray<RawPoolComponent> = [
    { type: "gnosis", name: "Gnosis", dots: sheet.gnosis },
    { type: "arcanum", name: capitalize(declaration.arcanum), dots },
  ]
  const intent = args.intent?.trim()

  const castId = yield* store.insertCast({
    sessionId,
    characterId: sheet.id,
    casterUserId: sheet.userId,
    casterName: member.displayName,
    arcanum: declaration.arcanum,
    level: declaration.level,
    ...(intent ? { intent } : {}),
    usesMagicalTool: args.usesMagicalTool ?? false,
    declaredComponents,
    declaredPool: sheet.gnosis + dots,
    spellManaCost: improvisedManaCost(sheet.path, declaration.arcanum),
  })

  yield* store.insertMessage({
    sessionId,
    sender: { userId: member.userId, displayName: member.displayName },
    text: `${member.displayName} drafts a vulgar ${capitalize(declaration.arcanum)} ${declaration.level} cast${intent ? ` — "${intent}"` : ""}. It waits in the wings.`,
    visibility: "system",
  })

  return castId
})

export interface CastStepArgs {
  readonly sessionId: string
  readonly castId: string
}

/** The owner kills their own draft: free, changing your mind costs nothing. */
export const killDraft = Effect.fn("Flows.vulgarCast.killDraft")(function* (
  args: CastStepArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  const castId = CastId.make(args.castId)
  const store = yield* GameStore

  const cast = yield* requireCast(sessionId, castId)
  // Authority before status: a stranger learns nothing about the ladder.
  yield* requireSessionCharacter(sessionId, cast.characterId)
  yield* requireStatus(cast, "draft")

  yield* store.patchCast(castId, { status: "cancelled" })

  const member = yield* casterMembership(cast)
  yield* store.insertMessage({
    sessionId,
    sender: { userId: member.userId, displayName: member.displayName },
    text: `${cast.casterName} withdraws the drafted cast.`,
    visibility: "system",
  })

  return castId
})

/** The Storyteller declines a draft with attribution — "not now". */
export const declineDraft = Effect.fn("Flows.vulgarCast.declineDraft")(function* (
  args: CastStepArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  const castId = CastId.make(args.castId)
  const store = yield* GameStore

  const storyteller = yield* requireStoryteller(sessionId)
  const cast = yield* requireCast(sessionId, castId)
  yield* requireStatus(cast, "draft")

  yield* store.patchCast(castId, { status: "cancelled" })

  yield* store.insertMessage({
    sessionId,
    sender: { userId: storyteller.userId, displayName: storyteller.displayName },
    text: `${storyteller.displayName} declines ${cast.casterName}'s drafted cast — not now.`,
    visibility: "system",
  })

  return castId
})

/**
 * The Storyteller engages a draft onto the exclusive stage. The liability
 * defaults freeze off the table here — Gnosis from the sheet, witnesses from
 * the Scene toggle, the accumulator derived from resolved Cast history
 * (ADR-0012) — as computed defaults (ADR-0015; the editing UI is a later
 * slice). No Scene open is legal: downtime casting accumulates nothing.
 */
export const engageCast = Effect.fn("Flows.vulgarCast.engageCast")(function* (
  args: CastStepArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  const castId = CastId.make(args.castId)
  const store = yield* GameStore

  const storyteller = yield* requireStoryteller(sessionId)
  const cast = yield* requireCast(sessionId, castId)
  yield* requireStatus(cast, "draft")

  const casts = yield* store.listCasts(sessionId)
  const onStage = casts.find((c) => isOnStage(c.status))
  if (onStage) {
    return yield* new StageOccupied({
      sessionId,
      onStageCastId: onStage.id,
      casterName: onStage.casterName,
    })
  }

  const sheet = yield* store.getSheet(cast.characterId)
  const scene = yield* store.getActiveScene(sessionId)
  const sceneId = Option.isSome(scene) ? scene.value.id : undefined

  const sleeperWitnesses = Option.isSome(scene)
    ? scene.value.sleeperWitnesses
    : false
  yield* store.patchCast(castId, {
    status: "engaged",
    ...(sceneId !== undefined ? { sceneId } : {}),
    gnosis: sheet.gnosis,
    sleeperWitnesses,
    // The toggle's "one or more" becomes a countable default the ST's
    // liability buttons then negotiate over (issue #44).
    witnessCount: sleeperWitnesses ? 1 : 0,
    priorParadoxRolls: deriveAccumulator(casts, sceneId, cast.characterId),
  })

  yield* store.insertMessage({
    sessionId,
    sender: { userId: storyteller.userId, displayName: storyteller.displayName },
    text: `${storyteller.displayName} engages ${cast.casterName}'s vulgar cast — it takes the stage.`,
    visibility: "system",
  })

  return castId
})

export interface EditLiabilitiesArgs extends CastStepArgs {
  /** Sleeper head count; dice stay the book's flat +2 for one-or-more. */
  readonly witnessCount?: number
  /** The ST's override of the derived accumulator default (ADR-0015). */
  readonly priorParadoxRolls?: number
  /** The whole discretionary list as it should now read — replace, not merge. */
  readonly discretionaryModifiers?: ReadonlyArray<ParadoxPoolModifier>
}

/**
 * The Storyteller's liability buttons (issue #44, PRD #39 stories 14/17): each
 * press patches the shared document during negotiation, and every screen
 * watches the Paradox pool reassemble in realtime. Only the ST's side of the
 * document is reachable here — the caster's fields have their own doors — and
 * only on `engaged`: after the ST locks, the caster commits against a frozen
 * pool, so liability edits refuse. No Activity entry lands: negotiation is
 * table talk, not a reveal (ADR-0016); the lock narrates the final pool.
 */
export const editLiabilities = Effect.fn("Flows.vulgarCast.editLiabilities")(
  function* (args: EditLiabilitiesArgs) {
    const sessionId = SessionId.make(args.sessionId)
    const castId = CastId.make(args.castId)
    const store = yield* GameStore

    yield* requireStoryteller(sessionId)
    const cast = yield* requireCast(sessionId, castId)
    yield* requireStatus(cast, "engaged")

    if (
      args.witnessCount !== undefined &&
      (!Number.isInteger(args.witnessCount) || args.witnessCount < 0)
    ) {
      return yield* new InvalidLiability({
        message: `Witnesses must be a whole count of Sleepers, got ${args.witnessCount}.`,
      })
    }
    if (
      args.priorParadoxRolls !== undefined &&
      (!Number.isInteger(args.priorParadoxRolls) || args.priorParadoxRolls < 0)
    ) {
      return yield* new InvalidLiability({
        message: `The accumulator must be a whole count of prior rolls, got ${args.priorParadoxRolls}.`,
      })
    }
    for (const modifier of args.discretionaryModifiers ?? []) {
      if (modifier.source.trim().length === 0) {
        return yield* new InvalidLiability({
          message: "A discretionary modifier needs a name the table can read.",
        })
      }
      if (!Number.isInteger(modifier.dice) || modifier.dice === 0) {
        return yield* new InvalidLiability({
          message: `A discretionary modifier must be a whole nonzero die count, got ${modifier.dice}.`,
        })
      }
    }

    yield* store.patchCast(castId, {
      ...(args.witnessCount !== undefined
        ? { witnessCount: args.witnessCount }
        : {}),
      ...(args.priorParadoxRolls !== undefined
        ? { priorParadoxRolls: args.priorParadoxRolls }
        : {}),
      ...(args.discretionaryModifiers !== undefined
        ? { discretionaryModifiers: args.discretionaryModifiers }
        : {}),
    })

    return castId
  },
)

export interface SetMagicalToolArgs extends CastStepArgs {
  readonly usesMagicalTool: boolean
}

/**
 * The caster's side of the negotiation (issue #44): the magical-tool flag is
 * theirs to change until the ST locks liabilities — after that the caster
 * would be reshaping the very pool the lock froze. Walks the same authority
 * ladder as every caster beat (owner plain; ST/Dev in-stead Override-stamped,
 * ADR-0015). Table talk like the ST's buttons: no Activity entry.
 */
export const setMagicalTool = Effect.fn("Flows.vulgarCast.setMagicalTool")(
  function* (args: SetMagicalToolArgs) {
    const sessionId = SessionId.make(args.sessionId)
    const castId = CastId.make(args.castId)
    const store = yield* GameStore

    const cast = yield* requireCast(sessionId, castId)
    // Authority before status: a stranger learns nothing about the ladder.
    yield* requireSessionCharacter(sessionId, cast.characterId)
    if (cast.status !== "draft" && cast.status !== "engaged") {
      return yield* new CastStatusConflict({
        castId: cast.id,
        status: cast.status,
        needed: "draft | engaged",
      })
    }

    yield* store.patchCast(castId, { usesMagicalTool: args.usesMagicalTool })

    return castId
  },
)

/** The Storyteller locks liabilities: the caster now commits against a frozen pool. */
export const lockLiabilities = Effect.fn("Flows.vulgarCast.lockLiabilities")(
  function* (args: CastStepArgs) {
    const sessionId = SessionId.make(args.sessionId)
    const castId = CastId.make(args.castId)
    const store = yield* GameStore

    const storyteller = yield* requireStoryteller(sessionId)
    const cast = yield* requireCast(sessionId, castId)
    yield* requireStatus(cast, "engaged")

    yield* store.patchCast(castId, { status: "liabilitiesLocked" })

    const pool = calculateParadoxPool(yield* paradoxInputs(cast))
    yield* store.insertMessage({
      sessionId,
      sender: { userId: storyteller.userId, displayName: storyteller.displayName },
      text: `${storyteller.displayName} locks the liabilities: ${cast.casterName} faces a ${pool.totalDice}-die Paradox pool.`,
      visibility: "system",
    })

    return castId
  },
)

export interface LockIntentionArgs extends CastStepArgs {
  /** Mana spent shrinking the Paradox pool, 1 per die — blind insurance. */
  readonly manaMitigation: number
}

/**
 * The caster locks intention — THE POINT OF NO RETURN. Mitigation and the
 * spell's Mana cost commit atomically; from here the only exits are playing
 * the Cast out or a Storyteller void (ADR-0015's contract regime).
 */
export const lockIntention = Effect.fn("Flows.vulgarCast.lockIntention")(function* (
  args: LockIntentionArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  const castId = CastId.make(args.castId)
  const store = yield* GameStore

  const cast = yield* requireCast(sessionId, castId)
  const sheet = yield* requireSessionCharacter(sessionId, cast.characterId)
  yield* requireStatus(cast, "liabilitiesLocked")

  const mitigation = args.manaMitigation
  if (!Number.isInteger(mitigation) || mitigation < 0) {
    return yield* new InvalidMitigation({
      message: `Mitigation must be a whole number of Mana, got ${mitigation}.`,
    })
  }
  const pool = calculateParadoxPool(yield* paradoxInputs(cast))
  if (mitigation > pool.totalDice) {
    return yield* new InvalidMitigation({
      message: `The Paradox pool holds ${pool.totalDice} dice; ${mitigation} Mana would buy off more than exists.`,
    })
  }

  // The commit is atomic with the status step: spendMana refuses before any
  // write, and the Convex transaction carries the rest (ADR-0016).
  const cost = Mana.make(cast.spellManaCost + mitigation)
  const manaRemaining = yield* spendMana(sheet.manaCurrent, cost)
  yield* store.patchSheet(sheet.id, { manaCurrent: manaRemaining })

  yield* store.patchCast(castId, {
    status: "intentionLocked",
    manaMitigation: mitigation,
  })

  const member = yield* casterMembership(cast)
  yield* store.insertMessage({
    sessionId,
    sender: { userId: member.userId, displayName: member.displayName },
    text: `${cast.casterName} locks intention, committing ${cost} Mana${mitigation > 0 ? ` (${mitigation} to mitigation)` : ""}. The point of no return.`,
    visibility: "system",
  })

  return castId
})

/**
 * Free cancel, either party, before the caster's lock: an in-fiction
 * reconsideration, not a repair — plain provenance, the stage frees.
 */
export const cancelCast = Effect.fn("Flows.vulgarCast.cancelCast")(function* (
  args: CastStepArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  const castId = CastId.make(args.castId)
  const store = yield* GameStore

  const member = yield* requireMember(sessionId)
  const cast = yield* requireCast(sessionId, castId)
  // The caster backs off their own Cast plainly; anyone else needs the
  // Storyteller's chair (which also answers a third player's click).
  if (member.userId !== cast.casterUserId) {
    yield* requireStoryteller(sessionId)
  }

  if (cast.status !== "engaged" && cast.status !== "liabilitiesLocked") {
    return yield* new CastStatusConflict({
      castId: cast.id,
      status: cast.status,
      needed: "engaged | liabilitiesLocked",
    })
  }

  yield* store.patchCast(castId, { status: "cancelled" })

  yield* store.insertMessage({
    sessionId,
    sender: { userId: member.userId, displayName: member.displayName },
    text: `${member.displayName} waves the cast off — ${cast.casterName}'s magic disperses unspent.`,
    visibility: "system",
  })

  return castId
})

/**
 * The Storyteller's own Paradox-roll button — never auto-fired, never anyone
 * else's. The roll always happens: a fully mitigated pool still throws the
 * chance die (the rules' gamble is honest). Zero successes skip containment —
 * no empty ceremony — landing the Cast directly on `contained`.
 */
export const rollParadox = Effect.fn("Flows.vulgarCast.rollParadox")(function* (
  args: CastStepArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  const castId = CastId.make(args.castId)
  const store = yield* GameStore

  const storyteller = yield* requireStoryteller(sessionId)
  const cast = yield* requireCast(sessionId, castId)
  yield* requireStatus(cast, "intentionLocked")

  const mitigation = yield* stamped(cast.manaMitigation, "manaMitigation")
  const inputs = yield* paradoxInputs(cast)
  const pool = calculateParadoxPool({ ...inputs, manaMitigation: mitigation })

  const components: ReadonlyArray<RawPoolComponent> = [
    { type: "modifier", name: "Paradox (Gnosis)", dots: pool.baseDice },
    ...pool.modifiers.flatMap((m) => modifierComponents(m.source, m.dice)),
  ]
  const dicePool = yield* buildPool(components)
  const result = yield* rollPool(dicePool)

  const skipContainment = result.successes === 0
  yield* store.patchCast(castId, {
    status: skipContainment ? "contained" : "paradoxRolled",
    paradoxSuccesses: result.successes,
    paradoxIsDramaticFailure: result.isDramaticFailure,
    ...(skipContainment ? { containedSuccesses: 0 } : {}),
  })

  const dice = result.isChanceDie ? "a chance die" : `${result.poolSize} dice`
  yield* store.insertRoll({
    sessionId,
    member: storyteller,
    components,
    result,
    summary: result.isDramaticFailure
      ? `Reality rolls ${dice} against ${cast.casterName} — a dramatic failure! Paradox leaves the caster alone, and the Scene forgives its next accumulation.`
      : `Reality rolls ${dice} against ${cast.casterName} — ${outcomeOf(result)}${skipContainment ? ". Nothing to contain; the way to the cast is clear" : ""}.`,
  })

  return castId
})

export interface ContainParadoxArgs extends CastStepArgs {
  /** Paradox successes absorbed as Resistant bashing, one wound per success. */
  readonly containedSuccesses: number
}

/**
 * The caster bets their flesh: each contained success writes one Resistant
 * bashing wound (issue #41), capped by the boxes still empty — the martyr play
 * down to the last box is possible, death is not. Zero is a legal choice.
 */
export const containParadox = Effect.fn("Flows.vulgarCast.containParadox")(function* (
  args: ContainParadoxArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  const castId = CastId.make(args.castId)
  const store = yield* GameStore

  const cast = yield* requireCast(sessionId, castId)
  const sheet = yield* requireSessionCharacter(sessionId, cast.characterId)
  yield* requireStatus(cast, "paradoxRolled")

  const successes = yield* stamped(cast.paradoxSuccesses, "paradoxSuccesses")
  const contained = args.containedSuccesses
  const cap = containmentCap(sheet.healthTrack, successes)
  if (!Number.isInteger(contained) || contained < 0 || contained > cap) {
    return yield* new InvalidContainment({
      message: `Containment must be between 0 and ${cap} (successes rolled, Health remaining), got ${contained}.`,
      cap,
    })
  }

  let track = sheet.healthTrack
  for (let i = 0; i < contained; i++) {
    track = applyDamage(track, "bashing", { resistant: true })
  }
  if (contained > 0) {
    yield* store.patchSheet(sheet.id, { healthTrack: track })
  }

  yield* store.patchCast(castId, {
    status: "contained",
    containedSuccesses: contained,
  })

  const member = yield* casterMembership(cast)
  const martyred = contained > 0 && isIncapacitated(track)
  yield* store.insertMessage({
    sessionId,
    sender: { userId: member.userId, displayName: member.displayName },
    text:
      contained === 0
        ? `${cast.casterName} lets the Paradox run — all ${successes} ${successes === 1 ? "success" : "successes"} will mar the cast and the world.`
        : `${cast.casterName} contains ${contained} of ${successes} Paradox ${successes === 1 ? "success" : "successes"}, taking ${contained} Resistant bashing.` +
          (martyred
            ? " The last health box fills — the caster is going down with the spell (unconsciousness: Storyteller adjudicates)."
            : ""),
    visibility: "system",
  })

  return castId
})

/**
 * The climax: the caster's own cast-roll button, a separate beat from
 * containment — picking up the dice is its own moment. Pool = declared −
 * uncontained successes (chance die at zero or below); resolution records both
 * rolls' outcomes and the Paradox severity, and frees the stage.
 */
export const rollCastDice = Effect.fn("Flows.vulgarCast.rollCastDice")(function* (
  args: CastStepArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  const castId = CastId.make(args.castId)
  const store = yield* GameStore

  const cast = yield* requireCast(sessionId, castId)
  yield* requireSessionCharacter(sessionId, cast.characterId)
  yield* requireStatus(cast, "contained")

  const paradoxSuccesses = yield* stamped(cast.paradoxSuccesses, "paradoxSuccesses")
  const contained = yield* stamped(cast.containedSuccesses, "containedSuccesses")
  const uncontained = paradoxSuccesses - contained
  const castPool = castPoolAfterParadox(cast.declaredPool, paradoxSuccesses, contained)

  // Zero and fewer dice are the same chance die, so record only the effective
  // penalty (the factor-penalty precedent in `flows/casting.ts`).
  const effectivePenalty = Math.max(-uncontained, -cast.declaredPool)
  const components: ReadonlyArray<RawPoolComponent> = [
    ...cast.declaredComponents,
    ...modifierComponents("Uncontained Paradox", effectivePenalty),
  ]
  const dicePool = yield* buildPool(components)
  const result = yield* rollPool(dicePool)

  const severity = resolveParadox(uncontained).severity
  yield* store.patchCast(castId, {
    status: "resolved",
    castPool,
    castSuccesses: result.successes,
    severity,
  })

  const member = yield* casterMembership(cast)
  const dice = result.isChanceDie ? "a chance die" : `${result.poolSize} dice`
  yield* store.insertRoll({
    sessionId,
    member,
    components,
    result,
    summary:
      `${cast.casterName} releases the vulgar ${capitalize(cast.arcanum)} ${cast.level} spell (${dice}) and gets ${outcomeOf(result)}.` +
      (severity === "none"
        ? " Reality lets it pass."
        : ` The uncontained Paradox manifests as ${capitalize(severity)}.`),
  })

  return castId
})

/**
 * The Storyteller's void: not a quiet retreat but an Override-stamped,
 * table-visible repair (ADR-0015) — any live stage, restores committed Mana
 * and containment Health, frees the stage, and leaves no accumulator trace
 * (the Cast never reaches `resolved`).
 */
export const voidCast = Effect.fn("Flows.vulgarCast.voidCast")(function* (
  args: CastStepArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  const castId = CastId.make(args.castId)
  const store = yield* GameStore

  const editor = yield* requireRepairAuthority(sessionId)
  const cast = yield* requireCast(sessionId, castId)
  if (!isUnresolved(cast.status)) {
    return yield* new CastStatusConflict({
      castId: cast.id,
      status: cast.status,
      needed: "any unresolved status",
    })
  }

  const restoredMana = isCommitted(cast.status)
    ? cast.spellManaCost + (cast.manaMitigation ?? 0)
    : 0
  const restoredHealth = cast.containedSuccesses ?? 0

  if (restoredMana > 0 || restoredHealth > 0) {
    const sheet = yield* store.getSheet(cast.characterId)
    yield* store.patchSheet(sheet.id, {
      ...(restoredMana > 0
        ? {
            manaCurrent: Mana.make(
              Math.min(sheet.manaCurrent + restoredMana, sheet.maxMana),
            ),
          }
        : {}),
      ...(restoredHealth > 0
        ? { healthTrack: healResistantBashing(sheet.healthTrack, restoredHealth) }
        : {}),
    })
  }

  yield* store.patchCast(castId, { status: "voided" })

  const restored =
    restoredMana > 0 || restoredHealth > 0
      ? ` ${[
          ...(restoredMana > 0 ? [`${restoredMana} Mana`] : []),
          ...(restoredHealth > 0 ? [`${restoredHealth} Health`] : []),
        ].join(" and ")} restored.`
      : ""
  yield* store.insertMessage({
    sessionId,
    sender: { userId: editor.userId, displayName: editor.displayName },
    text: `${editor.displayName} voids ${cast.casterName}'s cast — struck from the record.${restored}`,
    visibility: "system",
  })

  return castId
})
