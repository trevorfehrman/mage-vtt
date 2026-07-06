import { v } from "convex/values"
import { query } from "./_generated/server"
import { seatedMember } from "./lib/auth"
import { ActivityFeed } from "../src/domain/activity"
import { schemaToConvexValidator } from "../src/domain/schema-bridge"

export const list = query({
  args: {
    sessionId: v.id("sessions"),
    // The Second Seat (ADR-0013): a Dev-gated read-scope replacement — the
    // whisper and hidden-roll filters below key off the seat member, and the
    // caller's own sight is lost while seated.
    seat: v.optional(v.id("sessionMembers")),
  },
  // Derived from the domain's entry-array schema (ADR-0005, function-return
  // extension): projection drift fails loudly here, not in the client's decode.
  returns: schemaToConvexValidator(ActivityFeed),
  handler: async (ctx, args) => {
    const reader = await seatedMember(ctx, args.sessionId, args.seat)
    const readerId = reader?.userId
    const isStoryteller = reader?.role === "storyteller"

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
          m.senderId === readerId ||
          m.whisperTargetId === readerId
        )
      }
      return false
    })

    // Visibility-filter rolls
    const visibleRolls = isStoryteller
      ? rolls
      : rolls.filter((r) => r.visibility === "public" || r.userId === readerId)

    // Rolls are atomic, self-describing Activity entries (ADR-0009): each carries
    // its own `summary`, so there is no shadow "system" message to deduplicate.
    const messageItems = visibleMessages.map((m) => ({
      _tag: "message" as const,
      _id: m._id,
      timestamp: m.timestamp,
      senderId: m.senderId,
      senderName: m.senderName,
      text: m.text,
      visibilityType: m.visibilityType,
      ...(m.whisperTargetId !== undefined && {
        whisperTargetId: m.whisperTargetId,
      }),
      ...(m.override !== undefined && { override: m.override }),
    }))

    const rollItems = visibleRolls.map((r) => ({
      _tag: "roll" as const,
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
      ...(r.override !== undefined && { override: r.override }),
    }))

    // Merge by timestamp descending, take 100
    const merged = [...messageItems, ...rollItems]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 100)

    return merged
  },
})
