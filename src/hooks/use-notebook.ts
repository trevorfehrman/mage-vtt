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
  /** The page under the hand, read without re-running the hydration. */
  const open = useRef(0)
  open.current = history?.present.open ?? 0

  // the reading arrives: the hand's book is hydrated once; a reader's is replaced each time
  useEffect(() => {
    if (raw === undefined) return
    if (editable && written.current !== undefined) return
    const book: Book = { ...bookFrom(raw.pages, raw.mark), open: open.current }
    written.current = book
    setHistory(emptyHistory(book))
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
      writePage({ sessionId, characterId, page: i, ...rowOf(page) }).catch(() => {
        // the write failed: the page is owed again at the next commit point
        written.current =
          written.current === undefined
            ? undefined
            : { ...written.current, pages: written.current.pages.map((p, k) => (k === i ? (before.pages[k] ?? p) : p)) }
      })
    })
    if (present.mark !== before.mark) {
      setMark({ sessionId, characterId, mark: present.mark }).catch(() => {
        written.current = written.current === undefined ? undefined : { ...written.current, mark: before.mark }
      })
    }
  }, [present, editable, sessionId, characterId, writePage, setMark])

  return { history, setHistory }
}

/** The page's columns as the mutation takes them: fresh arrays, since the domain's are read-only. */
const rowOf = (page: Page) => ({
  notes: page.notes.map((n) => ({ ...n })),
  ink: page.ink.map((s) => ({ ...s, points: [...s.points] })),
  shapes: page.shapes.map((s) => ({ ...s })),
  order: [...page.order],
})
