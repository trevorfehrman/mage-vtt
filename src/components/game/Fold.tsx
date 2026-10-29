import type { ReactNode } from "react"

/** The sheet's one fold curve (MAG-60, then MAG-64: "the derrangments animation feels much smoother"). */
export const FOLD_CURVE = "420ms cubic-bezier(0.2, 0.8, 0.2, 1)"

/**
 * Height animated open and shut, the grid-rows way: the content stays
 * mounted and clips, so the shrink animates over the same words and nothing
 * snaps when the fold starts or ends. Shared by the Derangements accordion
 * and the Legacy plate so the two folds feel the same.
 */
export function Fold({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className="grid"
      style={{ gridTemplateRows: open ? "1fr" : "0fr", transition: `grid-template-rows ${FOLD_CURVE}` }}
      aria-hidden={!open}
    >
      <div style={{ overflow: "hidden", minHeight: 0, opacity: open ? 1 : 0, transition: `opacity ${FOLD_CURVE}` }}>
        {children}
      </div>
    </div>
  )
}
