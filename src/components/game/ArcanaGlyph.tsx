import type { ReactNode } from "react"

/**
 * The ten Arcana as a hybrid glyph set — a legible geometric skeleton plus one
 * calligraphic signature each (inward spiral terminal · barbed point · solid
 * "bindi" dot), so they read as Mage brush-runes rather than generic sacred
 * geometry. Original interpretations per docs/mage-iconography.md; approved in
 * src/routes/prototype/visual-identity-2.tsx (Pass 4).
 *
 * Glyphs are functional, not decorative (docs/component-polish.md): an
 * Arcanum's glyph appears wherever that Arcanum does — sheet rows, ruling
 * pair, pool chips, roll cards — and nowhere else.
 */

const GLYPH_PATHS: Record<string, ReactNode> = {
  // entropy — a barbed hook closing into an inward whirlpool spiral
  death: <><path d="M6 5 L8.4 6 M6 5 L6.6 7.6" /><path d="M6 5 C7 13.5 17.5 15.5 17.5 9.5 C17.5 6 12.5 6 12.5 10 C12.5 12.6 15.6 12.6 15.8 10.4" /></>,
  // destiny — a wishbone fork, its right horn curling to a spiral tail
  fate: <><path d="M12 20 L8.2 8.4 M8.2 8.4 L6.9 9.6 M8.2 8.4 L9.6 9" /><path d="M12 20 L15.4 10.4 C16.2 7.4 12.9 6.9 13.3 9.6" /></>,
  // energy — a tomoe comma swirling around a solid nucleus
  forces: <><path d="M15.2 7 L13.6 5.6 M15.2 7 L17 6.3" /><path d="M15.2 7 C9.5 6.6 6.8 11.6 10.6 14.8 C13.6 17.2 16.8 14.2 15.4 11.4" /><circle cx="12.4" cy="11.4" r="1.7" fill="currentColor" stroke="none" /></>,
  // the vesica seed with a living bindi at its heart
  life: <><path d="M12 4 C6.5 9 6.5 15 12 20 C17.5 15 17.5 9 12 4 Z" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /></>,
  // solid matter — an isometric cube studded on its top face
  matter: <><path d="M12 3 L21 8 V16 L12 21 L3 16 V8 Z" /><path d="M12 3 V11 M12 11 L21 8 M12 11 L3 8" /><circle cx="12" cy="6.6" r="1.1" fill="currentColor" stroke="none" /></>,
  // thought — ripples rising from a single point
  mind: <><circle cx="12" cy="13" r="1.5" fill="currentColor" stroke="none" /><path d="M6.7 13 A5.3 5.3 0 0 1 17.3 13" /><path d="M3.7 13 A8.3 8.3 0 0 1 20.3 13" /></>,
  // the supernal source — a radiant star crowning a looped source-staff
  prime: <><circle cx="12" cy="3.6" r="1.2" fill="currentColor" stroke="none" /><path d="M12 5.4 V6.2 M9.9 3.6 H10.7 M13.3 3.6 H14.1" /><path d="M7 8 H17" /><path d="M12 8 V16" /><path d="M12 16 C9.2 16 9.2 20 12 20 C14.8 20 14.8 16 12 16 Z" /></>,
  // folded space — a square holding a turned square around a focal mote
  space: <><rect x="4" y="4" width="16" height="16" /><path d="M12 4 L20 12 L12 20 L4 12 Z" /><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" /></>,
  // the veil — a gateway with an orbiting soul-mote
  spirit: <><circle cx="11" cy="12" r="7.5" /><path d="M11 4.5 V19.5" /><path d="M4.5 12 H17.5" opacity=".5" /><circle cx="21" cy="6.5" r="1.4" fill="currentColor" stroke="none" /></>,
  // recurrence — an hourglass whose stream curls into a spiral, pivot at now
  time: <><path d="M6.5 4 H17.5 L6.5 20 H17.5" /><path d="M17.5 20 C19.6 20 19.6 17.4 17.8 17.7" /><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" /></>,
}

/** Case-insensitive: takes "forces" or "Forces". Renders nothing for unknowns. */
export function ArcanaGlyph({
  arcanum,
  size = 14,
  className = "",
}: {
  arcanum: string
  size?: number
  className?: string
}) {
  const paths = GLYPH_PATHS[arcanum.toLowerCase()]
  if (!paths) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths}
    </svg>
  )
}
