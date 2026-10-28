import { WisdomRank } from "#/domain/wisdom"
import { DerangementGlyph } from "./DerangementGlyph"

/**
 * Wisdom on the title card (MAG-56): the meter. The owner's brief
 * (2026-10-26/27): no words, no numeral; Wisdom is the game's sanity, it
 * rarely moves, and when it does the step should be felt across the
 * table. Ten wide cells beneath the health track, Will and Mana, at that
 * row's width: the held ones filled, the lost ones hollow, and the fill's
 * color is the rank's own — bright verdigris at 10, the card's standard
 * verdigris at a new mage's 7, ember through the middle where Paradox
 * starts to linger, the Paradox red from 3 down. On a step the lost cell
 * goes dark over `SHIFT`, slow enough to be seen. No tooltip: the owner's
 * call (2026-10-27) is that the cells say it and a hover adds nothing — a
 * standing exception to ADR-0021's every-numeral-names-itself rule, since
 * there is no numeral; the group's accessible name carries the number.
 */

/** The one timing the step shifts with: slow enough to be felt. */
const SHIFT = "900ms cubic-bezier(0.2, 0.8, 0.2, 1)"

/**
 * The fill's color at each rank. A ramp, not bands: 7 is the card's own
 * verdigris (a new mage is simply a mage), the three above it brighten
 * toward white, 6 is the verdigris dimmed toward the card's line (grace
 * fading, not yet danger), 5 and 4 walk toward the Paradox red through an
 * amber and a red-orange, and from 3 down the red is the fill outright —
 * the one color at the table allowed to yell, because at these ranks
 * reality is yelling. The walk is mixed in oklch so the warm middle comes
 * from the ramp itself; ember, the card's armed-and-reversible color, is
 * not spent here (component-standards §1).
 */
const FILL_BY_RANK: Record<WisdomRank, string> = {
  10: "color-mix(in srgb, var(--accent) 65%, white)",
  9: "color-mix(in srgb, var(--accent) 80%, white)",
  8: "color-mix(in srgb, var(--accent) 92%, white)",
  7: "var(--accent)",
  6: "color-mix(in oklch, var(--accent) 70%, var(--line))",
  5: "color-mix(in oklch, var(--accent) 35%, var(--paradox))",
  4: "color-mix(in oklch, var(--accent) 15%, var(--paradox))",
  3: "var(--paradox)",
  2: "var(--paradox)",
  1: "var(--paradox)",
}

/** The glow, only at the ends: grace at the top, the burn at the bottom. */
const GLOW_BY_RANK: Partial<Record<WisdomRank, string>> = {
  10: "0 0 12px color-mix(in srgb, var(--accent) 70%, transparent)",
  2: "0 0 10px color-mix(in srgb, var(--paradox) 50%, transparent)",
  1: "0 0 16px color-mix(in srgb, var(--paradox) 80%, transparent)",
}

/**
 * `onSet` (MAG-63; owner's call 2026-10-27: players mark their own Wisdom):
 * when present each cell is a button that sets the rank to its own number —
 * the paper gesture of filling or erasing a dot. Absent, the meter is the
 * read-only record it was.
 */
/**
 * `lit` (MAG-60; owner 2026-10-28: "when you hover over the permanent one
 * it can light up a decorated empty wisdom pip"): the lost cell a
 * derangement badge is pointing at — outlined in ink with a glow and the
 * derangement's mark drawn inside, for as long as the hover lasts.
 */
export function WisdomMeter({
  wisdom,
  onSet,
  lit,
}: {
  wisdom: WisdomRank
  onSet?: ((rank: WisdomRank) => void) | undefined
  lit?: WisdomRank | undefined
}) {
  const fill = FILL_BY_RANK[wisdom]
  const glow = GLOW_BY_RANK[wisdom]
  const cellStyle = (held: boolean, isLit: boolean) => ({
    background: held ? fill : isLit ? "color-mix(in srgb, var(--ink) 14%, transparent)" : "transparent",
    boxShadow: held
      ? glow
      : isLit
        ? "inset 0 0 0 1px var(--ink), 0 0 10px color-mix(in srgb, var(--ink) 45%, transparent)"
        : "inset 0 0 0 1px var(--line)",
    transition: `background-color ${SHIFT}, box-shadow ${isLit ? "160ms" : SHIFT}`,
  })
  const decoration = (rank: WisdomRank) =>
    rank === lit && rank > wisdom ? (
      <span className="grid h-full place-items-center" style={{ color: "var(--ink)" }}>
        <DerangementGlyph size={10} />
      </span>
    ) : null
  return (
    <span
      className="grid w-full grid-cols-10 gap-[3px]"
      style={{ height: 12 }}
      role="group"
      aria-label={`Wisdom ${wisdom}`}
    >
      {WisdomRank.literals.map((rank) =>
        onSet ? (
          <button
            key={rank}
            type="button"
            onClick={() => onSet(rank)}
            aria-label={`Set Wisdom ${rank}`}
            aria-pressed={rank === wisdom}
            className="block cursor-pointer rounded-[2px]"
            style={cellStyle(rank <= wisdom, rank === lit)}
          >
            {decoration(rank)}
          </button>
        ) : (
          <span key={rank} className="block rounded-[2px]" style={cellStyle(rank <= wisdom, rank === lit)}>
            {decoration(rank)}
          </span>
        ),
      )}
    </span>
  )
}
