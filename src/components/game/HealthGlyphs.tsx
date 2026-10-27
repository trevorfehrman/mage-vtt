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
export function ResistantDot({ resistant, slot = false }: { resistant: boolean; slot?: boolean }) {
  return (
    <span
      className="size-[5px] rounded-full"
      title={resistant ? "Resistant — heals only naturally" : undefined}
      style={{
        background: resistant ? "var(--accent)" : "transparent",
        // the slot (MAG-63): a faint ring under a wounded box on a markable
        // track, so there is visibly something to click
        boxShadow: !resistant && slot ? "inset 0 0 0 1px var(--dim)" : undefined,
      }}
    />
  )
}
