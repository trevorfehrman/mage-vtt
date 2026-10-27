import { Schema } from "effect"
import type { BoxSeverity } from "#/domain/damage"

/** One glyph per health box severity — shared with the hand-edit panel. */
const HEALTH_BOX_GLYPHS: Record<BoxSeverity, string> = {
  empty: "",
  bashing: "╱",
  lethal: "✕",
  aggravated: "✳",
}
export const healthBoxGlyph = (severity: BoxSeverity): string =>
  HEALTH_BOX_GLYPHS[severity]

/**
 * The dot beneath a health box — Resistant damage (issue #41), the wound
 * Awakened magic can't heal. The slot always renders so the track's boxes
 * don't shift when a dot appears; shared with the hand-edit panel.
 */
const ResistantDotProps = Schema.Struct({
  resistant: Schema.Boolean,
  /** The dot may be marked here (MAG-63): an empty slot shows a faint ring
   * so there is visibly something to click. */
  markable: Schema.optionalKey(Schema.Boolean),
})

export function ResistantDot({ resistant, markable = false }: typeof ResistantDotProps.Type) {
  return (
    <span
      className="size-[5px] rounded-full"
      title={resistant ? "Resistant — heals only naturally" : undefined}
      style={{
        background: resistant ? "var(--accent)" : "transparent",
        boxShadow: !resistant && markable ? "inset 0 0 0 1px var(--dim)" : undefined,
      }}
    />
  )
}
