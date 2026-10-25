import type { Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { tableNameOf } from "../../src/domain/membership"

/**
 * Name people at the table (owner, 2026-10-25) outside the Effect seam —
 * chat and the Second Seat's announcement. One read of the session's sheets,
 * then each member goes by their sheet's headline, else their account name;
 * the flows reach the same name through `Membership.sheetName`.
 */
export async function tableNamer(ctx: QueryCtx | MutationCtx, sessionId: Id<"sessions">) {
  const sheets = await ctx.db
    .query("characters")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .collect()
  return (member: { readonly _id: Id<"sessionMembers">; readonly displayName: string }) =>
    tableNameOf(member, sheets)
}
