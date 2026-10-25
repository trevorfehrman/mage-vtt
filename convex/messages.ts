import { ConvexError, v } from "convex/values"
import { mutation } from "./_generated/server"
import { requireMember } from "./lib/auth"
import { whisperTargets } from "../src/domain/activity"
import { schemaToConvexValidator } from "../src/domain/schema-bridge"
import { WhisperTargetIds } from "../src/domain/tables"

/**
 * A chat line: to the table, or whispered to one or more members (MAG-53 —
 * the video tiles choose them). Who a whisper reaches is the domain's rule
 * (`whisperTargets`): members of this session other than the sender, each
 * once; a whisper left reaching no one is refused rather than quietly sent
 * to the table. The whisper names its people as it names its sender.
 */
export const send = mutation({
  args: {
    sessionId: v.id("sessions"),
    text: v.string(),
    whisperTargetIds: v.optional(schemaToConvexValidator(WhisperTargetIds)),
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
    const targets = whisperTargets(named, member.userId, members)
    if (named.length > 0 && targets.length === 0) {
      throw new ConvexError("That whisper reaches no one at this table.")
    }

    return await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      senderId: member.userId,
      senderName: member.displayName,
      text,
      visibilityType: targets.length > 0 ? "whisper" : "public",
      ...(targets.length > 0 && {
        whisperTargetIds: targets.map((t) => t.userId),
        whisperTargetNames: targets.map((t) => t.displayName),
      }),
      timestamp: Date.now(),
    })
  },
})
