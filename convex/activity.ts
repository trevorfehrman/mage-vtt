import { v } from "convex/values"
import { query } from "./_generated/server"
import { seatedMember } from "./lib/auth"
import { ActivityFeed, mergeFeed, visibleEntries } from "../src/domain/activity"
import { schemaToConvexValidator } from "../src/domain/schema-bridge"
import type { Doc } from "./_generated/dataModel"

/**
 * The Activity feed — a logic-free adapter over the Activity domain module
 * (issue #22 PRD): resolve the Reader, fetch both tables, project into
 * entries, filter, merge. The visibility policy and the chronological merge
 * live in the domain; only the storage concerns (indexes, fetch caps) are here.
 */

const messageEntry = (m: Doc<"messages">) => ({
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
})

// Rolls are atomic, self-describing Activity entries (ADR-0009): each carries
// its own `summary`, so there is no shadow "system" message to deduplicate.
const rollEntry = (r: Doc<"diceRolls">) => ({
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
})

// The live Cast card (issue #43, ADR-0016): the whole document, projected —
// the card is a live feed item climbing its ladder in place, timestamped by
// `updatedAt` so it rides at the action's edge. All Casts are public.
const castEntry = (c: Doc<"casts">) => {
  const { _id, _creationTime, sessionId: _sessionId, ...fields } = c
  return { _tag: "cast" as const, _id, timestamp: c.updatedAt, ...fields }
}

export const list = query({
  args: {
    sessionId: v.id("sessions"),
    // The Second Seat (ADR-0013): a Dev-gated read-scope replacement. Seat
    // resolution produces the effective Reader *before* filtering, so the
    // visibility policy never knows the seat exists and the caller's own
    // sight is lost while seated.
    seat: v.optional(v.id("sessionMembers")),
  },
  // Derived from the domain's entry-array schema (ADR-0005, function-return
  // extension): projection drift fails loudly here, not in the client's decode.
  returns: schemaToConvexValidator(ActivityFeed),
  handler: async (ctx, args) => {
    // The gate refuses non-members (issue #37), so the Reader always exists.
    const member = await seatedMember(ctx, args.sessionId, args.seat)
    const reader = { userId: member.userId, role: member.role }

    // Fetch caps are storage concerns; the feed's own cap lives in mergeFeed.
    const [messages, rolls, casts] = await Promise.all([
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
      ctx.db
        .query("casts")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .order("desc")
        .take(25),
    ])

    const entries = [
      ...messages.map(messageEntry),
      ...rolls.map(rollEntry),
      ...casts.map(castEntry),
    ]
    return mergeFeed(visibleEntries(reader, entries))
  },
})
