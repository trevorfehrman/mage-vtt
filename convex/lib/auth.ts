/**
 * Auth helper for Convex mutations/queries.
 *
 * authComponent.getAuthUser already throws ConvexError("Unauthenticated")
 * if no user is found. This wrapper keeps a single import for consumers.
 */

import { authComponent } from "../auth"
import type { QueryCtx, MutationCtx } from "../_generated/server"
import type { Id } from "../_generated/dataModel"

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
