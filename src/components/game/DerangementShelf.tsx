import { useEffect, useState, type ReactNode } from "react"
import { Match, Option } from "effect"
import {
  DERANGEMENT_PAIRS,
  derangement,
  hangingFromDot,
  holdWords,
  standingDerangements,
  weaknessWords,
  type DerangementDef,
  type DerangementName,
  type HeldDerangement,
} from "#/domain/derangements"
import type { SheetMark } from "#/domain/flows/hand-edit"
import type { SceneId } from "#/domain/ids"
import { WisdomRank } from "#/domain/wisdom"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "#/components/ui/tooltip"
import { DerangementGlyph } from "./DerangementGlyph"
import { ParadoxGlyph } from "./ParadoxGlyph"
import { clockWords, shelfOrder } from "./derangement-shelf-look"

/**
 * Derangements on the sheet (MAG-60), the owner's foundation (2026-10-28,
 * four rounds): badges that are always visible; hovering a permanent one
 * lights up its empty Wisdom pip; the Bedlam kind lists its duration;
 * beneath each empty pip an unlit derangement symbol that lights itself on
 * hover (not the pip); and the section in its own border, opening like an
 * accordion — "i need to see all the derangements side by side with their
 * twins but we should only detail one at a time on click or hover over …
 * clicking on one toggles it on and then that should create the badge. the
 * badges are always visible the detailed view isn't."
 *
 * Two pieces share one `menu` the sheet holds: `DerangementSlots` is the
 * row of symbols in the meter's columns (a symbol under a lost cell, solid
 * when that dot carries one, unlit when it could); `DerangementPanel` is
 * the bordered section the sheet places beneath the title row at the
 * plate's full width — its header is the heading, the opener and the
 * badges; its body, folded open, is two-sided: the nine pairs as twin
 * chips on the left, mild beside severe, and on the right the one the
 * player is pointing at, detailed. The context is what the opener chose: a
 * dot's symbol opens the body *for that dot*, the heading opens it *for
 * Bedlam*, and the body's eyebrow says which. A chip tapped on hangs there
 * and its badge appears in the header; tapped off, it is put down.
 *
 * The fold animates `grid-template-rows`, a layout property; what made it
 * drop frames was never the body but the halo'd trait rows beneath the
 * plate repainting as they were shoved — each sheet section is its own
 * compositor layer (`.mv-sheet-section`), and the fold holds 120Hz.
 */

export type DerangementMenu =
  | { readonly _tag: "closed" }
  | { readonly _tag: "dot"; readonly rank: WisdomRank }
  | { readonly _tag: "bedlam" }

const CELL = 12
const GAP = 3
const OPEN = "420ms cubic-bezier(0.2, 0.8, 0.2, 1)"

/** The clock, for the timed ones: read on render and kept roughly current. */
const useNow = () => {
  const [at, setAt] = useState(() => Date.now())
  useEffect(() => {
    const tick = setInterval(() => setAt(Date.now()), 60_000)
    return () => clearInterval(tick)
  }, [])
  return at
}

const standingNow = (
  held: ReadonlyArray<HeldDerangement>,
  wisdom: WisdomRank,
  activeSceneId: SceneId | undefined,
  at: number,
) => shelfOrder(standingDerangements(held, { wisdom, sceneId: Option.fromUndefinedOr(activeSceneId), at }))

/** At Wisdom 5+ a Bedlam needs a Scene to bind to; below, it has a clock. */
const bedlamGateOf = (wisdom: WisdomRank, activeSceneId: SceneId | undefined) =>
  activeSceneId !== undefined || wisdom <= 4 ? null : "no scene open"

/** The symbols beneath the meter, in its own ten columns. */
export function DerangementSlots({
  held,
  wisdom,
  activeSceneId,
  menu,
  onOpen,
}: {
  held: ReadonlyArray<HeldDerangement>
  wisdom: WisdomRank
  activeSceneId?: SceneId | undefined
  menu: DerangementMenu
  onOpen?: ((menu: DerangementMenu) => void) | undefined
}) {
  const at = useNow()
  const standing = standingNow(held, wisdom, activeSceneId, at)
  if (wisdom === 10) return null
  return (
    <div className="grid grid-cols-10" style={{ gap: GAP, height: CELL }}>
      {WisdomRank.literals.map((rank) => {
        if (rank <= wisdom) return <span key={rank} />
        const carried = Option.isSome(hangingFromDot(standing, rank))
        const open = menu._tag === "dot" && menu.rank === rank
        const symbol = (
          <DerangementGlyph size={11} title={carried ? `Derangement on Wisdom dot ${rank}` : undefined} />
        )
        return onOpen ? (
          <button
            key={rank}
            type="button"
            aria-label={carried ? `Wisdom dot ${rank}'s derangement` : `Hang a derangement on Wisdom dot ${rank}`}
            aria-expanded={open}
            onClick={() => onOpen(open ? { _tag: "closed" } : { _tag: "dot", rank })}
            className="mv-key mv-slot grid place-items-center"
            data-lit={carried || open ? "" : undefined}
          >
            {symbol}
          </button>
        ) : (
          <span key={rank} className="grid place-items-center" style={{ color: "var(--ink)", opacity: carried ? 1 : 0 }}>
            {symbol}
          </span>
        )
      })}
    </div>
  )
}

/**
 * The bordered section beneath the title row: the heading as the opener,
 * the badges beside it always, and the two-sided body folded beneath.
 */
export function DerangementPanel({
  held,
  wisdom,
  activeSceneId,
  menu,
  onMenu,
  onMark,
  onPoint,
}: {
  held: ReadonlyArray<HeldDerangement>
  wisdom: WisdomRank
  activeSceneId?: SceneId | undefined
  menu: DerangementMenu
  onMenu?: ((menu: DerangementMenu) => void) | undefined
  onMark?: ((mark: SheetMark) => void) | undefined
  onPoint?: ((rank: WisdomRank | undefined) => void) | undefined
}) {
  const at = useNow()
  const standing = standingNow(held, wisdom, activeSceneId, at)
  const point = (rank: WisdomRank | undefined) => onPoint?.(rank)
  const open = menu._tag !== "closed"
  const bedlamGate = bedlamGateOf(wisdom, activeSceneId)
  const gate = menu._tag === "bedlam" ? bedlamGate : null
  // the one detailed at a time: the last pointed at or tapped; to begin, the first hanging one
  const [focus, setFocus] = useState<DerangementName>(() => standing[0]?.name ?? DERANGEMENT_PAIRS[0][0])
  const context = Match.value(menu).pipe(
    Match.tag("closed", () => ""),
    Match.tag("dot", (m) => `on Wisdom dot ${m.rank}`),
    Match.tag("bedlam", () => `Bedlam${bedlamGate === null ? "" : ` · ${bedlamGate}`}`),
    Match.exhaustive,
  )
  const toggle = (name: DerangementName, on: boolean) =>
    onMark?.(
      on ? { derangement: { name, ...(menu._tag === "dot" ? { dot: menu.rank } : {}) } } : { shedDerangement: name },
    )

  return (
    <TooltipProvider>
      <div className="grid rounded-[2px]" style={{ boxShadow: "inset 0 0 0 1px var(--line)" }}>
        <div className="flex items-center gap-3 px-3" style={{ minHeight: 30 }}>
          {onMenu ? (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => onMenu(open ? { _tag: "closed" } : { _tag: "bedlam" })}
              className="mv-key mv-eyebrow flex items-center gap-1.5 transition-colors"
              style={{ color: open ? "var(--ink)" : undefined }}
            >
              Derangements
              <Chevron open={open} />
            </button>
          ) : (
            <span className="mv-eyebrow">Derangements</span>
          )}
          <span className="mv-data flex flex-wrap items-center gap-1.5">
            {standing.map((d) => (
              <Badge
                key={d.name}
                held={d}
                at={at}
                onShed={onMark ? () => onMark({ shedDerangement: d.name }) : undefined}
                onPoint={point}
              />
            ))}
          </span>
        </div>
        <Fold open={open}>
          <div className="grid gap-2 px-3 pb-3">
            <div className="flex items-center justify-between">
              <span className="mv-eyebrow" style={{ color: "var(--ink)" }}>
                {context}
              </span>
              {onMenu && (
                <button
                  type="button"
                  aria-label="Close the derangements"
                  onClick={() => onMenu({ _tag: "closed" })}
                  className="mv-key mv-data text-[11px] leading-none"
                  style={{ color: "var(--dim)" }}
                >
                  ×
                </button>
              )}
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: "minmax(0, 5fr) minmax(0, 7fr)" }}>
              {/* the twins: mild beside severe, nine rows under their two words */}
              <div className="grid content-start gap-1">
                <div className="grid grid-cols-2 gap-1 px-2 pb-0.5">
                  <span className="mv-eyebrow">mild</span>
                  <span className="mv-eyebrow">severe</span>
                </div>
                {DERANGEMENT_PAIRS.map(([mild, severe]) => (
                  <div key={mild} className="grid grid-cols-2 gap-1">
                    {[mild, severe].map((name) => (
                      <Twin
                        key={name}
                        name={name}
                        on={standing.some((d) => d.name === name)}
                        focused={focus === name}
                        gate={gate}
                        onFocus={() => setFocus(name)}
                        onToggle={onMark ? (on) => toggle(name, on) : undefined}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <Detail
                def={derangement(focus)}
                held={standing.find((d) => d.name === focus)}
                bedlam={menu._tag === "bedlam"}
                wisdom={wisdom}
              />
            </div>
          </div>
        </Fold>
      </div>
    </TooltipProvider>
  )
}

/** The opener's chevron: down shut, up open. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width={8}
      height={8}
      viewBox="0 0 8 8"
      aria-hidden
      style={{ transition: "transform 200ms", transform: open ? "rotate(180deg)" : "none" }}
    >
      <path d="M1 2.5 L4 5.5 L7 2.5" fill="none" stroke="currentColor" strokeWidth={1.2} />
    </svg>
  )
}

/** Height animated open and shut, the grid-rows way: the content stays mounted and clips. */
function Fold({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className="grid"
      style={{ gridTemplateRows: open ? "1fr" : "0fr", transition: `grid-template-rows ${OPEN}` }}
      aria-hidden={!open}
    >
      <div style={{ overflow: "hidden", minHeight: 0, opacity: open ? 1 : 0, transition: `opacity ${OPEN}` }}>
        {children}
      </div>
    </div>
  )
}

/** One name in the twin rows: pointing at it details it, tapping it hangs it or puts it down. */
function Twin({
  name,
  on,
  focused,
  gate,
  onFocus,
  onToggle,
}: {
  name: DerangementName
  on: boolean
  focused: boolean
  gate: string | null
  onFocus: () => void
  onToggle?: ((on: boolean) => void) | undefined
}) {
  const refused = gate !== null && !on
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-disabled={refused}
      onMouseEnter={onFocus}
      onFocus={onFocus}
      onClick={() => {
        onFocus()
        if (!refused) onToggle?.(!on)
      }}
      className={`mv-key rounded-[2px] px-2 text-left text-[12px] leading-none transition-colors ${refused ? "mv-refuse" : ""}`}
      style={{
        height: 24,
        color: on ? "var(--accent)" : focused ? "var(--ink)" : "var(--dim)",
        boxShadow: `inset 0 0 0 1px ${on ? "var(--accent)" : focused ? "var(--ink)" : "var(--line)"}`,
        background: on ? "var(--glow)" : "transparent",
      }}
    >
      {name}
    </button>
  )
}

/** The one detailed: its mark, its name and severity, what sets it off, what it does, and where it hangs. */
function Detail({
  def,
  held,
  bedlam,
  wisdom,
}: {
  def: DerangementDef
  held: HeldDerangement | undefined
  bedlam: boolean
  wisdom: WisdomRank
}) {
  const on = held !== undefined
  const weakness = bedlam ? weaknessWords(def.bedlam) : ""
  return (
    <div
      className="grid content-start gap-1.5 rounded-[2px] p-3"
      style={{ boxShadow: "inset 0 0 0 1px var(--line)", background: "color-mix(in srgb, var(--ink) 3%, transparent)" }}
    >
      <span className="flex items-center gap-2">
        <span style={{ color: on ? "var(--accent)" : "var(--dim)" }}>
          {bedlam ? <ParadoxGlyph size={12} ink="currentColor" title="" /> : <DerangementGlyph size={12} />}
        </span>
        <span className="mv-h text-[16px] leading-none" style={{ color: on ? "var(--accent)" : "var(--ink)" }}>
          {def.name}
        </span>
        <span className="mv-eyebrow ml-auto">{def.severity}</span>
      </span>
      <span className="mv-data text-[11px] leading-snug" style={{ color: "var(--dim)" }}>
        {def.trigger}
      </span>
      <span className="text-[12px] leading-snug" style={{ color: "var(--ink)" }}>
        {def.effect}
      </span>
      {weakness !== "" && (
        <span className="mv-data text-[11px] leading-none" style={{ color: "var(--paradox)" }}>
          {weakness}
        </span>
      )}
      {held && (
        <span className="mv-eyebrow" style={{ color: "var(--accent)" }}>
          hanging · {holdWords(held, wisdom)}
        </span>
      )}
    </div>
  )
}

/** One standing derangement as a badge: its mark, its name, its clock, its ×. */
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
          {Option.isSome(dot) ? <DerangementGlyph size={11} /> : <ParadoxGlyph size={11} title="" />}
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
