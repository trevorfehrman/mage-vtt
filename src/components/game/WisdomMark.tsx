import { Match } from "effect"
import type { ReactNode } from "react"
import { actsOfHubris, degenerationDicePool, wisdomBand, WisdomRank, type WisdomBand } from "#/domain/wisdom"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "#/components/ui/tooltip"

/**
 * Wisdom on the title card (MAG-56) — the second audition set. The owner's
 * brief (2026-10-26): no words; let form follow function. Wisdom is the
 * game's sanity — it rarely moves, and when it does it is a big deal — so
 * every look here is horizontal, its segments are big enough that one step
 * is visible across the table, and the step itself is animated: the thing
 * physically shifts (one shared `SHIFT` timing, slow and heavy) when the
 * Storyteller records the fall. What the component has to convey, in
 * order: where the mage stands on ten steps; which end is the Abyss and how
 * far off it is; and the step, when it comes. Color carries the zones the
 * book's effects define (`wisdomBand`): verdigris at the top, plain ink in
 * the middle, ember at 4–5 where Paradox starts to linger, the Paradox red
 * for 1–3. Read-only on every sheet; degeneration is the Storyteller's to
 * record through the hand-edit door. One look survives; the rest go with
 * the knob.
 */

export type WisdomLook = "track" | "meter" | "stairs" | "twin"

/** The one timing every look shifts with: slow enough to be felt. */
const SHIFT = "900ms cubic-bezier(0.2, 0.8, 0.2, 1)"

/** The band's ink and glow, one tone per band (Match.exhaustive). */
const toneOf = (band: WisdomBand): { color: string; glow: string | undefined } =>
  Match.value(band).pipe(
    Match.when("serene", () => ({
      color: "var(--accent)",
      glow: "0 0 14px color-mix(in srgb, var(--accent) 70%, transparent)",
    })),
    Match.when("clear", () => ({ color: "var(--accent)", glow: undefined })),
    Match.when("steady", () => ({ color: "var(--ink)", glow: undefined })),
    Match.when("faltering", () => ({ color: "var(--ember)", glow: undefined })),
    Match.when("blind", () => ({
      color: "var(--paradox)",
      glow: "0 0 10px color-mix(in srgb, var(--paradox) 45%, transparent)",
    })),
    Match.when("lost", () => ({
      color: "var(--paradox)",
      glow: "0 0 18px color-mix(in srgb, var(--paradox) 80%, transparent)",
    })),
    Match.exhaustive,
  )

/**
 * What a step is made of before anyone stands on it: the Abyss's three are
 * always the Paradox red, the two where Paradox starts to linger are a
 * faint ember, the rest are the card's line. The scale shows its own
 * danger whoever is where.
 */
const groundOf = (rank: WisdomRank): string =>
  Match.value(wisdomBand(rank)).pipe(
    Match.whenOr("blind", "lost", () => "color-mix(in srgb, var(--paradox) 50%, transparent)"),
    Match.when("faltering", () => "color-mix(in srgb, var(--ember) 35%, transparent)"),
    Match.whenOr("serene", "clear", "steady", () => "var(--line)"),
    Match.exhaustive,
  )

/** The one tooltip every look shares: the number, its dice, its sin. */
function WithWisdomTip({ wisdom, children }: { wisdom: WisdomRank; children: ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="mv-data flex items-center gap-x-3 leading-none"
            aria-label={`Wisdom ${wisdom}`}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          Wisdom {wisdom} · degeneration rolls {degenerationDicePool(wisdom)} dice · the mildest hubris:{" "}
          {actsOfHubris(wisdom)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function Label() {
  return (
    <span className="whitespace-nowrap" style={{ color: "var(--dim)", fontSize: 15 }}>
      WISDOM
    </span>
  )
}

/**
 * TRACK — the ladder laid flat, a row of its own. Ten rungs from 1 at the
 * left to 10 at the right; the three at the left are always red, the two
 * beside them faint ember, the rest the card's line. The mage is a solid
 * block standing on their rung, the band's color with the numeral cut into
 * it, and when Wisdom falls the block slides one rung toward the red.
 * Reads as "how far am I from the edge".
 */
export function WisdomTrack({ wisdom }: { wisdom: WisdomRank }) {
  const tone = toneOf(wisdomBand(wisdom))
  return (
    <WithWisdomTip wisdom={wisdom}>
      <Label />
      <span className="relative block flex-1" style={{ height: 18 }}>
        <span className="absolute inset-x-0 top-1/2 grid -translate-y-1/2 grid-cols-10">
          {WisdomRank.literals.map((rank) => (
            <span key={rank} className="block px-[1.5px]">
              <span className="block rounded-[1px]" style={{ height: 6, background: groundOf(rank) }} />
            </span>
          ))}
        </span>
        <span
          className="absolute inset-y-0 grid place-items-center rounded-[2px] text-[11px] font-bold"
          style={{
            left: `calc(${(wisdom - 1) * 10}% + 1.5px)`,
            width: "calc(10% - 3px)",
            background: tone.color,
            color: "var(--panel)",
            boxShadow: tone.glow,
            transition: `left ${SHIFT}, background-color ${SHIFT}, box-shadow ${SHIFT}`,
          }}
        >
          {wisdom}
        </span>
      </span>
    </WithWisdomTip>
  )
}

/**
 * METER — the sanity bar, a row of its own. Ten wide cells; the ones the
 * mage still holds are filled in the band's color, the lost ones are
 * hollow. At 10 the whole row glows verdigris; at 2 two red cells burn in a
 * row of empties. When Wisdom falls, the lost cell goes dark. Reads as
 * "how much is left".
 */
export function WisdomMeter({ wisdom }: { wisdom: WisdomRank }) {
  const tone = toneOf(wisdomBand(wisdom))
  return (
    <WithWisdomTip wisdom={wisdom}>
      <Label />
      <span className="grid flex-1 grid-cols-10 gap-[3px]" style={{ height: 14 }}>
        {WisdomRank.literals.map((rank) => {
          const held = rank <= wisdom
          return (
            <span
              key={rank}
              className="block rounded-[2px]"
              style={{
                background: held ? tone.color : "transparent",
                boxShadow: held ? tone.glow : "inset 0 0 0 1px var(--line)",
                transition: `background-color ${SHIFT}, box-shadow ${SHIFT}`,
              }}
            />
          )
        })}
      </span>
      <span className="font-semibold" style={{ color: tone.color, textShadow: tone.glow, fontSize: 15 }}>
        {wisdom}
      </span>
    </WithWisdomTip>
  )
}

/**
 * STAIRS — the descent made literal, a row of its own. Ten treads stepping
 * down from 10 at the left to 1 at the right; the last three treads are the
 * Paradox red. The mage stands on their tread as a lit bar with the numeral
 * over it, and when Wisdom falls they drop one step down and to the right.
 * Reads as "the fall", which is the book's word for it.
 */
export function WisdomStairs({ wisdom }: { wisdom: WisdomRank }) {
  const tone = toneOf(wisdomBand(wisdom))
  const TREAD = 30
  const RISE = 4
  const TOP = 12
  // the staircase as one path, 10's tread at the top left down to 1's at the bottom right
  const stepIndex = (rank: WisdomRank) => 10 - rank
  const treadY = (rank: WisdomRank) => TOP + stepIndex(rank) * RISE
  const treadX = (rank: WisdomRank) => stepIndex(rank) * TREAD
  const ranksTopDown = [...WisdomRank.literals].reverse()
  const run = (ranks: ReadonlyArray<WisdomRank>) =>
    ranks.map((rank) => `V ${treadY(rank)} H ${treadX(rank) + TREAD}`).join(" ")
  const stairPath = `M 0 ${TOP} ${run(ranksTopDown)}`
  // the Abyss's three treads, drawn again in red from the riser that drops onto them
  const abyssPath = `M ${treadX(3)} ${treadY(4)} ${run([3, 2, 1])}`
  return (
    <WithWisdomTip wisdom={wisdom}>
      <Label />
      <svg
        className="block flex-1"
        viewBox={`0 0 ${TREAD * 10} ${TOP + RISE * 10 + 2}`}
        height={TOP + RISE * 10 + 2}
        preserveAspectRatio="xMinYMid meet"
        aria-hidden
      >
        <path d={stairPath} fill="none" stroke="var(--line)" strokeWidth="1.5" />
        <path
          d={abyssPath}
          fill="none"
          stroke="color-mix(in srgb, var(--paradox) 55%, transparent)"
          strokeWidth="1.5"
        />
        {/* the mage on their tread: moves with a transform so the step animates */}
        <g
          style={{
            transform: `translate(${treadX(wisdom)}px, ${treadY(wisdom)}px)`,
            transition: `transform ${SHIFT}`,
          }}
        >
          <rect
            x={1}
            y={-3}
            width={TREAD - 2}
            height={3}
            rx={1}
            fill={tone.color}
            style={{
              filter: tone.glow ? `drop-shadow(${tone.glow})` : undefined,
              transition: `fill ${SHIFT}`,
            }}
          />
          <text
            x={TREAD / 2}
            y={-6}
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            fill={tone.color}
            style={{ transition: `fill ${SHIFT}` }}
          >
            {wisdom}
          </text>
        </g>
      </svg>
    </WithWisdomTip>
  )
}

/**
 * TWIN — the health track's own grammar, directly beneath it: ten boxes at
 * the health boxes' size and pitch, the held ones bordered and washed in
 * the band's color, the lost ones the empty box's line. Body above, soul
 * below, the same width to the pixel. No label; the pairing is the label,
 * the tooltip names it.
 */
export function WisdomTwin({ wisdom }: { wisdom: WisdomRank }) {
  const tone = toneOf(wisdomBand(wisdom))
  return (
    <WithWisdomTip wisdom={wisdom}>
      <span className="flex gap-1">
        {WisdomRank.literals.map((rank) => {
          const held = rank <= wisdom
          return (
            <span
              key={rank}
              className="block size-5 rounded-[2px] border"
              style={{
                borderColor: held ? tone.color : "var(--line)",
                background: held ? `color-mix(in srgb, ${tone.color} 22%, transparent)` : "transparent",
                boxShadow: held ? tone.glow : undefined,
                transition: `border-color ${SHIFT}, background-color ${SHIFT}, box-shadow ${SHIFT}`,
              }}
            />
          )
        })}
      </span>
    </WithWisdomTip>
  )
}
