/**
 * Auth helper for Convex mutations/queries.
 *
 * authComponent.getAuthUser already throws ConvexError("Unauthenticated")
 * if no user is found. This wrapper keeps a single import for consumers.
 */

import { ConvexError } from "convex/values"
import { authComponent } from "../auth"
import type { QueryCtx, MutationCtx } from "../_generated/server"
import type { Id } from "../_generated/dataModel"
import { resolveSeat } from "../../src/domain/seat"
import { isDevUser } from "./dev"

/**
 * Get the authenticated user or throw ConvexError("Unauthenticated").
 * Call at the top of every mutation/query that requires auth.
 */
export async function requireUser(ctx: QueryCtx | MutationCtx) {
  return await authComponent.getAuthUser(ctx)
}

/**
 * The authenticated user's membership in a session, or null if they aren't
 * a member. Session-scoped reads gate on this server-side — a non-member
 * sees nothing, never an empty result they could mistake for a real one.
 */
export async function memberOf(
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<"sessions">,
) {
  const user = await requireUser(ctx)

  const members = await ctx.db
    .query("sessionMembers")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .collect()

  return members.find((m) => m.userId === user._id) ?? null
}

/**
 * Resolve a seat request (the Second Seat, ADR-0013) against a Session's
 * roster: the caller, their own membership, and the domain decision. Both
 * refusals are thrown here, so every caller refuses loudly and identically.
 * Shared by the read-path `seatedMember` and the widening announcement
 * (`seat.announce`) — the announcement is a write *about* the seat, never a
 * write scoped *by* it.
 */
export async function resolveSeatRequest(
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<"sessions">,
  seat?: Id<"sessionMembers">,
) {
  const user = await requireUser(ctx)

  const members = await ctx.db
    .query("sessionMembers")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .collect()

  const own = members.find((m) => m.userId === user._id) ?? null
  const decision = resolveSeat({
    isDev: isDevUser(user._id),
    own,
    seat:
      seat === undefined
        ? undefined
        : (members.find((m) => m._id === seat) ?? null),
  })

  if (decision._tag === "SeatRefused") {
    throw new ConvexError("Second Seat refused: caller is not a Dev")
  }
  if (decision._tag === "SeatNotFound") {
    throw new ConvexError("Second Seat refused: no such member in this Session")
  }
  return { user, own, decision }
}

/**
 * The effective reader of an identity-sensitive query (the Second Seat,
 * ADR-0013): the caller's own membership, unless a Dev passed `seat` — then
 * the target member's row **replaces** the caller's read scope entirely.
 * Typed `QueryCtx`-only on purpose: ADR-0013 rejected a seat consulted at a
 * choke point that also serves mutations, so no mutation resolves its
 * identity through this helper.
 */
export async function seatedMember(
  ctx: QueryCtx,
  sessionId: Id<"sessions">,
  seat?: Id<"sessionMembers">,
) {
  const { decision } = await resolveSeatRequest(ctx, sessionId, seat)
  return decision.member
}
