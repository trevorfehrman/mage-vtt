import { useEffect, useRef, useState } from "react"
import type { ActivityEntry } from "#/domain/activity"
import { NOTHING_UNREAD, newestMessageAt, unreadFor, type Unread } from "#/domain/working-slot"

export type SlotMode = "dice" | "message"

/**
 * The working slot's state (MAG-53): which instrument shows, who the next
 * line is whispered to, and what arrived while the tray showed. Flipping to
 * the message box puts the caret in it; Enter outside any field does the
 * same; choosing someone to whisper (a video tile) flips to it too.
 */
export function useWorkingSlot(entries: ReadonlyArray<ActivityEntry> | undefined, viewerId: string) {
  const [mode, setModeRaw] = useState<SlotMode>("dice")
  const [targets, setTargets] = useState<ReadonlyArray<string>>([])
  const [seenThrough, setSeenThrough] = useState<number | null>(null)
  const [focusTick, setFocusTick] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const newest = entries === undefined ? null : newestMessageAt(entries)
  // Seen: everything already there when the feed first lands, and
  // everything that arrives while the message box shows.
  useEffect(() => {
    if (newest !== null && (seenThrough === null || mode === "message")) setSeenThrough(newest)
  }, [newest, mode, seenThrough])

  // the caret follows every flip to the message box, once it's shown
  useEffect(() => {
    if (focusTick > 0) inputRef.current?.focus()
  }, [focusTick])

  const setMode = (next: SlotMode) => {
    setModeRaw(next)
    if (next === "message") setFocusTick((t) => t + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.defaultPrevented) return
      if (e.target !== document.body) return
      e.preventDefault()
      setMode("message")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const unread: Unread =
    mode === "message" || entries === undefined || seenThrough === null
      ? NOTHING_UNREAD
      : unreadFor(entries, viewerId, seenThrough)

  return {
    mode,
    setMode,
    unread,
    targets,
    inputRef,
    /** a tile or a chip: add or drop them, and open the message box */
    toggleTarget: (id: string) => {
      setTargets((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
      setMode("message")
    },
    clearTargets: () => setTargets([]),
  }
}
