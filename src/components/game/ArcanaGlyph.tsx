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

// The soul's poles (MAG-52): the seven Virtues by their classical attributes
// (christianiconography.info), widened past the Christian ones (owner: Faith's
// cross is too Christian) — Justice takes her sword and Temperance the
// balance; the seven Vices by the plainest emblem each — the sins have no
// settled iconography, so legibility chose (owner-judged, 2026-10-24).
const VIRTUES: Record<string, GlyphDef> = {
  // caritas — the heart, its bindi the warmth it gives
  charity: { box: [4.22, 5.56, 15.56, 14.44], node: <><path d="M12 20 C5 15 3.5 11 4.5 8 C5.5 5 9.5 4.5 12 8 C14.5 4.5 18.5 5 19.5 8 C20.5 11 19 15 12 20 Z" /><circle cx="12" cy="12.2" r="1.3" fill="currentColor" stroke="none" /></> },
  // the vigil candle, its flame kept lit
  faith: { box: [8, 3.6, 8, 15.9], node: <><path d="M9.5 10 H14.5 V19.5 H9.5 Z" /><path d="M8 19.5 H16 M12 10 V8.8" /><path d="M12 3.6 C14 5.8 14 7.7 12 8.8 C10 7.7 10 5.8 12 3.6 Z" /><path d="M14.5 11.6 C13.8 12.6 13.8 13.6 14.4 14.2" /></> },
  // the column — capital, fluted shaft, plinth
  fortitude: { box: [7, 4.5, 10, 15.5], node: <><path d="M7 4.5 H17 M8 6.5 H16 M9 6.5 V18 M15 6.5 V18 M12 8 V16.5 M8 18 H16 M7 20 H17" /></> },
  // the sun breaking the horizon, its reflection below
  hope: { box: [3, 6, 18, 13.5], node: <><path d="M3 16.5 H21" /><path d="M7 16.5 A5 5 0 0 1 17 16.5" /><path d="M12 6 V8.6 M5.4 9.2 L7.1 10.9 M18.6 9.2 L16.9 10.9 M3.4 13.2 H5.4 M18.6 13.2 H20.6" /><path d="M8 19.5 H16" /><circle cx="12" cy="14.4" r="1.1" fill="currentColor" stroke="none" /></> },
  // the sword of Justice, point up, a bindi pommel
  justice: { box: [7.5, 3, 9, 18.8], node: <><path d="M12 3 L13.4 6 V15.5 H10.6 V6 Z" /><path d="M7.5 15.5 H16.5 M12 15.5 V19.4" /><circle cx="12" cy="20.6" r="1.2" fill="currentColor" stroke="none" /></> },
  // the serpent of wisdom in a slow coil, forked tongue barbed
  prudence: { box: [5, 4.03, 13.94, 16.52], node: <><path d="M5 20.5 C9 21 10 17.5 8 15.5 C6 13.5 7 10 10.5 10.5 C14 11 15.5 13.5 18 11.5 C19.6 10.2 19 7.6 17.4 6.6" /><path d="M17.4 6.6 C16 7.2 14.6 6.4 14.8 5.2 C15 4 16.8 3.6 17.8 4.6 C18.4 5.3 18.2 6.2 17.4 6.6 Z" /><circle cx="16.7" cy="5.1" r="0.7" fill="currentColor" stroke="none" /><path d="M14.8 5.4 L13.2 5.6 M13.2 5.6 L12.3 4.9 M13.2 5.6 L12.4 6.5" /></> },
  // the balance — measure in all things
  temperance: { box: [2.8, 2.5, 18.4, 17], node: <><circle cx="12" cy="3.6" r="1.1" fill="currentColor" stroke="none" /><path d="M12 5.2 V19.5 M8.5 19.5 H15.5 M5 7 H19" /><path d="M5 7 L3 12.5 M5 7 L7 12.5 M19 7 L17 12.5 M19 7 L21 12.5" /><path d="M2.8 12.5 H7.2 C6.8 14.6 3.2 14.6 2.8 12.5 Z" /><path d="M16.8 12.5 H21.2 C20.8 14.6 17.2 14.6 16.8 12.5 Z" /></> },
}

const VICES: Record<string, GlyphDef> = {
  // invidia, "to look upon" — the watching eye
  envy: { box: [3.5, 7.88, 17, 8.25], node: <><path d="M3.5 12 C7 6.5 17 6.5 20.5 12 C17 17.5 7 17.5 3.5 12 Z" /><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></> },
  // the cup filled past its brim, a drop running over
  gluttony: { box: [6.5, 4.2, 12.6, 15.4], node: <><path d="M6.5 6 H17.5 C17.5 11 15 13.2 12 13.2 C9 13.2 6.5 11 6.5 6 Z" /><path d="M6.5 6 C7.8 3.6 16.2 3.6 17.5 6" /><path d="M12 13.2 V18.6 M8.5 19.6 C9.5 18.6 14.5 18.6 15.5 19.6" /><path d="M17.5 6 C18.4 7 18.5 8 18.2 8.8" /><circle cx="18.1" cy="10.6" r="1" fill="currentColor" stroke="none" /></> },
  // the hoard — a column of coins, one face struck
  greed: { box: [6, 4.82, 12, 14.35], node: <><path d="M6 7 C6 4.1 18 4.1 18 7 C18 9.9 6 9.9 6 7 Z" /><path d="M6 7 V17 M18 7 V17 M6 17 C6 19.9 18 19.9 18 17 M6 10.4 C6 13.3 18 13.3 18 10.4 M6 13.7 C6 16.6 18 16.6 18 13.7" /><circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" /></> },
  // the goat's horns, ringed, sweeping back from the brow
  lust: { box: [4.48, 4.83, 15.04, 13.87], node: <><path d="M10.5 15 C8 13 5 11 4.5 7 C4.3 5.4 5.6 4.2 6.6 5.2 C6 8.6 8.6 11 11.5 12.6 Z" /><path d="M13.5 15 C16 13 19 11 19.5 7 C19.7 5.4 18.4 4.2 17.4 5.2 C18 8.6 15.4 11 12.5 12.6 Z" /><path d="M5.4 9.4 L7 8.6 M7.6 11.6 L8.8 10.4 M18.6 9.4 L17 8.6 M16.4 11.6 L15.2 10.4" /><circle cx="12" cy="17.6" r="1.1" fill="currentColor" stroke="none" /></> },
  // the peacock's eye-feather, barbs along the quill
  pride: { box: [9, 3, 6, 18], node: <><path d="M12 3 C8 6 8 10.5 12 12.8 C16 10.5 16 6 12 3 Z" /><circle cx="12" cy="8.4" r="1.1" fill="currentColor" stroke="none" /><path d="M12 12.8 V21 M12 15.6 L9.6 14.2 M12 15.6 L14.4 14.2 M12 18.4 L9.9 17.1 M12 18.4 L14.1 17.1" /></> },
  // the flame, a coal at its root
  wrath: { box: [6.99, 3, 10.21, 17], node: <><path d="M12 3 C15 7 18 10 17 15 C16.4 18.4 14 20 12 20 C9 20 6.8 17.8 7 14.6 C7.2 11.8 9 10.5 9.5 8 C11 9.5 11.2 11 11 12.5 C13 11 13.4 7 12 3 Z" /><circle cx="12" cy="16.4" r="1.2" fill="currentColor" stroke="none" /></> },
  // the snail — the spiral itself, feelers barely raised
  sloth: { box: [3.8, 6.8, 17.8, 11.8], node: <><path d="M14 17.4 C9 17.4 7 14.4 7 11.8 C7 8.8 9.5 6.8 12 6.8 C15 6.8 16.5 9 16.5 11.2 C16.5 13.2 15 14.6 13 14.6 C11.4 14.6 10.4 13.4 10.4 12 C10.4 10.8 11.3 10 12.3 10" /><path d="M3.8 18.6 H18.4 C19.8 18.6 20.4 17.4 19.6 16.4 L20.6 13" /><circle cx="20.7" cy="12.2" r="0.9" fill="currentColor" stroke="none" /></> },
}

// The body's ratings (MAG-52): what a mage brings to a fight, by the plainest
// emblem each, unadorned (owner: let the flag be a flag and the chevrons be
// chevrons). Initiative flies a pennant, not a bolt — a bolt would echo
// the Thyrsus antler-bolt.
const STATS: Record<string, GlyphDef> = {
  // the shield, a bindi at its boss
  defense: { box: [5, 3.5, 14, 17], node: <><path d="M12 3.5 L19 6 V11.5 C19 15.8 16 18.8 12 20.5 C8 18.8 5 15.8 5 11.5 V6 Z" /><circle cx="12" cy="11.5" r="1.2" fill="currentColor" stroke="none" /></> },
  // the pennant — first to move
  initiative: { box: [7, 3.5, 11, 17], node: <><path d="M7 3.5 V20.5 M7 4.5 L18 8 L7 11.5" /></> },
  // the magical tool — a wand, a four-pointed glint at its tip
  wand: { box: [4.5, 2.8, 15.9, 16.7], node: <><path d="M4.5 19.5 L14 10" /><path d="M17 2.8 L17.9 5.3 L20.4 6.2 L17.9 7.1 L17 9.6 L16.1 7.1 L13.6 6.2 L16.1 5.3 Z" /></> },
  // two chevrons running forward
  speed: { box: [4.5, 7, 11, 10], node: <><path d="M4.5 7 L9.5 12 L4.5 17 M10.5 7 L15.5 12 L10.5 17" /></> },
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

/** A Virtue's glyph (MAG-52). */
export function VirtueGlyph({
  virtue,
  size = 14,
  className = "",
}: {
  virtue: string
  size?: number
  className?: string
}) {
  return <Glyph def={VIRTUES[virtue.toLowerCase()]} size={size} className={className} />
}

/** A Vice's glyph (MAG-52). */
export function ViceGlyph({
  vice,
  size = 14,
  className = "",
}: {
  vice: string
  size?: number
  className?: string
}) {
  return <Glyph def={VICES[vice.toLowerCase()]} size={size} className={className} />
}

/** A rating's glyph — Defense, Initiative, Speed — or the magical tool's
 * wand (MAG-52). */
export function StatGlyph({
  stat,
  size = 14,
  className = "",
}: {
  stat: "defense" | "initiative" | "speed" | "wand"
  size?: number
  className?: string
}) {
  return <Glyph def={STATS[stat]} size={size} className={className} />
}
