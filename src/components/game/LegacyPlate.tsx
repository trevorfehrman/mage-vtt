import { Option } from "effect"
import type { Legacy } from "#/domain/character"
import { ArcanaGlyph, arcanumTint, isGrossArcanum } from "./ArcanaGlyph"
import { legacyPlate, type LegacyRung } from "./legacy-plate-look"

// The Legacy plate (MAG-64; owner 2026-10-27: "this should be bright and
// center on the nameplate component somewhere, this is a big deal ... a
// special newly styled section bolted on to the nameplate to make it feel
// like you physically got bigger"). The Legacy is the one choice a mage
// never reverses (Mage p. 344), so it is not a section of the sheet but a
// growth of the title card: a raised piece riveted onto the card's edge,
// bleeding to its sides, carrying the Legacy's name large, its primary
// Arcanum as the emblem when the catalog knows it, and the three
// attainments with their Gnosis gates — the reached ones in ink, the rest
// waiting in the dim. Absent until a Legacy is chosen.
//
// Three looks under audition on the rig; the card wears one.

/** Where the growth attaches: above the name, beneath the emblem row, or on the Gnosis flank. */
export const LEGACY_LOOKS = ["plinth", "pediment", "wing"] as const
export type LegacyLook = (typeof LEGACY_LOOKS)[number]

/** The title card's padding, which the band bleeds through to the card's edges. */
const CARD_PAD = 16
/** How far the wing juts past the card's right edge — the piece that was bolted on. */
const WING_JUT = 10

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
  const emblem = Option.match(plate.primary, {
    onNone: () => null,
    onSome: (a) => (
      <span className="inline-flex shrink-0" style={{ color: arcanumTint(a) }} aria-hidden>
        <ArcanaGlyph arcanum={a} size={look === "wing" ? 20 : 26} variant={isGrossArcanum(a) ? "seal" : "line"} />
      </span>
    ),
  })
  const eyebrow = Option.match(plate.nickname, {
    onNone: () => "Legacy",
    onSome: (n) => `Legacy · ${n}`,
  })

  if (look === "wing") {
    return (
      <div
        className="mv-legacy-wing grid justify-items-end gap-2 text-right"
        style={{ marginRight: -(CARD_PAD + WING_JUT), paddingLeft: 14, paddingRight: CARD_PAD + WING_JUT, paddingTop: 10, paddingBottom: 10 }}
        aria-label={`Legacy: ${plate.name}, ${plate.held} of ${plate.rungs.length} attainments`}
      >
        <span className="mv-eyebrow">{eyebrow}</span>
        <span className="flex items-center gap-2">
          <span className="mv-h leading-none" style={{ fontSize: 19 }}>{plate.name}</span>
          {emblem}
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

  const band = look === "pediment" ? "mv-legacy-pediment" : "mv-legacy-plinth"
  return (
    <div
      className={`mv-legacy-band ${band} flex flex-wrap items-center justify-between gap-x-8 gap-y-3`}
      style={{
        margin: look === "pediment" ? `-${CARD_PAD}px -${CARD_PAD}px 0` : `0 -${CARD_PAD}px -${CARD_PAD}px`,
        padding: `12px ${CARD_PAD}px`,
      }}
      aria-label={`Legacy: ${plate.name}, ${plate.held} of ${plate.rungs.length} attainments`}
    >
      <div className="grid gap-1.5">
        <span className="mv-eyebrow">{eyebrow}</span>
        <span className="flex items-center gap-3">
          {emblem}
          <span className="mv-h leading-none" style={{ fontSize: 24 }}>{plate.name}</span>
        </span>
      </div>
      <ol className="flex items-start gap-6">
        {plate.rungs.map((r) => (
          <li key={r.name} className="grid gap-1.5">
            <span className="mv-eyebrow" style={{ color: gateInk(r) }}>Gnosis {r.gnosis}</span>
            <span className="mv-h leading-none" style={{ fontSize: 14, fontWeight: 500, color: rungInk(r) }}>{r.name}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
