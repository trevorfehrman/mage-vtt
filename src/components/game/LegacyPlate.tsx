import { useState, type CSSProperties, type ReactNode } from "react"
import { Option } from "effect"
import type { Legacy } from "#/domain/character"
import { ArcanaGlyph, PathGlyph, arcanumTint, isGrossArcanum, pathTint } from "./ArcanaGlyph"
import { legacyPlate, type LegacyRung } from "./legacy-plate-look"

// The Legacy plate (MAG-64; owner 2026-10-27: "this should be bright and
// center on the nameplate component somewhere, this is a big deal ... a
// special newly styled section bolted on to the nameplate to make it feel
// like you physically got bigger"). The Legacy is the one choice a mage
// never reverses (Mage p. 344), so it is not a section of the sheet but a
// piece of the title card: the plinth beneath the emblem row, bordered as
// the Arcana tiles are and tinted by the Legacy's primary Arcanum (owner,
// 2026-10-28: no lighter ground than the card — "it gives it too much
// emphasis"), carrying the Legacy's name large with its Arcanum and Path
// emblems trailing it (never before it — the name keeps the card's left
// edge), and the three attainments with their Gnosis gates, the reached
// ones in ink, the rest waiting in the dim. An attainment's name opens its
// reading beneath the row: what it does, in the book's words. Absent until
// a Legacy is chosen.
//
// Three looks were auditioned; the owner chose the plinth as the foundation
// (2026-10-28). The pediment and wing stay on the rig's knob for now.

/** Where the growth attaches: beneath the emblem row, above the name, or on the Gnosis flank. */
export const LEGACY_LOOKS = ["plinth", "pediment", "wing"] as const
export type LegacyLook = (typeof LEGACY_LOOKS)[number]

/** The title card's padding, which the band bleeds through to the card's edges. */
const CARD_PAD = 16
/** How far the wing juts past the card's right edge — the piece that was bolted on. */
const WING_JUT = 10
// the derangement fold's own curve (MAG-60), so the two folds feel the same
const OPEN = "420ms cubic-bezier(0.2, 0.8, 0.2, 1)"

/** The three attainments' numerals (p. 344: "there are three stages of attainment"). */
const NUMERALS = ["I", "II", "III"] as const

const rungInk = (r: LegacyRung) => (r.reached ? "var(--ink)" : "var(--dim)")
const gateInk = (r: LegacyRung) => (r.reached ? "var(--accent)" : "var(--dim)")

export function LegacyPlate({
  legacy,
  gnosis,
  look,
}: {
  legacy: Legacy
  gnosis: number
  look: LegacyLook
}) {
  const plate = legacyPlate(legacy, gnosis)
  const [openRung, setOpenRung] = useState<Option.Option<string>>(Option.none())
  const tint = Option.getOrElse(Option.map(plate.primary, arcanumTint), () => "var(--accent)")
  const tileVar = { "--tile": tint } as CSSProperties
  const emblems = (size: number) => (
    <>
      {Option.match(plate.primary, {
        onNone: () => null,
        onSome: (a) => (
          <span className="inline-flex shrink-0" style={{ color: arcanumTint(a) }} aria-hidden>
            <ArcanaGlyph arcanum={a} size={size} variant={isGrossArcanum(a) ? "seal" : "line"} />
          </span>
        ),
      })}
      {Option.match(plate.path, {
        onNone: () => null,
        onSome: (p) => (
          <span className="inline-flex shrink-0" style={{ color: pathTint(p) }} aria-hidden>
            <PathGlyph path={p} size={size} />
          </span>
        ),
      })}
    </>
  )
  const label = `Legacy: ${plate.name}, ${plate.held} of ${plate.rungs.length} attainments`

  if (look === "wing") {
    return (
      <div
        className="mv-legacy-wing grid justify-items-end gap-2 text-right"
        style={{ ...tileVar, marginRight: -(CARD_PAD + WING_JUT), paddingLeft: 14, paddingRight: CARD_PAD + WING_JUT, paddingTop: 10, paddingBottom: 10 }}
        aria-label={label}
      >
        <span className="mv-eyebrow">Legacy</span>
        <span className="flex items-center gap-2">
          <span className="mv-h leading-none" style={{ fontSize: 19 }}>{plate.name}</span>
          {emblems(18)}
        </span>
        <ol className="grid justify-items-end gap-1">
          {plate.rungs.map((r) => (
            <li key={r.name} className="flex items-baseline gap-2 leading-none">
              <span style={{ fontSize: 13, color: rungInk(r) }}>{r.name}</span>
              <span className="mv-data" style={{ fontSize: 11, width: "1.2em", textAlign: "right", color: gateInk(r) }}>{r.gnosis}</span>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  const open = Option.getOrUndefined(openRung)
  // the reading stays mounted while the fold shuts, so the shrink animates
  // over the same words (owner, 2026-10-28: "the shrink needs to be animated too")
  const [lastOpen, setLastOpen] = useState<string | undefined>(undefined)
  const shown = plate.rungs.find((r) => r.name === (open ?? lastOpen))
  const shownIndex = plate.rungs.findIndex((r) => r.name === shown?.name)
  const toggle = (name: string) => {
    setLastOpen(name)
    setOpenRung((prev) => (Option.contains(prev, name) ? Option.none() : Option.some(name)))
  }

  return (
    <div
      className={`mv-legacy-band ${look === "pediment" ? "mv-legacy-pediment" : "mv-legacy-plinth"}`}
      style={{
        ...tileVar,
        // the addition bleeds through the card's padding to its edges
        // (owner, 2026-10-28: "an addition to the sheet not contained within it")
        // one pixel past the card's edge, where the card's own corner ticks
        // sit, so the band's border and the ticks share a line
        margin: look === "pediment" ? `-${CARD_PAD + 1}px -${CARD_PAD + 1}px 0` : `0 -${CARD_PAD + 1}px -${CARD_PAD + 1}px`,
        padding: `12px ${CARD_PAD}px`,
      }}
      aria-label={label}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <div className="grid gap-1.5">
          <span className="mv-eyebrow">Legacy</span>
          <span className="flex items-center gap-3">
            <span className="mv-h leading-none" style={{ fontSize: 24 }}>{plate.name}</span>
            {emblems(22)}
          </span>
        </div>
        <ol className="flex items-start gap-6">
          {plate.rungs.map((r) => (
            <li key={r.name} className="grid gap-1.5">
              <span className="mv-eyebrow" style={{ color: gateInk(r) }}>Gnosis {r.gnosis}</span>
              {Option.isSome(r.reading) ? (
                <button
                  type="button"
                  onClick={() => toggle(r.name)}
                  aria-expanded={open === r.name}
                  className="mv-legacy-rung mv-h text-left leading-none"
                  style={{ fontSize: 14, fontWeight: 500, color: rungInk(r) }}
                >
                  {r.name}
                </button>
              ) : (
                <span className="mv-h leading-none" style={{ fontSize: 14, fontWeight: 500, color: rungInk(r) }}>{r.name}</span>
              )}
            </li>
          ))}
        </ol>
      </div>
      {/* the reading (owner 2026-10-28: "don't we need to know what the
          spells do" / "a centered more dramatic ui, these 3 things are
          supposed to be like super iconic"): the open attainment beneath the
          row, centered — its numeral between two rules, its name, the page's
          own paragraph at a reading measure, the prerequisites as the page
          prints them, and the Optional Arcanum rider when there is one */}
      <Fold open={open !== undefined}>
        {shown !== undefined && Option.isSome(shown.reading) && (
          <div
            className="grid justify-items-center gap-3 border-t text-center"
            style={{ borderColor: "var(--line)", marginTop: 12, paddingTop: 16, paddingBottom: 4 }}
          >
            <span className="flex w-full items-center gap-4" aria-hidden>
              <span className="mv-rule flex-1" style={{ transform: "scaleX(-1)" }} />
              <span className="mv-h leading-none" style={{ fontSize: 22, color: "var(--tile, var(--accent))" }}>
                {NUMERALS[shownIndex] ?? ""}
              </span>
              <span className="mv-rule flex-1" />
            </span>
            <span className="mv-h leading-none" style={{ fontSize: 20, color: rungInk(shown) }}>{shown.name}</span>
            <span className="mv-eyebrow" style={{ color: gateInk(shown) }}>Gnosis {shown.gnosis}</span>
            {/* the paragraph is a paragraph — a centered column, ragged
                right (owner: "the text shouldn't be center justified ...
                keep it in the center") */}
            <p className="leading-relaxed text-left" style={{ fontSize: 14, maxWidth: "62ch", color: "var(--ink)" }}>
              {shown.reading.value.text}
            </p>
            <p className="mv-data leading-snug text-left" style={{ fontSize: 11, maxWidth: "62ch", color: "var(--dim)" }}>
              Prerequisites: {shown.reading.value.prerequisites}
            </p>
            {Option.match(shown.reading.value.rider, {
              onNone: () => null,
              onSome: (r) => (
                <p className="leading-relaxed text-left" style={{ fontSize: 13, maxWidth: "62ch", color: "var(--dim)" }}>
                  <span className="mv-eyebrow" style={{ color: "var(--tile, var(--accent))" }}>Optional Arcanum: {r.arcanum}</span>
                  <br />
                  {r.text}
                </p>
              ),
            })}
          </div>
        )}
      </Fold>
    </div>
  )
}

/** Height animated open and shut, the grid-rows way: the content stays
 * mounted and clips. The row gap above the reading lives inside the clipped
 * content, so nothing snaps when the fold starts or ends. */
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
