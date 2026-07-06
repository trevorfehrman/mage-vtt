import { Effect, Match, Option, Schema } from "effect"
import { DamageType, HealthBox } from "./damage"

// Pure rules leaves (ADR-0014): damage application, healing, and wound
// penalties are plain functions over the shared health-box vocabulary
// (`./damage`); only track creation keeps its typed error.

// --- Types ---

export class HealthTrack extends Schema.Class<HealthTrack>("HealthTrack")({
  boxes: Schema.Array(HealthBox),
}) {}

// --- Errors ---

export class HealthTrackError extends Schema.TaggedErrorClass<HealthTrackError>()(
  "HealthTrackError",
  { message: Schema.String },
) {}

// --- Damage severity for ordering ---

const SEVERITY: Record<HealthBox, number> = {
  empty: 0,
  bashing: 1,
  lethal: 2,
  aggravated: 3,
}

/** Aggravated leftmost, then lethal, then bashing, then empty. */
const bySeverity = (a: HealthBox, b: HealthBox): number => SEVERITY[b] - SEVERITY[a]

/** Worsen the rightmost `from` box to `to`; `none` when no such box exists. */
const upgraded = (
  boxes: ReadonlyArray<HealthBox>,
  from: HealthBox,
  to: HealthBox,
): Option.Option<ReadonlyArray<HealthBox>> => {
  const index = boxes.lastIndexOf(from)
  if (index === -1) return Option.none()
  const next = [...boxes]
  next[index] = to
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

  const boxes: Array<HealthBox> = Array.from({ length: size }, () => "empty" as const)

  return new HealthTrack({ boxes })
})

export const applyDamage = (track: HealthTrack, damage: DamageType): HealthTrack => {
  const emptyIndex = track.boxes.indexOf("empty")

  // With room on the track the wound fills a box; full tracks compound instead.
  const boxes: ReadonlyArray<HealthBox> =
    emptyIndex !== -1
      ? track.boxes.map((box, i) => (i === emptyIndex ? damage : box))
      : overflowed(track.boxes, damage)

  return new HealthTrack({ boxes: [...boxes].sort(bySeverity) })
}

export const healDamage = (track: HealthTrack, damageType: DamageType): HealthTrack => {
  // Clear the rightmost box of this damage type; identity when none is marked.
  const lastIndex = track.boxes.lastIndexOf(damageType)
  if (lastIndex === -1) return track

  const boxes: Array<HealthBox> = track.boxes.map((box, i) =>
    i === lastIndex ? "empty" : box,
  )
  return new HealthTrack({ boxes: boxes.sort(bySeverity) })
}

export const isIncapacitated = (track: HealthTrack): boolean =>
  track.boxes.every((b) => b !== "empty")

export const woundPenalty = (track: HealthTrack): number => {
  const filled = track.boxes.filter((b) => b !== "empty").length
  const total = track.boxes.length

  // Wound penalties apply based on how many boxes from the RIGHT are filled
  // 3rd to last filled: -1, 2nd to last: -2, last: -3
  if (filled >= total) return -3
  if (filled >= total - 1) return -2
  if (filled >= total - 2) return -1
  return 0
}
