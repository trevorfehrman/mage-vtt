import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { bookFrom, changedPages, emptyHistory, type Book, type History, type Page } from "#/domain/notebook"

/**
 * The notebook's store (MAG-75, ADR-0027): local-first, written at commit
 * points, undo in the hand. The query hands over the written pages and the
 * ribbon's mark; the hook builds the Book and, for the hand that writes,
 * hydrates its history ONCE — from then on local history is the truth and
 * every change of `present` is diffed page by page against what was last
 * written, the changed pages going whole to `writePage` and a moved ribbon
 * to `setMark`. A reader (another member's notebook) has no history to
 * keep, so it follows the server: every new reading replaces the book, the
 * page under the hand kept.
 *
 * Two hands may write one notebook (the player and the Storyteller driving
 * their sheet). A later reading that differs from what this hand last
 * wrote is another hand's: its pages are taken into the present — only the
 * pages this hand has not touched since, so nothing in flight is lost — and
 * the baseline moves with them, so they are not written back.
 *
 * `history` is undefined until the first reading arrives. Mount it keyed by
 * the character, so a sheet swap starts the hydration over.
 */
export function useNotebook(
  sessionId: Id<"sessions">,
  characterId: Id<"characters">,
  editable: boolean,
): { history: History | undefined; setHistory: Dispatch<SetStateAction<History | undefined>> } {
  const raw = useQuery(api.notebook.get, { sessionId, characterId })
  const writePage = useMutation(api.notebook.writePage)
  const setMark = useMutation(api.notebook.setMark)
  const [history, setHistory] = useState<History | undefined>(undefined)
  /** The book as the server last had it from this hand: the baseline every commit point is diffed against. */
  const written = useRef<Book | undefined>(undefined)
  /** The history as last rendered, for the reading's effect to merge into without re-running on every edit. */
  const latest = useRef<History | undefined>(undefined)
  useEffect(() => {
    latest.current = history
  }, [history])

  // the reading arrives: the hand's book is hydrated once, then another hand's pages are taken in; a reader's is replaced each time
  useEffect(() => {
    if (raw === undefined) return
    const server = bookFrom(raw.pages, raw.mark)
    const open = latest.current?.present.open ?? 0
    const base = written.current
    const have = latest.current
    if (!editable || base === undefined || have === undefined) {
      const book: Book = { ...server, open }
      written.current = book
      setHistory(emptyHistory(book))
      return
    }
    // another hand's pages: those that differ from this hand's baseline, where this hand has not written since
    const pages = have.present.pages.map((p, i) => (p === base.pages[i] && !samePage(base.pages[i], server.pages[i]) ? server.pages[i]! : p))
    const mark = have.present.mark === base.mark && base.mark !== server.mark ? server.mark : have.present.mark
    const changed = pages.some((p, i) => p !== have.present.pages[i]) || mark !== have.present.mark
    if (!changed) return
    const present: Book = { ...have.present, pages, mark }
    written.current = { ...base, pages: base.pages.map((p, i) => (pages[i] === server.pages[i] ? server.pages[i]! : p)), mark: mark === server.mark ? server.mark : base.mark }
    setHistory({ ...have, present })
  }, [raw, editable])

  // a commit point (or a raise, or the ribbon): what changed goes to the server, nothing else travels
  const present = history?.present
  useEffect(() => {
    if (!editable || present === undefined) return
    const before = written.current
    if (before === undefined || before === present) return
    written.current = present
    const pages = changedPages(before, present)
    pages.forEach((i) => {
      const page = present.pages[i]
      if (page === undefined) return
      writePage({ sessionId, characterId, page: i, ...rowOf(page) }).catch((error: unknown) => {
        // the write failed: the page is owed again at the next commit point
        console.error("notebook: a page did not reach the server; it is owed again at the next edit", error)
        written.current =
          written.current === undefined
            ? undefined
            : { ...written.current, pages: written.current.pages.map((p, k) => (k === i ? (before.pages[k] ?? p) : p)) }
      })
    })
    if (present.mark !== before.mark) {
      setMark({ sessionId, characterId, mark: present.mark }).catch((error: unknown) => {
        console.error("notebook: the ribbon did not reach the server; it is owed again at the next move", error)
        written.current = written.current === undefined ? undefined : { ...written.current, mark: before.mark }
      })
    }
  }, [present, editable, sessionId, characterId, writePage, setMark])

  return { history, setHistory }
}

/** Whether two pages hold the same things: the stored shape is plain data, so its JSON says. */
const samePage = (a: Page | undefined, b: Page | undefined): boolean => JSON.stringify(a) === JSON.stringify(b)

/** The page's columns as the mutation takes them: fresh arrays, since the domain's are read-only. */
const rowOf = (page: Page) => ({
  notes: page.notes.map((n) => ({ ...n })),
  ink: page.ink.map((s) => ({ ...s, points: [...s.points] })),
  shapes: page.shapes.map((s) => ({ ...s })),
  order: [...page.order],
})
