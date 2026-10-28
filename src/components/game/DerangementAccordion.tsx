import { useEffect, useState, type ReactNode } from "react"
import { Match, Option } from "effect"
import { ChevronDown } from "lucide-react"
import {
  DERANGEMENT_PAIRS,
  derangement,
  holdWords,
  isBedlamHold,
  pairDepth,
  standingDerangements,
  weaknessSentence,
  weaknessWords,
  type DerangementDef,
  type DerangementName,
  type DerangementSeverity,
  type HeldDerangement,
} from "#/domain/derangements"
import type { SheetMark } from "#/domain/flows/hand-edit"
import type { SceneId } from "#/domain/ids"
import type { WisdomRank } from "#/domain/wisdom"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "#/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "#/components/ui/tooltip"
import { ParadoxGlyph } from "./ParadoxGlyph"
import { clockWords, shelfOrder } from "./derangement-shelf-look"

/**
 * The Derangements accordion (MAG-60; owner 2026-10-28, after the zone:
 * "remove the zone, the ghost button, derangements becomes the header of an
 * accordion … the whole word [is the click target] and there's a caret …
 * take away the symbol, take away the lasting vs bedlam toggle … our list
 * will say Depression / Melancholia and the right side description will show
 * both separated by a line … some kind of symbol separating the mild and
 * severe on the line, kinda like how we have the keyhole … a button appears
 * in that bottom right corner that says 'derange' … the debuff on the sheet
 * once selected is way too big … the in depth info should be in a richly
 * styled tooltip on hover … the default state under derangements can read
 * 'You are not deranged.'"; then "the collapsible should be a fixed height
 * … the boxes should … take collectively the full height … a derange button
 * should be in like a footer of the thing on the right … separated by a line
 * … show not tell mild vs severe … a special styling zone for the bedlam
 * descriptions … hover over behavior on the collapsed state").
 *
 * The heading is the opener: the word, with a caret turning, on Health's
 * and Wisdom's left edge. Beneath it, always: the standing derangements as
 * small chips — the name in the display serif, since it is fiction — each
 * carrying its full reading in a tooltip, or the sentence "You are not
 * deranged." Pointing at the strip brightens it (`.mv-derange-head`);
 * clicking either opens the body, a chip on its own pair at its own depth.
 *
 * The body is two-sided and a fixed height. On the left the nine pairs,
 * each one row that says both names, the nine rows sharing the height. On
 * the right the pair chosen, both forms read whole — what sets it off and
 * the roll that resists, what it does, and its Bedlam weakness in its own
 * red-inked band — parted by a line with the turn on it: a half-lit disc
 * whose lit half faces the form that is live. The other form stands
 * dimmed. A click on the turn (or on a dimmed form) turns it. Depth is
 * shown, not said: the severe form's name wears the bruise. A footer under
 * a line holds the book's pages and the one button: Derange, to take the
 * live form; Compose, when the live form is already held, to put it down
 * — Resolve + Composure being what resists a derangement. The mark is
 * always lasting from here; a Bedlam's hold stays the flow's for the cast
 * card to pass later.
 *
 * The fold animates `grid-template-rows`; each sheet section is its own
 * compositor layer (`.mv-sheet-section`) so the shove holds 120Hz.
 */

const OPEN = "420ms cubic-bezier(0.2, 0.8, 0.2, 1)"
/** The body's fixed height: enough for the longest pair read whole, the same for every pair. */
const BODY = 464

/** The clock, for the timed ones: read on render and kept roughly current. */
const useNow = () => {
  const [at, setAt] = useState(() => Date.now())
  useEffect(() => {
    const tick = setInterval(() => setAt(Date.now()), 60_000)
    return () => clearInterval(tick)
  }, [])
  return at
}

/** The held one's ink: the wound's bruise for a lasting one, Paradox red for a Bedlam's. */
const inkOf = (bedlam: boolean) => (bedlam ? "var(--paradox)" : "var(--bad)")

/** The pair a name belongs to, named by its mild form. */
const pairOf = (name: DerangementName): DerangementName => {
  const def = derangement(name)
  return def.severity === "mild" ? name : def.partner
}

export function DerangementAccordion({
  held,
  wisdom,
  activeSceneId,
  onMark,
}: {
  held: ReadonlyArray<HeldDerangement>
  wisdom: WisdomRank
  activeSceneId?: SceneId | undefined
  onMark?: ((mark: SheetMark) => void) | undefined
}) {
  const at = useNow()
  const standing = shelfOrder(
    standingDerangements(held, { wisdom, sceneId: Option.fromUndefinedOr(activeSceneId), at }),
  )
  const [open, setOpen] = useState(false)
  // the pair chosen, named by its mild form, and which of its depths is live
  const [pair, setPair] = useState<DerangementName>(DERANGEMENT_PAIRS[0][0])
  const [depth, setDepth] = useState<DerangementSeverity>("mild")

  if (standing.length === 0 && !onMark) return null

  /** Open on a pair, its live depth the one held if any, else the mild form. */
  const openOn = (mild: DerangementName) => {
    setPair(mild)
    setDepth(Option.match(pairDepth(standing, mild), { onNone: () => "mild", onSome: (d) => derangement(d.name).severity }))
    setOpen(true)
  }

  return (
    <TooltipProvider>
      <Collapsible open={open} onOpenChange={setOpen} className="grid content-start gap-1.5">
        {/* the collapsed strip: the heading and what stands beneath it; pointing at it brightens it */}
        <div className={`mv-derange-head grid content-start gap-1.5 ${open ? "mv-derange-open" : ""}`}>
          {onMark ? (
            <CollapsibleTrigger asChild>
              <button type="button" className="mv-key mv-eyebrow flex w-fit items-center gap-1.5">
                Derangements
                <ChevronDown
                  size={10}
                  strokeWidth={1.5}
                  aria-hidden
                  style={{ transition: "transform 200ms", transform: open ? "rotate(180deg)" : "none" }}
                />
              </button>
            </CollapsibleTrigger>
          ) : (
            <span className="mv-eyebrow">Derangements</span>
          )}
          <div className="flex flex-wrap items-center gap-1.5" style={{ minHeight: 24 }}>
            {standing.length === 0 ? (
              <button
                type="button"
                disabled={!onMark}
                onClick={() => setOpen((o) => !o)}
                className="mv-key mv-derange-sentence text-left text-[12px] leading-none italic"
              >
                You are not deranged.
              </button>
            ) : (
              standing.map((d) => (
                <Chip key={d.name} held={d} at={at} wisdom={wisdom} onOpen={onMark ? () => openOn(pairOf(d.name)) : undefined} />
              ))
            )}
          </div>
        </div>
        <CollapsibleContent forceMount>
          <Fold open={open}>
            <div
              className="grid gap-3 pt-1 pb-1"
              style={{ gridTemplateColumns: "minmax(0, 5fr) minmax(0, 7fr)", height: BODY }}
            >
              {/* the pairs, one row each, the nine sharing the height */}
              <div className="grid gap-1" style={{ gridTemplateRows: "repeat(9, minmax(0, 1fr))" }}>
                {DERANGEMENT_PAIRS.map(([mild, severe]) => (
                  <PairRow
                    key={mild}
                    mild={mild}
                    severe={severe}
                    held={pairDepth(standing, mild)}
                    chosen={pair === mild}
                    onChoose={() => openOn(mild)}
                  />
                ))}
              </div>
              <Reading
                mild={derangement(pair)}
                severe={derangement(derangement(pair).partner)}
                held={pairDepth(standing, pair)}
                depth={depth}
                wisdom={wisdom}
                onTurn={setDepth}
                onTake={onMark ? (name) => onMark({ derangement: { name } }) : undefined}
                onShed={onMark ? (name) => onMark({ shedDerangement: name }) : undefined}
              />
            </div>
          </Fold>
        </CollapsibleContent>
      </Collapsible>
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

/** The severe form's name wears the bruise; the mild form's, the ink. Shown, not said. */
const depthInk = (severity: DerangementSeverity) => (severity === "severe" ? "var(--bad)" : "var(--ink)")

/** One pair in the list: "Depression / Melancholia", the severe in the bruise, a held form in its hold's ink. */
function PairRow({
  mild,
  severe,
  held,
  chosen,
  onChoose,
}: {
  mild: DerangementName
  severe: DerangementName
  held: Option.Option<HeldDerangement>
  chosen: boolean
  onChoose: () => void
}) {
  const heldInk = Option.map(held, (d) => inkOf(isBedlamHold(d.hold)))
  const nameInk = (name: DerangementName, severity: DerangementSeverity) =>
    Option.exists(held, (d) => d.name === name)
      ? Option.getOrElse(heldInk, () => "var(--ink)")
      : chosen
        ? depthInk(severity)
        : severity === "severe"
          ? "color-mix(in srgb, var(--bad) 55%, var(--dim))"
          : "var(--dim)"
  return (
    <button
      type="button"
      aria-pressed={chosen}
      onClick={onChoose}
      className="mv-key flex min-h-0 items-center gap-1.5 rounded-[2px] px-2 text-left transition-colors"
      style={{
        boxShadow: `inset 0 0 0 1px ${chosen ? "var(--ink)" : Option.getOrElse(Option.map(heldInk, (i) => `color-mix(in srgb, ${i} 45%, transparent)`), () => "var(--line)")}`,
        background: Option.match(heldInk, {
          onNone: () => "transparent",
          onSome: (i) => `color-mix(in srgb, ${i} 7%, transparent)`,
        }),
      }}
    >
      <span className="mv-h text-[13px] leading-none" style={{ color: nameInk(mild, "mild") }}>
        {mild}
      </span>
      <span className="mv-data text-[11px] leading-none" style={{ color: "var(--dim)" }}>
        /
      </span>
      <span className="mv-h text-[13px] leading-none" style={{ color: nameInk(severe, "severe") }}>
        {severe}
      </span>
    </button>
  )
}

/**
 * The pair read whole: the mild form, the line with the turn on it, the
 * severe form, and the footer under its own line with the book's pages and
 * the one button.
 */
function Reading({
  mild,
  severe,
  held,
  depth,
  wisdom,
  onTurn,
  onTake,
  onShed,
}: {
  mild: DerangementDef
  severe: DerangementDef
  held: Option.Option<HeldDerangement>
  depth: DerangementSeverity
  wisdom: WisdomRank
  onTurn: (depth: DerangementSeverity) => void
  onTake?: ((name: DerangementName) => void) | undefined
  onShed?: ((name: DerangementName) => void) | undefined
}) {
  const live = depth === "mild" ? mild : severe
  const liveHeld = Option.exists(held, (d) => d.name === live.name)
  const act = liveHeld ? onShed : onTake
  return (
    <div
      className="grid min-h-0 rounded-[2px]"
      style={{
        gridTemplateRows: "minmax(0, 1fr) auto minmax(0, 1fr) auto",
        boxShadow: "inset 0 0 0 1px var(--line)",
        background: "color-mix(in srgb, var(--ink) 3%, transparent)",
      }}
    >
      <Form
        def={mild}
        held={Option.filter(held, (d) => d.name === mild.name)}
        live={depth === "mild"}
        wisdom={wisdom}
        onLive={() => onTurn("mild")}
      />
      <div className="flex items-center gap-2 px-3">
        <span className="h-px flex-1" style={{ background: "var(--line)" }} />
        <Turn depth={depth} onTurn={onTurn} />
        <span className="h-px flex-1" style={{ background: "var(--line)" }} />
      </div>
      <Form
        def={severe}
        held={Option.filter(held, (d) => d.name === severe.name)}
        live={depth === "severe"}
        wisdom={wisdom}
        onLive={() => onTurn("severe")}
      />
      {/* the footer: the pages on the left, the button on the right */}
      <div
        className="flex items-center justify-between gap-3 px-3"
        style={{ height: 40, borderTop: "1px solid var(--line)" }}
      >
        <span className="mv-eyebrow">
          WoD p. {live.page.wod} · Mage p. {live.page.mage}
        </span>
        {act && (
          <button
            type="button"
            onClick={() => act(live.name)}
            className="mv-btn rounded-[3px] px-3 text-[12px] leading-none"
            style={{ height: 26, color: liveHeld ? "var(--accent)" : "var(--bad)" }}
          >
            {liveHeld ? "Compose" : "Derange"}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * The turn on the line between the two forms: a disc half lit, the lit half
 * facing the form that is live. A click turns it to the other.
 */
function Turn({ depth, onTurn }: { depth: DerangementSeverity; onTurn: (depth: DerangementSeverity) => void }) {
  const toSevere = depth === "mild"
  return (
    <button
      type="button"
      aria-label={toSevere ? "Turn to the severe form" : "Turn to the mild form"}
      onClick={() => onTurn(toSevere ? "severe" : "mild")}
      className="mv-key grid place-items-center rounded-full transition-colors"
      style={{ width: 22, height: 22, color: "var(--dim)" }}
    >
      <svg
        viewBox="0 0 24 24"
        width={18}
        height={18}
        aria-hidden
        style={{ transition: "transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1)", transform: toSevere ? "none" : "rotate(180deg)" }}
      >
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth={1.4} />
        {/* the lit half: upward while the mild form is live */}
        <path d="M4 12 A8 8 0 0 1 20 12 Z" fill="var(--bad)" />
      </svg>
    </button>
  )
}

/** One form read whole; dimmed while the other is live, and a click makes it live. */
function Form({
  def,
  held,
  live,
  wisdom,
  onLive,
}: {
  def: DerangementDef
  held: Option.Option<HeldDerangement>
  live: boolean
  wisdom: WisdomRank
  onLive: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={live}
      onClick={onLive}
      className="mv-key grid min-h-0 content-start gap-1.5 overflow-hidden px-3 py-2.5 text-left transition-opacity"
      style={{ opacity: live ? 1 : 0.4 }}
    >
      <Rules def={def} held={held} wisdom={wisdom} nameSize={16} />
    </button>
  )
}

/**
 * The full reading of one form, shared by the body and the chip's tooltip:
 * its name — in the bruise if it is the severe form — what sets it off and
 * the roll that resists, what it does, its Bedlam weakness in its own band,
 * and, when held, how it is held.
 */
function Rules({
  def,
  held,
  wisdom,
  nameSize,
}: {
  def: DerangementDef
  held: Option.Option<HeldDerangement>
  wisdom: WisdomRank
  nameSize: number
}) {
  return (
    <>
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="mv-h leading-none" style={{ fontSize: nameSize, color: depthInk(def.severity) }}>
          {def.name}
        </span>
        {def.extreme && <span className="mv-eyebrow">· life-altering trauma to acquire, save by Bedlam</span>}
        {Option.isSome(held) && (
          <span className="mv-eyebrow ml-auto" style={{ color: inkOf(isBedlamHold(held.value.hold)) }}>
            {holdWords(held.value, wisdom)}
          </span>
        )}
      </span>
      <span className="mv-data text-[11px] leading-snug" style={{ color: "var(--dim)" }}>
        {def.trigger} · resist with {def.resist}
      </span>
      <span className="text-[12px] leading-snug" style={{ color: "var(--ink)" }}>
        {def.effect}
      </span>
      {/* the Bedlam band: the Paradox's own red, its glyph, the weakness in prose */}
      <span
        className="grid gap-1 rounded-[2px] px-2.5 py-1.5"
        style={{
          background: "color-mix(in srgb, var(--paradox) 7%, transparent)",
          boxShadow: "inset 2px 0 0 var(--paradox)",
        }}
      >
        <span className="mv-eyebrow flex items-center gap-1.5" style={{ color: "var(--paradox)" }}>
          <ParadoxGlyph size={10} ink="currentColor" title="" />
          Bedlam
        </span>
        <span className="text-[11.5px] leading-snug" style={{ color: "color-mix(in srgb, var(--ink) 88%, transparent)" }}>
          {weaknessSentence(def.bedlam)}
        </span>
      </span>
    </>
  )
}

/**
 * One standing derangement as a chip: its name, small, in its hold's ink,
 * with the full reading in a tooltip. A click opens the body on it.
 */
function Chip({
  held,
  at,
  wisdom,
  onOpen,
}: {
  held: HeldDerangement
  at: number
  wisdom: WisdomRank
  onOpen?: (() => void) | undefined
}) {
  const def = derangement(held.name)
  const bedlam = isBedlamHold(held.hold)
  const ink = inkOf(bedlam)
  const clock = Match.value(held.hold).pipe(
    Match.tag("lasting", () => Option.none()),
    Match.tag("scene", () => Option.some("scene")),
    Match.tag("until", (h) => clockWords(h.expiresAt, at)),
    Match.exhaustive,
  )
  const weight = bedlam ? [weaknessWords(def.bedlam), ...Option.toArray(clock)].filter((w) => w !== "").join(" · ") : ""
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={!onOpen}
          onClick={onOpen}
          aria-label={`${held.name}, ${def.severity}: open the derangements`}
          className="mv-key mv-derange-chip flex items-center gap-2 rounded-[3px] px-2 transition-[box-shadow,background-color]"
          style={{ height: 24, ["--chip-ink" as string]: ink }}
        >
          <span className="mv-h text-[13px] leading-none" style={{ color: "var(--ink)" }}>
            {held.name}
          </span>
          {weight !== "" && (
            <span className="mv-data text-[10px] leading-none" style={{ color: ink }}>
              {weight}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" sideOffset={6} className="max-w-[46ch] px-3 py-2.5 text-pretty">
        <span className="grid gap-1.5 text-left">
          <Rules def={def} held={Option.some(held)} wisdom={wisdom} nameSize={14} />
        </span>
      </TooltipContent>
    </Tooltip>
  )
}
