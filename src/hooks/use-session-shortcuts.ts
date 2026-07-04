import { useEffect } from "react"

interface SessionShortcutsOptions {
  onClearPool: () => void
  onToggleLeft?: () => void
  onToggleRight: () => void
}

/**
 * Session-page keyboard shortcuts: `[` toggles the video rail, `]` the right
 * rail, Escape clears the dice pool. Rail toggles are suppressed while typing
 * (tab switching returns when the center grows tabs again).
 */
export function useSessionShortcuts({
  onClearPool,
  onToggleLeft,
  onToggleRight,
}: SessionShortcutsOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"

      if (!isTyping && e.key === "[" && onToggleLeft) {
        onToggleLeft()
        return
      }
      if (!isTyping && e.key === "]") {
        onToggleRight()
        return
      }

      // Escape — clear dice pool (works everywhere)
      if (e.key === "Escape") {
        onClearPool()
      }
    }

    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClearPool, onToggleLeft, onToggleRight])
}
