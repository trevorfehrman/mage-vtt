import { Match, Schema } from "effect"

// Pure rules leaves (ADR-0014): plain functions; the Wisdom-keyed table is
// total over the 1–10 rank vocabulary, and the XP-cost variants are a tagged
// union dispatched with Match.

/** Wisdom runs 1–10; tables keyed by it are total, so no rank can fall through. */
export const WisdomRank = Schema.Literals([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
export type WisdomRank = typeof WisdomRank.Type

/** A new mage's Wisdom (page 69): 7, before any creation trade-off. */
export const STARTING_WISDOM: WisdomRank = 7

// --- Acts of hubris by Wisdom (pages 79-80, Mage) ---

/**
 * The mildest act that threatens a dot at each rank — what a mage of that
 * Wisdom can no longer shrug off. The sheet speaks it beside the number so
 * the trait reads as a conscience, not a score.
 */
const ACTS_OF_HUBRIS: Record<WisdomRank, string> = {
  10: "magic where the mundane would do; a selfish thought",
  9: "magically bending another against their will; a minor selfish act",
  8: "magically forcing another to break their own morals; injuring another",
  7: "laying a curse; petty theft",
  6: "binding an unwilling being to a place or task; grand theft",
  5: "transforming a person into a lesser being against their will; mass property damage",
  4: "harming someone with magic; draining another's Mana; an impassioned crime",
  3: "exiling or possessing another against their will; planned murder",
  2: "preventing an Awakening; murder by magic; casual, callous murder",
  1: "stealing a soul; mass murder",
}

export const actsOfHubris = (wisdom: WisdomRank): string => ACTS_OF_HUBRIS[wisdom]

// --- Bands (MAG-56): the drama of the number, in the sheet's words ---

/**
 * Where a Wisdom stands, as a mage would feel it: 10 is serene, 8–9 clear,
 * 6–7 steady (a new mage's 7 is here), 4–5 faltering, 2–3 blind (the book's
 * "acts of blindness"), 1 lost to Endless Night. The names are the app's,
 * the thresholds follow the book's effects: the ±1 with spirits and Abyssal
 * things turn at 9 and 2, Paradox durations lengthen below 5.
 */
export const WisdomBand = Schema.Literals(["serene", "clear", "steady", "faltering", "blind", "lost"])
export type WisdomBand = typeof WisdomBand.Type

const BAND_BY_RANK: Record<WisdomRank, WisdomBand> = {
  10: "serene",
  9: "clear",
  8: "clear",
  7: "steady",
  6: "steady",
  5: "faltering",
  4: "faltering",
  3: "blind",
  2: "blind",
  1: "lost",
}

export const wisdomBand = (wisdom: WisdomRank): WisdomBand => BAND_BY_RANK[wisdom]

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
