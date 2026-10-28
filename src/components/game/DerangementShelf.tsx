import { useEffect, useState, type ReactNode } from "react"
import { Match, Option } from "effect"
import {
  DERANGEMENT_PAIRS,
  derangement,
  hangingFromDot,
  standingDerangements,
  weaknessWords,
  type DerangementDef,
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
 * two rounds): badges under the Wisdom track; hovering a permanent one
 * lights up its empty pip; the Bedlam kind lists its duration; beneath each
 * empty pip an unlit derangement symbol (no box); a dedicated Derangements
 * heading beneath Wisdom; clicking any symbol under the pips, or the opener
 * under the heading, animates height into the character block — no popup —
 * and shows the full list as larger cards complete with what each does;
 * toggle them on there; shrink the section and they become the badges.
 *
 * Two pieces share one `menu` the sheet holds: `DerangementSlots` is the
 * row of symbols in the meter's columns (a symbol under a lost cell, solid
 * when that dot carries one, unlit when it could); `DerangementSection` is
 * what the heading holds — the badge row, its opener, and the list that
 * opens beneath. The context is what the opener chose: a dot's symbol opens
 * the list *for that dot*, the heading's opener opens it *for Bedlam*, and
 * the list's eyebrow says which. A card toggled on hangs there; toggled off,
 * it is put down.
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

/** The symbols beneath the meter, in its own ten columns. */
export function DerangementSlots({
  held,
  wisdom,
  activeSceneId,
  menu,
  onOpen,
  onPoint,
}: {
  held: ReadonlyArray<HeldDerangement>
  wisdom: WisdomRank
  activeSceneId?: SceneId | undefined
  menu: DerangementMenu
  onOpen?: ((menu: DerangementMenu) => void) | undefined
  onPoint?: ((rank: WisdomRank | undefined) => void) | undefined
}) {
  const at = useNow()
  const standing = standingNow(held, wisdom, activeSceneId, at)
  const point = (rank: WisdomRank | undefined) => onPoint?.(rank)
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
            onMouseEnter={() => point(rank)}
            onMouseLeave={() => point(undefined)}
            className="mv-key grid place-items-center transition-opacity"
            style={{ color: carried || open ? "var(--ink)" : "var(--dim)", opacity: carried || open ? 1 : 0.45 }}
          >
            {symbol}
          </button>
        ) : (
          <span
            key={rank}
            className="grid place-items-center"
            style={{ color: "var(--ink)", opacity: carried ? 1 : 0 }}
            onMouseEnter={() => point(rank)}
            onMouseLeave={() => point(undefined)}
          >
            {symbol}
          </span>
        )
      })}
    </div>
  )
}

/** Under the Derangements heading: the badges, the opener, and the list that opens in place. */
export function DerangementSection({
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
  // at Wisdom 5+ a Bedlam needs a Scene to bind to; below, it has a clock
  const bedlamGate = activeSceneId !== undefined || wisdom <= 4 ? null : "no scene open"

  return (
    <TooltipProvider>
      <div className="grid">
        {/* the badge row, folded away while the list is open */}
        <Fold open={!open}>
          <div className="mv-data flex flex-wrap items-center gap-1.5" style={{ minHeight: 18 }}>
            {standing.map((d) => (
              <Badge
                key={d.name}
                held={d}
                at={at}
                onShed={onMark ? () => onMark({ shedDerangement: d.name }) : undefined}
                onPoint={point}
              />
            ))}
            {onMenu && (
              <button
                type="button"
                aria-label="Open the derangements"
                aria-expanded={open}
                onClick={() => onMenu({ _tag: "bedlam" })}
                className="mv-key grid place-items-center transition-opacity"
                style={{ height: 18, width: 18, color: "var(--dim)", opacity: 0.45 }}
              >
                <ParadoxGlyph size={11} ink="currentColor" title="" />
              </button>
            )}
          </div>
        </Fold>
        {/* the list, opening in place */}
        <Fold open={open}>
          <div className="grid gap-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="mv-eyebrow" style={{ color: "var(--ink)" }}>
                {Match.value(menu).pipe(
                  Match.tag("closed", () => ""),
                  Match.tag("dot", (m) => `on Wisdom dot ${m.rank}`),
                  Match.tag("bedlam", () => `Bedlam${bedlamGate === null ? "" : ` · ${bedlamGate}`}`),
                  Match.exhaustive,
                )}
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
            <div className="grid grid-cols-2 gap-1.5">
              {DERANGEMENT_PAIRS.flatMap(([mild, severe]) =>
                [mild, severe].map((name) => (
                  <Card
                    key={name}
                    def={derangement(name)}
                    menu={menu}
                    held={standing.find((d) => d.name === name)}
                    gate={menu._tag === "bedlam" ? bedlamGate : null}
                    onToggle={
                      onMark
                        ? (on) =>
                            onMark(
                              on
                                ? { derangement: { name, ...(menu._tag === "dot" ? { dot: menu.rank } : {}) } }
                                : { shedDerangement: name },
                            )
                        : undefined
                    }
                  />
                )),
              )}
            </div>
          </div>
        </Fold>
      </div>
    </TooltipProvider>
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

/** One derangement in the open list: the name, the pair it belongs to, what sets it off and what it does. */
function Card({
  def,
  menu,
  held,
  gate,
  onToggle,
}: {
  def: DerangementDef
  menu: DerangementMenu
  held: HeldDerangement | undefined
  gate: string | null
  onToggle?: ((on: boolean) => void) | undefined
}) {
  const on = held !== undefined
  const bedlam = menu._tag === "bedlam"
  const weakness = bedlam ? weaknessWords(def.bedlam) : ""
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-disabled={gate !== null && !on}
      onClick={() => (gate === null || on) && onToggle?.(!on)}
      className={`mv-key grid gap-1 rounded-[2px] p-2.5 text-left transition-colors ${gate !== null && !on ? "mv-refuse" : ""}`}
      style={{
        boxShadow: `inset 0 0 0 1px ${on ? "var(--accent)" : "var(--line)"}`,
        background: on ? "var(--glow)" : "transparent",
      }}
    >
      <span className="flex items-center gap-2">
        <span style={{ color: on ? "var(--accent)" : "var(--dim)" }}>
          {bedlam ? <ParadoxGlyph size={12} ink="currentColor" title="" /> : <DerangementGlyph size={12} />}
        </span>
        <span className="mv-h text-[14px] leading-none" style={{ color: on ? "var(--accent)" : "var(--ink)" }}>
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
    </button>
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
