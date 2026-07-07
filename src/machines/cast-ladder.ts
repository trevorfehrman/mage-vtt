import { assign, setup } from "xstate"
import type { CastEntry } from "#/domain/activity"
import { CastStatus } from "#/domain/cast"

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
 * The card's controls for one (rung, viewer) pair — the pure heart of
 * "buttons only for my role". Spectators get none; the Storyteller's `void`
 * door is open on any live rung (ADR-0015's visible repair). Caster beats
 * list for the caster only — an ST driving them in a player's stead is
 * server-legal (Override-stamped) but not chrome we offer.
 */
export type LadderControl =
  | "kill" // caster: withdraw own draft
  | "decline" // ST: refuse a draft
  | "engage" // ST: put a draft on stage
  | "lockLiabilities" // ST: freeze the pool
  | "lockIntention" // caster: the point of no return (with mitigation)
  | "cancel" // either party, pre-commitment
  | "rollParadox" // ST's own button
  | "contain" // caster: bet flesh (with the capped input)
  | "rollCast" // caster: the climax
  | "void" // ST: the Override-stamped repair

export const ladderControls = (
  status: CastStatus,
  viewer: { isStoryteller: boolean; isCaster: boolean },
): ReadonlyArray<LadderControl> => {
  const controls: Array<LadderControl> = []
  switch (status) {
    case "draft":
      if (viewer.isCaster) controls.push("kill")
      if (viewer.isStoryteller) controls.push("engage", "decline")
      break
    case "engaged":
      if (viewer.isStoryteller) controls.push("lockLiabilities")
      if (viewer.isCaster || viewer.isStoryteller) controls.push("cancel")
      break
    case "liabilitiesLocked":
      if (viewer.isCaster) controls.push("lockIntention")
      if (viewer.isCaster || viewer.isStoryteller) controls.push("cancel")
      break
    case "intentionLocked":
      if (viewer.isStoryteller) controls.push("rollParadox")
      break
    case "paradoxRolled":
      if (viewer.isCaster) controls.push("contain")
      break
    case "contained":
      if (viewer.isCaster) controls.push("rollCast")
      break
    default:
      break
  }
  // The repair door rides every live rung except the free-exit draft stage
  // (a draft dies by kill/decline; void exists to unstick the contract).
  if (
    viewer.isStoryteller &&
    status !== "draft" &&
    status !== "resolved" &&
    status !== "cancelled" &&
    status !== "voided"
  ) {
    controls.push("void")
  }
  return controls
}
