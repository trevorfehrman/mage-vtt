import { useEffect } from "react"

interface SessionShortcutsOptions {
  onClearPool: () => void
  onToggleRight: () => void
}

/**
 * Session-page keyboard shortcuts for the reduced grid: `]` toggles the right
 * rail, Escape clears the dice pool. (`[` returns with the video rail; tab
 * switching returns when the center grows tabs again.)
 */
export function useSessionShortcuts({
  onClearPool,
  onToggleRight,
}: SessionShortcutsOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"

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
  }, [onClearPool, onToggleRight])
}
