/**
 * Auth helper for Convex mutations/queries.
 *
 * authComponent.getAuthUser already throws ConvexError("Unauthenticated")
 * if no user is found. This wrapper keeps a single import for consumers.
 */

import { authComponent } from "../auth"
import type { QueryCtx, MutationCtx } from "../_generated/server"

/**
 * Get the authenticated user or throw ConvexError("Unauthenticated").
 * Call at the top of every mutation/query that requires auth.
 */
export async function requireUser(ctx: QueryCtx | MutationCtx) {
  return await authComponent.getAuthUser(ctx)
}
