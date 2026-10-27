/**
 * The cycle arrow ↻ — a turn, drawn in the Lozenge's manner (sized in em,
 * dropped to the numerals' center line) so it sits in a run of text.
 */
export function CycleArrow() {
  return (
    <svg
      width="0.8em"
      height="0.8em"
      viewBox="0 0 10 10"
      aria-hidden
      style={{ display: "inline-block", verticalAlign: "-0.05em", flexShrink: 0 }}
    >
      <path
        d="M8.2 5.6 A3.3 3.3 0 1 1 7.3 2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <path d="M6.2 1.4 L8.3 2.4 L7.2 4.4 Z" fill="currentColor" />
    </svg>
  )
}
