import { v } from "convex/values"
import { query } from "./_generated/server"
import { requireUser } from "./lib/auth"

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

    // Fetch messages and rolls in parallel
    const [messages, rolls] = await Promise.all([
      ctx.db
        .query("messages")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .order("desc")
        .take(100),
      ctx.db
        .query("diceRolls")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .order("desc")
        .take(50),
    ])

    // Visibility-filter messages
    const visibleMessages = messages.filter((m) => {
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

    // Visibility-filter rolls
    const visibleRolls = isStoryteller
      ? rolls
      : rolls.filter((r) => r.visibility === "public" || r.userId === user._id)

    // Rolls are atomic, self-describing Activity entries (ADR-0009): each carries
    // its own `summary`, so there is no shadow "system" message to deduplicate.
    const messageItems = visibleMessages.map((m) => ({
      kind: "message" as const,
      _id: m._id,
      timestamp: m.timestamp,
      senderId: m.senderId,
      senderName: m.senderName,
      text: m.text,
      visibilityType: m.visibilityType,
      whisperTargetId: m.whisperTargetId,
      override: m.override,
    }))

    const rollItems = visibleRolls.map((r) => ({
      kind: "roll" as const,
      _id: r._id,
      timestamp: r.timestamp,
      userId: r.userId,
      displayName: r.displayName,
      components: r.components,
      poolSize: r.poolSize,
      rolls: r.rolls,
      explosions: r.explosions,
      roteRerolls: r.roteRerolls,
      successes: r.successes,
      isChanceDie: r.isChanceDie,
      isDramaticFailure: r.isDramaticFailure,
      isExceptionalSuccess: r.isExceptionalSuccess,
      visibility: r.visibility,
      againThreshold: r.againThreshold,
      isRoteAction: r.isRoteAction,
      summary: r.summary,
      override: r.override,
    }))

    // Merge by timestamp descending, take 100
    const merged = [...messageItems, ...rollItems]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 100)

    return merged
  },
})
