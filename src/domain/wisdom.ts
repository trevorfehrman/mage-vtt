import { Match, Schema } from "effect"

// Pure rules leaves (ADR-0014): plain functions; the Wisdom-keyed table is
// total over the 1–10 rank vocabulary, and the XP-cost variants are a tagged
// union dispatched with Match.

/** Wisdom runs 1–10; tables keyed by it are total, so no rank can fall through. */
export const WisdomRank = Schema.Literals([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
export type WisdomRank = typeof WisdomRank.Type

// --- Degeneration dice pool by Wisdom (pages 79-80, Mage) ---

const DEGENERATION_POOL: Record<WisdomRank, number> = {
  10: 5,
  9: 5,
  8: 4,
  7: 4,
  6: 3,
  5: 3,
  4: 3,
  3: 2,
  2: 2,
  1: 2,
}

// --- XP cost multipliers (page 69 Mage, page 35 WoD) ---

export const XpTrait = Schema.Literals([
  "attribute",
  "skill",
  "skillSpecialty",
  "rulingArcanum",
  "commonArcanum",
  "inferiorArcanum",
  "gnosis",
  "wisdom",
  "merit",
  "rote",
  "willpower",
])
export type XpTrait = typeof XpTrait.Type

const XpCostRule = Schema.Union([
  Schema.TaggedStruct("perDot", { multiplier: Schema.Number }),
  Schema.TaggedStruct("flat", { points: Schema.Number }),
])
type XpCostRule = typeof XpCostRule.Type

const XP_COSTS: Record<XpTrait, XpCostRule> = {
  attribute: { _tag: "perDot", multiplier: 5 },
  skill: { _tag: "perDot", multiplier: 3 },
  skillSpecialty: { _tag: "flat", points: 3 },
  rulingArcanum: { _tag: "perDot", multiplier: 6 },
  commonArcanum: { _tag: "perDot", multiplier: 7 },
  inferiorArcanum: { _tag: "perDot", multiplier: 8 },
  gnosis: { _tag: "perDot", multiplier: 8 },
  wisdom: { _tag: "perDot", multiplier: 3 },
  merit: { _tag: "perDot", multiplier: 2 },
  rote: { _tag: "flat", points: 2 },
  willpower: { _tag: "flat", points: 8 },
}

// --- Types ---

export class WisdomEffectsResult extends Schema.Class<WisdomEffectsResult>("WisdomEffectsResult")({
  spiritSocialBonus: Schema.Number.check(Schema.isInt()),
  abyssalContestBonus: Schema.Number.check(Schema.isInt()),
}) {}

// --- Public API ---

export const degenerationDicePool = (wisdom: WisdomRank): number =>
  DEGENERATION_POOL[wisdom]

export const wisdomEffects = (wisdom: number): WisdomEffectsResult => {
  let spiritSocialBonus = 0
  let abyssalContestBonus = 0

  if (wisdom >= 9) {
    spiritSocialBonus = 1
    abyssalContestBonus = 1
  } else if (wisdom <= 2) {
    spiritSocialBonus = -1
    abyssalContestBonus = -1
  }

  return new WisdomEffectsResult({ spiritSocialBonus, abyssalContestBonus })
}

export const SkillCategory = Schema.Literals(["mental", "physical", "social"])
export type SkillCategory = typeof SkillCategory.Type

export const untrainedSkillPenalty = (category: SkillCategory): number =>
  Match.value(category).pipe(
    Match.when("mental", () => -3),
    Match.when("physical", () => -1),
    Match.when("social", () => -1),
    Match.exhaustive,
  )

export const xpCost = (traitType: XpTrait, newDots: number): number =>
  Match.value(XP_COSTS[traitType]).pipe(
    Match.tag("perDot", (rule) => newDots * rule.multiplier),
    Match.tag("flat", (rule) => rule.points),
    Match.exhaustive,
  )
