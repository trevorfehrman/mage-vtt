import { v } from "convex/values"
import { mutation } from "./_generated/server"
import { requireMember } from "./lib/auth"

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
    const member = await requireMember(ctx, args.sessionId)

    return await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      senderId: member.userId,
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
