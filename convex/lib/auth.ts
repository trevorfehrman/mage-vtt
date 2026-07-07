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
import { NotAMember, NotStoryteller } from "../../src/domain/authz"
import { PlayerId, SessionId } from "../../src/domain/ids"
import { resolveSeat } from "../../src/domain/seat"
import { isDevUser } from "./dev"
import { seamRefusal } from "./effect"

/** The typed refusal on the wire (ADR-0010) — narrowed to the gates' errors. */
const refusal = (error: NotAMember | NotStoryteller) => seamRefusal(error)

/** One owner of the Session roster scan the gates and seat resolution share. */
async function sessionMembers(
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<"sessions">,
) {
  return await ctx.db
    .query("sessionMembers")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .collect()
}

/**
 * Get the authenticated user or throw ConvexError("Unauthenticated").
 * Call at the top of every mutation/query that requires auth.
 */
export async function requireUser(ctx: QueryCtx | MutationCtx) {
  return await authComponent.getAuthUser(ctx)
}

/**
 * The membership gate for plain reads and simple writes (issue #37): resolve
 * the caller's membership once, refusing with the seam's `NotAMember` tag
 * (ADR-0010) — the same `ConvexError` shape the enforcement seam raises, so
 * the client's error mapping needs no new cases. A logged-in non-member gets
 * this typed refusal instead of a silently thinned result: Session content
 * never leaks outside the table, and a refusal is not mistakable for an
 * empty room. Per ADR-0004 this stays a helper inside plain handlers — not a
 * port, no `GameStore` growth.
 */
export async function requireMember(
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<"sessions">,
) {
  const user = await requireUser(ctx)

  const members = await sessionMembers(ctx, sessionId)
  const member = members.find((m) => m.userId === user._id)
  if (!member) {
    throw refusal(
      new NotAMember({
        sessionId: SessionId.make(sessionId),
        userId: PlayerId.make(user._id),
      }),
    )
  }
  return member
}

/** The gate's role rung: membership plus the Storyteller chair (ADR-0010's tag). */
export async function requireStoryteller(
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<"sessions">,
) {
  const member = await requireMember(ctx, sessionId)
  if (member.role !== "storyteller") {
    throw refusal(
      new NotStoryteller({
        sessionId: SessionId.make(sessionId),
        userId: PlayerId.make(member.userId),
      }),
    )
  }
  return member
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

  const members = await sessionMembers(ctx, sessionId)
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
  const { user, decision } = await resolveSeatRequest(ctx, sessionId, seat)
  // No effective reader — the caller is not a member and took no seat. The
  // membership gate's typed refusal (issue #37), not a thinned result.
  if (decision.member === null) {
    throw refusal(
      new NotAMember({
        sessionId: SessionId.make(sessionId),
        userId: PlayerId.make(user._id),
      }),
    )
  }
  return decision.member
}
