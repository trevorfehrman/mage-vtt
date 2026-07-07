import { ConvexError, v } from "convex/values"
import { SessionNotFound } from "../src/domain/session"
import { mutation, query } from "./_generated/server"
import { requireMember, requireUser } from "./lib/auth"
import { mapEffectError } from "./lib/effect"

const INVITE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function generateInviteCode(): string {
  let code = ""
  for (let i = 0; i < 8; i++) {
    code += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)]
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    const sessionId = await ctx.db.insert("sessions", {
      name: args.name,
      storytellerId: user._id,
      inviteCode: generateInviteCode(),
      status: "lobby",
    })

    await ctx.db.insert("sessionMembers", {
      sessionId,
      userId: user._id,
      role: "storyteller",
      displayName: user.name ?? "Storyteller",
    })

    return sessionId
  },
})

export const join = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", args.inviteCode))
      .unique()

    if (!session) {
      // A typed refusal on the wire (ADR-0010, issue #50): the same domain
      // class the join flow raises, decodable against the SeamError union.
      throw new ConvexError(
        mapEffectError(
          new SessionNotFound({
            message: `No session found with invite code: ${args.inviteCode}`,
          }),
        ) as Record<string, string>,
      )
    }

    // Check not already a member
    const existing = await ctx.db
      .query("sessionMembers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
      .collect()

    if (existing.some((m) => m.userId === user._id)) {
      return session._id // Already a member, just return the session
    }

    await ctx.db.insert("sessionMembers", {
      sessionId: session._id,
      userId: user._id,
      role: "player",
      displayName: user.name ?? "Player",
    })

    return session._id
  },
})

// The Session document plus its roster, for members only (issue #37): the
// gate replaces what was an ungated read — Session content, member names
// included, never leaves the table.
export const get = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.sessionId)

    const session = await ctx.db.get(args.sessionId)
    if (!session) return null

    const members = await ctx.db
      .query("sessionMembers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect()

    return { ...session, members }
  },
})

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx)

    const memberships = await ctx.db
      .query("sessionMembers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    const sessions = await Promise.all(
      memberships.map(async (m) => {
        const session = await ctx.db.get(m.sessionId)
        return session ? { ...session, myRole: m.role } : null
      }),
    )

    return sessions.filter((s) => s !== null)
  },
})
