import { v } from "convex/values"
import { mutation } from "./_generated/server"
import { requireUser } from "./lib/auth"

export const send = mutation({
  args: {
    sessionId: v.id("sessions"),
    text: v.string(),
    visibilityType: v.optional(
      v.union(v.literal("public"), v.literal("whisper")),
    ),
    whisperTargetId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    // Verify membership
    const members = await ctx.db
      .query("sessionMembers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect()

    const member = members.find((m) => m.userId === user._id)
    if (!member) {
      throw new Error("Not a member of this session")
    }

    return await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      senderId: user._id,
      senderName: member.displayName,
      text: args.text,
      visibilityType: args.visibilityType ?? "public",
      ...(args.whisperTargetId != null && {
        whisperTargetId: args.whisperTargetId,
      }),
      timestamp: Date.now(),
    })
  },
})
