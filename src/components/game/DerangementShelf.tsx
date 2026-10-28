import { useEffect, useState, type ReactNode } from "react"
import { Match, Option } from "effect"
import {
  DERANGEMENT_PAIRS,
  derangement,
  hangingFromDot,
  standingDerangements,
  weaknessWords,
  type DerangementName,
  type HeldDerangement,
} from "#/domain/derangements"
import type { SheetMark } from "#/domain/flows/hand-edit"
import type { SceneId } from "#/domain/ids"
import { WisdomRank } from "#/domain/wisdom"
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "#/components/ui/tooltip"
import { DerangementGlyph } from "./DerangementGlyph"
import { ParadoxGlyph } from "./ParadoxGlyph"
import { clockWords, shelfOrder } from "./derangement-shelf-look"

/**
 * The derangement shelf (MAG-60), the owner's foundation (2026-10-28):
 * "badges that live under the wisdom track. when you hover over the
 * permanent one it can light up a decorated empty wisdom pip, and the other
 * kind can list their duration. beneath each empty pip there should be a
 * ghost button where some kind of derangement symbol will go. when the user
 * clicks that we need a popup ui that allows them to select which
 * derangement goes there. hovering over a derangement says what it does,
 * and they need x's on them so they can be dismissed."
 *
 * Two rows beneath the meter. The **slot row** shares the meter's ten
 * columns: beneath each lost cell a ghost slot (the mark in outline), which
 * opens the popup — the nine pairs, mild beside severe — and the chosen
 * name hangs on that dot; a slot already carrying one shows the mark solid.
 * The **badge row** lists what stands: the mark or the Paradox glyph, the
 * name, a Bedlam one's weakness and clock, and an × that puts it down. A
 * permanent badge's hover lights its cell above (and the slot beneath it);
 * any badge's hover says what the derangement does. A Bedlam one has no
 * cell, so its door is the last ghost in the badge row, wearing the Paradox
 * glyph — it binds to the open Scene at Wisdom 5+ (the ghost says "no scene
 * open" when there is none) or to the Wisdom table's clock below.
 */

const CELL = 12
const GAP = 3

export function DerangementShelf({
  held,
  wisdom,
  activeSceneId,
  onMark,
  onPoint,
}: {
  held: ReadonlyArray<HeldDerangement>
  wisdom: WisdomRank
  /** The Scene open now, for the scene-bound ones; absent in downtime. */
  activeSceneId?: SceneId | undefined
  onMark?: ((mark: SheetMark) => void) | undefined
  /** The lost cell under the pointer, for the meter to light; undefined when none. */
  onPoint?: ((rank: WisdomRank | undefined) => void) | undefined
}) {
  // The clock, for the timed ones: read on render and kept roughly current.
  const [at, setAt] = useState(() => Date.now())
  useEffect(() => {
    const tick = setInterval(() => setAt(Date.now()), 60_000)
    return () => clearInterval(tick)
  }, [])

  const sceneId = Option.fromUndefinedOr(activeSceneId)
  const standing = shelfOrder(standingDerangements(held, { wisdom, sceneId, at }))
  const point = (rank: WisdomRank | undefined) => onPoint?.(rank)
  if (standing.length === 0 && onMark === undefined) return null

  // at Wisdom 5+ a Bedlam needs a Scene to bind to; below, it has a clock
  const bedlamGate = activeSceneId !== undefined || wisdom <= 4 ? null : "no scene open"

  return (
    <TooltipProvider>
      <div className="mv-data grid" style={{ gap: GAP + 2 }}>
        {/* the slot row: the meter's own ten columns */}
        <div className="grid grid-cols-10" style={{ gap: GAP, height: CELL }}>
          {WisdomRank.literals.map((rank) => {
            if (rank <= wisdom) return <span key={rank} />
            const carried = hangingFromDot(standing, rank)
            return Option.match(carried, {
              onSome: (d) => (
                <span
                  key={rank}
                  className="grid place-items-center"
                  style={{ color: "var(--ink)" }}
                  onMouseEnter={() => point(rank)}
                  onMouseLeave={() => point(undefined)}
                >
                  <DerangementGlyph size={10} title={`${d.name}, on Wisdom dot ${rank}`} />
                </span>
              ),
              onNone: () =>
                onMark ? (
                  <Picker
                    key={rank}
                    heading={`Dot ${rank}`}
                    taken={standing}
                    onPick={(name) => onMark({ derangement: { name, dot: rank } })}
                    onOpenChange={(open) => point(open ? rank : undefined)}
                  >
                    <button
                      type="button"
                      aria-label={`Hang a derangement on Wisdom dot ${rank}`}
                      className="mv-key grid h-full w-full place-items-center rounded-[2px] transition-colors"
                      style={{ color: "var(--dim)", boxShadow: "inset 0 0 0 1px var(--line)", opacity: 0.6 }}
                      onMouseEnter={() => point(rank)}
                      onMouseLeave={() => point(undefined)}
                    >
                      <DerangementGlyph size={10} />
                    </button>
                  </Picker>
                ) : (
                  <span key={rank} />
                ),
            })
          })}
        </div>
        {/* the badge row */}
        {(standing.length > 0 || onMark) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {standing.map((d) => (
              <Badge
                key={d.name}
                held={d}
                at={at}
                onShed={onMark ? () => onMark({ shedDerangement: d.name }) : undefined}
                onPoint={point}
              />
            ))}
            {onMark && (
              <Picker
                heading="Bedlam"
                taken={standing}
                gate={bedlamGate}
                onPick={(name) => onMark({ derangement: { name } })}
              >
                <button
                  type="button"
                  aria-label="Mark a Bedlam derangement"
                  aria-disabled={bedlamGate !== null}
                  className={`mv-key flex items-center gap-1.5 rounded-[2px] px-1.5 text-[10px] leading-none transition-colors ${bedlamGate === null ? "" : "mv-refuse"}`}
                  style={{ height: 18, color: "var(--dim)", boxShadow: "inset 0 0 0 1px var(--line)", opacity: 0.7 }}
                >
                  <ParadoxGlyph size={10} ink="currentColor" title="" />
                  {bedlamGate !== null && <span>{bedlamGate}</span>}
                </button>
              </Picker>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

/** One standing derangement: its mark, its name, its clock, its ×. */
function Badge({
  held,
  at,
  onShed,
  onPoint,
}: {
  held: HeldDerangement
  at: number
  onShed?: (() => void) | undefined
  onPoint: (rank: WisdomRank | undefined) => void
}) {
  const def = derangement(held.name)
  const dot = Match.value(held.hold).pipe(
    Match.tag("lostDot", (h) => Option.some(h.rank)),
    Match.tag("scene", "until", () => Option.none()),
    Match.exhaustive,
  )
  const clock = Match.value(held.hold).pipe(
    Match.tag("lostDot", () => Option.none()),
    Match.tag("scene", () => Option.some("scene")),
    Match.tag("until", (h) => clockWords(h.expiresAt, at)),
    Match.exhaustive,
  )
  const weakness = Option.isSome(dot) ? "" : weaknessWords(def.bedlam)
  const tail = [...(weakness === "" ? [] : [weakness]), ...Option.toArray(clock)].join(" · ")
  const rank = Option.getOrUndefined(dot)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-[2px] pl-1.5 text-[11px] leading-none"
          style={{ height: 18, color: "var(--ink)", boxShadow: "inset 0 0 0 1px var(--line)" }}
          onMouseEnter={() => onPoint(rank)}
          onMouseLeave={() => onPoint(undefined)}
          onFocus={() => onPoint(rank)}
          onBlur={() => onPoint(undefined)}
        >
          {Option.isSome(dot) ? (
            <DerangementGlyph size={11} />
          ) : (
            <ParadoxGlyph size={11} title="" />
          )}
          <span>{held.name}</span>
          {tail !== "" && <span style={{ color: "var(--dim)" }}>{tail}</span>}
          {onShed ? (
            <button
              type="button"
              onClick={onShed}
              aria-label={`Put down ${held.name}`}
              className="mv-key grid h-full place-items-center px-1.5 text-[11px] leading-none transition-colors"
              style={{ color: "var(--dim)" }}
            >
              ×
            </button>
          ) : (
            <span className="pr-1.5" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4} className="max-w-72">
        {def.effect}
      </TooltipContent>
    </Tooltip>
  )
}

/** The popup: the nine pairs, mild beside severe; a name already standing is dimmed. */
function Picker({
  heading,
  taken,
  gate = null,
  onPick,
  onOpenChange,
  children,
}: {
  heading: string
  taken: ReadonlyArray<HeldDerangement>
  gate?: string | null
  onPick: (name: DerangementName) => void
  onOpenChange?: ((open: boolean) => void) | undefined
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const change = (next: boolean) => {
    if (gate !== null && next) return
    setOpen(next)
    onOpenChange?.(next)
  }
  const names = taken.map((d) => d.name)
  const cell = (name: DerangementName) => (
    <button
      key={name}
      type="button"
      disabled={names.includes(name)}
      onClick={() => {
        onPick(name)
        change(false)
      }}
      className="mv-key truncate text-left text-[11px] leading-none transition-colors disabled:opacity-30"
      style={{ height: 18, color: "var(--ink)" }}
    >
      {name}
    </button>
  )
  return (
    <Popover open={open} onOpenChange={change}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="bottom" align="start" sideOffset={6} className="mv-data w-auto p-3">
        <div className="grid gap-2">
          <span className="mv-eyebrow">{heading}</span>
          <div className="grid grid-cols-2 gap-x-5" style={{ rowGap: 1 }}>
            {DERANGEMENT_PAIRS.map(([mild, severe]) => [cell(mild), cell(severe)])}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
