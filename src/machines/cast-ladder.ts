import { Match } from "effect"
import { assign, setup, type StateValue } from "xstate"
import type { CastEntry } from "#/domain/activity"
import { CastStatus, isOnStage, isPriceFixed, type CastPhases } from "#/domain/cast"

/**
 * The Cast-ladder machine (issue #43, ADR-0016): a *projection* of the
 * subscribed Cast document, never an owner of pending state. The document is
 * the single source of truth; this machine only mirrors its status rung so a
 * reconnecting client rehydrates mid-ladder from the snapshot alone — the
 * `input` seeds the rung, and every subsequent `SYNC` re-derives it. The
 * mutations themselves are fired by the card (the settled XState/Effect
 * bridge: actors/components wrap the Convex mutation; authority stays
 * server-side).
 */

export type LadderEvent = { type: "SYNC"; cast: CastEntry }

export interface LadderContext {
  cast: CastEntry
}

const statusIs =
  (status: CastStatus) =>
  ({ context }: { context: LadderContext }) =>
    context.cast.status === status

/** One `always` fork per rung: `deriving` routes to the document's status. */
const derive = CastStatus.literals.map((status) => ({
  guard: statusIs(status),
  target: status,
}))

export const castLadderMachine = setup({
  types: {
    context: {} as LadderContext,
    events: {} as LadderEvent,
    input: {} as { cast: CastEntry },
  },
}).createMachine({
  id: "castLadder",
  context: ({ input }) => ({ cast: input.cast }),
  initial: "deriving",
  // Any update re-derives: the machine can only ever disagree with the
  // document for the microtask it takes `always` to fire.
  on: {
    SYNC: {
      actions: assign({ cast: ({ event }) => event.cast }),
      target: ".deriving",
    },
  },
  states: {
    deriving: { always: derive },
    // One state per rung, straight off the vocabulary. Terminal rungs are
    // deliberately not `final`: a projection must keep mirroring whatever
    // snapshot arrives, never halt its own actor.
    ...Object.fromEntries(CastStatus.literals.map((status) => [status, {}])),
  },
})

/**
 * The rung a render dispatches on. The machine's vocabulary is one state
 * wider than the ladder's — it may sit in `deriving` for the microtask its
 * `always` fork takes (unobserved in any render produced so far, issue #67).
 * The fork's target is the document's status by definition, so that frame
 * reads the document directly rather than feeding an off-vocabulary value
 * to a Match.exhaustive dispatch and killing the route.
 */
export const ladderRung = (value: StateValue, cast: CastEntry): CastStatus =>
  value === "deriving" ? cast.status : (value as CastStatus)

/**
 * The card's controls for one (rung-phase, viewer) pair — the pure heart of
 * "buttons only for my role". The two-colored rungs (ADR-0022) split on the
 * document's stamps, read through `waitingOn`'s `CastPhases` shape.
 * Spectators get none; the Storyteller's `void` door is open on any live
 * rung (ADR-0015's visible repair). Caster beats list for the caster only —
 * an ST driving them in a player's stead is server-legal (Override-stamped)
 * but not chrome we offer.
 */
export type LadderControl =
  | "kill" // caster: withdraw own draft
  | "decline" // ST: refuse a draft
  | "engage" // ST: put a draft on stage
  | "adjust" // ST: personal adjustments (ADR-0022), the Tides rung before the fix
  | "lockPrice" // ST: THE FIX — stamp the Tides, go hands-off
  | "commit" // caster: the point of no return (with mitigation)
  | "cancel" // the Tides rung: either party while fluid, caster-only once fixed
  | "rollParadox" // ST's own button
  | "contain" // caster: the cockpit's containment selection (local, #113)
  | "release" // caster: the one Cast click — containment lands, dice fly
  | "void" // ST: the Override-stamped repair

export const ladderControls = (
  cast: CastPhases,
  viewer: { isStoryteller: boolean; isCaster: boolean },
): ReadonlyArray<LadderControl> => {
  const rung = Match.value(cast.status).pipe(
    Match.withReturnType<ReadonlyArray<LadderControl>>(),
    Match.when("draft", () => [
      ...(viewer.isCaster ? (["kill"] as const) : []),
      ...(viewer.isStoryteller ? (["engage", "decline"] as const) : []),
    ]),
    Match.when("price", () =>
      isPriceFixed(cast)
        ? // Locked means locked (#114): only the caster may still bail — the
          // ST fixed the price and holds no cancel, just the repair door.
          [...(viewer.isCaster ? (["commit", "cancel"] as const) : [])]
        : // The caster alone wears cancel on the fluid Tides too (owner note,
          // 2026-07-19): for the ST it was redundant chrome beside Void —
          // pre-commitment nothing is spent, so the outcomes near-coincide.
          // The seam still honors either party's cancel; this is chrome only.
          [
            ...(viewer.isStoryteller ? (["adjust", "lockPrice"] as const) : []),
            ...(viewer.isCaster ? (["cancel"] as const) : []),
          ],
    ),
    Match.when("paradox", () =>
      cast.paradoxSuccesses === undefined
        ? viewer.isStoryteller
          ? (["rollParadox"] as const)
          : []
        : viewer.isCaster
          ? (["contain", "release"] as const)
          : [],
    ),
    // Terminal rungs offer no buttons — listed, not defaulted (ADR-0018), so a
    // new rung is a compile error here instead of a silently control-less card.
    Match.whenOr("resolved", "cancelled", "voided", () => []),
    Match.exhaustive,
  )
  // The repair door rides every live rung except the free-exit draft stage
  // (a draft dies by kill/decline; void exists to unstick the contract).
  return viewer.isStoryteller && isOnStage(cast.status) ? [...rung, "void"] : rung
}
