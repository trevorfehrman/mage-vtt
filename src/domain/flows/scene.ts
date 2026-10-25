import { Effect, Option, Schema } from "effect"
import { tableName } from "../membership"
import { requireStoryteller } from "../authz"
import { isOnStage } from "../cast"
import { CastId, SessionId } from "../ids"
import { modifierComplaint, ParadoxPoolModifier } from "../paradox"
import { GameStore } from "../ports/game-store"

/**
 * The Scene lifecycle flows (issue #42, PRD #39): the ST-controlled narrative
 * container — Paradox accumulation's rules-visible boundary.
 *
 * All three doors are Storyteller-authority actions with plain provenance
 * (ADR-0015's write classification): the ST acting as ST bends no rule, so no
 * Override — only a Dev in someone else's chair gets the godmode stamp, via
 * `requireStoryteller`'s bypass rung. Open and close each land as one system
 * Activity entry (ADR-0003/0009); the witnesses toggle is a quiet write the
 * strip shows live — the log narrates dramatic beats, not knob positions.
 *
 * At most one Scene is active per Session, an invariant these flows enforce
 * (refusing on the ADR-0010 taxonomy), not the table. No Scene open is a
 * legal state: play — casting included — proceeds outside any Scene with
 * nothing accumulating.
 */

// --- Errors (ADR-0010, co-located with the flows that raise them) ---

/** Validation: a Scene needs a name to be a place in the fiction. */
export class InvalidSceneName extends Schema.TaggedError<InvalidSceneName>()(
  "InvalidSceneName",
  { message: Schema.String },
) {}

/** Rules/precondition: the stage holds one Scene — close it before the next. */
export class SceneAlreadyOpen extends Schema.TaggedError<SceneAlreadyOpen>()(
  "SceneAlreadyOpen",
  {
    sessionId: SessionId,
    activeSceneName: Schema.String,
  },
) {}

/** Rules/precondition: this door needs an open Scene, and none is. */
export class NoActiveScene extends Schema.TaggedError<NoActiveScene>()(
  "NoActiveScene",
  { sessionId: SessionId },
) {}

/**
 * Rules/precondition (issue #43): the Scene cannot close over a Cast on
 * stage — a dangling negotiation would corrupt the accumulator record. Play
 * it out, cancel it, or void it first.
 */
export class CastOnStage extends Schema.TaggedError<CastOnStage>()(
  "CastOnStage",
  {
    sessionId: SessionId,
    castId: CastId,
    casterName: Schema.String,
  },
) {}

// --- Flows ---

export const OpenSceneArgs = Schema.Struct({
  sessionId: Schema.String,
  name: Schema.String,
})
export type OpenSceneArgs = typeof OpenSceneArgs.Type

export const openScene = Effect.fn("Flows.scene.openScene")(function* (
  args: OpenSceneArgs,
) {
  // Authority before validation: a non-member is refused as a non-member,
  // never handed validation feedback for a table they're not at.
  const sessionId = SessionId.make(args.sessionId)
  const storyteller = yield* requireStoryteller(sessionId)

  const name = args.name.trim()
  if (name.length === 0) {
    return yield* new InvalidSceneName({ message: "A Scene needs a name." })
  }

  const store = yield* GameStore
  const active = yield* store.getActiveScene(sessionId)
  if (Option.isSome(active)) {
    return yield* new SceneAlreadyOpen({
      sessionId,
      activeSceneName: active.value.name,
    })
  }

  // The Tides open quiet (ADR-0022): zero witnesses, no circumstances — the
  // ambient price is armed deliberately, on the strip, before anyone declares.
  const sceneId = yield* store.insertScene({
    sessionId,
    name,
    witnessCount: 0,
    circumstances: [],
  })

  yield* store.insertMessage({
    sessionId,
    sender: { userId: storyteller.userId, displayName: tableName(storyteller) },
    text: `${tableName(storyteller)} opened the Scene "${name}".`,
    visibility: "system",
  })

  return sceneId
})

export const CloseSceneArgs = Schema.Struct({
  sessionId: Schema.String,
})
export type CloseSceneArgs = typeof CloseSceneArgs.Type

export const closeScene = Effect.fn("Flows.scene.closeScene")(function* (
  args: CloseSceneArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  const storyteller = yield* requireStoryteller(sessionId)

  const store = yield* GameStore
  const scene = yield* requireActiveScene(sessionId)

  // The stage must be clear (issue #43): a Cast mid-handshake blocks the
  // close; Drafts have no mechanical weight, so they die with the Scene.
  const casts = yield* store.listCasts(sessionId)
  const onStage = casts.find((c) => isOnStage(c.status))
  if (onStage) {
    return yield* new CastOnStage({
      sessionId,
      castId: onStage.id,
      casterName: onStage.casterName,
    })
  }
  const drafts = casts.filter((c) => c.status === "draft")
  yield* Effect.forEach(drafts, (draft) =>
    store.patchCast(draft.id, { status: "cancelled" }),
  )

  // A Combat is a child of the Scene (issue #60): it cannot outlive its
  // parent, so the close ends it — narrated below, never silent (the same
  // posture as the cancelled wings).
  const combat = yield* store.getActiveCombat(sessionId)
  if (Option.isSome(combat)) {
    yield* store.patchCombat(combat.value.id, { status: "ended" })
  }

  yield* store.patchScene(scene.id, { status: "closed" })

  // One close entry narrates the whole beat, cancelled wings included
  // (ADR-0009: atomic and self-describing, no shadow entries per draft).
  const wings =
    drafts.length === 0
      ? ""
      : drafts.length === 1
        ? ` The draft in the wings was cancelled.`
        : ` ${drafts.length} drafts in the wings were cancelled.`
  const clash = Option.isSome(combat) ? " The Combat still raging ended with it." : ""
  yield* store.insertMessage({
    sessionId,
    sender: { userId: storyteller.userId, displayName: tableName(storyteller) },
    text: `${tableName(storyteller)} closed the Scene "${scene.name}".${wings}${clash}`,
    visibility: "system",
  })

  return scene.id
})

export const EditTidesArgs = Schema.Struct({
  sessionId: Schema.String,
  /** Sleeper head count; dice stay the book's flat +2 for one-or-more. */
  witnessCount: Schema.optionalKey(Schema.Number),
  /** The whole circumstance list as it should now read — replace, not merge. */
  circumstances: Schema.optionalKey(Schema.Array(ParadoxPoolModifier)),
})
export type EditTidesArgs = typeof EditTidesArgs.Type

/** Validation: a Tides edit that no ruling could mean (ADR-0022). */
export class InvalidTides extends Schema.TaggedError<InvalidTides>()(
  "InvalidTides",
  { message: Schema.String },
) {}

/** A whole, non-negative count — the witness stepper's legal space. */
const WholeCount = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
)

/**
 * The Storyteller's Tides surface (ADR-0022): the scene-owned ambient price
 * of vulgar magic, edited inline on the strip. A quiet write the strip shows
 * live — the log narrates dramatic beats, not knob positions. Scene state is
 * never mutated by a cast; the ST reacts to the world here, and the *next*
 * fix pays the new price — a fixed card keeps its snapshot.
 */
export const editTides = Effect.fn("Flows.scene.editTides")(function* (
  args: EditTidesArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  yield* requireStoryteller(sessionId)

  const store = yield* GameStore
  const scene = yield* requireActiveScene(sessionId)

  if (args.witnessCount !== undefined && !Schema.is(WholeCount)(args.witnessCount)) {
    return yield* new InvalidTides({
      message: `Witnesses must be a whole count of Sleepers, got ${args.witnessCount}.`,
    })
  }
  yield* Effect.forEach(args.circumstances ?? [], (circumstance) => {
    const complaint = modifierComplaint(circumstance)
    return complaint === null
      ? Effect.void
      : new InvalidTides({ message: `A circumstance ${complaint}` })
  })

  yield* store.patchScene(scene.id, {
    ...(args.witnessCount !== undefined
      ? { witnessCount: args.witnessCount }
      : {}),
    ...(args.circumstances !== undefined
      ? { circumstances: args.circumstances }
      : {}),
  })

  return scene.id
})

/** The precondition close and the toggle share — and Combat's start door
 * (issue #60: a Combat is a child of a Scene): an open Scene, or the refusal. */
export const requireActiveScene = Effect.fn("Flows.scene.requireActiveScene")(function* (
  sessionId: SessionId,
) {
  const store = yield* GameStore
  const active = yield* store.getActiveScene(sessionId)
  if (Option.isNone(active)) {
    return yield* new NoActiveScene({ sessionId })
  }
  return active.value
})
