import { Effect, Schema } from "effect"

// --- Types ---

export const HealthBoxValue = Schema.Literals(["empty", "bashing", "lethal", "aggravated"])
export type HealthBox = typeof HealthBoxValue.Type

const DamageType = Schema.Literals(["bashing", "lethal", "aggravated"])
export type DamageType = typeof DamageType.Type

export class HealthTrack extends Schema.Class<HealthTrack>("HealthTrack")({
  boxes: Schema.Array(HealthBoxValue),
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

// --- Public API ---

export const createHealthTrack = Effect.fn("HealthTrack.create")(function* (
  size: number,
) {
  if (size < 1 || size > 20 || !Number.isInteger(size)) {
    yield* new HealthTrackError({ message: `Invalid health track size: ${size}` })
  }

  const boxes: Array<HealthBox> = Array.from({ length: size }, () => "empty" as const)

  return new HealthTrack({ boxes })
})

export const applyDamage = Effect.fn("HealthTrack.applyDamage")(function* (
  track: HealthTrack,
  damage: DamageType,
) {
  const boxes = [...track.boxes] as Array<HealthBox>

  // Find the leftmost empty box
  const emptyIndex = boxes.indexOf("empty")

  if (emptyIndex !== -1) {
    // There's an empty slot — fill it, but maintain severity ordering
    // Damage goes in the leftmost position appropriate for its severity
    boxes[emptyIndex] = damage

    // Re-sort: aggravated leftmost, then lethal, then bashing, then empty
    boxes.sort((a, b) => SEVERITY[b] - SEVERITY[a])
  } else {
    // Track is full — upgrade the rightmost lowest-severity damage
    // Find rightmost bashing (for bashing/lethal overflow) or lethal (for aggravated overflow)
    if (damage === "bashing") {
      // Upgrade rightmost bashing to lethal
      const lastBashing = boxes.lastIndexOf("bashing")
      if (lastBashing !== -1) {
        boxes[lastBashing] = "lethal"
      }
      // If no bashing to upgrade, damage is lost (all lethal/aggravated)
    } else if (damage === "lethal") {
      // Upgrade rightmost bashing to lethal
      const lastBashing = boxes.lastIndexOf("bashing")
      if (lastBashing !== -1) {
        boxes[lastBashing] = "lethal"
      } else {
        // Upgrade rightmost lethal to aggravated
        const lastLethal = boxes.lastIndexOf("lethal")
        if (lastLethal !== -1) {
          boxes[lastLethal] = "aggravated"
        }
      }
    } else {
      // Aggravated — upgrade rightmost lethal to aggravated
      const lastLethal = boxes.lastIndexOf("lethal")
      if (lastLethal !== -1) {
        boxes[lastLethal] = "aggravated"
      } else {
        const lastBashing = boxes.lastIndexOf("bashing")
        if (lastBashing !== -1) {
          boxes[lastBashing] = "aggravated"
        }
      }
    }

    // Re-sort after upgrade
    boxes.sort((a, b) => SEVERITY[b] - SEVERITY[a])
  }

  return new HealthTrack({ boxes })
})

export const woundPenalty = Effect.fn("HealthTrack.woundPenalty")(function* (
  track: HealthTrack,
) {
  const filled = track.boxes.filter((b) => b !== "empty").length
  const total = track.boxes.length

  // Wound penalties apply based on how many boxes from the RIGHT are filled
  // 3rd to last filled: -1, 2nd to last: -2, last: -3
  if (filled >= total) return -3
  if (filled >= total - 1) return -2
  if (filled >= total - 2) return -1
  return 0
})
