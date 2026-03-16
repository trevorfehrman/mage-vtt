import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

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
})
