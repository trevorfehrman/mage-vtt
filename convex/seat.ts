import { v } from "convex/values"
import { mutation } from "./_generated/server"
import { resolveSeatRequest } from "./lib/auth"
import { seatWidensReads } from "../src/domain/seat"

/**
 * The Second Seat's one write (ADR-0013): taking a seat with *more* sight
 * than your own is announced as a system Activity entry naming the Dev —
 * secret-seeing is "explicit, opt-in, logged" (CONTEXT.md). A narrower or
 * same-sight seat is silent. The seat itself stays client state; this
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
    if (!seatWidensReads(own?.role ?? null, target.role)) {
      return { announced: false }
    }

    const devName = own?.displayName ?? user.name ?? user._id
    await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      senderId: user._id,
      senderName: devName,
      text: `${devName} takes the Second Seat: reading as ${target.displayName}`,
      visibilityType: "system",
      timestamp: Date.now(),
    })
    return { announced: true }
  },
})
