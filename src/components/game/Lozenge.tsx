import { Schema } from "effect"

const LozengeProps = Schema.Struct({
  /** The pending ghost (#102): the outline alone. */
  hollow: Schema.optionalKey(Schema.Boolean),
  /** Accessible name, when the lozenge stands alone for a word. */
  title: Schema.optionalKey(Schema.String),
})

/**
 * The lozenge ◈ — Mana's and Willpower's mark (color tells them apart), and
 * the chance die's. Drawn, not typed: the font's ◈ sits off the text's center
 * line, and by a different amount in every face that renders it. This one is
 * sized in em and dropped so its middle lands on the middle of the capitals
 * and numerals beside it (about 0.36em above the baseline in Manrope and
 * JetBrains Mono). It must sit in a run of text — a direct flex child loses
 * the vertical-align that centers it.
 */
export function Lozenge({ hollow = false, title }: typeof LozengeProps.Type) {
  return (
    <svg
      width="0.74em"
      height="0.74em"
      viewBox="0 0 10 10"
      role={title === undefined ? undefined : "img"}
      aria-hidden={title === undefined ? true : undefined}
      aria-label={title}
      style={{ display: "inline-block", verticalAlign: "-0.01em", flexShrink: 0 }}
    >
      {title !== undefined && <title>{title}</title>}
      <path
        d="M5 0.7 L9.3 5 L5 9.3 L0.7 5 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      {!hollow && <path d="M5 3 L7 5 L5 7 L3 5 Z" fill="currentColor" />}
    </svg>
  )
}
