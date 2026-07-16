import type { ReactNode } from "react"

/**
 * The Mage glyph sets — the ten Arcana, five Paths, five Orders — as a hybrid
 * glyph language: a legible geometric skeleton plus one calligraphic signature
 * each (inward spiral terminal · barbed point · solid "bindi" dot), so they
 * read as Mage brush-runes rather than generic sacred geometry. Original
 * interpretations of the motifs in docs/mage-iconography.md (the canonical
 * runes are copyrighted line art; we abstract the motif, never trace).
 *
 * Glyphs are functional, not decorative (docs/component-polish.md): a glyph
 * appears wherever its subject does — sheet rows, the identity emblems, pool
 * chips, roll cards — and nowhere else.
 *
 * Every glyph is optically normalized: its measured bounding box (via
 * getBBox, baked below) is scaled to fill the same 18×18 target centered in
 * the 24-box, with stroke width compensated, so Death and Matter carry equal
 * visual weight at any rendered size.
 */

interface GlyphDef {
  /** Measured [x, y, width, height] of the drawn paths in the 24-box. */
  box: readonly [number, number, number, number]
  node: ReactNode
}

const ARCANA: Record<string, GlyphDef> = {
  // entropy — a barbed hook closing into an inward whirlpool spiral
  death: { box: [6, 5, 11.5, 7.96], node: <><path d="M6 5 L8.4 6 M6 5 L6.6 7.6" /><path d="M6 5 C7 13.5 17.5 15.5 17.5 9.5 C17.5 6 12.5 6 12.5 10 C12.5 12.6 15.6 12.6 15.8 10.4" /></> },
  // destiny — a wishbone fork, its right horn curling to a spiral tail
  fate: { box: [6.9, 7.83, 8.63, 12.17], node: <><path d="M12 20 L8.2 8.4 M8.2 8.4 L6.9 9.6 M8.2 8.4 L9.6 9" /><path d="M12 20 L15.4 10.4 C16.2 7.4 12.9 6.9 13.3 9.6" /></> },
  // energy — a tomoe comma swirling around a solid nucleus
  forces: { box: [8.83, 5.6, 8.17, 10.08], node: <><path d="M15.2 7 L13.6 5.6 M15.2 7 L17 6.3" /><path d="M15.2 7 C9.5 6.6 6.8 11.6 10.6 14.8 C13.6 17.2 16.8 14.2 15.4 11.4" /><circle cx="12.4" cy="11.4" r="1.7" fill="currentColor" stroke="none" /></> },
  // the vesica seed with a living bindi at its heart
  life: { box: [7.88, 4, 8.25, 16], node: <><path d="M12 4 C6.5 9 6.5 15 12 20 C17.5 15 17.5 9 12 4 Z" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /></> },
  // solid matter — an isometric cube studded on its top face
  matter: { box: [3, 3, 18, 18], node: <><path d="M12 3 L21 8 V16 L12 21 L3 16 V8 Z" /><path d="M12 3 V11 M12 11 L21 8 M12 11 L3 8" /><circle cx="12" cy="6.6" r="1.1" fill="currentColor" stroke="none" /></> },
  // thought — ripples rising from a single point
  mind: { box: [3.7, 4.7, 16.6, 9.8], node: <><circle cx="12" cy="13" r="1.5" fill="currentColor" stroke="none" /><path d="M6.7 13 A5.3 5.3 0 0 1 17.3 13" /><path d="M3.7 13 A8.3 8.3 0 0 1 20.3 13" /></> },
  // the supernal source — a radiant star crowning a looped source-staff
  prime: { box: [7, 2.4, 10, 17.6], node: <><circle cx="12" cy="3.6" r="1.2" fill="currentColor" stroke="none" /><path d="M12 5.4 V6.2 M9.9 3.6 H10.7 M13.3 3.6 H14.1" /><path d="M7 8 H17" /><path d="M12 8 V16" /><path d="M12 16 C9.2 16 9.2 20 12 20 C14.8 20 14.8 16 12 16 Z" /></> },
  // folded space — a square holding a turned square around a focal mote
  space: { box: [4, 4, 16, 16], node: <><rect x="4" y="4" width="16" height="16" /><path d="M12 4 L20 12 L12 20 L4 12 Z" /><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" /></> },
  // the veil — a gateway with an orbiting soul-mote. Box is deliberately NOT
  // the measured bbox: it's re-centered on the wheel (cx 11) so the mote
  // hangs off-center instead of dragging the wheel left (owner call, #84).
  spirit: { box: [1.55, 4.5, 18.9, 15], node: <><circle cx="11" cy="12" r="7.5" /><path d="M11 4.5 V19.5" /><path d="M4.5 12 H17.5" opacity=".5" /><circle cx="21" cy="6.5" r="1.4" fill="currentColor" stroke="none" /></> },
  // recurrence — an hourglass whose stream curls into a spiral, pivot at now
  time: { box: [6.5, 4, 12.61, 16], node: <><path d="M6.5 4 H17.5 L6.5 20 H17.5" /><path d="M17.5 20 C19.6 20 19.6 17.4 17.8 17.7" /><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" /></> },
}

const PATHS: Record<string, GlyphDef> = {
  // Lunargent Thorn — a crescent moon pierced by a barbed thorn
  acanthus: { box: [5.13, 3.5, 13.37, 17], node: <><path d="M16.5 4 A8.5 8.5 0 1 0 16.5 20 A6.5 6.5 0 1 1 16.5 4 Z" /><path d="M6.5 17.5 L18.5 5.5 M18.5 5.5 L16 5.8 M18.5 5.5 L18.2 8" /></> },
  // Iron Gauntlet — the whip's jagged lash, barbed at the grip, curling at the tip
  mastigos: { box: [7, 4, 12.24, 15.13], node: <><path d="M7 4 L13.5 8.5 L9 12.5 L17 19" /><path d="M7 4 L9.4 4.3 M7 4 L7.5 6.3" /><path d="M17 19 C19.3 19.7 20.1 17.3 18.1 16.9" /></> },
  // Lead Coin — the balance beam over the struck coin, scroll and barb at the beam ends
  moros: { box: [4.48, 3.4, 14.02, 16.8], node: <><path d="M5.5 5 H18.5" /><path d="M18.5 5 L17.3 3.4" /><path d="M5.5 5 C3.9 5.5 4.3 7.6 5.9 7.1" /><path d="M12 5 V9.5" /><circle cx="12" cy="15" r="5.2" /><circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none" /></> },
  // Golden Key — the key of the Aether, star-bindi in its bow, barbed foot
  obrimos: { box: [8.8, 3.6, 7, 18], node: <><circle cx="12" cy="6.8" r="3.2" /><circle cx="12" cy="6.8" r="1" fill="currentColor" stroke="none" /><path d="M12 10 V20 M12 20 L15.8 20 M12 16.6 H14.4" /><path d="M12 20 L10.9 21.6" /></> },
  // Stone Book — the jagged antler-bolt flanked by two cave-art dots
  thyrsus: { box: [4.8, 3.7, 15.2, 16.3], node: <><path d="M9 4 L13 9 L10 9 L15 15 L12 15 L16.5 20" /><path d="M9 4 L10.9 3.7 M9 4 L8.9 6" /><circle cx="6.2" cy="13.5" r="1.4" fill="currentColor" stroke="none" /><circle cx="18.6" cy="8.5" r="1.4" fill="currentColor" stroke="none" /></> },
}

const ORDERS: Record<string, GlyphDef> = {
  // the Claw — a sheaf of arrows crossed in an asterisk, spiral at the foot
  "adamantine arrow": { box: [5.5, 4.5, 13, 15.16], node: <><path d="M12 4.5 V19.5 M5.5 8.2 L18.5 15.8 M18.5 8.2 L5.5 15.8" /><path d="M12 4.5 L10.3 6.3 M12 4.5 L13.7 6.3" /><path d="M12 19.5 C9.8 20.3 9.2 17.8 11 17.9" /></> },
  // the Eye — the veiled mask, bar-slit eyes, a key driven into the crown
  "guardians of the veil": { box: [5, 2.8, 14, 17], node: <><path d="M5 8.5 C5 5 19 5 19 8.5 C19 14.5 16.2 17.8 12 19.8 C7.8 17.8 5 14.5 5 8.5 Z" /><path d="M8 11 H16" /><circle cx="12" cy="14.6" r="1.2" fill="currentColor" stroke="none" /><path d="M12 5.6 V2.8 M12 2.8 L13.6 3.4" /></> },
  // the Wings — the open book bearing a keyhole in its pages
  mysterium: { box: [4.6, 4.91, 14.8, 13.29], node: <><path d="M12 6.2 C9.4 4.6 6.2 4.6 4.6 5.6 V17.6 C6.2 16.6 9.4 16.6 12 18.2 C14.6 16.6 17.8 16.6 19.4 17.6 V5.6 C17.8 4.6 14.6 4.6 12 6.2 Z" /><path d="M12 6.2 V18.2" /><circle cx="15.7" cy="9.6" r="1.2" fill="currentColor" stroke="none" /><path d="M15.7 10.8 V13" /></> },
  // the Voice — the ascending ladder, rungs narrowing toward the orb above
  "silver ladder": { box: [8.6, 1.7, 6.8, 18.8], node: <><path d="M8.6 20.5 L11.2 4.5 M15.4 20.5 L12.8 4.5" /><path d="M9.2 16.6 H14.8 M9.9 12.4 H14.2 M10.5 8.2 H13.6" /><circle cx="12" cy="2.9" r="1.2" fill="currentColor" stroke="none" /></> },
  // the assembly-wheel — a gear-ringed wheel with a satellite orb
  "free council": { box: [4.2, 3.3, 17.5, 16.5], node: <><circle cx="11.5" cy="12.5" r="7.3" /><circle cx="11.5" cy="12.5" r="2.9" /><path d="M11.5 5.2 V7.4 M11.5 17.6 V19.8 M4.2 12.5 H6.4 M16.6 12.5 H18.8 M6.3 7.3 L7.9 8.9 M15.1 16.1 L16.7 17.7 M6.3 17.7 L7.9 16.1 M15.1 8.9 L16.7 7.3" /><circle cx="20.3" cy="4.7" r="1.4" fill="currentColor" stroke="none" /></> },
}

export type GlyphVariant = "line" | "seal"

/**
 * Scale-and-center a glyph's measured box onto a shared target in the 24-box,
 * compensating stroke width so every glyph carries the same line weight.
 *
 * `variant="line"` is the glyph as light: tinted strokes on the dark ground.
 * `variant="seal"` is its negative — a struck medallion: a solid disc of
 * currentColor with the glyph knocked out dark (the Gross/material rendering;
 * the Subtle sibling stays line-light).
 */
function Glyph({
  def,
  size,
  className,
  variant = "line",
}: {
  def: GlyphDef | undefined
  size: number
  className: string
  variant?: GlyphVariant
}) {
  if (!def) return null
  const [x, y, w, h] = def.box
  const target = variant === "seal" ? 13 : 18
  const s = Math.min(target / w, target / h)
  const tx = 12 - s * (x + w / 2)
  const ty = 12 - s * (y + h / 2)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4 / s}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {variant === "seal" && (
        <circle cx="12" cy="12" r="11" fill="currentColor" stroke="none" />
      )}
      <g
        transform={`translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${s.toFixed(3)})`}
        {...(variant === "seal" ? { style: { color: "var(--panel)" } } : {})}
      >
        {def.node}
      </g>
    </svg>
  )
}

/**
 * Arcana color semantics (docs/mage-iconography.md, --realm-* tokens): one
 * hue per Supernal Realm family; the Subtle/Gross siblings split by
 * inversion — Subtle renders as line-light, Gross as a struck medallion
 * (see the `variant` prop). UI semantics, not game rules.
 */
const ARCANUM_REALM: Record<string, string> = {
  prime: "aether",
  forces: "aether",
  fate: "arcadia",
  time: "arcadia",
  mind: "pandemonium",
  space: "pandemonium",
  spirit: "wild",
  life: "wild",
  death: "stygia",
  matter: "stygia",
}

/** The Gross (material) half of each Realm pair; its sibling is Subtle. */
const GROSS_ARCANA = new Set(["forces", "time", "space", "life", "matter"])

const PATH_REALM: Record<string, string> = {
  obrimos: "aether",
  acanthus: "arcadia",
  mastigos: "pandemonium",
  thyrsus: "wild",
  moros: "stygia",
}

/** The Realm-family tint for an Arcanum, as a CSS var. Accent for unknowns. */
export const arcanumTint = (arcanum: string): string => {
  const realm = ARCANUM_REALM[arcanum.toLowerCase()]
  return realm ? `var(--realm-${realm})` : "var(--accent)"
}

/** True for the material (medallion-rendered) half of a Realm pair. */
export const isGrossArcanum = (arcanum: string): boolean =>
  GROSS_ARCANA.has(arcanum.toLowerCase())

/** The Realm an Arcanum belongs to (drives the material behavior classes). */
export const arcanumRealm = (arcanum: string): string =>
  ARCANUM_REALM[arcanum.toLowerCase()] ?? "aether"

/** The Realm-family tint for a Path. Accent for unknowns. */
export const pathTint = (path: string): string => {
  const realm = PATH_REALM[path.toLowerCase()]
  return realm ? `var(--realm-${realm})` : "var(--accent)"
}

/** Precious-metal realms (gold Aether, lunargent Arcadia) sheen; the base
 * materials — rusted iron, stone, lead — stay matte. */
const PRECIOUS_REALMS = new Set(["aether", "arcadia"])

export const isPreciousArcanum = (arcanum: string): boolean =>
  PRECIOUS_REALMS.has(ARCANUM_REALM[arcanum.toLowerCase()] ?? "")

/** Case-insensitive: takes "forces" or "Forces". Renders nothing for unknowns. */
export function ArcanaGlyph({
  arcanum,
  size = 14,
  className = "",
  variant = "line",
}: {
  arcanum: string
  size?: number
  className?: string
  variant?: GlyphVariant
}) {
  return (
    <Glyph
      def={ARCANA[arcanum.toLowerCase()]}
      size={size}
      className={className}
      variant={variant}
    />
  )
}

/** Case-insensitive: takes "Moros" etc. Renders nothing for unknowns. */
export function PathGlyph({
  path,
  size = 14,
  className = "",
}: {
  path: string
  size?: number
  className?: string
}) {
  return <Glyph def={PATHS[path.toLowerCase()]} size={size} className={className} />
}

/** Case-insensitive: takes "Mysterium", "Silver Ladder" etc. Renders nothing for unknowns. */
export function OrderGlyph({
  order,
  size = 14,
  className = "",
}: {
  order: string
  size?: number
  className?: string
}) {
  return <Glyph def={ORDERS[order.toLowerCase()]} size={size} className={className} />
}
