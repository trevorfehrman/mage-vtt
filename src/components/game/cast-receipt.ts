import type { CastEntry } from "#/domain/activity"

/**
 * The declared terms, one line — the receipt the offer and the caster's
 * occupied roll zone both read from (issue #110); the chronicle card renders
 * its own richer form. One formatter so the two zones can't drift.
 */
export const castReceipt = (cast: CastEntry): string =>
  [
    `declared pool ${cast.declaredPool}`,
    ...(cast.potency !== undefined ? [`Potency ${cast.potency} bought`] : []),
    ...(cast.targets !== undefined ? [`×${cast.targets} targets`] : []),
    ...(cast.spellManaCost > 0 ? [`${cast.spellManaCost} Mana cost`] : []),
    ...(cast.usesMagicalTool ? ["tool in hand −1"] : []),
  ].join(" · ")
