import { useEffect } from "react"
import type { PanelImperativeHandle } from "react-resizable-panels"

export function usePanelShortcuts(
  leftPanelRef: React.RefObject<PanelImperativeHandle | null>,
  rightPanelRef: React.RefObject<PanelImperativeHandle | null>,
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      if (e.key === "[") {
        const panel = leftPanelRef.current
        if (!panel) return
        if (panel.isCollapsed()) {
          panel.expand()
        } else {
          panel.collapse()
        }
      }

      if (e.key === "]") {
        const panel = rightPanelRef.current
        if (!panel) return
        if (panel.isCollapsed()) {
          panel.expand()
        } else {
          panel.collapse()
        }
      }
    }

    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [leftPanelRef, rightPanelRef])
}
