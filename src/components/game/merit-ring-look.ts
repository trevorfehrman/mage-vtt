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

/** The purse's dice as the door lays them out, one state per slot. */
export const PurseLayout = Schema.Array(PurseDieState)
export type PurseLayout = typeof PurseLayout.Type

const count = (layout: PurseLayout, state: PurseDieState): number =>
  layout.filter((d) => d === state).length

/** The layout the counts alone give: in the purse, then staged, then gone. */
export const canonicalPurse = (purse: Purse): PurseLayout =>
  Array.from({ length: purse.capacity }, (_, i) =>
    i >= purse.current ? "gone" : i >= purse.current - purse.staged ? "staged" : "purse",
  )

/**
 * The door remembers which die is which (owner, 2026-10-28: "select and
 * deselect the dice at will, in whatever order I want — that will make it
 * feel more like a purse"); the sheet and the pool only know counts. A
 * remembered layout stands while it agrees with the counts. When the roll
 * takes the staged dice (the pool empties and the purse drops by exactly
 * that many) the staged slots are the ones that go. Anything else — a
 * hand edit, a stale layout — falls back to the canonical layout.
 */
export const reconcilePurse = (layout: PurseLayout, purse: Purse): PurseLayout => {
  const agrees =
    layout.length === purse.capacity &&
    count(layout, "gone") === purse.capacity - purse.current &&
    count(layout, "staged") === purse.staged
  if (agrees) return layout
  const rolled =
    layout.length === purse.capacity &&
    purse.staged === 0 &&
    count(layout, "gone") + count(layout, "staged") === purse.capacity - purse.current
  if (rolled) return layout.map((d) => (d === "staged" ? "gone" : d))
  return canonicalPurse(purse)
}

/** What a tap on a purse die asks for, and the layout after it. */
export const PurseTap = Schema.Struct({
  layout: PurseLayout,
  act: Schema.Union([
    /** stage this many into the pool */
    Schema.TaggedStruct("stage", { staged: Schema.Number }),
    /** refill the purse to this many — a mark */
    Schema.TaggedStruct("refill", { current: Schema.Number }),
  ]),
})
export type PurseTap = typeof PurseTap.Type

/**
 * One input: tap a die, any die, in any order. A purse die goes to the
 * tray; a staged die comes back; a gone die refills the purse through
 * itself.
 */
export const tapPurseDie = (layout: PurseLayout, i: number): PurseTap => {
  const flip = (to: PurseDieState): PurseLayout => layout.map((d, k) => (k === i ? to : d))
  return Match.value(layout[i] ?? "gone").pipe(
    Match.when("purse", () => {
      const next = flip("staged")
      return { layout: next, act: { _tag: "stage", staged: count(next, "staged") } as const }
    }),
    Match.when("staged", () => {
      const next = flip("purse")
      return { layout: next, act: { _tag: "stage", staged: count(next, "staged") } as const }
    }),
    Match.when("gone", () => {
      const next = flip("purse")
      return { layout: next, act: { _tag: "refill", current: next.length - count(next, "gone") } as const }
    }),
    Match.exhaustive,
  )
}
