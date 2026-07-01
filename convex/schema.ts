import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { schemaToConvexValidator } from "../src/domain/schema-bridge"
import {
  DiceRollsRow,
  MessagesRow,
  SessionMembersRow,
} from "../src/domain/tables"

export default defineSchema({
  // --- RAG: Rule chunks with vector embeddings ---
  ruleChunks: defineTable({
    chunkId: v.string(),
    text: v.string(),
    embedding: v.array(v.float64()),
    chapter: v.string(),
    section: v.string(),
    contentType: v.string(), // rules | lore | glossary | spells | creation | storytelling
    pageStart: v.number(),
    pageEnd: v.number(),
    source: v.string(), // core-rules | homebrew
  })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["contentType", "source"],
    })
    .index("by_chunkId", ["chunkId"]),

  // --- Structured: Spells and Rotes ---
  spells: defineTable({
    name: v.string(),
    arcanum: v.string(),
    level: v.number(),
    practice: v.string(),
    action: v.string(),
    duration: v.string(),
    aspect: v.string(),
    cost: v.string(),
    description: v.string(),
    pageStart: v.number(),
  })
    .index("by_arcanum", ["arcanum"])
    .index("by_arcanum_level", ["arcanum", "level"])
    .index("by_name", ["name"]),

  rotes: defineTable({
    spellName: v.string(),
    spellArcanum: v.string(),
    spellLevel: v.number(),
    order: v.string(),
    name: v.string(),
    dicePool: v.string(),
  })
    .index("by_order", ["order"])
    .index("by_spell", ["spellName", "spellArcanum"]),

  // --- Structured: Path and Order reference data ---
  paths: defineTable({
    name: v.string(),
    realm: v.string(),
    rulingArcana: v.array(v.string()),
    commonArcana: v.array(v.string()),
    inferiorArcanum: v.string(),
    resistanceBonusAttribute: v.string(),
    resistanceBonusValue: v.number(),
  }).index("by_name", ["name"]),

  orders: defineTable({
    name: v.string(),
    roteSkills: v.array(v.string()),
    description: v.string(),
  }).index("by_name", ["name"]),

  // --- Game Sessions ---
  sessions: defineTable({
    name: v.string(),
    storytellerId: v.string(),
    inviteCode: v.string(),
    status: v.union(v.literal("lobby"), v.literal("active"), v.literal("ended")),
  })
    .index("by_inviteCode", ["inviteCode"])
    .index("by_storytellerId", ["storytellerId"]),

  // Validator derived from the Effect-Schema mirror (ADR-0005); the column shape
  // lives once in `src/domain/tables.ts`.
  sessionMembers: defineTable(schemaToConvexValidator(SessionMembersRow))
    .index("by_sessionId", ["sessionId"])
    .index("by_userId", ["userId"]),

  // --- Dice Rolls (derived from the `DiceRollsRow` mirror, ADR-0005) ---
  diceRolls: defineTable(schemaToConvexValidator(DiceRollsRow)).index(
    "by_sessionId",
    ["sessionId"],
  ),

  // --- Characters ---
  characters: defineTable({
    sessionMemberId: v.id("sessionMembers"),
    sessionId: v.id("sessions"),
    userId: v.string(),
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
    healthTrack: v.array(v.string()),
    willpowerCurrent: v.number(),
    manaCurrent: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionMemberId", ["sessionMemberId"]),

  // --- Chat Messages (derived from the `MessagesRow` mirror, ADR-0005) ---
  messages: defineTable(schemaToConvexValidator(MessagesRow)).index("by_sessionId", [
    "sessionId",
  ]),
})
