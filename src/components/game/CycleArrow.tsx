/**
 * The cycle arrow ↻ — a turn, drawn in the Lozenge's manner (sized in em,
 * dropped to the numerals' center line) so it sits in a run of text. Most
 * of a circle, clockwise, ending in a head big enough to read as an arrow
 * at 11px (owner, 2026-10-27: the first draft's head was too small to tell).
 */
export function CycleArrow() {
  return (
    <svg
      width="0.9em"
      height="0.9em"
      viewBox="0 0 12 12"
      aria-hidden
      style={{ display: "inline-block", verticalAlign: "-0.08em", flexShrink: 0 }}
    >
      {/* three quarters of a ring, from the right round the bottom and left to the top */}
      <path
        d="M10 6 A4 4 0 1 1 6.6 2.05"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      {/* the head, pointing on along the ring at the top */}
      <path d="M5.6 0.2 L10 2.1 L5.9 4.6 Z" fill="currentColor" />
    </svg>
  )
}
