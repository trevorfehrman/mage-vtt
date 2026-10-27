import { Array as Arr, Effect, Match, Option, Schema } from "effect"
import { BoxSeverity, healthBox, type DamageType, type HealthBox, type HealthTrack } from "./damage"

// Pure rules leaves (ADR-0014): damage application, healing, and wound
// penalties are plain functions over the shared health-box vocabulary
// (`./damage`) — including its HealthTrack, so the track has one type, not a
// parallel wrapper class here; only track creation keeps its typed error.

// --- Errors ---

export class HealthTrackError extends Schema.TaggedError<HealthTrackError>()(
  "HealthTrackError",
  { message: Schema.String },
) {}

// --- The sheet's two marking gestures (issue #41, MAG-63) ---

// The one box vocabulary, in its declared order — never a parallel copy.
const BOX_CYCLE: ReadonlyArray<BoxSeverity> = BoxSeverity.literals

/**
 * Click cycles the wound: clear → bashing → lethal → aggravated → clear. The
 * box invariant (#118, owner ruling 2026-07-19): the Resistant dot marks a
 * property of the wound IN the box, so cycling around to empty drops it.
 */
export const cycleBox = (box: HealthBox): HealthBox => {
  const severity = BOX_CYCLE[(BOX_CYCLE.indexOf(box.severity) + 1) % BOX_CYCLE.length]!
  return { severity, resistant: severity === "empty" ? false : box.resistant }
}

/** Toggle the Resistant dot beneath a wound; an empty box can't carry one (#118). */
export const toggleResistant = (box: HealthBox): HealthBox =>
  box.severity === "empty" ? box : { ...box, resistant: !box.resistant }

// --- Damage severity for ordering ---

const SEVERITY: Record<BoxSeverity, number> = {
  empty: 0,
  bashing: 1,
  lethal: 2,
  aggravated: 3,
}

/**
 * Aggravated leftmost, then lethal, then bashing, then empty. Sorting is
 * stable, so a wound's resistant dot rides its whole box through the re-sort.
 */
const bySeverity = (a: HealthBox, b: HealthBox): number =>
  SEVERITY[b.severity] - SEVERITY[a.severity]

const lastIndexOfSeverity = (
  boxes: ReadonlyArray<HealthBox>,
  severity: BoxSeverity,
): number =>
  Option.getOrElse(
    Arr.findLastIndex(boxes, (box) => box.severity === severity),
    () => -1,
  )

/** Worsen the rightmost `from` box to `to`; `none` when no such box exists. */
const upgraded = (
  boxes: ReadonlyArray<HealthBox>,
  from: BoxSeverity,
  to: BoxSeverity,
): Option.Option<ReadonlyArray<HealthBox>> => {
  const index = lastIndexOfSeverity(boxes, from)
  if (index === -1) return Option.none()
  const next = [...boxes]
  // The existing wound compounds — the incoming one never lands, so the box
  // keeps its own resistant dot (issue #41; the ST can hand-edit disagreement).
  next[index] = { ...next[index]!, severity: to }
  return Option.some(next)
}

/**
 * A full track compounds damage: the incoming wound worsens an existing box
 * instead of occupying one — bashing steps to lethal before lethal steps to
 * aggravated. When nothing softer than the incoming damage remains, it is lost.
 */
const overflowed = (
  boxes: ReadonlyArray<HealthBox>,
  damage: DamageType,
): ReadonlyArray<HealthBox> =>
  Match.value(damage).pipe(
    Match.when("bashing", () => upgraded(boxes, "bashing", "lethal")),
    Match.when("lethal", () =>
      upgraded(boxes, "bashing", "lethal").pipe(
        Option.orElse(() => upgraded(boxes, "lethal", "aggravated")),
      ),
    ),
    Match.when("aggravated", () =>
      upgraded(boxes, "lethal", "aggravated").pipe(
        Option.orElse(() => upgraded(boxes, "bashing", "aggravated")),
      ),
    ),
    Match.exhaustive,
    Option.getOrElse(() => boxes),
  )

// --- Public API ---

export const createHealthTrack = Effect.fn("HealthTrack.create")(function* (
  size: number,
) {
  if (size < 1 || size > 20 || !Number.isInteger(size)) {
    return yield* new HealthTrackError({ message: `Invalid health track size: ${size}` })
  }

  const track: HealthTrack = Array.from({ length: size }, () => healthBox("empty"))
  return track
})

export const ApplyDamageOptions = Schema.Struct({
  /** Resistant damage — Paradox Backlash — writes the dot beneath the box. */
  resistant: Schema.optionalKey(Schema.Boolean),
})
export type ApplyDamageOptions = typeof ApplyDamageOptions.Type

export const applyDamage = (
  track: HealthTrack,
  damage: DamageType,
  options?: ApplyDamageOptions,
): HealthTrack => {
  const emptyIndex = track.findIndex((box) => box.severity === "empty")

  // With room on the track the wound fills a box; full tracks compound instead.
  const boxes =
    emptyIndex !== -1
      ? track.map((box, i) =>
          i === emptyIndex ? healthBox(damage, options?.resistant ?? false) : box,
        )
      : overflowed(track, damage)

  return [...boxes].sort(bySeverity)
}

export const healDamage = (track: HealthTrack, damageType: DamageType): HealthTrack => {
  // Clear the rightmost box of this damage type; identity when none is marked.
  // The dot belongs to the wound, so healing the wound clears it too.
  const lastIndex = lastIndexOfSeverity(track, damageType)
  if (lastIndex === -1) return track

  return track
    .map((box, i): HealthBox => (i === lastIndex ? healthBox("empty") : box))
    .sort(bySeverity)
}

/**
 * Undo containment damage (issue #43): clear up to `count` Resistant bashing
 * boxes, rightmost first — the void flow restoring exactly the wounds the
 * containment beat wrote. Non-resistant bashing and worsened wounds are left
 * alone; if fewer such boxes remain than asked, what exists is cleared.
 */
export const healResistantBashing = (
  track: HealthTrack,
  count: number,
): HealthTrack => {
  const next = [...track]
  let remaining = count
  for (let i = next.length - 1; i >= 0 && remaining > 0; i--) {
    const box = next[i]!
    if (box.severity === "bashing" && box.resistant) {
      next[i] = healthBox("empty")
      remaining--
    }
  }
  return next.sort(bySeverity)
}

export const isIncapacitated = (track: HealthTrack): boolean =>
  track.every((b) => b.severity !== "empty")

/**
 * Each box's place among the empty boxes, left to right (MAG-48): 0 for the
 * first empty box, 1 for the next; null for a filled one. Bashing fills the
 * leftmost empties first (applyDamage), so a bet of n boxes lands on the
 * empties whose ordinal is below n — the boxes a backlash bet ghosts.
 */
/**
 * The containment bet laid on the track (MAG-49): one Resistant bashing per
 * contained success (p. 126), leftmost empties first. `makeBy` normalizes
 * its count to >= 1, so an empty bet is guarded by hand — it once laid a
 * phantom box. The cast card's outlook and its header both read the track
 * through this one leaf.
 */
export const containOnTrack = (track: HealthTrack, contained: number): HealthTrack =>
  contained > 0
    ? Arr.reduce(Arr.makeBy(contained, (i) => i), track, (t) =>
        applyDamage(t, "bashing", { resistant: true }),
      )
    : track

export const emptyOrdinals = (track: HealthTrack): ReadonlyArray<number | null> =>
  Arr.mapAccum(track, 0, (n, box): [number, number | null] =>
    box.severity === "empty" ? [n + 1, n] : [n, null],
  )[1]

export const woundPenalty = (track: HealthTrack): number => {
  const filled = track.filter((b) => b.severity !== "empty").length
  const total = track.length

  // Wound penalties apply based on how many boxes from the RIGHT are filled
  // 3rd to last filled: -1, 2nd to last: -2, last: -3
  if (filled >= total) return -3
  if (filled >= total - 1) return -2
  if (filled >= total - 2) return -1
  return 0
}
