import type { ComponentProps, ReactNode } from "react"
import type { ParadoxPoolModifier } from "#/domain/paradox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "#/components/ui/tooltip"
import {
  SHORE,
  TIDE_COUNT_MAX,
  TideCount,
  signedDice,
  stepTideCount,
  tidesGround,
  tidesNetInk,
  tidesPillEdge,
  tidesWeight,
  type Shore,
  type TideDraft,
} from "./tides-ground"

/** The shared focus plank (styles.css) on controls that wear no mv-* class. */
const RING = "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"

/** Every pill's frame — the live pills, the draft, the skeleton. */
const PILL_SHELL = "mv-data inline-flex max-w-full items-stretch overflow-hidden border text-[12px] leading-none"

/** A pill's edge ink, by its shore. */
const shoreEdge = (side: Shore) => tidesPillEdge(SHORE[side].sign)

/**
 * One tide pill (MAG-45): prose cells inboard, the number outboard behind a
 * rule in the pill's own edge — first on the ebb shore, last on the flood
 * shore, so the shores mirror. `cells` run from the number outward; the
 * flood pill reverses them. The live pill and the ST's draft are both this.
 */
function TidePill({
  side,
  number,
  numberClassName = "",
  cells,
  style,
  ...props
}: {
  side: Shore
  number: ReactNode
  numberClassName?: string
  cells: ReadonlyArray<ReactNode>
} & ComponentProps<"span">) {
  const { numberFirst } = SHORE[side]
  const edge = shoreEdge(side)
  const numberCell = (
    <span
      className={`flex items-center whitespace-nowrap font-bold ${numberClassName}`}
      style={{ color: "var(--ink)", ...(numberFirst ? { borderRight: `1px solid ${edge}` } : { borderLeft: `1px solid ${edge}` }) }}
    >
      {number}
    </span>
  )
  return (
    <span
      {...props}
      className={PILL_SHELL}
      style={{ borderRadius: 11, borderColor: edge, color: "var(--ink)", background: "color-mix(in srgb, var(--panel) 88%, transparent)", ...style }}
    >
      {numberFirst ? (
        <>
          {numberCell}
          {cells}
        </>
      ) : (
        <>
          {[...cells].reverse()}
          {numberCell}
        </>
      )}
    </span>
  )
}

export interface Weather {
  readonly modifier: ParadoxPoolModifier
  readonly onRemove?: () => void
}

interface TidesBoxProps {
  /** The named circumstances, scene-wide and this caster's own. */
  weather: ReadonlyArray<Weather>
  /** The ST's seat while the Tides are fluid: the shores take new tides. */
  canAdjust: boolean
  busy: boolean
  draft: TideDraft | null
  onDraft: (draft: TideDraft | null) => void
  /** Land the open draft on the document. */
  onAdd: () => void
}

/**
 * The Tides, a section of their own (owner, 2026-10-22 late): the ST
 * setting the stage — the premise of the beat, declared to the player and
 * read before the dice. Its own box on the felt's radius, and after the
 * owner's audition (/prototype/tides-audition, treatment H, see
 * tides-ground.ts) the box's ground IS the mood: green owns the left edge,
 * red the right, the net slides the seam, green leans into the top-left and
 * red into the bottom-right. The eyebrow prints the net beside TIDES. The
 * circumstances stand as two shores: ebbs stacked bottom-left, floods
 * bottom-right, prose in ink, the number outboard — weakest at the top,
 * strongest sinking to the corner. The felt below keeps its own ground and
 * stays the star.
 */
export function TidesBox({ weather, canAdjust, busy, draft, onDraft, onAdd }: TidesBoxProps) {
  if (weather.length === 0 && !canAdjust) return null
  const mods = weather.map((w) => w.modifier)
  const { net } = tidesWeight(mods)
  const ebbs = weather.filter((w) => w.modifier.dice < 0).sort((a, b) => b.modifier.dice - a.modifier.dice)
  const floods = weather.filter((w) => w.modifier.dice > 0).sort((a, b) => a.modifier.dice - b.modifier.dice)

  const pill = ({ modifier, onRemove }: Weather, side: Shore, i: number) => (
    <Tooltip key={`${side}-${modifier.source}-${i}`}>
      <TooltipTrigger asChild>
        <TidePill
          side={side}
          numberClassName="px-2 py-1"
          number={
            <>
              {signedDice(modifier.dice)}
              {onRemove && (
                <button
                  onClick={onRemove}
                  disabled={busy}
                  className="ml-1.5 leading-none opacity-70 hover:opacity-100 disabled:opacity-40"
                  style={{ color: "var(--dim)" }}
                  title="Remove"
                >
                  ×
                </button>
              )}
            </>
          }
          cells={[
            // break between words only — a shore never splits a word
            <span key="prose" className="px-2.5 py-1" style={{ overflowWrap: "normal", wordBreak: "normal" }}>
              {modifier.source}
            </span>,
          ]}
        />
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {SHORE[side].says}
        {Math.abs(modifier.dice)}
      </TooltipContent>
    </Tooltip>
  )

  // The ST's hand on each shore (MAG-45, owner 2026-10-23): a skeleton pill
  // at the shore's end — dashed in the shore's ink, "+ ebb" / "+ flood" —
  // that is ALWAYS there (owner's second look). Clicking it opens a draft
  // pill above it: the prose typed in the pill's own text cell, the count a
  // plain number in its number cell (− / +, or ↑/↓) — the shore supplies the
  // sign when it lands. ✓ or Enter lands it; × or Esc discards it; clicking
  // away lands it if it has a name and discards it if not.
  const shoreEnd = (side: Shore) => {
    if (!canAdjust) return null
    const edge = shoreEdge(side)
    // A fresh draft on this shore. By mouse it is one press even with a
    // draft open (owner's third look): the press lands the open one if it
    // has a name (not through blur — mousedown is intercepted so the field
    // never loses focus to a disabled button) and opens the new one; a
    // keyboard activation reaches onClick after Tab's blur has already
    // landed or discarded the old draft.
    const openDraft = () => {
      if (draft !== null && draft.side === side && draft.source.trim().length > 0) onAdd()
      onDraft({ side, source: "", count: TideCount.make(1) })
    }
    const skeleton = (
      <button
        key={`${side}-new`}
        onMouseDown={(e) => {
          e.preventDefault()
          if (!busy) openDraft()
        }}
        onClick={(e) => {
          if (e.detail === 0 && !busy) openDraft()
        }}
        className={`${PILL_SHELL} px-2.5 py-1 opacity-60 hover:opacity-100 ${RING}`}
        style={{ borderRadius: 11, borderStyle: "dashed", borderColor: edge, color: "var(--dim)", background: "transparent" }}
        title={SHORE[side].invite}
      >
        + {side}
      </button>
    )
    if (draft === null || draft.side !== side) return skeleton
    // The number cell steps with its own − and + (owner, 2026-10-23:
    // shift-click and the arrow keys were invisible); the arrow keys still
    // work in the field. The prose cell ends in ✓ (add; Enter) and ×
    // (discard; Esc), in the shore's ink — the same × the live pill wears.
    const stepButton = (dir: 1 | -1) => (
      <button
        onClick={() => onDraft({ ...draft, count: stepTideCount(draft.count, dir) })}
        disabled={busy || (dir === -1 ? draft.count <= 1 : draft.count >= TIDE_COUNT_MAX)}
        className={`px-1.5 py-1 leading-none disabled:opacity-30 ${RING}`}
        style={{ color: "var(--dim)" }}
        title={dir === 1 ? "One more die (↑)" : "One fewer die (↓)"}
      >
        {dir === 1 ? "+" : "−"}
      </button>
    )
    const canAdd = !busy && draft.source.trim().length > 0
    return (
      <>
        <TidePill
          key={`${side}-draft`}
          side={side}
          onBlur={(e) => {
            // focus left the pill (not just moved between its cells)
            if (e.currentTarget.contains(e.relatedTarget)) return
            if (draft.source.trim().length > 0) onAdd()
            else onDraft(null)
          }}
          number={
            <>
              {stepButton(-1)}
              <span className="px-0.5" title={SHORE[side].countTitle}>
                {draft.count}
              </span>
              {stepButton(1)}
            </>
          }
          cells={[
            <input
              key="field"
              autoFocus
              value={draft.source}
              onChange={(e) => onDraft({ ...draft, source: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAdd()
                else if (e.key === "Escape") onDraft(null)
                else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                  e.preventDefault()
                  onDraft({ ...draft, count: stepTideCount(draft.count, e.key === "ArrowUp" ? 1 : -1) })
                }
              }}
              disabled={busy}
              placeholder="name it…"
              // mv-field is the repo's text control (component-standards §6);
              // the pill's own edge is the border, so the field's is cleared.
              className="mv-field mv-data min-w-0 px-2 py-1 text-[12px]"
              style={{ width: `${Math.max(10, draft.source.length + 2)}ch`, border: "none", borderRadius: 0 }}
            />,
            <button
              key="accept"
              onClick={onAdd}
              disabled={!canAdd}
              className={`px-1.5 py-1 leading-none disabled:opacity-30 ${RING}`}
              style={{ color: edge }}
              title="Add this tide (Enter)"
            >
              ✓
            </button>,
            <button
              key="discard"
              onClick={() => onDraft(null)}
              disabled={busy}
              className={`px-1.5 py-1 leading-none opacity-70 hover:opacity-100 disabled:opacity-40 ${RING}`}
              style={{ color: "var(--dim)" }}
              title="Discard (Esc)"
            >
              ×
            </button>,
          ]}
        />
        {skeleton}
      </>
    )
  }

  return (
    <TooltipProvider>
      {/* No border (owner, 2026-10-22): the tides themselves establish the
          area — the ground's two inks are its edges. */}
      <div className="mt-2.5 rounded-[6px] px-3.5 pt-3 pb-3.5" style={{ background: tidesGround(mods) }}>
        <div
          className="mv-data flex items-baseline justify-between text-[9px] uppercase tracking-[0.18em]"
          style={{ color: "var(--dim)" }}
        >
          <span>tides</span>
          <span className="text-[12px] normal-case tracking-normal" style={{ color: tidesNetInk(net) }}>
            ≈ {signedDice(net)}
          </span>
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="flex flex-col items-start gap-1.5" style={{ maxWidth: "64%" }}>
            {ebbs.map((w, i) => pill(w, "ebb", i))}
            {shoreEnd("ebb")}
          </div>
          <div className="ml-auto flex flex-col items-end gap-1.5" style={{ maxWidth: "64%" }}>
            {floods.map((w, i) => pill(w, "flood", i))}
            {shoreEnd("flood")}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
