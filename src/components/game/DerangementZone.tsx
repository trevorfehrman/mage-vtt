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
  weaknessWords,
  type DerangementDef,
  type DerangementName,
  type HeldDerangement,
} from "#/domain/derangements"
import type { SheetMark } from "#/domain/flows/hand-edit"
import type { SceneId } from "#/domain/ids"
import type { WisdomRank } from "#/domain/wisdom"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "#/components/ui/collapsible"
import { DerangementGlyph } from "./DerangementGlyph"
import { ParadoxGlyph } from "./ParadoxGlyph"
import { clockWords, shelfOrder } from "./derangement-shelf-look"

/**
 * The Derangements zone (MAG-60; owner 2026-10-28, rolling the complexity
 * back: "the derangements area needs to be styled more like a zone. some of
 * the zone is always visible even when unpopulated. maybe try a ghost badge
 * there after all, clicking in the zone 'header' expands the zone with the
 * derangement picker … these debuffs have game weight but they also have
 * hefty roleplaying weight. the player should be very aware that they're
 * under the burden of these things").
 *
 * A band across the title card beneath its title row, its eyebrow on the
 * same left edge as HEALTH and WISDOM. The header strip is always there:
 * the heading, the standing derangements as *marks* — the name in the
 * display serif, since it is fiction; beneath it one mono line of game
 * weight ("lasting", "Bedlam · −1 Death · scene"), since that is mechanics;
 * and the bout in prose, always read, never hovered — and at the row's end
 * a ghost, a dashed outline wearing the spiral, which says "unburdened"
 * while nothing is held. Clicking anywhere in the strip opens the picker
 * beneath. While anything is held the zone wears a fog of its burden's
 * ink — the wound's bruise for a lasting one, Paradox red once a Bedlam
 * one stands — settling in when a mark lands and staying.
 *
 * The picker: one card per pair, named for its mild form with the severe
 * form beneath as what it deepens to, so the pairing is structural rather
 * than a visual hint. A tap takes the mild form; a second deepens it to the
 * severe; a third puts it down. Two words at the top say what a tap takes
 * it as: lasting, or a Bedlam's (its clock from the Wisdom table, refused
 * in downtime at Wisdom 5+ where a scene-long one has nothing to bind to).
 * Pointing at a card details the form the next tap would take.
 *
 * The fold animates `grid-template-rows`; each sheet section is its own
 * compositor layer (`.mv-sheet-section`) so the shove holds 120Hz.
 */

const OPEN = "420ms cubic-bezier(0.2, 0.8, 0.2, 1)"
const PLATE_PAD = 16

/** The clock, for the timed ones: read on render and kept roughly current. */
const useNow = () => {
  const [at, setAt] = useState(() => Date.now())
  useEffect(() => {
    const tick = setInterval(() => setAt(Date.now()), 60_000)
    return () => clearInterval(tick)
  }, [])
  return at
}

/** At Wisdom 5+ a Bedlam needs a Scene to bind to; below, it has a clock. */
const bedlamGateOf = (wisdom: WisdomRank, activeSceneId: SceneId | undefined) =>
  activeSceneId !== undefined || wisdom <= 4 ? null : "no scene open"

/** The burden's ink: the wound's bruise for a lasting one, Paradox red for a Bedlam's. */
const inkOf = (bedlam: boolean) => (bedlam ? "var(--paradox)" : "var(--bad)")

export function DerangementZone({
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
  // what a tap takes it as: lasting, or a Bedlam's
  const [asBedlam, setAsBedlam] = useState(false)
  // the pair pointed at, named by its mild form
  const [focus, setFocus] = useState<DerangementName | undefined>(undefined)
  const gate = asBedlam ? bedlamGateOf(wisdom, activeSceneId) : null
  const burdened = standing.length > 0
  const zoneInk = inkOf(standing.some((d) => isBedlamHold(d.hold)))

  if (!burdened && !onMark) return null

  const take = (name: DerangementName) => onMark?.({ derangement: { name, ...(asBedlam ? { bedlam: true } : {}) } })
  const shed = (name: DerangementName) => onMark?.({ shedDerangement: name })

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="mv-burden grid"
      style={{ marginInline: -PLATE_PAD, paddingInline: PLATE_PAD, ["--burden-ink" as string]: zoneInk }}
      data-burdened={burdened ? "" : undefined}
    >
      {burdened && <div key={standing.map((d) => d.name).join("·")} className="mv-burden-fog" aria-hidden />}
      {/* the header strip: always there; a click anywhere not on a button opens the picker */}
      <div
        className="flex items-start gap-5 py-3"
        style={{ cursor: onMark ? "pointer" : undefined }}
        onClick={(e) => {
          if (onMark && !(e.target as HTMLElement).closest("button")) setOpen((o) => !o)
        }}
      >
        <span className="mv-eyebrow shrink-0" style={{ paddingTop: 4, color: open ? "var(--ink)" : undefined }}>
          Derangements
        </span>
        <div className="flex flex-wrap items-stretch gap-2">
          {standing.map((d) => (
            <Mark key={d.name} held={d} at={at} wisdom={wisdom} onShed={onMark ? () => shed(d.name) : undefined} />
          ))}
          {onMark && (
            <CollapsibleTrigger
              aria-label={open ? "Close the derangements" : "Take on a derangement"}
              className="mv-key flex items-center gap-2 rounded-[3px] px-3 transition-colors"
              style={{
                minHeight: 30,
                border: `1px dashed color-mix(in srgb, ${open ? "var(--ink)" : "var(--dim)"} 55%, transparent)`,
                color: open ? "var(--ink)" : "var(--dim)",
              }}
            >
              <DerangementGlyph size={12} />
              {!burdened && <span className="mv-data text-[11px] leading-none">unburdened</span>}
              <ChevronDown
                size={10}
                strokeWidth={1.5}
                aria-hidden
                style={{ transition: "transform 200ms", transform: open ? "rotate(180deg)" : "none" }}
              />
            </CollapsibleTrigger>
          )}
        </div>
      </div>
      <CollapsibleContent forceMount>
        <Fold open={open}>
          <div className="grid gap-3 pb-4">
            <div className="flex items-center gap-4">
              <span className="mv-eyebrow">take as</span>
              {[
                ["lasting", false],
                ["Bedlam", true],
              ].map(([word, bedlam]) => (
                <button
                  key={String(word)}
                  type="button"
                  aria-pressed={asBedlam === bedlam}
                  onClick={() => setAsBedlam(bedlam === true)}
                  className="mv-key mv-eyebrow transition-colors"
                  style={{
                    color: asBedlam === bedlam ? inkOf(bedlam === true) : undefined,
                    boxShadow: asBedlam === bedlam ? `0 1px 0 ${inkOf(bedlam === true)}` : undefined,
                  }}
                >
                  {word}
                </button>
              ))}
              {gate !== null && (
                <span className="mv-eyebrow" style={{ color: "var(--paradox)" }}>
                  · {gate}
                </span>
              )}
              <button
                type="button"
                aria-label="Close the derangements"
                onClick={() => setOpen(false)}
                className="mv-key mv-data ml-auto text-[11px] leading-none"
                style={{ color: "var(--dim)" }}
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2" onMouseLeave={() => setFocus(undefined)}>
              {DERANGEMENT_PAIRS.map(([mild, severe]) => (
                <PairCard
                  key={mild}
                  mild={mild}
                  severe={severe}
                  depth={pairDepth(standing, mild)}
                  ink={inkOf(asBedlam)}
                  gated={gate !== null}
                  focused={focus === mild}
                  onFocus={() => setFocus(mild)}
                  onTake={onMark ? take : undefined}
                  onShed={onMark ? shed : undefined}
                />
              ))}
            </div>
            <Detail
              focus={focus}
              standing={standing}
              bedlam={asBedlam}
            />
          </div>
        </Fold>
      </CollapsibleContent>
    </Collapsible>
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

/** The next tap on a pair: take the mild form, deepen to the severe, or put it down. */
const nextStep = (depth: Option.Option<HeldDerangement>, mild: DerangementName, severe: DerangementName) =>
  Option.match(depth, {
    onNone: () => ({ _tag: "take", name: mild, words: "tap to take" }) as const,
    onSome: (d) =>
      d.name === mild
        ? ({ _tag: "take", name: severe, words: "tap to deepen" }) as const
        : ({ _tag: "shed", name: severe, words: "tap to put down" }) as const,
  })

/** One pair as a card: the mild form, and beneath it the severe form it deepens to. */
function PairCard({
  mild,
  severe,
  depth,
  ink,
  gated,
  focused,
  onFocus,
  onTake,
  onShed,
}: {
  mild: DerangementName
  severe: DerangementName
  depth: Option.Option<HeldDerangement>
  ink: string
  gated: boolean
  focused: boolean
  onFocus: () => void
  onTake?: ((name: DerangementName) => void) | undefined
  onShed?: ((name: DerangementName) => void) | undefined
}) {
  const step = nextStep(depth, mild, severe)
  const heldInk = Option.map(depth, (d) => inkOf(isBedlamHold(d.hold)))
  const atMild = Option.exists(depth, (d) => d.name === mild)
  const atSevere = Option.exists(depth, (d) => d.name === severe)
  const refused = gated && step._tag === "take"
  const line = Option.getOrElse(heldInk, () => (focused ? "var(--ink)" : "var(--line)"))
  return (
    <button
      type="button"
      aria-pressed={Option.isSome(depth)}
      aria-disabled={refused}
      aria-label={`${mild}: ${step.words}`}
      onMouseEnter={onFocus}
      onFocus={onFocus}
      onClick={() => {
        onFocus()
        if (refused) return
        Match.value(step).pipe(
          Match.tag("take", (s) => onTake?.(s.name)),
          Match.tag("shed", (s) => onShed?.(s.name)),
          Match.exhaustive,
        )
      }}
      className={`mv-key grid content-start gap-1 rounded-[3px] px-3 py-2 text-left transition-colors ${refused ? "mv-refuse" : ""}`}
      style={{
        boxShadow: `inset 0 0 0 1px ${line}`,
        background: Option.match(heldInk, {
          onNone: () => "transparent",
          onSome: (i) => `color-mix(in srgb, ${i} ${atSevere ? 16 : 9}%, transparent)`,
        }),
      }}
    >
      <span className="flex items-center gap-2">
        <span style={{ color: Option.getOrElse(heldInk, () => "var(--dim)") }}>
          <DerangementGlyph size={12} />
        </span>
        <span
          className="mv-h text-[15px] leading-none"
          style={{ color: atMild ? Option.getOrElse(heldInk, () => ink) : atSevere ? "var(--dim)" : "var(--ink)" }}
        >
          {mild}
        </span>
      </span>
      <span className="mv-eyebrow flex items-center gap-1" style={{ paddingLeft: 2, fontSize: 8 }}>
        <ChevronDown size={9} strokeWidth={1.5} aria-hidden />
        deepens to
      </span>
      <span
        className="mv-h text-[13px] leading-none"
        style={{ color: atSevere ? Option.getOrElse(heldInk, () => ink) : "var(--dim)" }}
      >
        {severe}
      </span>
    </button>
  )
}

/** The form the next tap would take, in the book's words: its trigger, its bout, its Bedlam weakness. */
function Detail({
  focus,
  standing,
  bedlam,
}: {
  focus: DerangementName | undefined
  standing: ReadonlyArray<HeldDerangement>
  bedlam: boolean
}) {
  if (focus === undefined) {
    return (
      <span className="mv-data text-[11px] leading-snug" style={{ color: "var(--dim)", minHeight: 30 }}>
        One affliction at two depths: a tap takes the mild form, another deepens it, a third puts it down.
      </span>
    )
  }
  const def = derangement(focus)
  const step = nextStep(pairDepth(standing, focus), focus, def.partner)
  const shown: DerangementDef = derangement(step.name)
  const weakness = bedlam ? weaknessWords(shown.bedlam) : ""
  return (
    <div className="grid gap-1" style={{ minHeight: 30 }}>
      <span className="flex items-baseline gap-2">
        <span className="mv-h text-[14px] leading-none" style={{ color: "var(--ink)" }}>
          {shown.name}
        </span>
        <span className="mv-eyebrow">{shown.severity}</span>
        {weakness !== "" && (
          <span className="mv-data text-[11px] leading-none" style={{ color: "var(--paradox)" }}>
            {weakness}
          </span>
        )}
        <span className="mv-eyebrow ml-auto">{step.words}</span>
      </span>
      <span className="text-[12px] leading-snug" style={{ color: "var(--ink)" }}>
        <span style={{ color: "var(--dim)" }}>{shown.trigger}. </span>
        {shown.effect}
      </span>
    </div>
  )
}

/**
 * One standing derangement as a mark: the name in the display serif (it is
 * fiction), one mono line of game weight beneath (it is mechanics), and
 * the bout in prose, always read.
 */
function Mark({
  held,
  at,
  wisdom,
  onShed,
}: {
  held: HeldDerangement
  at: number
  wisdom: WisdomRank
  onShed?: (() => void) | undefined
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
  const weakness = bedlam ? weaknessWords(def.bedlam) : ""
  const weight = [
    bedlam ? "Bedlam" : "lasting",
    ...(weakness === "" ? [] : [weakness]),
    ...Option.toArray(clock),
  ].join(" · ")
  return (
    <div
      className="grid content-start gap-1 rounded-[3px] px-3 py-2"
      style={{
        minWidth: 200,
        maxWidth: 330,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${ink} 45%, transparent)`,
        background: `color-mix(in srgb, ${ink} 7%, transparent)`,
      }}
      title={holdWords(held, wisdom)}
    >
      <span className="flex items-center gap-2">
        <span style={{ color: ink }}>{bedlam ? <ParadoxGlyph size={12} ink="currentColor" title="" /> : <DerangementGlyph size={12} />}</span>
        <span className="mv-h text-[15px] leading-none" style={{ color: "var(--ink)" }}>
          {held.name}
        </span>
        <span className="mv-eyebrow ml-auto">{def.severity}</span>
        {onShed && (
          <button
            type="button"
            onClick={onShed}
            aria-label={`Put down ${held.name}`}
            className="mv-key text-[11px] leading-none transition-colors"
            style={{ color: "var(--dim)" }}
          >
            ×
          </button>
        )}
      </span>
      <span className="mv-data text-[11px] leading-none" style={{ color: ink }}>
        {weight}
      </span>
      <span className="text-[11.5px] leading-snug" style={{ color: "color-mix(in srgb, var(--ink) 82%, transparent)" }}>
        {def.effect}
      </span>
    </div>
  )
}
