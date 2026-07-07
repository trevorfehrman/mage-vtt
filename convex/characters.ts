import { Schema } from "effect"
import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { requireMember, seatedMember } from "./lib/auth"
import { enforcedMutation } from "./lib/enforce"
import { initialCurrentState, PathName } from "../src/domain/character"
import { HealthBox } from "../src/domain/damage"
import { castSpell as castSpellFlow } from "../src/domain/flows/casting"
import { castRote as castRoteFlow } from "../src/domain/flows/rote-cast"
import { handEditSheet as handEditSheetFlow } from "../src/domain/flows/hand-edit"
import { schemaToConvexValidator } from "../src/domain/schema-bridge"
import { CharacterSeedData } from "../src/domain/tables"

// A Covert improvised cast through the enforcement seam (ADR-0004, PRD #4).
// Auth, authority over the sheet, the Mana economy, the dice, the sheet patch,
// and the Activity entry all come from the domain flow; this file supplies only
// the args.
export const castSpell = enforcedMutation({
  args: {
    sessionId: v.id("sessions"),
    characterId: v.id("characters"),
    arcanum: v.string(),
    level: v.number(),
    potency: v.optional(v.number()),
    targets: v.optional(v.number()),
    highSpeech: v.optional(v.boolean()),
    extraManaCost: v.optional(v.number()),
    spendWillpower: v.optional(v.boolean()),
    visibility: v.optional(v.union(v.literal("public"), v.literal("hidden"))),
  },
  flow: castSpellFlow,
})

// A known-Rote cast through the seam (PRD #11, issue #18). The Rote lookup,
// the Aspect gate, the pool from the caster's own sheet, and the writes all
// live in the domain flow; this file supplies only the args.
export const castRote = enforcedMutation({
  args: {
    sessionId: v.id("sessions"),
    characterId: v.id("characters"),
    roteName: v.string(),
    skillChoice: v.optional(v.string()),
    potency: v.optional(v.number()),
    targets: v.optional(v.number()),
    highSpeech: v.optional(v.boolean()),
    extraManaCost: v.optional(v.number()),
    spendWillpower: v.optional(v.boolean()),
    visibility: v.optional(v.union(v.literal("public"), v.literal("hidden"))),
  },
  flow: castRoteFlow,
})

// The fudge/repair path (PRD #11, issue #19): a hand edit to a sheet's
// current-state values. The inverted authority ladder (owner rejected; only
// ST/Dev pass), the repair Override, and the system Activity entry all live
// in the domain flow; this file supplies only the args.
export const handEdit = enforcedMutation({
  args: {
    sessionId: v.id("sessions"),
    characterId: v.id("characters"),
    manaCurrent: v.optional(v.number()),
    willpowerCurrent: v.optional(v.number()),
    // The (severity, resistant) pair (issue #41) — the dot beneath the box is
    // hand-editable like everything the sheet can represent (ADR-0011). The
    // validator is bridge-derived from the one box vocabulary (ADR-0005).
    healthTrack: v.optional(schemaToConvexValidator(Schema.Array(HealthBox))),
  },
  flow: handEditSheetFlow,
})

export const getForSession = query({
  args: {
    sessionId: v.id("sessions"),
    // The Second Seat (ADR-0013): while seated, "my character" is the seat
    // member's — the Dev's own sheet is out of reach until they stand up.
    seat: v.optional(v.id("sessionMembers")),
  },
  handler: async (ctx, args) => {
    // The gate refuses non-members (issue #37); null now only ever means
    // "this member has no character yet" — the client's seeding trigger.
    const member = await seatedMember(ctx, args.sessionId, args.seat)

    return await ctx.db
      .query("characters")
      .withIndex("by_sessionMemberId", (q) =>
        q.eq("sessionMemberId", member._id),
      )
      .unique()
  },
})

// The Session roster (PRD #11, issue #17): every PC in the Session, readable
// by every session member. Scoping is server-side — a non-member gets the
// gate's typed refusal (issue #37), never an empty roster they could confuse
// for a real one. Sheets carry no secrets by table norm (hidden things live
// in the feed, which already filters server-side), so the full documents go
// to every member.
export const listForSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.sessionId)

    return await ctx.db
      .query("characters")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect()
  },
})

// Dev-only sheet seeding. The args validator is bridge-derived from the
// domain's seedable width (ADR-0005, issue #27) — the same pattern as the
// ingestion mutation — and every derived stat (health boxes, Willpower,
// starting Mana) comes from the character domain, never re-derived here.
export const seed = mutation({
  args: {
    sessionId: v.id("sessions"),
    data: schemaToConvexValidator(CharacterSeedData),
  },
  handler: async (ctx, args) => {
    const member = await requireMember(ctx, args.sessionId)

    // Idempotent: skip if character already exists
    const existing = await ctx.db
      .query("characters")
      .withIndex("by_sessionMemberId", (q) =>
        q.eq("sessionMemberId", member._id),
      )
      .unique()

    if (existing) return existing._id

    return await ctx.db.insert("characters", {
      sessionMemberId: member._id,
      sessionId: args.sessionId,
      userId: member.userId,
      ...args.data,
      // The wire validator already pins the Path literals; the decode re-proves
      // it to the type system so the derivation reads a total table.
      ...initialCurrentState({
        ...args.data,
        path: Schema.decodeUnknownSync(PathName)(args.data.path),
      }),
    })
  },
})
