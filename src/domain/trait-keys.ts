import { Schema } from "effect"

// The sheet's closed key vocabularies, kept in a leaf of their own so the
// catalogs that name them (Merit prerequisites, a Bedlam derangement's
// weak Arcanum) and the sheet that carries those catalogs' names can both
// import them without a cycle. `character.ts` re-exports them, so the
// sheet's callers keep their one import.

/** The nine Attributes, lowercase — the keys of the sheet's attribute blocks. */
export const AttributeKey = Schema.Literals([
  "intelligence", "wits", "resolve",
  "strength", "dexterity", "stamina",
  "presence", "manipulation", "composure",
])
export type AttributeKey = typeof AttributeKey.Type

/**
 * The sheet's skill keys (MAG-58): the one vocabulary a Skill Specialty or a
 * Merit prerequisite may name. A test pins it to `SheetSkills`' own keys so
 * the two cannot drift.
 */
export const SkillKey = Schema.Literals([
  "academics", "computer", "crafts", "investigation", "medicine", "occult", "politics", "science",
  "athletics", "brawl", "drive", "firearms", "larceny", "stealth", "survival", "weaponry",
  "animalKen", "empathy", "expression", "intimidation", "persuasion", "socialize", "streetwise", "subterfuge",
])
export type SkillKey = typeof SkillKey.Type

/** A skill key as the sheet and the pool name it: "animalKen" → "Animal Ken". */
export const skillDisplayName = (key: SkillKey): string =>
  key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())

/** The ten Arcana, lowercase — the canonical key set for arcana maps. */
export const ARCANA = [
  "death", "fate", "forces", "life", "matter",
  "mind", "prime", "space", "spirit", "time",
] as const

export const ArcanumName = Schema.Literals([...ARCANA])
export type ArcanumName = typeof ArcanumName.Type
