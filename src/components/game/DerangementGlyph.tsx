/**
 * The derangement mark (MAG-60): a spiral — the mind turning in on itself.
 * Where the Paradox glyph is a working torn through, this is nothing broken,
 * only a line that will not come out where it went in. One stroke, so it
 * reads at 10px inside a Wisdom cell and at 12px on a badge.
 */
export function DerangementGlyph({ size = 12, title }: { size?: number; title?: string | undefined }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      role={title === undefined ? undefined : "img"}
      aria-hidden={title === undefined}
      aria-label={title}
    >
      <path d="M12 12 a1.5 1.5 0 0 1 1.5 1.5 a3 3 0 0 1 -3 3 a4.5 4.5 0 0 1 -4.5 -4.5 a6 6 0 0 1 6 -6 a7.5 7.5 0 0 1 7.5 7.5 a9 9 0 0 1 -5 8" />
    </svg>
  )
}
