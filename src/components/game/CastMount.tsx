import type { ReactNode } from "react"

/**
 * Where a live Cast stands in the live zone (MAG-48), on every seat. One
 * frame for every mount, so the rig and the session can't drift; stacked
 * casts are parted by one line.
 */
export function CastMount({ children }: { children: ReactNode }) {
  return (
    <div className="border-t first:border-t-0" style={{ borderColor: "var(--line)" }}>
      {children}
    </div>
  )
}
