import { Array as Arr, Effect, Option, Schema } from "effect"
import {
  requireMember,
  requireRepairAuthority,
  requireSessionCharacter,
  requireStoryteller,
} from "../authz"
import {
  CastStatus,
  containmentCap,
  finalCastPool,
  isCommitted,
  isOnStage,
  isPriceFrozen,
  isRoteCast,
  isUnresolved,
  sceneTides,
  toGnosisRank,
  type Cast,
  type TidesSnapshot,
} from "../cast"
import { ArcanumName } from "../character"
import { buildPool, rollPool, type RawPoolComponent } from "../dice"
import { applyDamage, isIncapacitated, woundPenalty } from "../health"
import { CastId, CharacterId, SessionId } from "../ids"
import { improvisedManaCost, spendMana } from "../mana-economy"
import {
  calculateParadoxPool,
  modifierComplaint,
  ParadoxPoolModifier,
  resolveParadox,
} from "../paradox"
import { GameStore } from "../ports/game-store"
import { DocumentNotFound } from "../ports/errors"
import { Mana, Willpower } from "../quantities"
import { requireVulgarSpell, resolveRotePool } from "../rote-cast"
import type { CharacterSheet } from "../character"
import { spendWillpower, WILLPOWER_BONUS_DICE } from "../willpower-economy"
import {
  ArcanumTooWeak,
  InvalidCastDeclaration,
  modifierComponents,
  outcomeOf,
} from "./casting"
import { requireKnownRote } from "./rote-cast"

/**
 * The Vulgar Cast ladder (issue #43, PRD #39, ADR-0016 as amended by
 * ADR-0022): one flow per commitment, each checking actor authority, document
 * status, and phase, and refusing on the ADR-0010 taxonomy — the first mutual
 * contract under ADR-0015's second regime. The Cast document is the single
 * source of truth; commitments land atomic Activity entries (ADR-0009) while
 * drafting stays broadcast working state on the document itself.
 *
 *   draftCast → engageCast (ST; the stage) → [adjustPrice*] → lockPrice (ST;
 *   THE FREEZE — Tides stamped, irrevocably hands-off) → commitCast (caster;
 *   Mana + precommitted Willpower spent; POINT OF NO RETURN) → rollParadox
 *   (ST's own button; chance die at zero dice) → [setDraftContainment*] →
 *   releaseCast (caster's one Cast click: containment lands and the dice fly
 *   in one commitment) → resolved
 *
 * Exits: killDraft (owner) / declineDraft (ST) → cancelled; cancelCast
 * (either party, anywhere on The Price — the caster may bail on a frozen
 * price) → cancelled; voidCast (ST repair, any live stage, Override-stamped,
 * restores Mana and Willpower, leaves no accumulator trace) → voided.
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
 * Rules/precondition: the beat fired against the wrong rung — or the wrong
 * phase of a two-colored rung (ADR-0022) — out of order, already taken, or
 * the Cast is terminal. Inside the contract this refusal is symmetric: it
 * answers the Storyteller as readily as the caster (ADR-0015). `needed` is
 * display prose, not vocabulary — a phase is prose on its rung.
 */
export class CastStatusConflict extends Schema.TaggedErrorClass<CastStatusConflict>()(
  "CastStatusConflict",
  {
    castId: CastId,
    status: CastStatus,
    needed: Schema.String,
  },
) {}

/** Validation: a personal adjustment that no ruling could mean (ADR-0022). */
export class InvalidAdjustment extends Schema.TaggedErrorClass<InvalidAdjustment>()(
  "InvalidAdjustment",
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

/** A whole, non-negative count — the shape every negotiated tally must fit. */
const WholeCount = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
)

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
 * The two-colored phase enforcement (ADR-0022): The Price before the freeze
 * (the ST's fluid assembly) or after it (the caster's settled decision).
 */
const requirePricePhase = Effect.fn("Flows.vulgarCast.requirePricePhase")(
  function* (cast: Cast, phase: "fluid" | "frozen") {
    yield* requireStatus(cast, "price")
    if (isPriceFrozen(cast) !== (phase === "frozen")) {
      return yield* new CastStatusConflict({
        castId: cast.id,
        status: cast.status,
        needed:
          phase === "fluid"
            ? "The Price, before the freeze"
            : "The Price, after the freeze",
      })
    }
  },
)

/**
 * The Paradox rung's phase enforcement (ADR-0022): before the ST's roll
 * (successes unstamped) or after it (the caster's cockpit).
 */
const requireParadoxPhase = Effect.fn("Flows.vulgarCast.requireParadoxPhase")(
  function* (cast: Cast, phase: "unrolled" | "rolled") {
    yield* requireStatus(cast, "paradox")
    if ((cast.paradoxSuccesses !== undefined) !== (phase === "rolled")) {
      return yield* new CastStatusConflict({
        castId: cast.id,
        status: cast.status,
        needed:
          phase === "unrolled"
            ? "Paradox, before the roll"
            : "Paradox, after the roll",
      })
    }
  },
)

/**
 * A beat field that a prior beat must have stamped: absence at this rung is a
 * document-corruption bug, not a client-actionable failure (Fail/Die split).
 */
const stamped = <A>(value: A | undefined, field: string): Effect.Effect<A> =>
  value === undefined
    ? Effect.die(new Error(`Cast document missing ${field} at its status rung`))
    : Effect.succeed(value)

/**
 * The one containment rule both cockpit doors enforce (ADR-0022): the draft
 * box clicks and the release itself bet inside 0..min(successes rolled,
 * Health remaining). Returns the stamped successes for the release's math.
 */
const requireContainable = Effect.fn("Flows.vulgarCast.requireContainable")(
  function* (cast: Cast, sheet: CharacterSheet, contained: number) {
    const successes = yield* stamped(cast.paradoxSuccesses, "paradoxSuccesses")
    const cap = containmentCap(sheet.healthTrack, successes)
    if (!Schema.is(WholeCount)(contained) || contained > cap) {
      return yield* new InvalidContainment({
        message: `Containment must be between 0 and ${cap} (successes rolled, Health remaining), got ${contained}.`,
        cap,
      })
    }
    return successes
  },
)

/**
 * The Paradox pool's inputs as the freeze stamped them (ADR-0022): the frozen
 * Tides seed plus the ST's personal adjustments — stamped, never re-derived.
 * The freeze itself passes the seed it is about to stamp; every later beat
 * reads it off the document.
 */
const paradoxInputs = Effect.fn("Flows.vulgarCast.paradoxInputs")(function* (
  cast: Cast,
  justStamped?: TidesSnapshot,
) {
  const gnosis = yield* stamped(cast.gnosis, "gnosis")
  const tides = justStamped ?? (yield* stamped(cast.tides, "tides"))
  return {
    gnosis: toGnosisRank(gnosis),
    isRote: isRoteCast(cast),
    usesMagicalTool: cast.usesMagicalTool,
    witnessCount: tides.witnessCount,
    priorParadoxRollsThisScene: tides.priorParadoxRolls,
    discretionaryModifiers: [
      ...tides.circumstances,
      ...(cast.adjustments ?? []),
    ],
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

export const DraftCastArgs = Schema.Struct({
  sessionId: Schema.String,
  characterId: Schema.String,
  /** Improvised lane: the declared Arcanum and effect level (its Practice). */
  arcanum: Schema.optionalKey(Schema.String),
  level: Schema.optionalKey(Schema.Number),
  /** Rote lane (issue #47): the trained Rote, plus the "or"-pool pick. */
  roteName: Schema.optionalKey(Schema.String),
  skillChoice: Schema.optionalKey(Schema.String),
  intent: Schema.optionalKey(Schema.String),
  usesMagicalTool: Schema.optionalKey(Schema.Boolean),
  /** The blind Willpower precommitment (ADR-0022, WoD p. 133): +3 dice now,
   * the point deducted at the commit, as losable to Paradox as any die. */
  spendWillpower: Schema.optionalKey(Schema.Boolean),
})
export type DraftCastArgs = typeof DraftCastArgs.Type

const DraftDeclaration = Schema.Struct({
  arcanum: ArcanumName,
  level: Schema.Number.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 5 }),
  ),
})

/**
 * The improvised lane's frozen declaration: Gnosis + Arcanum off the sheet,
 * gated by the caster's dots, priced by the Path (PRD #39 story 8).
 */
const improvisedDeclaration = Effect.fn("Flows.vulgarCast.improvisedDeclaration")(
  function* (sheet: CharacterSheet, arcanum: string | undefined, level: number | undefined) {
    const declaration = yield* Schema.decodeUnknownEffect(DraftDeclaration)({
      arcanum,
      level,
    }).pipe(
      Effect.mapError(
        () =>
          new InvalidCastDeclaration({
            message: `Not a castable declaration: ${arcanum} ${level}`,
          }),
      ),
    )

    const dots = sheet.arcana[declaration.arcanum] ?? 0
    if (dots < declaration.level) {
      return yield* new ArcanumTooWeak({
        arcanum: declaration.arcanum,
        level: declaration.level,
        dots,
      })
    }

    const declaredComponents: ReadonlyArray<RawPoolComponent> = [
      { type: "gnosis", name: "Gnosis", dots: sheet.gnosis },
      { type: "arcanum", name: capitalize(declaration.arcanum), dots },
    ]
    return {
      isRote: false as const,
      arcanum: declaration.arcanum,
      level: declaration.level,
      declaredComponents,
      declaredPool: sheet.gnosis + dots,
      spellManaCost: improvisedManaCost(sheet.path, declaration.arcanum),
    }
  },
)

/**
 * The rote lane's frozen declaration (issue #47): the trained Rote's
 * structured pool resolved against the sheet — the same leaf `castRote`
 * casts from, "or"-skill choice included — with the Arcanum and level read
 * off the spell's reference row, never off client numbers or the sheet's
 * denormalized copy. The Aspect gate mirrors the covert flow's: a Covert
 * rote casts atomically and refuses the ladder, so the lanes stay disjoint.
 * The knownRotes list is the qualification, not a dot check (ADR-0011: a
 * fudged sheet still casts), and a Rote skips the improvised Path cost (the
 * castRote convention).
 */
const roteDeclaration = Effect.fn("Flows.vulgarCast.roteDeclaration")(function* (
  sheet: CharacterSheet,
  roteName: string,
  skillChoice: string | undefined,
) {
  const store = yield* GameStore
  const rote = yield* requireKnownRote(sheet, roteName)
  const spell = yield* store.getSpell(rote.spellName, rote.spellArcanum)
  yield* requireVulgarSpell(spell)
  const resolved = yield* resolveRotePool(sheet, rote, skillChoice)

  const declaredComponents: ReadonlyArray<RawPoolComponent> = [
    { type: "attribute", name: resolved.attribute.name, dots: resolved.attribute.dots },
    { type: resolved.skill.kind, name: resolved.skill.name, dots: resolved.skill.dots },
    { type: "arcanum", name: resolved.arcanum.name, dots: resolved.arcanum.dots },
    ...(resolved.specialty.eligible
      ? [{ type: "modifier", name: "Rote Specialty", dots: resolved.specialty.bonus }]
      : []),
  ]
  return {
    isRote: true as const,
    roteName: rote.name,
    arcanum: spell.arcanum.toLowerCase(),
    level: spell.level,
    declaredComponents,
    declaredPool:
      resolved.attribute.dots +
      resolved.skill.dots +
      resolved.arcanum.dots +
      resolved.specialty.bonus,
    spellManaCost: 0,
  }
})

/**
 * The caster declares a Vulgar Cast into the wings: free, no Storyteller
 * attention needed, no mechanical weight until engaged. The declared pool and
 * spell Mana cost freeze here — the sheet as it stands at declaration is the
 * sheet the Cast plays from. Two lanes, one door (issue #47): an improvised
 * effect (Gnosis + Arcanum) or a trained Rote (its resolved pool, `isRote`
 * stamped for the Paradox pricing) — exactly one per draft. A Willpower
 * spend precommits blind here (ADR-0022, WoD p. 133): its +3 dice join the
 * declared pool before penalties; only the point's deduction waits for the
 * commit, so a killed or declined draft costs nothing.
 */
export const draftCast = Effect.fn("Flows.vulgarCast.draftCast")(function* (
  args: DraftCastArgs,
) {
  const sessionId = SessionId.make(args.sessionId)

  const store = yield* GameStore
  // Authority before validation: a stranger learns nothing about the lanes.
  const sheet = yield* requireSessionCharacter(
    sessionId,
    CharacterId.make(args.characterId),
  )

  if (args.roteName !== undefined && (args.arcanum !== undefined || args.level !== undefined)) {
    return yield* new InvalidCastDeclaration({
      message: "A draft declares an improvised effect or a Rote — not both.",
    })
  }
  if (args.roteName === undefined && args.skillChoice !== undefined) {
    return yield* new InvalidCastDeclaration({
      message: "A skill pick belongs to a Rote declaration.",
    })
  }
  const lane =
    args.roteName !== undefined
      ? yield* roteDeclaration(sheet, args.roteName, args.skillChoice)
      : yield* improvisedDeclaration(sheet, args.arcanum, args.level)

  // The Willpower precommitment must be affordable when declared — the check
  // spends nothing; the point itself commits with the Mana at the commit.
  const withWillpower = args.spendWillpower ?? false
  if (withWillpower) {
    yield* spendWillpower(sheet.willpowerCurrent)
  }
  const declaration = withWillpower
    ? {
        ...lane,
        declaredComponents: [
          ...lane.declaredComponents,
          { type: "modifier", name: "Willpower", dots: WILLPOWER_BONUS_DICE },
        ],
        declaredPool: lane.declaredPool + WILLPOWER_BONUS_DICE,
      }
    : lane

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
  const intent = args.intent?.trim()

  const castId = yield* store.insertCast({
    sessionId,
    characterId: sheet.id,
    casterUserId: sheet.userId,
    casterName: member.displayName,
    arcanum: declaration.arcanum,
    level: declaration.level,
    ...(declaration.isRote
      ? { isRote: true, roteName: declaration.roteName }
      : {}),
    ...(intent ? { intent } : {}),
    usesMagicalTool: args.usesMagicalTool ?? false,
    ...(withWillpower ? { spendWillpower: true } : {}),
    declaredComponents: declaration.declaredComponents,
    declaredPool: declaration.declaredPool,
    spellManaCost: declaration.spellManaCost,
  })

  const declared = declaration.isRote
    ? `drafts the Rote "${declaration.roteName}" as a vulgar ${capitalize(declaration.arcanum)} ${declaration.level} cast`
    : `drafts a vulgar ${capitalize(declaration.arcanum)} ${declaration.level} cast`
  const willpower = withWillpower ? ", Willpower behind it" : ""
  yield* store.insertMessage({
    sessionId,
    sender: { userId: member.userId, displayName: member.displayName },
    text: `${member.displayName} ${declared}${willpower}${intent ? ` — "${intent}"` : ""}. It waits in the wings.`,
    visibility: "system",
  })

  return castId
})

export const CastStepArgs = Schema.Struct({
  sessionId: Schema.String,
  castId: Schema.String,
})
export type CastStepArgs = typeof CastStepArgs.Type

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
 * The Storyteller engages a draft onto the exclusive stage — The Price rung
 * opens fluid (ADR-0022): the card shows the live Tides off the Scene while
 * the ST assembles personal adjustments; nothing is settled until the freeze
 * stamps the seed. Gnosis stamps here — the sheet as it stands when the Cast
 * takes the stage. No Scene open is legal: downtime casting seeds nothing.
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

  yield* store.patchCast(castId, {
    status: "price",
    ...(sceneId !== undefined ? { sceneId } : {}),
    gnosis: sheet.gnosis,
  })

  yield* store.insertMessage({
    sessionId,
    sender: { userId: storyteller.userId, displayName: storyteller.displayName },
    text: `${storyteller.displayName} engages ${cast.casterName}'s vulgar cast — it takes the stage, and the Tides set its price.`,
    visibility: "system",
  })

  return castId
})

export const AdjustPriceArgs = Schema.Struct({
  ...CastStepArgs.fields,
  /** The whole adjustment list as it should now read — replace, not merge. */
  adjustments: Schema.Array(ParadoxPoolModifier),
})
export type AdjustPriceArgs = typeof AdjustPriceArgs.Type

/**
 * The Storyteller's personal adjustments (ADR-0022): facts about this
 * caster's situation — a broken hand, hanging from a ledge, a ghost's boon —
 * added to the card before the freeze, visibly distinct from the inherited
 * scene seed. The ST reacts to the world by editing the Scene, to the caster
 * by adjusting here; only The Price's fluid phase is reachable. No Activity
 * entry: assembly is table talk, not a reveal (ADR-0016); the freeze narrates
 * the final pool.
 */
export const adjustPrice = Effect.fn("Flows.vulgarCast.adjustPrice")(function* (
  args: AdjustPriceArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  const castId = CastId.make(args.castId)
  const store = yield* GameStore

  yield* requireStoryteller(sessionId)
  const cast = yield* requireCast(sessionId, castId)
  yield* requirePricePhase(cast, "fluid")

  yield* Effect.forEach(args.adjustments, (adjustment) => {
    const complaint = modifierComplaint(adjustment)
    return complaint === null
      ? Effect.void
      : new InvalidAdjustment({ message: `An adjustment ${complaint}` })
  })

  yield* store.patchCast(castId, { adjustments: args.adjustments })

  return castId
})

export const SetMagicalToolArgs = Schema.Struct({
  ...CastStepArgs.fields,
  usesMagicalTool: Schema.Boolean,
})
export type SetMagicalToolArgs = typeof SetMagicalToolArgs.Type

/**
 * The caster's side of the price (issue #44): the magical-tool flag is theirs
 * to change until the freeze — after that the caster would be reshaping the
 * very pool the freeze settled. Walks the same authority ladder as every
 * caster beat (owner plain; ST/Dev in-stead Override-stamped, ADR-0015).
 * Table talk like the ST's adjustments: no Activity entry.
 */
export const setMagicalTool = Effect.fn("Flows.vulgarCast.setMagicalTool")(
  function* (args: SetMagicalToolArgs) {
    const sessionId = SessionId.make(args.sessionId)
    const castId = CastId.make(args.castId)
    const store = yield* GameStore

    const cast = yield* requireCast(sessionId, castId)
    // Authority before status: a stranger learns nothing about the ladder.
    yield* requireSessionCharacter(sessionId, cast.characterId)
    if (cast.status === "price") {
      yield* requirePricePhase(cast, "fluid")
    } else {
      yield* requireStatus(cast, "draft")
    }

    yield* store.patchCast(castId, { usesMagicalTool: args.usesMagicalTool })

    return castId
  },
)

/**
 * THE FREEZE (ADR-0022): the Storyteller locks the price when satisfied —
 * the Tides seed stamps onto the card (scene witnesses, circumstances, this
 * caster's derived pips) beside the personal adjustments, and from this click
 * the ST is irrevocably hands-off. No unfreeze exists; repairs are void plus
 * redeclare, or out-of-band restitution. Post-freeze Scene edits never touch
 * the frozen card — the *next* cast pays the new price.
 */
export const lockPrice = Effect.fn("Flows.vulgarCast.lockPrice")(function* (
  args: CastStepArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  const castId = CastId.make(args.castId)
  const store = yield* GameStore

  const storyteller = yield* requireStoryteller(sessionId)
  const cast = yield* requireCast(sessionId, castId)
  yield* requirePricePhase(cast, "fluid")

  // The seed stamps off the Scene as it stands at this click — the one
  // stamping moment, so pre-freeze Scene edits flow through and post-freeze
  // ones visibly diverge (the strip shows the new world, the card keeps its
  // snapshot). Downtime seeds nothing.
  const casts = yield* store.listCasts(sessionId)
  const scene = yield* store.getActiveScene(sessionId)
  const tides = sceneTides(
    casts,
    Option.isSome(scene) ? scene.value : undefined,
    cast.characterId,
  )

  yield* store.patchCast(castId, { tides })

  const pool = calculateParadoxPool(yield* paradoxInputs(cast, tides))
  yield* store.insertMessage({
    sessionId,
    sender: { userId: storyteller.userId, displayName: storyteller.displayName },
    text: `${storyteller.displayName} freezes the price: ${cast.casterName} faces a ${pool.totalDice}-die Paradox pool. Settled — it cannot shift now.`,
    visibility: "system",
  })

  return castId
})

export const CommitCastArgs = Schema.Struct({
  ...CastStepArgs.fields,
  /** Mana spent shrinking the Paradox pool, 1 per die — blind insurance. */
  manaMitigation: Schema.Number,
})
export type CommitCastArgs = typeof CommitCastArgs.Type

/**
 * The caster commits — THE POINT OF NO RETURN. Mitigation, the spell's Mana
 * cost, and the precommitted Willpower point (ADR-0022) commit atomically in
 * one mutation; the Cast enters the Paradox rung and the only exits are
 * playing it out or a Storyteller void (ADR-0015's contract regime).
 */
export const commitCast = Effect.fn("Flows.vulgarCast.commitCast")(function* (
  args: CommitCastArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  const castId = CastId.make(args.castId)
  const store = yield* GameStore

  const cast = yield* requireCast(sessionId, castId)
  const sheet = yield* requireSessionCharacter(sessionId, cast.characterId)
  yield* requirePricePhase(cast, "frozen")

  const mitigation = args.manaMitigation
  if (!Schema.is(WholeCount)(mitigation)) {
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

  // The commit is atomic with the status step: spendMana and spendWillpower
  // refuse before any write, and the Convex transaction carries the rest.
  const cost = Mana.make(cast.spellManaCost + mitigation)
  const manaRemaining = yield* spendMana(sheet.manaCurrent, cost)
  const willpowerRemaining = (cast.spendWillpower ?? false)
    ? yield* spendWillpower(sheet.willpowerCurrent)
    : null
  yield* store.patchSheet(sheet.id, {
    manaCurrent: manaRemaining,
    ...(willpowerRemaining !== null
      ? { willpowerCurrent: willpowerRemaining }
      : {}),
  })

  yield* store.patchCast(castId, {
    status: "paradox",
    manaMitigation: mitigation,
  })

  const member = yield* casterMembership(cast)
  const spent = [
    `${cost} Mana${mitigation > 0 ? ` (${mitigation} to mitigation)` : ""}`,
    ...(willpowerRemaining !== null ? ["the precommitted Willpower"] : []),
  ].join(" and ")
  yield* store.insertMessage({
    sessionId,
    sender: { userId: member.userId, displayName: member.displayName },
    text: `${cast.casterName} commits, spending ${spent}. The point of no return.`,
    visibility: "system",
  })

  return castId
})

/**
 * Free cancel, either party, anywhere on The Price — before the caster's
 * commit (a caster may bail on a frozen price; that is the rung's design):
 * an in-fiction reconsideration, not a repair — plain provenance, the stage
 * frees.
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

  yield* requireStatus(cast, "price")

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
 * chance die (the rules' gamble is honest). The rung doesn't move — the
 * stamped successes flip its phase to the caster's cockpit, zero included
 * (nothing to contain is still the caster's release to click).
 */
export const rollParadox = Effect.fn("Flows.vulgarCast.rollParadox")(function* (
  args: CastStepArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  const castId = CastId.make(args.castId)
  const store = yield* GameStore

  const storyteller = yield* requireStoryteller(sessionId)
  const cast = yield* requireCast(sessionId, castId)
  yield* requireParadoxPhase(cast, "unrolled")

  const mitigation = yield* stamped(cast.manaMitigation, "manaMitigation")
  const inputs = yield* paradoxInputs(cast)
  const pool = calculateParadoxPool({ ...inputs, manaMitigation: mitigation })

  const components: ReadonlyArray<RawPoolComponent> = [
    { type: "modifier", name: "Paradox (Gnosis)", dots: pool.baseDice },
    ...pool.modifiers.flatMap((m) => modifierComponents(m.source, m.dice)),
  ]
  const dicePool = yield* buildPool(components)
  const result = yield* rollPool(dicePool)

  yield* store.patchCast(castId, {
    paradoxSuccesses: result.successes,
    paradoxIsDramaticFailure: result.isDramaticFailure,
  })

  const dice = result.isChanceDie ? "a chance die" : `${result.poolSize} dice`
  yield* store.insertRoll({
    sessionId,
    member: storyteller,
    components,
    result,
    summary: result.isDramaticFailure
      ? `Reality rolls ${dice} against ${cast.casterName} — a dramatic failure! Paradox leaves the caster alone, and the Scene forgives its next accumulation.`
      : `Reality rolls ${dice} against ${cast.casterName} — ${outcomeOf(result)}${result.successes === 0 ? ". Nothing to contain; the way to the cast is clear" : ""}.`,
  })

  return castId
})

export const SetDraftContainmentArgs = Schema.Struct({
  ...CastStepArgs.fields,
  /** The half-built sacrifice: box clicks, broadcast live (ADR-0022). */
  draftContainedSuccesses: Schema.Number,
})
export type SetDraftContainmentArgs = typeof SetDraftContainmentArgs.Type

/**
 * The cockpit's drafting door (ADR-0022): box clicks write broadcast working
 * state on the Cast document — cheap, seam-checked (actor is caster, phase is
 * the cockpit, boxes in range), no rules consequence until the release
 * finalizes. Spectators watch through the same reactivity as everything
 * else; a reconnecting caster drops back into their half-built sacrifice.
 * Deliberately public, un-clicks included — no poker face. No Activity entry.
 */
export const setDraftContainment = Effect.fn("Flows.vulgarCast.setDraftContainment")(
  function* (args: SetDraftContainmentArgs) {
    const sessionId = SessionId.make(args.sessionId)
    const castId = CastId.make(args.castId)
    const store = yield* GameStore

    const cast = yield* requireCast(sessionId, castId)
    const sheet = yield* requireSessionCharacter(sessionId, cast.characterId)
    yield* requireParadoxPhase(cast, "rolled")
    yield* requireContainable(cast, sheet, args.draftContainedSuccesses)

    yield* store.patchCast(castId, {
      draftContainedSuccesses: args.draftContainedSuccesses,
    })

    return castId
  },
)

export const ReleaseCastArgs = Schema.Struct({
  ...CastStepArgs.fields,
  /** Paradox successes absorbed as Resistant bashing, one wound per success. */
  containedSuccesses: Schema.Number,
})
export type ReleaseCastArgs = typeof ReleaseCastArgs.Type

/**
 * The one Cast click (ADR-0022: one mutation per commitment): containment
 * lands and the dice fly as a single server commitment — the card may still
 * play "the sacrifice lands" then "the dice fly" as sequential animations
 * from this one event. Each contained success writes one Resistant bashing
 * wound (issue #41), capped by the boxes still empty — the martyr play down
 * to the last box is possible, death is not; zero is a legal choice. The
 * pool shrinks twice (issue #45): declared − uncontained successes (p. 124)
 * and the wound penalty of the track as the sacrifice leaves it (chance die
 * at zero or below) — the precommitted Willpower dice erode like any others.
 * Resolution records both rolls' outcomes and the Paradox severity, frees
 * the stage, and — when containment filled the last box — surfaces the
 * full-bashing-track unconsciousness rule for the Storyteller to adjudicate.
 */
export const releaseCast = Effect.fn("Flows.vulgarCast.releaseCast")(function* (
  args: ReleaseCastArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  const castId = CastId.make(args.castId)
  const store = yield* GameStore

  const cast = yield* requireCast(sessionId, castId)
  const sheet = yield* requireSessionCharacter(sessionId, cast.characterId)
  yield* requireParadoxPhase(cast, "rolled")

  const contained = args.containedSuccesses
  const paradoxSuccesses = yield* requireContainable(cast, sheet, contained)

  // The sacrifice lands first: the track the dice pay wound penalties on is
  // the track as containment leaves it.
  const track =
    contained === 0
      ? sheet.healthTrack
      : Arr.reduce(Arr.makeBy(contained, (i) => i), sheet.healthTrack, (t) =>
          applyDamage(t, "bashing", { resistant: true }),
        )
  if (contained > 0) {
    yield* store.patchSheet(sheet.id, { healthTrack: track })
  }

  const uncontained = paradoxSuccesses - contained
  const penalty = woundPenalty(track)
  const castPool = finalCastPool({
    declaredPool: cast.declaredPool,
    paradoxSuccesses,
    contained,
    woundPenalty: penalty,
  })

  // Zero and fewer dice are the same chance die, so record only the effective
  // portion of each penalty (the factor-penalty precedent in
  // `flows/casting.ts`), uncontained Paradox eating the pool first.
  const paradoxPenalty = Math.max(-uncontained, -cast.declaredPool)
  const woundPortion = Math.max(penalty, -(cast.declaredPool + paradoxPenalty))
  const components: ReadonlyArray<RawPoolComponent> = [
    ...cast.declaredComponents,
    ...modifierComponents("Uncontained Paradox", paradoxPenalty),
    ...modifierComponents("Wound penalty", woundPortion),
  ]
  const dicePool = yield* buildPool(components)
  const result = yield* rollPool(dicePool)

  const severity = resolveParadox(uncontained).severity
  yield* store.patchCast(castId, {
    status: "resolved",
    containedSuccesses: contained,
    castPool,
    castSuccesses: result.successes,
    severity,
  })

  const member = yield* casterMembership(cast)
  const dice = result.isChanceDie ? "a chance die" : `${result.poolSize} dice`
  const sacrifice =
    contained > 0
      ? `contains ${contained} of ${paradoxSuccesses} Paradox ${paradoxSuccesses === 1 ? "success" : "successes"} as Resistant bashing and `
      : paradoxSuccesses > 0
        ? `lets all ${paradoxSuccesses} Paradox ${paradoxSuccesses === 1 ? "success" : "successes"} run and `
        : ""
  yield* store.insertRoll({
    sessionId,
    member,
    components,
    result,
    summary:
      `${cast.casterName} ${sacrifice}releases the vulgar ${capitalize(cast.arcanum)} ${cast.level} spell (${dice}), getting ${outcomeOf(result)}.` +
      (severity === "none"
        ? " Reality lets it pass."
        : ` The uncontained Paradox manifests as ${capitalize(severity)}.`),
  })

  // The martyr's aftermath (PRD #39 story 28): the spell is away; now the
  // full bashing track's unconsciousness rule is the Storyteller's to call.
  if (contained > 0 && isIncapacitated(track)) {
    yield* store.insertMessage({
      sessionId,
      sender: { userId: member.userId, displayName: member.displayName },
      text: `${cast.casterName}'s health track is full, the last box bashing — the book calls that unconsciousness. The spell is already loose; the Storyteller adjudicates what the body does next.`,
      visibility: "system",
    })
  }

  return castId
})

/**
 * The Storyteller's void: not a quiet retreat but an Override-stamped,
 * table-visible repair (ADR-0015) — any live stage, restores committed Mana
 * and the precommitted Willpower point, frees the stage, and leaves no
 * accumulator trace (the Cast never reaches `resolved`). Containment can no
 * longer need restoring: the sacrifice lands only inside the release, which
 * resolves in the same commitment (ADR-0022).
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

  const committed = isCommitted(cast.status)
  const restoredMana = committed
    ? cast.spellManaCost + (cast.manaMitigation ?? 0)
    : 0
  const restoredWillpower = committed && (cast.spendWillpower ?? false) ? 1 : 0

  if (restoredMana > 0 || restoredWillpower > 0) {
    const sheet = yield* store.getSheet(cast.characterId)
    yield* store.patchSheet(sheet.id, {
      ...(restoredMana > 0
        ? {
            manaCurrent: Mana.make(
              Math.min(sheet.manaCurrent + restoredMana, sheet.maxMana),
            ),
          }
        : {}),
      ...(restoredWillpower > 0
        ? {
            willpowerCurrent: Willpower.make(
              Math.min(sheet.willpowerCurrent + restoredWillpower, sheet.willpower),
            ),
          }
        : {}),
    })
  }

  yield* store.patchCast(castId, { status: "voided" })

  const restored =
    restoredMana > 0 || restoredWillpower > 0
      ? ` ${[
          ...(restoredMana > 0 ? [`${restoredMana} Mana`] : []),
          ...(restoredWillpower > 0 ? [`${restoredWillpower} Willpower`] : []),
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
