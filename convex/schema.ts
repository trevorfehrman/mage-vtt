import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { schemaToConvexValidator } from "../src/domain/schema-bridge"
import {
  CastDoc,
  CharacterDoc,
  DiceRollDoc,
  MessageDoc,
  SceneDoc,
  SessionMemberDoc,
} from "../src/domain/tables"

/**
 * A Rote's structured dice pool (issue #14), mirroring
 * src/domain/rote-pool.ts `RotePool`: `skills` ≥1 (more than one = the book's
 * "or" alternatives), `vs` present = a contested pool. Shared with the
 * `insertRote` ingest mutation.
 */
export const rotePoolValidator = v.object({
  attribute: v.string(),
  skills: v.array(v.string()),
  arcanum: v.string(),
  vs: v.optional(v.array(v.string())),
})

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
    .index("by_name", ["name"])
    // Spell names repeat across arcana (Sight, Protection, …) AND at several
    // levels within one Arcanum (Sight is Fate 1 and Fate 2), so the upsert
    // identity is the full triple (issue #29).
    .index("by_name_arcanum_level", ["name", "arcanum", "level"]),

  rotes: defineTable({
    spellName: v.string(),
    spellArcanum: v.string(),
    spellLevel: v.number(),
    order: v.string(),
    name: v.string(),
    // Canonical prose form of `pool` — display only.
    dicePool: v.string(),
    // The structured pool (issue #14) — what the domain consumes. Optional
    // only for rows predating re-ingestion.
    pool: v.optional(rotePoolValidator),
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
  sessionMembers: defineTable(schemaToConvexValidator(SessionMemberDoc))
    .index("by_sessionId", ["sessionId"])
    .index("by_userId", ["userId"]),

  // --- Dice Rolls (derived from the `DiceRollDoc` mirror, ADR-0005) ---
  diceRolls: defineTable(schemaToConvexValidator(DiceRollDoc)).index(
    "by_sessionId",
    ["sessionId"],
  ),

  // --- Characters (derived from the `CharacterDoc` mirror, ADR-0005) ---
  // The last hand-written table definition, retired: an equivalence test pins
  // the derived validator to the previous shape so existing documents stay valid.
  characters: defineTable(schemaToConvexValidator(CharacterDoc))
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionMemberId", ["sessionMemberId"]),

  // --- Chat Messages (derived from the `MessageDoc` mirror, ADR-0005) ---
  messages: defineTable(schemaToConvexValidator(MessageDoc)).index("by_sessionId", [
    "sessionId",
  ]),

  // --- Scenes (derived from the `SceneDoc` mirror, ADR-0005; issue #42) ---
  // The compound index serves the one hot read: "this session's active Scene".
  scenes: defineTable(schemaToConvexValidator(SceneDoc)).index(
    "by_sessionId_status",
    ["sessionId", "status"],
  ),

  // --- Casts (derived from the `CastDoc` mirror, ADR-0005; issue #43) ---
  // One index: every read is session-scoped (the wings, the stage, the
  // accumulator), and sessions hold few Casts — flows filter in memory.
  casts: defineTable(schemaToConvexValidator(CastDoc)).index("by_sessionId", [
    "sessionId",
  ]),
})
