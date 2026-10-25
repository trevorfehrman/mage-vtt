import { ConvexError, v } from "convex/values"
import { mutation } from "./_generated/server"
import { requireMember } from "./lib/auth"

/**
 * A chat line: to the table, or whispered to one or more members (MAG-53 —
 * the video tiles choose them). A whisper reaches only members of this
 * session other than its sender; anyone else named is dropped, and a whisper
 * left reaching no one is refused rather than quietly sent to the table.
 */
export const send = mutation({
  args: {
    sessionId: v.id("sessions"),
    text: v.string(),
    whisperTargetIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const member = await requireMember(ctx, args.sessionId)
    const text = args.text.trim()
    if (text === "") throw new ConvexError("A message needs words.")

    const named = args.whisperTargetIds ?? []
    const members = await ctx.db
      .query("sessionMembers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect()
    const targets = [...new Set(named)].filter(
      (id) => id !== member.userId && members.some((m) => m.userId === id),
    )
    if (named.length > 0 && targets.length === 0) {
      throw new ConvexError("That whisper reaches no one at this table.")
    }

    return await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      senderId: member.userId,
      senderName: member.displayName,
      text,
      visibilityType: targets.length > 0 ? "whisper" : "public",
      ...(targets.length > 0 && { whisperTargetIds: targets }),
      timestamp: Date.now(),
    })
  },
})
