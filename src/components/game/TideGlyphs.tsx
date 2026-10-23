/**
 * The Paradox area's instrument glyphs (the badges work, 2026-10-22 evening):
 * the rule's fixed slots, drawn as marks so the row can carry the raw facts
 * — how many Sleepers, how many prior rolls, tool in hand or not — and
 * leave the dice math to the dice. Same house as the Arcana and Paradox
 * glyphs: a 24-box, round strokes, currentColor, so the row's ink says live
 * or dim. Each speaks its own name for the accessibility tree.
 */

const frame = (size: number, title: string, strokeWidth: number) =>
  ({
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    role: "img",
    "aria-label": title,
  }) as const

/** Sleeper witnesses: a closed eye — the lid's curve and three lashes. */
export function SleeperGlyph({ size = 14, title = "Sleeper witnesses" }: { size?: number; title?: string }) {
  return (
    <svg {...frame(size, title, 2.2)}>
      <title>{title}</title>
      <path d="M 3 10 Q 12 18.5 21 10" />
      <path d="M 7.2 14.6 L 5.8 17.4" />
      <path d="M 12 16 L 12 19" />
      <path d="M 16.8 14.6 L 18.2 17.4" />
    </svg>
  )
}

/** Prior Paradox rolls this scene: a three-quarter arrow, six o'clock
 * round to three — "again" — the count standing to its right. The scene
 * UI's accumulator will wear the same mark (owner, 2026-10-22). */
export function PriorRollsGlyph({ size = 14, title = "Prior Paradox rolls this scene" }: { size?: number; title?: string }) {
  return (
    <svg {...frame(size, title, 2.2)}>
      <title>{title}</title>
      <path d="M 12 20 A 8 8 0 1 1 20 12" />
      <path d="M 17 9.5 L 20 12.5 L 23 9.5" />
    </svg>
  )
}

/** The Tides' net pull on the pool: two waves. Red when they rise (more
 * Paradox dice), verdigris when they pull back, dim when slack. */
export function TidesGlyph({ size = 14, title = "The Tides" }: { size?: number; title?: string }) {
  return (
    <svg {...frame(size, title, 2.2)}>
      <title>{title}</title>
      <path d="M 2.5 9.5 C 5.5 6.5, 8.5 6.5, 11.5 9.5 S 17.5 12.5, 21.5 9.5" />
      <path d="M 2.5 16 C 5.5 13, 8.5 13, 11.5 16 S 17.5 19, 21.5 16" />
    </svg>
  )
}

/** The dedicated magical tool: a wand — the most generic of the five
 * Atlantean tools (Mage p. 91; owner's call over the pentacle coin,
 * 2026-10-22). A rod held low-left, a four-point spark off its tip. */
export function ToolGlyph({ size = 14, title = "Magical tool" }: { size?: number; title?: string }) {
  return (
    <svg {...frame(size, title, 2.2)}>
      <title>{title}</title>
      <path d="M 4 20 L 14.5 9.5" />
      <path d="M 17.5 3.5 L 17.5 9.5" />
      <path d="M 14.5 6.5 L 20.5 6.5" />
    </svg>
  )
}
