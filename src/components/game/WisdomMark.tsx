import { Match } from "effect"
import type { ReactNode } from "react"
import {
  actsOfHubris,
  degenerationDicePool,
  wisdomBand,
  wisdomBandWords,
  WisdomRank,
  type WisdomBand,
} from "#/domain/wisdom"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "#/components/ui/tooltip"

/**
 * Wisdom on the title card (MAG-56) — the audition set. The owner's brief
 * (2026-10-26): nothing else on the card uses dots, the "5/7" numerals are
 * not dramatic enough for the trait that decides how long reality punishes
 * a mage, and the number must *feel* like what it is — 10 is amazing, 7 is
 * fine, 5 is sketchy, 2 is really bad. Every look here is driven by the
 * band (`wisdomBand`) and speaks the drama through the card's existing
 * color grammar: verdigris is grace, ink is ordinary, ember is a warning,
 * the Paradox red burn is reality turning on the mage. Read-only on every
 * sheet; degeneration is the Storyteller's to record through the hand-edit
 * door. One look survives the audition; the rest are deleted with the knob.
 */

export type WisdomLook = "rail" | "heat" | "word" | "scales" | "ladder"

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

/** The one tooltip every look shares: the number, its dice, its sin. */
function WithWisdomTip({
  wisdom,
  align,
  children,
}: {
  wisdom: WisdomRank
  align: "start" | "end"
  children: ReactNode
}) {
  const band = wisdomBand(wisdom)
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className={`mv-data flex items-center gap-x-3 leading-none ${align === "end" ? "justify-end" : ""}`}
            aria-label={`Wisdom ${wisdom}, ${wisdomBandWords(band)}`}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          Wisdom {wisdom} · {wisdomBandWords(band)} · degeneration rolls {degenerationDicePool(wisdom)} dice · the mildest
          hubris: {actsOfHubris(wisdom)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** The first audition (kept for comparison): ten pips, the numeral, the sin. */
export function WisdomRail({ wisdom }: { wisdom: WisdomRank }) {
  return (
    <WithWisdomTip wisdom={wisdom} align="start">
      <span className="whitespace-nowrap" style={{ color: "var(--dim)", fontSize: 15 }}>
        WISDOM
      </span>
      <span className="flex items-center gap-[3px]">
        {WisdomRank.literals.map((rank) => (
          <span
            key={rank}
            className="inline-block size-[7px] rounded-full"
            style={{
              background: rank <= wisdom ? "var(--ink)" : "transparent",
              boxShadow: rank <= wisdom ? undefined : "inset 0 0 0 1px var(--line)",
            }}
          />
        ))}
      </span>
      <span className="font-semibold" style={{ color: "var(--ink)", fontSize: 15 }}>
        {wisdom}
      </span>
      <span className="min-w-0 text-[12px] leading-tight" style={{ color: "var(--dim)" }}>
        hubris: {actsOfHubris(wisdom)}
      </span>
    </WithWisdomTip>
  )
}

/**
 * HEAT — Wisdom in Gnosis's own grammar, beneath it: the label and a 32px
 * numeral, but the numeral's ink and glow are the band's. A 10 shines
 * verdigris like the Gnosis beside it; a 7 sits in plain ink; a 5 goes
 * ember; a 2 burns the Paradox red the resolved card uses for a Bedlam.
 * The band word sits beneath in the eyebrow voice. The two numbers that
 * define a mage, stacked.
 */
export function WisdomHeat({ wisdom }: { wisdom: WisdomRank }) {
  const band = wisdomBand(wisdom)
  const tone = toneOf(band)
  return (
    <WithWisdomTip wisdom={wisdom} align="end">
      <span className="grid justify-items-end gap-1">
        <span className="flex items-baseline gap-2 leading-none">
          <span style={{ color: "var(--dim)", fontSize: 15 }}>WISDOM</span>
          <span
            className="text-[32px] font-semibold"
            style={{ color: tone.color, textShadow: tone.glow }}
          >
            {wisdom}
          </span>
        </span>
        <span className="mv-eyebrow" style={{ color: tone.color }}>
          {wisdomBandWords(band)}
        </span>
      </span>
    </WithWisdomTip>
  )
}

/**
 * WORD — the band word is the thing, set in the heading face like the
 * mage's name, in the band's ink; the numeral is a small dim aside. A
 * player reads "BLIND" before they read "2". The hubris line follows so
 * the word has its reason.
 */
export function WisdomWord({ wisdom }: { wisdom: WisdomRank }) {
  const band = wisdomBand(wisdom)
  const tone = toneOf(band)
  return (
    <WithWisdomTip wisdom={wisdom} align="start">
      <span className="whitespace-nowrap" style={{ color: "var(--dim)", fontSize: 15 }}>
        WISDOM
      </span>
      <span
        className="mv-h uppercase leading-none tracking-[0.1em] whitespace-nowrap"
        style={{ color: tone.color, textShadow: tone.glow, fontSize: 22 }}
      >
        {wisdomBandWords(band)}
      </span>
      <span style={{ color: "var(--dim)", fontSize: 15 }}>{wisdom}</span>
      {/* the sin may run long at the middle ranks: it wraps, the word never does */}
      <span className="min-w-0 text-[12px] leading-tight" style={{ color: "var(--dim)" }}>
        hubris: {actsOfHubris(wisdom)}
      </span>
    </WithWisdomTip>
  )
}

/**
 * SCALES — the book's own image: "the scales of merit — the principle of
 * cosmic Judgment as depicted in the Tarot" (p. 80). A balance whose beam
 * is level at 10 and tips three degrees per dot lost, the low pan sinking
 * toward the Abyss; the beam and pans take the band's ink, so a 2 is a
 * hard-tilted red balance. The numeral and band word stand beside it.
 */
export function WisdomScales({ wisdom }: { wisdom: WisdomRank }) {
  const band = wisdomBand(wisdom)
  const tone = toneOf(band)
  const tilt = (10 - wisdom) * 3
  return (
    <WithWisdomTip wisdom={wisdom} align="start">
      <span style={{ color: "var(--dim)", fontSize: 15 }}>WISDOM</span>
      <svg
        width="56"
        height="34"
        viewBox="0 0 56 34"
        aria-hidden
        style={{ color: tone.color, filter: tone.glow ? `drop-shadow(${tone.glow})` : undefined }}
      >
        {/* the post and its foot */}
        <line x1="28" y1="6" x2="28" y2="31" stroke="var(--dim)" strokeWidth="1.5" />
        <line x1="20" y1="31" x2="36" y2="31" stroke="var(--dim)" strokeWidth="1.5" />
        {/* the beam, turning on the post's pivot; the heavy side sinks right */}
        <g transform={`rotate(${tilt} 28 8)`}>
          <line x1="6" y1="8" x2="50" y2="8" stroke="currentColor" strokeWidth="1.75" />
          <circle cx="28" cy="8" r="2" fill="currentColor" />
          {/* the pans: chains and shallow bowls */}
          <line x1="6" y1="8" x2="6" y2="18" stroke="currentColor" strokeWidth="1" />
          <path d="M 1 18 Q 6 24 11 18" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="50" y1="8" x2="50" y2="18" stroke="currentColor" strokeWidth="1" />
          <path d="M 45 18 Q 50 24 55 18" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </g>
      </svg>
      <span className="font-semibold" style={{ color: tone.color, textShadow: tone.glow, fontSize: 22 }}>
        {wisdom}
      </span>
      <span className="mv-eyebrow" style={{ color: tone.color }}>
        {wisdomBandWords(band)}
      </span>
    </WithWisdomTip>
  )
}

/**
 * LADDER — the Celestial Ladder, the descent into Endless Night (p. 79:
 * "those who betray themselves … fall deeper into Endless Night, the maw of
 * the Abyss"). Ten rungs, 10 at the top; the mage's rung is marked in the
 * band's ink, the rungs above are the line's faint rings, and the lowest
 * three are always drawn in the Paradox red — the Abyss is down there
 * whether or not the mage is near it. Stands beside Gnosis, column-tall.
 */
export function WisdomLadder({ wisdom }: { wisdom: WisdomRank }) {
  const band = wisdomBand(wisdom)
  const tone = toneOf(band)
  const rungs = [...WisdomRank.literals].reverse()
  return (
    <WithWisdomTip wisdom={wisdom} align="end">
      <span className="grid justify-items-end gap-1">
        <span style={{ color: "var(--dim)", fontSize: 15 }}>WISDOM</span>
        <span className="flex items-center gap-2">
          <span className="font-semibold" style={{ color: tone.color, textShadow: tone.glow, fontSize: 22 }}>
            {wisdom}
          </span>
          <span className="grid gap-[2px]">
            {rungs.map((rank) => {
              const here = rank === wisdom
              const abyss = rank <= 3
              return (
                <span
                  key={rank}
                  className="block rounded-[1px]"
                  style={{
                    width: here ? 22 : 16,
                    height: here ? 3 : 2,
                    justifySelf: "end",
                    background: here
                      ? tone.color
                      : abyss
                        ? "color-mix(in srgb, var(--paradox) 55%, transparent)"
                        : "var(--line)",
                    boxShadow: here ? tone.glow : undefined,
                  }}
                />
              )
            })}
          </span>
        </span>
        <span className="mv-eyebrow" style={{ color: tone.color }}>
          {wisdomBandWords(band)}
        </span>
      </span>
    </WithWisdomTip>
  )
}
