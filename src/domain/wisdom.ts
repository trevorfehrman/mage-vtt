import { Effect, Schema } from "effect"

// --- Degeneration dice pool by Wisdom (pages 79-80, Mage) ---

const DEGENERATION_POOL: Record<number, number> = {
  10: 5, 9: 5, 8: 4, 7: 4, 6: 3, 5: 3, 4: 3, 3: 2, 2: 2, 1: 2,
}

// --- XP cost multipliers (page 69 Mage, page 35 WoD) ---

const XP_COSTS: Record<string, { multiplier: number } | { flat: number }> = {
  attribute: { multiplier: 5 },
  skill: { multiplier: 3 },
  skillSpecialty: { flat: 3 },
  rulingArcanum: { multiplier: 6 },
  commonArcanum: { multiplier: 7 },
  inferiorArcanum: { multiplier: 8 },
  gnosis: { multiplier: 8 },
  wisdom: { multiplier: 3 },
  merit: { multiplier: 2 },
  rote: { flat: 2 },
  willpower: { flat: 8 },
}

// --- Types ---

export class WisdomEffectsResult extends Schema.Class<WisdomEffectsResult>("WisdomEffectsResult")({
  spiritSocialBonus: Schema.Number.check(Schema.isInt()),
  abyssalContestBonus: Schema.Number.check(Schema.isInt()),
}) {}

// --- Public API ---

export const degenerationDicePool = Effect.fn("Wisdom.degenerationPool")(function* (
  wisdom: number,
) {
  return DEGENERATION_POOL[wisdom] ?? 2
})

export const wisdomEffects = Effect.fn("Wisdom.effects")(function* (wisdom: number) {
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
})

export const untrainedSkillPenalty = Effect.fn("Wisdom.untrainedPenalty")(function* (
  category: "mental" | "physical" | "social",
) {
  return category === "mental" ? -3 : -1
})

export const xpCost = Effect.fn("Wisdom.xpCost")(function* (
  traitType: string,
  newDots: number,
) {
  const cost = XP_COSTS[traitType]
  if (!cost) return 0
  if ("flat" in cost) return cost.flat
  return newDots * cost.multiplier
})
