/**
 * The Paradox glyph (#114): the tear in the Lie. Where the Arcana glyphs are
 * a geometric skeleton with one calligraphic signature (ArcanaGlyph.tsx),
 * Paradox is the signature with no skeleton — all barbs, no order: an
 * irregular solid burst, every spike a different length, nothing repeated.
 * It wears --paradox (the commissioned outside-the-palette red) and does the
 * yelling itself — beside it the words "Paradox" and "bites" are redundant
 * and the no-doubling rule (#114) drops them.
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
      fill="currentColor"
      stroke="none"
      role="img"
      aria-label={title}
      style={{ color: "var(--paradox)" }}
    >
      <title>{title}</title>
      <path d="M12 1.5 L13.8 8 L19.5 3.6 L15.9 9.8 L22.5 10.6 L16.4 12.9 L20.8 18.9 L14.3 15.4 L13.6 22.5 L11.2 15.8 L5.6 20.4 L8.7 13.6 L1.5 13.2 L8.1 10.4 L4.3 4.4 L10.4 8.3 Z" />
    </svg>
  )
}
