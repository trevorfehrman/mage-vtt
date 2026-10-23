import type { ReactNode } from "react"

/**
 * Where a Cast card stands outside the feed (MAG-46): the caster's and the
 * Storyteller's roll zone, and the pinned slot above every other seat's
 * tray. One frame for all three, so the rig and the session can't drift.
 */
export function CastMount({ children }: { children: ReactNode }) {
  return (
    <div className="border-t p-2" style={{ borderColor: "var(--line)" }}>
      {children}
    </div>
  )
}
