import { v } from "convex/values"
import { mutation } from "./_generated/server"
import { resolveSeatRequest } from "./lib/auth"
import { tableNameOf } from "../src/domain/membership"
import { seatIsAnnounced } from "../src/domain/seat"

/**
 * The Second Seat's one write (ADR-0013): taking any member's seat but your
 * own is announced as a system Activity entry naming the Dev — every seat
 * holds that member's private Whispers, and secret-seeing is "explicit,
 * opt-in, logged" (CONTEXT.md). The seat itself stays client state; this
 * mutation records the taking of the `target` member's seat — a write
 * *about* the seat, never a write scoped *by* it (no read here resolves
 * through the target).
 */
export const announce = mutation({
  args: {
    sessionId: v.id("sessions"),
    target: v.id("sessionMembers"),
  },
  handler: async (ctx, args) => {
    const { user, own, decision } = await resolveSeatRequest(
      ctx,
      args.sessionId,
      args.target,
    )
    // A target was passed, so refusals already threw; anything but a seated
    // decision means there is nothing to announce.
    if (decision._tag !== "Seated") return { announced: false }

    const target = decision.member
    if (!seatIsAnnounced(own, target)) {
      return { announced: false }
    }

    // Named at the table as everyone else is (owner, 2026-10-25).
    const sheets = await ctx.db
      .query("characters")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect()
    const devName = own === null ? (user.name ?? user._id) : tableNameOf(own, sheets)
    await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      senderId: user._id,
      senderName: devName,
      text: `${devName} takes the Second Seat: reading as ${tableNameOf(target, sheets)}`,
      visibilityType: "system",
      timestamp: Date.now(),
    })
    return { announced: true }
  },
})
