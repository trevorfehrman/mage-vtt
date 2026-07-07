import { Effect, Option, Schema } from "effect"
import { requireStoryteller } from "../authz"
import { isOnStage } from "../cast"
import { CastId, SessionId } from "../ids"
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
export class InvalidSceneName extends Schema.TaggedErrorClass<InvalidSceneName>()(
  "InvalidSceneName",
  { message: Schema.String },
) {}

/** Rules/precondition: the stage holds one Scene — close it before the next. */
export class SceneAlreadyOpen extends Schema.TaggedErrorClass<SceneAlreadyOpen>()(
  "SceneAlreadyOpen",
  {
    sessionId: SessionId,
    activeSceneName: Schema.String,
  },
) {}

/** Rules/precondition: this door needs an open Scene, and none is. */
export class NoActiveScene extends Schema.TaggedErrorClass<NoActiveScene>()(
  "NoActiveScene",
  { sessionId: SessionId },
) {}

/**
 * Rules/precondition (issue #43): the Scene cannot close over a Cast on
 * stage — a dangling negotiation would corrupt the accumulator record. Play
 * it out, cancel it, or void it first.
 */
export class CastOnStage extends Schema.TaggedErrorClass<CastOnStage>()(
  "CastOnStage",
  {
    sessionId: SessionId,
    castId: CastId,
    casterName: Schema.String,
  },
) {}

// --- Flows ---

export interface OpenSceneArgs {
  readonly sessionId: string
  readonly name: string
}

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

  // Witnesses default quiet: the +2 Sleeper liability is armed deliberately,
  // on the strip, before anyone declares a cast.
  const sceneId = yield* store.insertScene({
    sessionId,
    name,
    sleeperWitnesses: false,
  })

  yield* store.insertMessage({
    sessionId,
    sender: { userId: storyteller.userId, displayName: storyteller.displayName },
    text: `${storyteller.displayName} opened the Scene "${name}".`,
    visibility: "system",
  })

  return sceneId
})

export interface CloseSceneArgs {
  readonly sessionId: string
}

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

  yield* store.patchScene(scene.id, { status: "closed" })

  // One close entry narrates the whole beat, cancelled wings included
  // (ADR-0009: atomic and self-describing, no shadow entries per draft).
  const wings =
    drafts.length === 0
      ? ""
      : drafts.length === 1
        ? ` The draft in the wings was cancelled.`
        : ` ${drafts.length} drafts in the wings were cancelled.`
  yield* store.insertMessage({
    sessionId,
    sender: { userId: storyteller.userId, displayName: storyteller.displayName },
    text: `${storyteller.displayName} closed the Scene "${scene.name}".${wings}`,
    visibility: "system",
  })

  return scene.id
})

export interface SetSceneWitnessesArgs {
  readonly sessionId: string
  readonly sleeperWitnesses: boolean
}

export const setSceneWitnesses = Effect.fn("Flows.scene.setSceneWitnesses")(
  function* (args: SetSceneWitnessesArgs) {
    const sessionId = SessionId.make(args.sessionId)
    yield* requireStoryteller(sessionId)

    const store = yield* GameStore
    const scene = yield* requireActiveScene(sessionId)

    yield* store.patchScene(scene.id, { sleeperWitnesses: args.sleeperWitnesses })

    return scene.id
  },
)

/** The precondition close and the toggle share: an open Scene, or the refusal. */
const requireActiveScene = Effect.fn("Flows.scene.requireActiveScene")(function* (
  sessionId: SessionId,
) {
  const store = yield* GameStore
  const active = yield* store.getActiveScene(sessionId)
  if (Option.isNone(active)) {
    return yield* new NoActiveScene({ sessionId })
  }
  return active.value
})
