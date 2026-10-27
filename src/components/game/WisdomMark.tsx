import { degenerationDicePool, WisdomRank } from "#/domain/wisdom"

/**
 * Wisdom on the title card (MAG-56): the meter. The owner's brief
 * (2026-10-26/27): no words, no numeral; Wisdom is the game's sanity, it
 * rarely moves, and when it does the step should be felt across the
 * table. Ten wide cells beneath the health track, Will and Mana, at that
 * row's width: the held ones filled, the lost ones hollow, and the fill's
 * color is the rank's own — bright verdigris at 10, the card's standard
 * verdigris at a new mage's 7, ember through the middle where Paradox
 * starts to linger, the Paradox red from 3 down. On a step the lost cell
 * goes dark over `SHIFT`, slow enough to be seen. The hover title says the
 * two things the cells do not: the number itself and the degeneration dice
 * it rolls (owner, 2026-10-27: the minimum that is useful). Read-only on
 * every sheet; degeneration is the Storyteller's to record through the
 * hand-edit door.
 */

/** The one timing the step shifts with: slow enough to be felt. */
const SHIFT = "900ms cubic-bezier(0.2, 0.8, 0.2, 1)"

/**
 * The fill's color at each rank. A ramp, not bands: 7 is the card's own
 * verdigris (a new mage is simply a mage), the three above it brighten
 * toward white, the two below warm toward ember, 4 is ember turning, and
 * from 3 down it is the Paradox red — the one color at the table allowed
 * to yell, because at these ranks reality is yelling.
 */
const FILL_BY_RANK: Record<WisdomRank, string> = {
  10: "color-mix(in srgb, var(--accent) 65%, white)",
  9: "color-mix(in srgb, var(--accent) 80%, white)",
  8: "color-mix(in srgb, var(--accent) 92%, white)",
  7: "var(--accent)",
  6: "color-mix(in srgb, var(--accent) 60%, var(--ember))",
  5: "var(--ember)",
  4: "color-mix(in srgb, var(--ember) 45%, var(--paradox))",
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

export function WisdomMeter({ wisdom }: { wisdom: WisdomRank }) {
  const fill = FILL_BY_RANK[wisdom]
  const glow = GLOW_BY_RANK[wisdom]
  return (
    <span
      className="grid w-full grid-cols-10 gap-[3px]"
      style={{ height: 12 }}
      title={`Wisdom ${wisdom} · degeneration ${degenerationDicePool(wisdom)} dice`}
      aria-label={`Wisdom ${wisdom}`}
    >
      {WisdomRank.literals.map((rank) => {
        const held = rank <= wisdom
        return (
          <span
            key={rank}
            className="block rounded-[2px]"
            style={{
              background: held ? fill : "transparent",
              boxShadow: held ? glow : "inset 0 0 0 1px var(--line)",
              transition: `background-color ${SHIFT}, box-shadow ${SHIFT}`,
            }}
          />
        )
      })}
    </span>
  )
}
