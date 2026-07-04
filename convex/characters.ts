import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { requireUser } from "./lib/auth"
import { enforcedMutation } from "./lib/enforce"
import { castSpell as castSpellFlow } from "../src/domain/flows/casting"
import { castRote as castRoteFlow } from "../src/domain/flows/rote-cast"

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

export const getForSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    const members = await ctx.db
      .query("sessionMembers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect()

    const member = members.find((m) => m.userId === user._id)
    if (!member) return null

    const character = await ctx.db
      .query("characters")
      .withIndex("by_sessionMemberId", (q) =>
        q.eq("sessionMemberId", member._id),
      )
      .unique()

    return character
  },
})

export const seed = mutation({
  args: {
    sessionId: v.id("sessions"),
    data: v.object({
      name: v.string(),
      shadowName: v.optional(v.string()),
      concept: v.string(),
      virtue: v.string(),
      vice: v.string(),
      path: v.string(),
      order: v.string(),
      gnosis: v.number(),
      attributes: v.object({
        mental: v.object({
          intelligence: v.number(),
          wits: v.number(),
          resolve: v.number(),
        }),
        physical: v.object({
          strength: v.number(),
          dexterity: v.number(),
          stamina: v.number(),
        }),
        social: v.object({
          presence: v.number(),
          manipulation: v.number(),
          composure: v.number(),
        }),
      }),
      skills: v.object({
        mental: v.object({
          academics: v.number(),
          computer: v.number(),
          crafts: v.number(),
          investigation: v.number(),
          medicine: v.number(),
          occult: v.number(),
          politics: v.number(),
          science: v.number(),
        }),
        physical: v.object({
          athletics: v.number(),
          brawl: v.number(),
          drive: v.number(),
          firearms: v.number(),
          larceny: v.number(),
          stealth: v.number(),
          survival: v.number(),
          weaponry: v.number(),
        }),
        social: v.object({
          animalKen: v.number(),
          empathy: v.number(),
          expression: v.number(),
          intimidation: v.number(),
          persuasion: v.number(),
          socialize: v.number(),
          streetwise: v.number(),
          subterfuge: v.number(),
        }),
      }),
      arcana: v.object({
        death: v.optional(v.number()),
        fate: v.optional(v.number()),
        forces: v.optional(v.number()),
        life: v.optional(v.number()),
        matter: v.optional(v.number()),
        mind: v.optional(v.number()),
        prime: v.optional(v.number()),
        space: v.optional(v.number()),
        spirit: v.optional(v.number()),
        time: v.optional(v.number()),
      }),
    }),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    const members = await ctx.db
      .query("sessionMembers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect()

    const member = members.find((m) => m.userId === user._id)
    if (!member) {
      throw new Error("Not a member of this session")
    }

    // Idempotent: skip if character already exists
    const existing = await ctx.db
      .query("characters")
      .withIndex("by_sessionMemberId", (q) =>
        q.eq("sessionMemberId", member._id),
      )
      .unique()

    if (existing) return existing._id

    // Compute initial mutable values from the data
    const stamina = args.data.attributes.physical.stamina
    const healthSize = stamina + 5
    const healthTrack = Array.from({ length: healthSize }, () => "empty")

    // Resolve + Composure (with path resistance bonus)
    const pathResistance: Record<string, { attr: "composure" | "resolve"; bonus: number }> = {
      Acanthus: { attr: "composure", bonus: 1 },
      Mastigos: { attr: "resolve", bonus: 1 },
      Moros: { attr: "composure", bonus: 1 },
      Obrimos: { attr: "resolve", bonus: 1 },
      Thyrsus: { attr: "composure", bonus: 1 },
    }
    const resistance = pathResistance[args.data.path]
    const effectiveResolve = args.data.attributes.mental.resolve +
      (resistance?.attr === "resolve" ? resistance.bonus : 0)
    const effectiveComposure = args.data.attributes.social.composure +
      (resistance?.attr === "composure" ? resistance.bonus : 0)
    const willpowerMax = effectiveResolve + effectiveComposure

    // Gnosis-based max mana
    const GNOSIS_MAX_MANA = [10, 11, 12, 13, 14, 15, 20, 30, 50, 100]
    const maxMana = GNOSIS_MAX_MANA[args.data.gnosis - 1] ?? 10

    const characterId = await ctx.db.insert("characters", {
      sessionMemberId: member._id,
      sessionId: args.sessionId,
      userId: user._id,
      ...args.data,
      healthTrack,
      willpowerCurrent: willpowerMax,
      manaCurrent: maxMana,
    })

    return characterId
  },
})
