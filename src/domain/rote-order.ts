import { Array as Arr, Order } from "effect"
import type { KnownRote } from "./character"
import type { ROTE_ARCANA } from "./rote-pool"

/**
 * Rotes ordered by Arcanum (issue #88): the sheet's Rotes section mirrors the
 * dashboard tiles, so a character's Death verbs sit together beneath the Death
 * tile and rows never reshuffle when ratings change.
 */

/**
 * The dashboard tiles' canonical order — row-major over the five Supernal
 * Realm columns (`ARCANA_CANON` in CharacterSheet.tsx, capitalized to the
 * Rote vocabulary): the first row's five Arcana, then the second row's.
 */
export const CANONICAL_ARCANA: ReadonlyArray<(typeof ROTE_ARCANA)[number]> = [
  "Prime", "Fate", "Mind", "Spirit", "Death",
  "Forces", "Time", "Space", "Life", "Matter",
]

const byArcanum = Order.mapInput(Order.Number, (r: KnownRote) =>
  CANONICAL_ARCANA.indexOf(r.spellArcanum),
)
const byLevel = Order.mapInput(Order.Number, (r: KnownRote) => r.spellLevel)
const byName = Order.mapInput(Order.String, (r: KnownRote) => r.name)

const canonicalRoteOrder = Order.combine(byArcanum, Order.combine(byLevel, byName))

/** KnownRotes in section order: canonical Arcanum, then spell level, then name. */
export const sortRotes = (rotes: ReadonlyArray<KnownRote>): Array<KnownRote> =>
  Arr.sort(rotes, canonicalRoteOrder)
