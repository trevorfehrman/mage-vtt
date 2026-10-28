import { Match, Schema } from "effect"
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

/** The purse as the door shows it: what it holds, what is left this chapter, what is staged into this roll. */
export const Purse = Schema.Struct({
  capacity: Schema.Number,
  current: Schema.Number,
  staged: Schema.Number,
})
export type Purse = typeof Purse.Type

export const PipState = Schema.Literals(["purse", "staged", "gone"])
export type PipState = typeof PipState.Type

/**
 * The pips left to right: in the purse (verdigris ring), staged into this
 * roll (ember — the rightmost of what is left, about to leave), gone this
 * chapter (dim, hollow).
 */
export const pipStates = (purse: Purse): ReadonlyArray<PipState> =>
  Array.from({ length: purse.capacity }, (_, i) =>
    i >= purse.current ? "gone" : i >= purse.current - purse.staged ? "staged" : "purse",
  )

/** What a tap on a pip asks for: a new staging, or a refill through the pip (a mark). */
export const PipTap = Schema.Union([
  Schema.TaggedStruct("stage", { staged: Schema.Number }),
  Schema.TaggedStruct("refill", { current: Schema.Number }),
])
export type PipTap = typeof PipTap.Type

/**
 * Click-through, both ways: a purse pip stages itself and every purse pip
 * right of it; a staged pip takes itself and every staged pip left of it
 * back; a gone pip fills the purse through itself.
 */
export const pipTap = (purse: Purse, i: number): PipTap =>
  Match.value(pipStates(purse)[i] ?? "gone").pipe(
    Match.when("purse", () => ({ _tag: "stage", staged: purse.current - i }) as const),
    Match.when("staged", () => ({ _tag: "stage", staged: purse.current - i - 1 }) as const),
    Match.when("gone", () => ({ _tag: "refill", current: i + 1 }) as const),
    Match.exhaustive,
  )
