import { useEffect, useRef, useState } from "react"
import type { ActivityEntry } from "#/domain/activity"
import { NOTHING_UNREAD, newestMessageAt, unreadFor, type SlotMode, type Unread } from "#/domain/working-slot"

/**
 * The working slot's state (MAG-53): which instrument shows, who the next
 * line is whispered to, and what arrived while the tray showed. Flipping to
 * the message box puts the caret in it; Enter outside any field does the
 * same; choosing someone to whisper (a video tile) flips to it too — with
 * the caret only for a pointer, so a keyboard can go on choosing tiles.
 * Escape hands focus back to the switch. A change of reader (the Second
 * Seat) starts the slot's memory over: what was seen, and who was chosen.
 */
export function useWorkingSlot(entries: ReadonlyArray<ActivityEntry> | undefined, viewerId: string) {
  const [mode, setModeRaw] = useState<SlotMode>("dice")
  const [targets, setTargets] = useState<ReadonlyArray<string>>([])
  const [seenThrough, setSeenThrough] = useState<number | null>(null)
  const [focusTick, setFocusTick] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const switchRef = useRef<HTMLButtonElement | null>(null)

  const reader = useRef(viewerId)
  useEffect(() => {
    if (reader.current === viewerId) return
    reader.current = viewerId
    setSeenThrough(null)
    setTargets([])
  }, [viewerId])

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

  const setMode = (next: SlotMode, caret = true) => {
    setModeRaw(next)
    if (next === "message" && caret) setFocusTick((t) => t + 1)
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
    switchRef,
    /** a tile or a chip: add or drop them, and open the message box — the
     * caret follows only when asked (a pointer on a tile) */
    toggleTarget: (id: string, caret = false) => {
      setTargets((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
      setMode("message", caret)
    },
    clearTargets: () => setTargets([]),
    /** Escape in the message line: back to the tray, focus to the switch */
    escape: () => {
      setMode("dice")
      switchRef.current?.focus()
    },
  }
}
