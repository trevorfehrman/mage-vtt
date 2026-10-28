import { useEffect, useState } from "react"
import { Match, Option } from "effect"
import {
  DERANGEMENT_PAIRS,
  derangement,
  standingDerangements,
  weaknessWords,
  type DerangementCause,
  type DerangementName,
  type HeldDerangement,
} from "#/domain/derangements"
import type { SheetMark } from "#/domain/flows/hand-edit"
import { SceneId } from "#/domain/ids"
import type { WisdomRank } from "#/domain/wisdom"
import { ParadoxGlyph } from "./ParadoxGlyph"
import { clockWords, shelfOrder } from "./derangement-shelf-look"

/**
 * The derangement shelf (MAG-60) — what hangs under the Wisdom meter. Two
 * kinds, told apart by what they hang from (owner, 2026-10-28: "the
 * challenge here is to communicate two types, and to associate one type
 * with the specific pip of the wisdom track that's missing"):
 *
 * - A **permanent** one hangs from the hollow cell it cost: a thin stem
 *   drops from that cell's center to the name, which starts at the stem for
 *   the left half of the meter and ends at it for the right half, so the
 *   name sits where the lost dot is. It stands while the dot is lost and is
 *   simply not there once the dot is bought back.
 * - A **Bedlam** one hangs from the Paradox's clock, not a cell: it wears
 *   the Paradox glyph, its weakness in a few words, and the clock — "scene"
 *   while bound to the open Scene, or the time left.
 *
 * Nothing renders when nothing stands. With `onMark` the shelf is the
 * player's door too (the MAG-63 paper gesture): a + at the foot opens the
 * nine pairs, mild beside severe, under two chips for the cause — the lost
 * dot or Bedlam — and a tap on a name marks it; a tap on a hanging name
 * puts it down. The chip is ember while chosen (armed, reversible).
 */

const LINE = 14
const GAP = 3
/** The Eyebrowed shell's gap between the meter and what follows it. */
const TO_METER = 6
const BAR = 9
/** The meter's cell height, and about its width at the card's width (WisdomMeter). */
const CELL = 12
const CELL_WIDTH = 30

export function DerangementShelf({
  held,
  wisdom,
  activeSceneId,
  onMark,
}: {
  held: ReadonlyArray<HeldDerangement>
  wisdom: WisdomRank
  /** The Scene open now, for the scene-bound ones; absent in downtime. */
  activeSceneId?: string | undefined
  onMark?: ((mark: SheetMark) => void) | undefined
}) {
  // The clock, for the timed ones: read on render and kept roughly current.
  const [at, setAt] = useState(() => Date.now())
  useEffect(() => {
    const tick = setInterval(() => setAt(Date.now()), 60_000)
    return () => clearInterval(tick)
  }, [])
  const [open, setOpen] = useState(false)

  const sceneId = Option.map(Option.fromUndefinedOr(activeSceneId), SceneId.make)
  const standing = shelfOrder(standingDerangements(held, { wisdom, sceneId, at }))
  if (standing.length === 0 && onMark === undefined) return null

  return (
    <div className="mv-data grid" style={{ gap: GAP }}>
      {standing.map((d, i) => (
        <HangingLine
          key={d.name}
          held={d}
          index={i}
          at={at}
          onShed={onMark ? () => onMark({ shedDerangement: d.name }) : undefined}
        />
      ))}
      {onMark && (
        <div className="grid justify-end" style={{ marginTop: standing.length === 0 ? 0 : 2 }}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Close derangements" : "Mark a derangement"}
            className="mv-key grid place-items-center rounded-[2px] text-[9px] leading-none transition-colors"
            style={{
              height: BAR,
              width: CELL_WIDTH,
              color: open ? "var(--ember)" : "var(--dim)",
              boxShadow: `inset 0 0 0 1px ${open ? "var(--ember)" : "var(--line)"}`,
            }}
          >
            {open ? "−" : "+"}
          </button>
        </div>
      )}
      {onMark && open && (
        <Picker
          wisdom={wisdom}
          sceneOpen={activeSceneId !== undefined}
          held={standing}
          onPick={(name, cause) => {
            onMark({ derangement: { name, cause } })
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

/** One hanging derangement: from its cell, or from the Paradox's clock. */
function HangingLine({
  held,
  index,
  at,
  onShed,
}: {
  held: HeldDerangement
  index: number
  at: number
  onShed?: (() => void) | undefined
}) {
  const def = derangement(held.name)
  const name = onShed ? (
    <button
      type="button"
      onClick={onShed}
      aria-label={`Put down ${held.name}`}
      className="mv-key cursor-pointer leading-none"
      style={{ color: "var(--ink)" }}
    >
      {held.name}
    </button>
  ) : (
    <span style={{ color: "var(--ink)" }}>{held.name}</span>
  )
  return Match.value(held.hold).pipe(
    Match.tag("lostDot", ({ rank }) => {
      // the stem is pinned through the hollow cell's center and drops past
      // every line above this one to run alongside the name, which hangs off
      // it by its near edge
      const center = `${((rank - 0.5) / 10) * 100}%`
      const pin = TO_METER + CELL / 2
      const stem = pin + index * (LINE + GAP) + LINE * 0.85
      const leftHalf = rank <= 5
      return (
        <div className="relative text-[11px]" style={{ height: LINE }}>
          <span
            aria-hidden
            className="absolute"
            style={{
              left: center,
              top: -pin,
              width: 1,
              height: stem,
              background: "var(--dim)",
              opacity: 0.55,
            }}
          />
          <span
            className="absolute flex items-center whitespace-nowrap"
            style={{
              height: LINE,
              ...(leftHalf ? { left: center, paddingLeft: 4 } : { right: `${((10 - rank) / 10) * 100 + 5}%`, paddingRight: 4 }),
            }}
            aria-label={`${held.name}, from Wisdom dot ${rank}`}
          >
            {name}
          </span>
        </div>
      )
    }),
    Match.tag("scene", "until", (hold) => {
      const clock = Match.value(hold).pipe(
        Match.tag("scene", () => Option.some("scene")),
        Match.tag("until", (h) => clockWords(h.expiresAt, at)),
        Match.exhaustive,
      )
      const weakness = weaknessWords(def.bedlam)
      return (
        <div
          className="flex items-center gap-2 whitespace-nowrap text-[11px] leading-none"
          style={{ height: LINE }}
        >
          <ParadoxGlyph size={11} title="Bedlam" />
          {name}
          <span style={{ color: "var(--dim)" }}>
            {[...(weakness === "" ? [] : [weakness]), ...Option.toArray(clock)].join(" · ")}
          </span>
        </div>
      )
    }),
    Match.exhaustive,
  )
}

/** The door: the cause, then the name. */
function Picker({
  wisdom,
  sceneOpen,
  held,
  onPick,
}: {
  wisdom: WisdomRank
  sceneOpen: boolean
  held: ReadonlyArray<HeldDerangement>
  onPick: (name: DerangementName, cause: DerangementCause) => void
}) {
  const dotLost = wisdom < 10
  // at Wisdom 5+ a Bedlam needs a Scene to bind to; below, it has a clock
  const bedlamPossible = sceneOpen || wisdom <= 4
  const [cause, setCause] = useState<DerangementCause>(dotLost ? "lostDot" : "bedlam")
  const chip = (c: DerangementCause, enabled: boolean, children: React.ReactNode) => {
    const chosen = cause === c
    return (
      <button
        type="button"
        disabled={!enabled}
        onClick={() => setCause(c)}
        aria-pressed={chosen}
        className="mv-key flex items-center gap-1.5 rounded-[2px] px-2 text-[10px] leading-none transition-colors disabled:opacity-25"
        style={{
          height: 18,
          color: chosen ? "var(--ember)" : "var(--dim)",
          boxShadow: `inset 0 0 0 1px ${chosen ? "var(--ember)" : "var(--line)"}`,
        }}
      >
        {children}
      </button>
    )
  }
  const taken = new Set(held.map((d) => d.name))
  return (
    <div className="grid gap-2 pt-1">
      <div className="flex items-center gap-2">
        {chip(
          "lostDot",
          dotLost,
          <>
            <span aria-hidden style={{ width: 1, height: 10, background: "currentColor", opacity: 0.7 }} />
            <span>dot {wisdom + 1}</span>
          </>,
        )}
        {chip(
          "bedlam",
          bedlamPossible,
          <>
            <ParadoxGlyph size={10} ink="currentColor" title="" />
            <span>Bedlam</span>
          </>,
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4" style={{ rowGap: 2 }}>
        {DERANGEMENT_PAIRS.map(([mild, severe]) => (
          <PairRow key={mild} mild={mild} severe={severe} taken={taken} onPick={(name) => onPick(name, cause)} />
        ))}
      </div>
    </div>
  )
}

function PairRow({
  mild,
  severe,
  taken,
  onPick,
}: {
  mild: DerangementName
  severe: DerangementName
  taken: ReadonlySet<DerangementName>
  onPick: (name: DerangementName) => void
}) {
  const cell = (name: DerangementName) => (
    <button
      type="button"
      disabled={taken.has(name)}
      onClick={() => onPick(name)}
      className="mv-key truncate text-left text-[11px] leading-none transition-colors disabled:opacity-30"
      style={{ height: 16, color: "var(--ink)" }}
    >
      {name}
    </button>
  )
  return (
    <>
      {cell(mild)}
      {cell(severe)}
    </>
  )
}
