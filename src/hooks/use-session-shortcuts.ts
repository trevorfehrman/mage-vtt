import { useEffect } from "react"
import type { PanelImperativeHandle } from "react-resizable-panels"

interface SessionShortcutsOptions {
  leftPanelRef: React.RefObject<PanelImperativeHandle | null>
  rightPanelRef: React.RefObject<PanelImperativeHandle | null>
  onTabChange: (tab: string) => void
  onClearPool: () => void
  onToggleLeft?: () => void
  onToggleRight?: () => void
}

export function useSessionShortcuts({
  leftPanelRef,
  rightPanelRef,
  onTabChange,
  onClearPool,
  onToggleLeft,
  onToggleRight,
}: SessionShortcutsOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const isTyping =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"

      // Panel toggles — only when not typing
      if (!isTyping) {
        if (e.key === "[") {
          if (onToggleLeft) {
            onToggleLeft()
          } else {
            togglePanel(leftPanelRef)
          }
          return
        }
        if (e.key === "]") {
          if (onToggleRight) {
            onToggleRight()
          } else {
            togglePanel(rightPanelRef)
          }
          return
        }
      }

      const mod = e.metaKey || e.ctrlKey

      // Tab switching — Mod+1/2 (blocked while typing)
      if (mod && !isTyping) {
        if (e.key === "1") {
          e.preventDefault()
          onTabChange("map")
          return
        }
        if (e.key === "2") {
          e.preventDefault()
          onTabChange("sheet")
          return
        }
      }

      // Escape — clear dice pool (works everywhere)
      if (e.key === "Escape") {
        onClearPool()
      }
    }

    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [leftPanelRef, rightPanelRef, onTabChange, onClearPool, onToggleLeft, onToggleRight])
}

function togglePanel(ref: React.RefObject<PanelImperativeHandle | null>) {
  const panel = ref.current
  if (!panel) return
  if (panel.isCollapsed()) {
    panel.expand()
  } else {
    panel.collapse()
  }
}
