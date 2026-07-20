/**
 * The Paradox glyph (#114; recommissioned by the 2026-07-19 polish pass —
 * the all-barbs burst was rejected as not arcane enough): the torn ritual
 * circle. Where the Arcana glyphs are a geometric skeleton with one
 * calligraphic signature (ArcanaGlyph.tsx), Paradox is a working — a
 * containment circle — that reality has cracked straight through: two arcs
 * that no longer close, and the rift running jagged between the gaps. It
 * wears --paradox (the commissioned outside-the-palette red) and does the
 * yelling itself — beside it the word "Paradox" is redundant and the
 * no-doubling rule (#114) drops it.
 */
export function ParadoxGlyph({
  size = 14,
  title = "Paradox",
}: {
  size?: number
  /** Accessible name; the glyph replaces the word, so it must speak it. */
  title?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={title}
      style={{ color: "var(--paradox)" }}
    >
      <title>{title}</title>
      {/* the ritual circle, broken where the rift tears through it */}
      <path d="M 9.4 4.9 A 7.6 7.6 0 0 0 9.4 19.1" />
      <path d="M 14.6 4.9 A 7.6 7.6 0 0 1 14.6 19.1" />
      {/* the rift — one jagged crack from gap to gap */}
      <path d="M 13.8 1.8 L 9.8 10.4 L 14.2 12.2 L 10.2 22.2" />
    </svg>
  )
}
