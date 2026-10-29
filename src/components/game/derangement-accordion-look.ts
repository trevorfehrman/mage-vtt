import { Option } from "effect"
import { isBedlamHold, type HeldDerangement } from "#/domain/derangements"

// The accordion's pure look rules (MAG-60), kept out of the component so they can
// be tested flat (ADR-0014/0019): the order the standing derangements stand
// in, and the clock's few words.

/** The accordion's order: the lasting ones first, then the Bedlam ones, each in the order they were marked. */
export const chipOrder = (standing: ReadonlyArray<HeldDerangement>): ReadonlyArray<HeldDerangement> => [
  ...standing.filter((d) => !isBedlamHold(d.hold)),
  ...standing.filter((d) => isBedlamHold(d.hold)),
]

/**
 * Time left in the fewest words: "40m" under an hour, "3h" under two days,
 * "5d" beyond — hours and days to the nearest, so a clock just stamped for
 * 24 hours says 24h, not 25h. None means the clock has run out (the accordion
 * won't show it).
 */
export const clockWords = (expiresAt: number, at: number): Option.Option<string> => {
  const left = expiresAt - at
  if (left <= 0) return Option.none()
  const minutes = Math.ceil(left / 60_000)
  if (minutes < 60) return Option.some(`${minutes}m`)
  const hours = Math.round(left / 3_600_000)
  if (hours < 48) return Option.some(`${hours}h`)
  return Option.some(`${Math.round(left / 86_400_000)}d`)
}
