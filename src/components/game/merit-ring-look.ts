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

/** A purse's level on the sheet: what is left this chapter, and what it holds. */
export const PurseLevel = Schema.Struct({
  current: Schema.Number,
  capacity: Schema.Number,
})
export type PurseLevel = typeof PurseLevel.Type

/** The purse as the door shows it: its level, and what is staged into this roll. */
export const Purse = Schema.Struct({
  ...PurseLevel.fields,
  staged: Schema.Number,
})
export type Purse = typeof Purse.Type

export const PurseDieState = Schema.Literals(["purse", "staged", "gone"])
export type PurseDieState = typeof PurseDieState.Type

/**
 * The purse's dice left to right (owner, 2026-10-28: "show the purse as
 * normal sized dice… one input type"): in the purse (a verdigris die),
 * staged into the tray (an ember ghost — the die has gone to the tray; the
 * rightmost of what is left go first), gone this chapter (a dim ghost,
 * rolled away).
 */
export const purseDice = (purse: Purse): ReadonlyArray<PurseDieState> =>
  Array.from({ length: purse.capacity }, (_, i) =>
    i >= purse.current ? "gone" : i >= purse.current - purse.staged ? "staged" : "purse",
  )

/** What a tap on a purse die asks for: a new staging, or a refill through the die (a mark). */
export const PurseTap = Schema.Union([
  Schema.TaggedStruct("stage", { staged: Schema.Number }),
  Schema.TaggedStruct("refill", { current: Schema.Number }),
])
export type PurseTap = typeof PurseTap.Type

/**
 * One input: click a die. A purse die goes to the tray, with every purse
 * die right of it; a staged die comes back, with every staged die left of
 * it; a gone die refills the purse through itself.
 */
export const purseTap = (purse: Purse, i: number): PurseTap =>
  Match.value(purseDice(purse)[i] ?? "gone").pipe(
    Match.when("purse", () => ({ _tag: "stage", staged: purse.current - i }) as const),
    Match.when("staged", () => ({ _tag: "stage", staged: purse.current - i - 1 }) as const),
    Match.when("gone", () => ({ _tag: "refill", current: i + 1 }) as const),
    Match.exhaustive,
  )
