import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
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

export const list = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    const members = await ctx.db
      .query("sessionMembers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect()

    const member = members.find((m) => m.userId === user._id)
    const isStoryteller = member?.role === "storyteller"

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(100)

    // Visibility filter:
    // - Public + system messages: visible to all
    // - Whispers: visible to sender, target, and storyteller
    return messages.filter((m) => {
      if (m.visibilityType === "public" || m.visibilityType === "system") {
        return true
      }
      if (m.visibilityType === "whisper") {
        return (
          isStoryteller ||
          m.senderId === user._id ||
          m.whisperTargetId === user._id
        )
      }
      return false
    })
  },
})
