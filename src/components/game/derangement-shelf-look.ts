import { Array as Arr, Match, Option, Order } from "effect"
import { isBedlamHold, type HeldDerangement } from "#/domain/derangements"

// The shelf's pure look rules (MAG-60), kept out of the component so they can
// be tested flat (ADR-0014/0019): the order the standing derangements hang
// in, and the clock's few words.

/**
 * The shelf's order: the permanent ones first, the most recently lost dot
 * (the highest rank) nearest the meter so the stems stay short and never
 * cross; the Bedlam ones after, in the order they were marked.
 */
export const shelfOrder = (standing: ReadonlyArray<HeldDerangement>): ReadonlyArray<HeldDerangement> => {
  const rankOf = (d: HeldDerangement) =>
    Match.value(d.hold).pipe(
      Match.tag("lostDot", (h) => h.rank),
      Match.tag("scene", "until", () => 0),
      Match.exhaustive,
    )
  const permanent = standing.filter((d) => !isBedlamHold(d.hold))
  const bedlam = standing.filter((d) => isBedlamHold(d.hold))
  return [...Arr.sortWith(permanent, (d) => -rankOf(d), Order.Number), ...bedlam]
}

/**
 * Time left in the fewest words: "40m" under an hour, "3h" under two days,
 * "5d" beyond — hours and days to the nearest, so a clock just stamped for
 * 24 hours says 24h, not 25h. None means the clock has run out (the shelf
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
