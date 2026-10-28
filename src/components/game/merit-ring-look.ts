import { Schema } from "effect"
import type { MeritName } from "#/domain/merits"

// The ring's pure rules (MAG-59; ADR-0019): plain functions over Schema
// shapes, read by MeritRing.tsx and the gallery. Nothing here touches the
// pool or the sheet — those are the component's.

/** The name on the ring: short, the door says the whole of it. A name over
 * fifteen characters would run off the ring's column into the lock. */
const SHORT_NAMES: Partial<Record<MeritName, string>> = {
  "Encyclopedic Knowledge": "Encyclopedia",
  "Holistic Awareness": "Holistic",
  "Sleepwalker Retainer": "Sleepwalker",
  "Natural Immunity": "Immunity",
  "Toxin Resistance": "Toxins",
  "Fighting Finesse": "Finesse",
  "Fighting Style: Boxing": "Boxing",
  "Fighting Style: Kung Fu": "Kung Fu",
  "Fighting Style: Two Weapons": "Two Weapons",
}
export const ringName = (name: MeritName): string => SHORT_NAMES[name] ?? name

/** An index wrapped into a ring of `n`. */
export const wrapIndex = (n: number, i: number): number => ((i % n) + n) % n

/** A signed distance wrapped into one period: the short way round the ring. */
export const periodic = (period: number, d: number): number => {
  const w = (((d + period / 2) % period) + period) % period
  return w - period / 2
}

// --- The purse's pips (MAG-67) ---

/** A purse's level on the sheet: what is left this chapter, and what it holds. */
export const PurseLevel = Schema.Struct({
  current: Schema.Number,
  capacity: Schema.Number,
})
export type PurseLevel = typeof PurseLevel.Type
