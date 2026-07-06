import type { SessionRole } from "./roles"

/**
 * The Second Seat (ADR-0013): a Dev reading a Session from another member's
 * seat. Read-scope **replacement**, never impersonation — these leaves decide
 * who the effective reader is and whether taking the seat must be announced;
 * the lookups and the refusal live in the Convex helper (`seatedMember`).
 *
 * Deliberately plain TypeScript, not Effect Schema: nothing here is a
 * persisted or decoded artifact — `SeatDecision` is a transient decision
 * generic over whatever member row the caller holds, consumed by Convex's
 * plain-async helpers outside the Effect seam.
 */

/**
 * Does sitting in `seatRole` grant more sight than `ownRole` has?
 *
 * Sight is ordered: non-member (null) < player < storyteller. Only a widening
 * seat is announced in the Activity Log (secret-seeing is "explicit, opt-in,
 * logged" — CONTEXT.md's god-mode clause); a narrower or same-sight seat is
 * silent, because losing sight is the point.
 */
export const seatWidensReads = (
  ownRole: SessionRole | null,
  seatRole: SessionRole,
): boolean => sightRank(seatRole) > sightRank(ownRole)

const sightRank = (role: SessionRole | null): number =>
  role === "storyteller" ? 2 : role === "player" ? 1 : 0

export type SeatDecision<M> =
  /** No seat requested — read as yourself (null when not a member). */
  | { readonly _tag: "OwnSeat"; readonly member: M | null }
  /** The seat replaces the caller's entire read scope. */
  | { readonly _tag: "Seated"; readonly member: M }
  /** A `seat` from a non-Dev — refused before any lookup can leak. */
  | { readonly _tag: "SeatRefused" }
  /** A Dev asked for a seat that isn't a member of this Session. */
  | { readonly _tag: "SeatNotFound" }

/**
 * Resolve the effective reader. `seat` is three-valued: `undefined` = no seat
 * requested, `null` = requested but no such member, a member = the target.
 * A non-Dev with any `seat` is refused identically whether or not the seat
 * exists — refusal must not double as a membership probe.
 */
export const resolveSeat = <M>(args: {
  readonly isDev: boolean
  readonly own: M | null
  readonly seat: M | null | undefined
}): SeatDecision<M> => {
  if (args.seat === undefined) return { _tag: "OwnSeat", member: args.own }
  if (!args.isDev) return { _tag: "SeatRefused" }
  if (args.seat === null) return { _tag: "SeatNotFound" }
  return { _tag: "Seated", member: args.seat }
}
