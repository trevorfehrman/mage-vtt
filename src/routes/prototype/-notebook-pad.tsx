// PROTOTYPE — throwaway (MAG-75 audition, 2026-10-28/29). The mage's
// notebook drawn with react-konva: the page is a plain array of notes and ink
// (Schema, in -notebook-page.ts), Konva only renders it; every edit is a pure
// function over the page, and undo / redo is a history of pages. Client-only
// (Konva needs a window), so the route lazy-loads this file inside ClientOnly.
// No app imports; mock only.
//
// Round three (owner, 2026-10-29): "each note just needs three active areas,
// text value and symbol ... don't be afraid to redesign the note frame
// itself ... methodical, this is their second brain. quick, clear,
// revisable." So a note is a ledger row: a tinted spine on the left holding
// its symbol (click: the list of kinds opens beneath), the words beside it
// (click: write), and a square cell for the value at the right (click:
// write); the symbol opens its list in every tool. A double-click on bare
// page writes a note. Strokes pick, sweep and move like notes; groups move as
// one.
// Round five: "what if a user wants to take a very long note ... let them
// resize the note and then add a clear scroll container ... fade ... to make
// it clear there's more to read ... resizing by drag should be a thing. the
// increments should be smooth but still snap to the dots." A picked row
// shows a grip at its corner; the grip follows the hand smoothly and the row
// snaps to whole cells on release. A row a hand has sized keeps its size and
// its words scroll inside it, fading at the foot while there is more.
// The pagination round (owner, 2026-10-29): "this is a notebook with its
// half folded around behind it ... like the keyring ... feel. velocity ...
// the user must feel that they can quickly thumb through their notebook
// even if just for fun but arrive on the page they want quickly as well."
// The book's position is one continuous motion value, in pages: a drag on
// either page edge turns it under the hand and coasts to land on a whole
// page; a sideways swipe drives it directly and it snaps when quiet; the
// arrow keys step it. The page lifting off is a quiet copy of the page in
// its own layer, slid by that value every frame with no React in between;
// the page beneath is the live one. The stacked page edges on each side are
// the handles — and hang outside the sheet's column, as a notebook's tabs do.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FocusEvent as RFocusEvent, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from "react"
import { Match, Option } from "effect"
import { Group, Layer, Line, Path, Rect, Stage, Text } from "react-konva"
import Konva from "konva"
import { getStroke } from "perfect-freehand"
import { animate, useMotionValue, useMotionValueEvent } from "motion/react"
import {
  addInk,
  CELL,
  commit,
  duplicateNotes,
  editOpen,
  GRID,
  GRID_TICK_EVERY,
  KINDS,
  kindLook,
  lastIndex,
  MAX_LINES,
  MIN_H,
  MIN_W,
  moveMany,
  NOTE_H,
  ORIGIN,
  pageAt,
  placeAt,
  raise,
  redo,
  rekind,
  removeMany,
  resize,
  retitle,
  revalue,
  snapPoint,
  SPINE_W,
  swept,
  takesValue,
  toggleGroup,
  turnTo,
  undo,
  withGroups,
  within,
  type Book,
  type Box,
  type History,
  type Ink,
  type Move,
  type Note,
  type NoteKind,
  type Page,
  type Shift,
  type Tool,
} from "./-notebook-page"

/** The note being written, and the words as they stand mid-edit, so the row grows while the hand is still moving. */
type Editing = { readonly id: string; readonly focus: "title" | "number"; readonly draft: string }
/** A drag in flight: everything moving, and where each node began. */
type Drag = { readonly ids: ReadonlyArray<string>; readonly origin: Record<string, { x: number; y: number }> }
/** A resize in flight: the row and the size under the hand, before it snaps. */
type Resizing = { readonly id: string; readonly w: number; readonly h: number }

/** The ruling knob the route hands down. */
export type Rule = "dots" | "lines" | "none"

/** The pen's character (perfect-freehand): a nib that thins with speed or pressure, smoothed, tapered at both ends. */
const PEN = { size: 5, thinning: 0.65, smoothing: 0.55, streamline: 0.5, start: { taper: 24 }, end: { taper: 32 } }

const INK = "#d7d2e0"
const DIM = "#807b8f"
const ACCENT = "#6fae97"
/** The page: the panel's own color, so a lifting page covers the one beneath. */
const PANEL = "#0e0d13"
/** The stacked page edges beside the page: how far they reach, and how many show before they compress. */
const EDGE_W = 22
const EDGE_SHOWN = 12
/** The plate: a hair above the panel. */
const PLATE = "#121118"
const HAND = 18
const LEAD = 1.1
const PAD = 10
/** Where the words hang from; the symbol and the value's cell center on the first line of them. */
const WORDS_TOP = 14
const LINE_MID = WORDS_TOP + (HAND * LEAD) / 2
const CELL_TOP = LINE_MID - CELL / 2
/** A row's height for its lines: what the words need plus the gutter, rounded up to whole cells, never under two. */
const rowHeight = (lines: number, gap: number): number => Math.max(NOTE_H, Math.ceil((WORDS_TOP + lines * HAND * LEAD + 6 + gap * 2) / GRID) * GRID)
/** The grip's reach from the row's corner, and the fade's depth at a scrolling row's foot. */
const GRIP = 10
const FADE = 28

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/** The stroke's outline as Konva's flat point list, from the triples the page stores. */
const outlineOf = (ink: Ink, live: boolean): number[] => {
  const triples: Array<[number, number, number]> = []
  for (let i = 0; i + 2 < ink.points.length; i += 3) triples.push([ink.points[i]!, ink.points[i + 1]!, ink.points[i + 2]!])
  return getStroke(triples, { ...PEN, simulatePressure: !ink.pressured, last: !live }).flat()
}

/**
 * The ruling as a repeating tile drawn once: a dot at every lattice point,
 * a hairline cross at every fourth — the lattice's own sigil. Drawn at 2×
 * and scaled down so the dots stay crisp on a dense display.
 */
const rulingTile = (rule: Rule): HTMLCanvasElement | null => {
  if (rule === "none") return null
  const span = GRID * GRID_TICK_EVERY
  const c = document.createElement("canvas")
  c.width = span * 2
  c.height = span * 2
  const g = c.getContext("2d")
  if (g === null) return null
  g.scale(2, 2)
  g.fillStyle = INK
  g.strokeStyle = INK
  if (rule === "lines") {
    g.globalAlpha = 0.045
    g.lineWidth = 1
    for (let j = 0; j < GRID_TICK_EVERY; j++) {
      g.beginPath()
      g.moveTo(0, j * GRID + 0.5)
      g.lineTo(span, j * GRID + 0.5)
      g.stroke()
    }
    return c
  }
  for (let i = 0; i < GRID_TICK_EVERY; i++) {
    for (let j = 0; j < GRID_TICK_EVERY; j++) {
      const x = i * GRID
      const y = j * GRID
      if (i === 0 && j === 0) {
        g.globalAlpha = 0.16
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(x - 3, y + 0.5)
        g.lineTo(x + 4, y + 0.5)
        g.moveTo(x + 0.5, y - 3)
        g.lineTo(x + 0.5, y + 4)
        g.stroke()
      } else {
        g.globalAlpha = 0.13
        g.beginPath()
        g.arc(x + 0.5, y + 0.5, 0.9, 0, Math.PI * 2)
        g.fill()
      }
    }
  }
  return c
}

/** The Golden Key — Obrimos' Path glyph (the app's ArcanaGlyph motif, 24-box) as path data Konva can draw. */
const OBRIMOS = [
  "M8.8 6.8 A3.2 3.2 0 1 0 15.2 6.8 A3.2 3.2 0 1 0 8.8 6.8 Z",
  "M12 10 V20 M12 20 L15.8 20 M12 16.6 H14.4",
  "M12 20 L10.9 21.6",
]
const OBRIMOS_BINDI = "M11 6.8 A1 1 0 1 0 13 6.8 A1 1 0 1 0 11 6.8 Z"

// --- The row's measure ---

/**
 * The words' column: inside the gutter, after the spine, before the value's
 * cell when there is one. `w` is the row's width on the lattice; the plate
 * is drawn `gap` px inside it on every side, so rows on neighboring cells
 * keep a margin between them (owner, 2026-10-29: "snapping just a few
 * pixels inside the dots? this way every note next to each other have
 * margin").
 */
const titleWidth = (kind: NoteKind, w: number, gap: number): number => w - gap * 2 - SPINE_W - PAD * 2 - (takesValue(kind) ? CELL + PAD : 0)
/** Konva measures text as it draws, so one offstage Text measures how many lines a title takes at a width. */
const measurer = new Konva.Text({ fontSize: HAND, lineHeight: LEAD, wrap: "word" })
const linesOf = (title: string, width: number, font: string): number => {
  if (title === "") return 1
  measurer.setAttrs({ text: title, width, fontFamily: font })
  return Math.max(1, Math.round(measurer.height() / (HAND * LEAD)))
}

export function NotebookPad({
  font,
  tool,
  inkColor,
  rule,
  gap,
  picked,
  onPicked,
  history,
  onHistory,
  width,
  height,
}: {
  font: string
  tool: Tool
  inkColor: string
  rule: Rule
  /** The gutter: px the plate is drawn inside its lattice box, on every side. */
  gap: number
  picked: ReadonlyArray<string>
  onPicked: (ids: ReadonlyArray<string>) => void
  history: History<Book>
  onHistory: (h: History<Book>) => void
  width: number
  height: number
}) {
  const book = history.present
  const last = lastIndex(book)
  /** The book's position, in pages: whole at rest, fractional while a page is lifting. */
  const pos = useMotionValue(book.open)
  /** What is in view: page i at rest, or page i lifting off page i+1. Changes only at the crossings. */
  const [view, setView] = useState<{ i: number; lifted: boolean }>({ i: book.open, lifted: false })
  /** The page under the hand: the one beneath while another lifts. */
  const liveIndex = view.lifted ? view.i + 1 : view.i
  const page = pageAt(book, liveIndex)
  const [editing, setEditing] = useState<Option.Option<Editing>>(Option.none())
  /** The note whose list of kinds is open beneath it. */
  const [menu, setMenu] = useState<Option.Option<string>>(Option.none())
  const [stroke, setStroke] = useState<Option.Option<Ink>>(Option.none())
  const [sweep, setSweep] = useState<Option.Option<Box>>(Option.none())
  const [resizing, setResizing] = useState<Option.Option<Resizing>>(Option.none())
  /** How far each sized row's words are scrolled; the page does not remember this. */
  const [scroll, setScroll] = useState<Record<string, number>>({})
  const [fontsReady, setFontsReady] = useState(0)
  const stamped = useRef(0)
  const stageRef = useRef<Konva.Stage>(null)
  const padRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const valueRef = useRef<HTMLInputElement>(null)
  const drag = useRef<Option.Option<Drag>>(Option.none())
  /** When the editor last closed, or a sweep last ended: the click that did it must not write or clear a pick. */
  const settledAt = useRef(0)
  const topRef = useRef<Konva.Layer>(null)
  /** A page turned to is already written: its rows must not drift in as if just placed. */
  const skipArrive = useRef(false)
  const prevLive = useRef(liveIndex)
  if (prevLive.current !== liveIndex) {
    skipArrive.current = true
    prevLive.current = liveIndex
  }
  useLayoutEffect(() => {
    skipArrive.current = false
  })

  const tile = useMemo(() => rulingTile(rule), [rule])

  // Konva measures text at draw time, so the layer redraws once the hand is loaded.
  useEffect(() => {
    let live = true
    void document.fonts.load(`${HAND}px "${font}"`).then(() => {
      if (live) setFontsReady((n) => n + 1)
    })
    return () => {
      live = false
    }
  }, [font])

  const set = (next: Page) => onHistory(commit(history, editOpen(book, () => next)))
  /** A change the history need not remember (the draw order). */
  const replace = (next: Page) => {
    if (next !== page) onHistory({ ...history, present: editOpen(book, () => next) })
  }
  const noteById = (id: string): Option.Option<Note> => Option.fromNullishOr(page.notes.find((n) => n.id === id))
  const pickedNotes = page.notes.filter((n) => picked.includes(n.id))
  const nodeOf = (id: string): Option.Option<Konva.Node> => Option.fromNullishOr(stageRef.current?.findOne(`#${id}`))

  // --- the row's measure, live: its words as drafted, its size as the hand holds it ---

  /** The row's words: from the page, or from the draft while they are being written. */
  const wordsOf = (n: Note): string => Option.match(editing, { onNone: () => n.title, onSome: (ed) => (ed.id === n.id ? ed.draft : n.title) })
  /** The row's size: from the page, or under the hand while it is being resized. 0 height = as tall as its words. */
  const sizeOf = (n: Note): { w: number; h: number } =>
    Option.match(resizing, { onNone: () => ({ w: n.w, h: n.h }), onSome: (r) => (r.id === n.id ? { w: r.w, h: r.h } : { w: n.w, h: n.h }) })
  const linesAll = (n: Note): number => linesOf(wordsOf(n), titleWidth(n.kind, sizeOf(n).w, gap), font)
  /** The page's room for one row: its height less the margin at head and foot. */
  const room = height - ORIGIN * 2
  /**
   * The lines a row shows: all of them when a hand has sized it (they scroll)
   * or while it is being written (it grows), up to the cap when it sizes
   * itself at rest.
   */
  const linesIn = (n: Note): number =>
    sizeOf(n).h > 0 || Option.exists(editing, (ed) => ed.id === n.id) ? linesAll(n) : Math.min(MAX_LINES, linesAll(n))
  const heightOf = (n: Note): number => {
    const s = sizeOf(n)
    return s.h > 0 ? s.h : Math.min(rowHeight(linesIn(n), gap), room)
  }
  /** Where the row sits: its place on the page, nudged up live if its growth would hang it past the foot. */
  const seatOf = (n: Note): { x: number; y: number } => within({ x: n.x, y: n.y }, sizeOf(n).w, heightOf(n), width, height)

  const removePicked = () => {
    if (picked.length === 0) return
    set(removeMany(page, picked))
    onPicked([])
    setMenu(Option.none())
  }

  const onKey = (e: RKeyboardEvent<HTMLDivElement>) => {
    if (Option.isSome(editing)) return
    const meta = e.metaKey || e.ctrlKey
    const key = e.key.toLowerCase()
    if (meta && key === "z") {
      e.preventDefault()
      onHistory(e.shiftKey ? redo(history) : undo(history))
      return
    }
    if (meta && key === "d" && pickedNotes.length > 0) {
      e.preventDefault()
      set(duplicateNotes(page, picked))
      return
    }
    if (meta && key === "a") {
      e.preventDefault()
      onPicked([...page.notes.map((n) => n.id), ...page.ink.map((s) => s.id)])
      return
    }
    if (meta && key === "g" && picked.length > 1) {
      e.preventDefault()
      set(toggleGroup(page, picked))
      return
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault()
      removePicked()
      return
    }
    if (e.key === "Escape") {
      if (Option.isSome(menu)) setMenu(Option.none())
      else onPicked([])
    }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault()
      push(e.key === "ArrowRight" ? 1 : -1)
      return
    }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault()
      settle()
      chase(e.key === "Home" ? 0 : last)
      return
    }
    // 1–7 swap the picked notes' kind, in the list's order
    const digit = Number.parseInt(e.key, 10)
    if (pickedNotes.length > 0 && digit >= 1 && digit <= KINDS.length) {
      const kind = KINDS[digit - 1]
      if (kind !== undefined) set(rekind(page, picked, kind))
    }
  }

  // --- picking: a click takes one (and its group) and raises it, shift-click adds or removes, a sweep takes a region ---

  const pick = (id: string, shift: boolean) => {
    const ids = withGroups(page, [id])
    const allIn = ids.every((x) => picked.includes(x))
    if (shift) onPicked(allIn ? picked.filter((p) => !ids.includes(p)) : [...picked, ...ids.filter((x) => !picked.includes(x))])
    else if (!allIn) onPicked(ids)
    if (!shift) replace(raise(page, id))
    if (!Option.contains(menu, id)) setMenu(Option.none())
  }

  // --- the editor: the note's words and, when its kind takes one, its value ---

  const openEditor = (n: Note, focus: "title" | "number") => {
    onPicked([n.id])
    setMenu(Option.none())
    setEditing(Option.some({ id: n.id, focus, draft: n.title }))
  }
  /**
   * Close the editor: keep the words or abandon them. An empty plain note is
   * normally removed — unless the editor is closing because the row is about
   * to be dragged, when the note must stay to be dragged.
   */
  const closeEditor = (keep: boolean, preserveEmpty = false) =>
    Option.map(editing, (ed) => {
      settledAt.current = Date.now()
      Option.map(noteById(ed.id), (n) => {
        const title = keep ? (titleRef.current?.value ?? n.title) : n.title
        const number = keep ? (valueRef.current?.value ?? n.number) : n.number
        const emptyBlank = !preserveEmpty && title.trim() === "" && n.kind === "blank"
        // a row written past the cap keeps its height as a sized row, so nothing written is hidden without a
        // scroll; a row that grew past the page's foot is nudged up onto the lattice to fit
        const lines = linesOf(title.trim(), titleWidth(n.kind, n.w, gap), font)
        const grown = n.h > 0 ? n.h : lines > MAX_LINES ? Math.min(rowHeight(lines, gap), room) : rowHeight(lines, gap)
        const seat = within({ x: n.x, y: n.y }, n.w, grown, width, height)
        const titled = revalue(retitle(page, ed.id, title.trim()), ed.id, number.trim())
        const written = n.h === 0 && lines > MAX_LINES ? resize(titled, ed.id, n.w, grown) : titled
        set(emptyBlank ? removeMany(page, [ed.id]) : seat.y === n.y && seat.x === n.x ? written : moveMany(written, [{ id: ed.id, ...seat }], []))
        if (emptyBlank) onPicked([])
      })
      setEditing(Option.none())
      // the keys (1–7, ⌫, ⌘Z) must keep working once the editor is gone
      padRef.current?.focus({ preventScroll: true })
    })
  /** Focus leaving the editor altogether commits it; moving between its two fields does not. */
  const onEditorBlur = (e: RFocusEvent<HTMLElement>) => {
    const to = e.relatedTarget
    if (to instanceof Node && editorRef.current?.contains(to)) return
    closeEditor(true)
  }
  const onEditorKey = (e: RKeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      closeEditor(true)
    }
    // Escape shuts an open list first, and only then abandons the edit
    if (e.key === "Escape") {
      if (Option.isSome(menu)) setMenu(Option.none())
      else closeEditor(false)
    }
  }
  // a press inside the editor that travels becomes a drag of the note: the
  // edit commits, Konva is told where the pointer is, and the note's group
  // takes the drag from there (Konva follows the window's pointer thereafter).
  // The press is followed on the window, because the first move already
  // leaves the editor's small box and lands on the canvas.
  const onEditorPointerDown = (e: RPointerEvent<HTMLElement>) => {
    const from = { x: e.clientX, y: e.clientY }
    const ed = editing
    const stage = stageRef.current
    const stop = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", stop)
    }
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - from.x, ev.clientY - from.y) < 6) return
      stop()
      Option.map(ed, (open) => {
        closeEditor(true, true)
        if (stage === null) return
        stage.setPointersPositions(ev)
        Option.map(nodeOf(open.id), (node) => node.startDrag())
      })
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", stop)
  }

  const pointer = (): Option.Option<{ x: number; y: number }> =>
    Option.fromNullishOr(stageRef.current?.getPointerPosition())
  /** The pen's pressure when the device reports one; a mouse says 0.5 and we say so. */
  const pressureOf = (evt: Event): { p: number; real: boolean } =>
    evt instanceof PointerEvent && evt.pointerType === "pen" ? { p: evt.pressure, real: true } : { p: 0.5, real: false }

  // the pointer on the bare page, by tool: the pen begins a stroke, select
  // begins a sweep
  const onStageDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const onPage = e.target === e.target.getStage()
    Match.value(tool).pipe(
      Match.when("select", () => {
        if (onPage) Option.map(pointer(), (p) => setSweep(Option.some({ x: p.x, y: p.y, w: 0, h: 0 })))
      }),
      Match.when("pen", () => {
        Option.map(pointer(), (p) => {
          const pr = pressureOf(e.evt)
          setStroke(Option.some({ id: `i${Date.now().toString(36)}`, points: [p.x, p.y, pr.p], color: inkColor, pressured: pr.real, group: "" }))
        })
      }),
      Match.exhaustive,
    )
  }
  // a click on the bare page shuts the list and clears the pick; a
  // double-click writes a note there and opens it (the click waits for the
  // mouse to settle, because a mousedown's own default action would move
  // focus and blur an editor opened this early)
  const onStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target !== e.target.getStage()) return
    if (Date.now() - settledAt.current < 250) return
    setMenu(Option.none())
    onPicked([])
  }
  const onStageDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target !== e.target.getStage() || tool !== "select") return
    Option.map(pointer(), (p) => {
      stamped.current += 1
      const next = placeAt(page, p.x - 12, p.y - 12, stamped.current)
      set(next)
      const n = next.notes[next.notes.length - 1]
      if (n) openEditor(n, "title")
    })
  }
  const onStageMove = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (tool !== "pen" || Option.isNone(stroke)) return
    Option.map(pointer(), (p) => {
      const pr = pressureOf(e.evt)
      setStroke(Option.some({ ...stroke.value, points: [...stroke.value.points, p.x, p.y, pr.p], pressured: stroke.value.pressured || pr.real }))
    })
  }
  const onStageUp = () => {
    if (Option.isNone(stroke)) return
    if (stroke.value.points.length >= 6) set(addInk(page, stroke.value))
    setStroke(Option.none())
  }

  // a sweep follows the pointer on the window, not the stage: a hand that
  // overshoots the page's edge is still sweeping
  useEffect(() => {
    if (Option.isNone(sweep)) return
    const stage = stageRef.current
    if (stage === null) return
    const s = sweep.value
    const rect = stage.container().getBoundingClientRect()
    const at = (e: PointerEvent) => ({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    const move = (e: PointerEvent) => {
      const p = at(e)
      setSweep(Option.some({ ...s, w: p.x - s.x, h: p.y - s.y }))
    }
    const up = (e: PointerEvent) => {
      const p = at(e)
      const box = { ...s, w: p.x - s.x, h: p.y - s.y }
      setSweep(Option.none())
      if (Math.abs(box.w) < 4 && Math.abs(box.h) < 4) return
      settledAt.current = Date.now()
      const taken = swept(page, box, heightOf)
      onPicked(e.shiftKey ? [...picked, ...taken.filter((id) => !picked.includes(id))] : taken)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
  })

  // --- moving: the dragged thing carries everything picked with it; notes settle on the lattice, strokes keep their shape ---

  const onDragStart = (id: string) => {
    // a row dragged by its symbol while its editor is open takes its words with it and leaves no overlay behind
    Option.map(editing, (ed) => {
      if (ed.id === id) closeEditor(true, true)
    })
    const ids = picked.includes(id) ? picked : withGroups(page, [id])
    const origin: Record<string, { x: number; y: number }> = {}
    for (const x of ids) Option.map(nodeOf(x), (node) => (origin[x] = node.position()))
    drag.current = Option.some({ ids, origin })
    setMenu(Option.none())
  }
  const onDragMove = (id: string, node: Konva.Node) =>
    Option.map(drag.current, (d) => {
      const from = d.origin[id]
      if (from === undefined) return
      const dx = node.x() - from.x
      const dy = node.y() - from.y
      for (const other of d.ids) {
        const o = d.origin[other]
        if (other !== id && o !== undefined) Option.map(nodeOf(other), (n) => n.position({ x: o.x + dx, y: o.y + dy }))
      }
    })
  const onDragEnd = (id: string, node: Konva.Node) => {
    const d = Option.getOrElse(drag.current, (): Drag => ({ ids: [id], origin: { [id]: { x: 0, y: 0 } } }))
    drag.current = Option.none()
    const from = d.origin[id] ?? { x: 0, y: 0 }
    const dx = node.x() - from.x
    const dy = node.y() - from.y
    const moves: Move[] = []
    const shifts: Shift[] = []
    let landing = 0
    const land = () => {
      // a stroke's points take the shift and its node goes back to rest, in the same tick, so it never draws twice over
      for (const s of shifts) Option.map(nodeOf(s.id), (n) => n.position({ x: 0, y: 0 }))
      set(moveMany(page, moves, shifts))
    }
    for (const x of d.ids) {
      const note = page.notes.find((n) => n.id === x)
      if (note === undefined) {
        shifts.push({ id: x, dx, dy })
        continue
      }
      Option.map(x === id ? Option.some(node) : nodeOf(x), (target) => {
        const p = within(snapPoint(target.x(), target.y()), note.w, heightOf(note), width, height)
        moves.push({ id: x, x: p.x, y: p.y })
        landing += 1
        target.to({
          x: p.x,
          y: p.y,
          duration: 0.16,
          easing: Konva.Easings.EaseOut,
          onFinish: () => {
            landing -= 1
            if (landing === 0) land()
          },
        })
      })
    }
    if (landing === 0) land()
  }
  /**
   * A note that has just appeared lands: a short drift down onto its place.
   * The drift rides on the node's offset, never its position — position is
   * React's, and a tween that wrote it back late would pin the note where it
   * first appeared (a row nudged up from the foot while it was being written
   * stayed put, 2026-10-29).
   */
  const arrive = (node: Konva.Group | null) => {
    if (node === null || node.getAttr("landed") === true) return
    node.setAttr("landed", true)
    if (skipArrive.current) return
    node.opacity(0)
    node.offsetY(5)
    node.to({ opacity: 1, offsetY: 0, duration: 0.18, easing: Konva.Easings.EaseOut })
  }

  // --- resizing: the grip follows the hand; the row snaps to whole cells when the hand lets go ---

  /** The grip's drag events must not reach the row, whose own drag handlers would read the grip as a move. */
  const grip = (n: Note, seat: { x: number; y: number }) => ({
    dragBoundFunc: (pos: { x: number; y: number }) => ({
      x: clamp(pos.x, seat.x + MIN_W - GRIP, width - ORIGIN - GRIP),
      y: clamp(pos.y, seat.y + MIN_H - GRIP, height - ORIGIN - GRIP),
    }),
    onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true
    },
    onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true
      setMenu(Option.none())
      setResizing(Option.some({ id: n.id, w: n.w, h: heightOf(n) }))
    },
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true
      setResizing(Option.some({ id: n.id, w: e.target.x() + GRIP + gap * 2, h: e.target.y() + GRIP + gap * 2 }))
    },
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true
      const w = clamp(Math.round((e.target.x() + GRIP + gap * 2) / GRID) * GRID, MIN_W, width - ORIGIN - seat.x)
      const h = clamp(Math.round((e.target.y() + GRIP + gap * 2) / GRID) * GRID, MIN_H, height - ORIGIN - seat.y)
      // the grip rides back to the snapped corner itself: its props may not change if the size did not
      e.target.to({ x: w - gap * 2 - GRIP, y: h - gap * 2 - GRIP, duration: 0.12, easing: Konva.Easings.EaseOut })
      setResizing(Option.none())
      set(resize(page, n.id, w, h))
    },
  })

  // --- turning: one continuous position in pages; the lifting page rides it every frame, React only hears the crossings ---

  /** Whatever the hand had open on this page is put down before the page turns. */
  const settle = () => {
    closeEditor(true)
    setMenu(Option.none())
    if (picked.length > 0) onPicked([])
  }
  useMotionValueEvent(pos, "change", (p) => {
    const i = clamp(Math.floor(p), 0, last)
    const f = clamp(p - i, 0, 1)
    const lifted = f > 0.002 && i < last
    const top = topRef.current
    if (top !== null) {
      top.x(-f * width)
      top.batchDraw()
    }
    if (i !== view.i || lifted !== view.lifted) setView({ i, lifted })
    if (!lifted && i !== book.open) onHistory({ ...history, present: turnTo(book, i) })
  })
  // the lifting page's layer is new each lift: it takes its place from the position before its first frame
  useLayoutEffect(() => {
    const top = topRef.current
    if (top === null) return
    const p = pos.get()
    top.x(-(p - Math.floor(p)) * width)
    top.batchDraw()
  }, [view.lifted, view.i, pos, width])
  // the book opened elsewhere (undo, redo): the position follows
  useEffect(() => {
    if (Math.round(pos.get()) !== book.open && !edgeDrag.current) chase(book.open)
    // owed to the open page alone
  }, [book.open])

  /** Coast from a velocity (pages per second) and land exactly on a page. The nominal target is a page away, since animate() skips an inertia whose target is the current value. */
  const coast = (v: number) =>
    animate(pos, clamp(pos.get() + (v >= 0 ? 1 : -1), 0, last), {
      type: "inertia",
      velocity: v,
      power: 0.4,
      timeConstant: 200,
      modifyTarget: (t) => clamp(Math.round(t), 0, last),
      min: 0,
      max: last,
      restDelta: 0.002,
    })
  /** Chase a page on a spring: it stops dead on the page. */
  const chasing = useRef(false)
  const chase = (target: number) => {
    chasing.current = true
    animate(pos, clamp(target, 0, last), {
      type: "spring",
      stiffness: 260,
      damping: 30,
      mass: 0.9,
      onComplete: () => {
        chasing.current = false
      },
    })
  }
  const target = useRef(0)
  /** A step: quick steps move the target further and the book accelerates after it (a second press in the same instant counts, before the first has moved it). */
  const push = (by: number) => {
    settle()
    const resting = !chasing.current && Math.abs(pos.getVelocity()) < 0.05
    target.current = clamp((resting ? Math.round(pos.get()) : target.current) + by, 0, last)
    chase(target.current)
  }

  // a drag on either stack of page edges turns the book under the hand, then
  // coasts; a tap steps one page that way. The press is followed on the
  // window, as the sweep is: the strip is narrow and the first move has
  // already left it.
  const edgeDrag = useRef(false)
  const edge = (side: "left" | "right") => ({
    onPointerDown: (e: RPointerEvent<HTMLDivElement>) => {
      pos.stop()
      settle()
      padRef.current?.focus({ preventScroll: true })
      edgeDrag.current = true
      const from = pos.get()
      const x = e.clientX
      let moved = false
      const move = (ev: PointerEvent) => {
        const dx = x - ev.clientX
        if (!moved) {
          if (Math.abs(dx) <= 3) return
          moved = true
        }
        pos.set(clamp(from + dx / width, 0, last))
      }
      const up = () => {
        window.removeEventListener("pointermove", move)
        window.removeEventListener("pointerup", up)
        window.removeEventListener("pointercancel", up)
        edgeDrag.current = false
        if (moved) coast(pos.getVelocity())
        else push(side === "right" ? 1 : -1)
      }
      window.addEventListener("pointermove", move)
      window.addEventListener("pointerup", up)
      window.addEventListener("pointercancel", up)
    },
  })

  // a sideways swipe on the page turns it directly (the OS supplies the momentum) and it snaps once the stream is quiet; up and down stays the rows'
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const el = padRef.current
    if (el === null) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault()
      pos.stop()
      if (Option.isSome(editing) || Option.isSome(menu) || picked.length > 0) settle()
      pos.set(clamp(pos.get() + e.deltaX / width, 0, last))
      if (settling.current !== null) clearTimeout(settling.current)
      settling.current = setTimeout(() => chase(Math.round(pos.get())), 120)
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  })

  const drawing = tool === "pen"
  const editingNote = Option.flatMap(editing, (ed) => noteById(ed.id))
  const menuNote = Option.flatMap(menu, noteById)

  return (
    <div
      ref={padRef}
      tabIndex={0}
      onKeyDown={onKey}
      className="relative outline-none"
      style={{ width, height, background: "var(--panel)", cursor: drawing ? "crosshair" : "default" }}
      data-fonts={fontsReady}
    >
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        onPointerDown={onStageDown}
        onClick={onStageClick}
        onDblClick={onStageDblClick}
        onPointerMove={onStageMove}
        onPointerUp={onStageUp}
        onMouseLeave={onStageUp}
      >
        {/* the ruling and the bookplate: the page itself, never listening */}
        <Layer listening={false}>
          {tile !== null && (
            <Rect
              x={0}
              y={0}
              width={width}
              height={height}
              fillPatternImage={tile as unknown as HTMLImageElement /* Konva draws any CanvasImageSource; its type names only an image */}
              fillPatternRepeat="repeat"
              fillPatternScale={{ x: 0.5, y: 0.5 }}
              fillPatternX={ORIGIN}
              fillPatternY={ORIGIN}
            />
          )}
          <Group x={width - 58} y={height - 58} scaleX={2} scaleY={2} opacity={0.26}>
            {OBRIMOS.map((d) => (
              <Path key={d} data={d} stroke={ACCENT} strokeWidth={1.4} lineCap="round" lineJoin="round" strokeScaleEnabled={false} />
            ))}
            <Path data={OBRIMOS_BINDI} fill={ACCENT} />
          </Group>
          <PageNumber n={liveIndex + 1} font={font} height={height} />
        </Layer>
        <Layer listening={!drawing && !view.lifted}>
          {page.notes.map((n) => {
            const look = kindLook(n.kind)
            // the row's box on the lattice, and the plate drawn a gutter inside it
            const mw = sizeOf(n).w
            const w = mw - gap * 2
            const h = heightOf(n) - gap * 2
            const sized = sizeOf(n).h > 0
            const isSel = picked.includes(n.id)
            const blank = n.kind === "blank"
            const isEditing = Option.exists(editing, (ed) => ed.id === n.id)
            const valued = takesValue(n.kind)
            const tw = titleWidth(n.kind, mw, gap)
            const cellX = w - PAD - CELL
            const cellY = CELL_TOP
            const seat = seatOf(n)
            const lines = linesIn(n)
            const lineBox = lines * HAND * LEAD
            // the words hang from a fixed top, so a new line never moves the lines already written
            const wordsTop = WORDS_TOP
            const clipH = h - wordsTop - 6
            const over = Math.max(0, lineBox - clipH)
            const sc = clamp(scroll[n.id] ?? 0, 0, over)
            // the fade takes at most half the words' window, so a short row still shows its words
            const fade = Math.min(FADE, Math.floor(clipH / 2))
            return (
              <Group
                key={n.id}
                id={n.id}
                ref={arrive}
                x={seat.x}
                y={seat.y}
                draggable={!drawing}
                onMouseDown={(e) => pick(n.id, e.evt.shiftKey)}
                onDragStart={() => onDragStart(n.id)}
                onDragMove={(e) => onDragMove(n.id, e.target)}
                onDragEnd={(e) => onDragEnd(n.id, e.target)}
              >
                <Group x={gap} y={gap}>
                {/* the row: a solid plate a hair above the page, shadowed so rows stack, a crisp border in the kind's ink */}
                <Rect x={0} y={0} width={w} height={h} fill={PLATE} cornerRadius={3} shadowColor="#000" shadowBlur={8} shadowOffsetY={2} shadowOpacity={0.5} />
                <Rect
                  x={0.5}
                  y={0.5}
                  width={w - 1}
                  height={h - 1}
                  cornerRadius={3}
                  stroke={isSel ? ACCENT : look.tint}
                  strokeWidth={isSel ? 1.5 : 1}
                  opacity={isSel ? 1 : blank ? 0.3 : 0.55}
                  listening={false}
                />
                {/* the spine: the symbol's seat; click it and the kinds list opens — over an open editor too, whose focus a press here leaves alone */}
                <Group
                  onMouseDown={(e) => {
                    if (isEditing) e.evt.preventDefault()
                  }}
                  onClick={() => setMenu(Option.contains(menu, n.id) ? Option.none() : Option.some(n.id))}
                >
                  <Rect x={0.5} y={0.5} width={SPINE_W} height={h - 1} fill={look.tint} opacity={blank ? 0.04 : 0.1} cornerRadius={[3, 0, 0, 3]} />
                  <Line points={[SPINE_W + 0.5, 1, SPINE_W + 0.5, h - 1]} stroke={look.tint} strokeWidth={1} opacity={blank ? 0.2 : 0.4} />
                  <Path
                    x={SPINE_W / 2 - 8}
                    y={Math.min(h / 2, LINE_MID) - 8}
                    data={look.glyph}
                    stroke={look.tint}
                    strokeWidth={1.3}
                    lineCap="round"
                    lineJoin="round"
                    opacity={blank ? 0.45 : 1}
                    {...(blank ? { dash: [2, 2.5] } : {})}
                  />
                </Group>
                {/* the words: double-click to write; a sized row's words scroll under the wheel and fade at the foot while there is more */}
                <Group
                  onDblClick={() => openEditor(n, "title")}
                  onWheel={(e) => {
                    if (over === 0) return
                    e.evt.preventDefault()
                    setScroll((s) => ({ ...s, [n.id]: clamp((s[n.id] ?? 0) + e.evt.deltaY, 0, over) }))
                  }}
                >
                  <Rect x={SPINE_W + 1} y={0} width={tw + PAD * 2 - 1} height={h} fill={INK} opacity={0.001} />
                  {!isEditing && (
                    <Group clipX={SPINE_W + 1} clipY={wordsTop} clipWidth={tw + PAD * 2 - 1} clipHeight={sized ? clipH : h - wordsTop} listening={false}>
                      <Text
                        x={SPINE_W + PAD}
                        y={wordsTop - sc}
                        width={tw}
                        {...(sized ? {} : { height: h - wordsTop - 4, ellipsis: true })}
                        verticalAlign="top"
                        text={blank && n.title === "" ? "write…" : n.title}
                        fontFamily={font}
                        fontSize={HAND}
                        lineHeight={LEAD}
                        fill={blank && n.title === "" ? DIM : INK}
                        opacity={blank && n.title === "" ? 0.6 : 1}
                        wrap="word"
                      />
                    </Group>
                  )}
                  {!isEditing && sized && over - sc > 2 && (
                    <Rect
                      x={SPINE_W + 1}
                      y={wordsTop + clipH - fade}
                      width={tw + PAD * 2 - 1}
                      height={fade}
                      fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                      fillLinearGradientEndPoint={{ x: 0, y: fade }}
                      fillLinearGradientColorStops={[0, "rgba(18,17,24,0)", 1, PLATE]}
                      listening={false}
                    />
                  )}
                  {!isEditing && sized && sc > 2 && (
                    <Rect
                      x={SPINE_W + 1}
                      y={wordsTop}
                      width={tw + PAD * 2 - 1}
                      height={fade}
                      fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                      fillLinearGradientEndPoint={{ x: 0, y: fade }}
                      fillLinearGradientColorStops={[0, PLATE, 1, "rgba(18,17,24,0)"]}
                      listening={false}
                    />
                  )}
                </Group>
                {/* the value's cell: a square centered on the first line of words; faint and dashed until a value is written; click to write */}
                {valued && (
                  <Group onClick={(e) => !e.evt.shiftKey && openEditor(n, "number")}>
                    <Rect
                      x={cellX + 0.5}
                      y={cellY + 0.5}
                      width={CELL - 1}
                      height={CELL - 1}
                      cornerRadius={3}
                      stroke={look.tint}
                      strokeWidth={1}
                      opacity={n.number === "" ? 0.35 : 0.85}
                      {...(n.number === "" ? { dash: [3, 3] } : {})}
                    />
                    {!isEditing && (
                      <Text
                        x={cellX}
                        y={cellY}
                        width={CELL}
                        height={CELL}
                        align="center"
                        verticalAlign="middle"
                        text={n.number}
                        fontFamily={font}
                        fontSize={n.number.length > 2 ? 11 : 14}
                        fill={look.tint}
                        listening={false}
                      />
                    )}
                  </Group>
                )}
                {/* the grip: a picked row's corner; drag it and the row follows, snapping to whole cells on release */}
                {isSel && !isEditing && (
                  <Group x={w - GRIP} y={h - GRIP} draggable {...grip(n, seat)}>
                    <Rect x={-8} y={-8} width={18} height={18} fill={INK} opacity={0.001} />
                    <Line points={[1, 7, 7, 1]} stroke={ACCENT} strokeWidth={1} opacity={0.8} lineCap="round" />
                    <Line points={[5, 7, 7, 5]} stroke={ACCENT} strokeWidth={1} opacity={0.8} lineCap="round" />
                  </Group>
                )}
                </Group>
              </Group>
            )
          })}
        </Layer>
        <Layer listening={!drawing && !view.lifted}>
          {page.ink.map((s) => {
            const isSel = picked.includes(s.id)
            return (
              <Line
                key={s.id}
                id={s.id}
                points={outlineOf(s, false)}
                closed
                fill={s.color}
                opacity={isSel ? 1 : 0.92}
                lineJoin="round"
                hitStrokeWidth={10}
                stroke={isSel ? ACCENT : s.color}
                strokeWidth={isSel ? 1 : 0.5}
                {...(isSel ? { shadowColor: ACCENT, shadowBlur: 6 } : {})}
                draggable={!drawing}
                onMouseDown={(e) => pick(s.id, e.evt.shiftKey)}
                onDragStart={() => onDragStart(s.id)}
                onDragMove={(e) => onDragMove(s.id, e.target)}
                onDragEnd={(e) => onDragEnd(s.id, e.target)}
              />
            )
          })}
          {Option.match(stroke, {
            onNone: () => null,
            onSome: (s) => (
              <Line points={outlineOf(s, true)} closed fill={s.color} opacity={0.92} lineJoin="round" listening={false} />
            ),
          })}
          {Option.match(sweep, {
            onNone: () => null,
            onSome: (s) => (
              <Rect x={s.x} y={s.y} width={s.w} height={s.h} stroke={ACCENT} strokeWidth={1} dash={[3, 3]} fill="rgba(111,174,151,0.06)" listening={false} />
            ),
          })}
        </Layer>
        {/* the page lifting off: a quiet copy of it, slid by the position every frame; its shadow falls on the page beneath */}
        {view.lifted && (
          <Layer ref={topRef} listening={false}>
            <Rect x={0} y={0} width={width} height={height} fill={PANEL} />
            {tile !== null && (
              <Rect
                x={0}
                y={0}
                width={width}
                height={height}
                fillPatternImage={tile as unknown as HTMLImageElement}
                fillPatternRepeat="repeat"
                fillPatternScale={{ x: 0.5, y: 0.5 }}
                fillPatternX={ORIGIN}
                fillPatternY={ORIGIN}
              />
            )}
            <QuietPage page={pageAt(book, view.i)} font={font} gap={gap} width={width} height={height} />
            <PageNumber n={view.i + 1} font={font} height={height} />
            <Rect
              x={width}
              y={0}
              width={18}
              height={height}
              fillLinearGradientStartPoint={{ x: 0, y: 0 }}
              fillLinearGradientEndPoint={{ x: 18, y: 0 }}
              fillLinearGradientColorStops={[0, "rgba(0,0,0,0.55)", 1, "rgba(0,0,0,0)"]}
            />
          </Layer>
        )}
      </Stage>

      {/* the stacked page edges: the pages turned, at the left; the pages to come, at the right — the handles that turn the book, hanging outside the sheet */}
      <EdgeStack side="left" count={view.i} height={height} {...edge("left")} />
      <EdgeStack side="right" count={last - view.i} height={height} {...edge("right")} />

      {/* the editor: the note's words, and its value when the kind takes one */}
      {Option.match(Option.zipWith(editing, editingNote, (ed, n) => ({ ed, n })), {
        onNone: () => null,
        onSome: ({ ed, n }) => {
          const mw = sizeOf(n).w
          const w = mw - gap * 2
          const h = heightOf(n) - gap * 2
          const sized = sizeOf(n).h > 0
          const valued = takesValue(n.kind)
          const tw = titleWidth(n.kind, mw, gap)
          const look = kindLook(n.kind)
          const seat = seatOf(n)
          const lines = linesIn(n)
          const wordsTop = WORDS_TOP
          const field = {
            pointerEvents: "auto" as const,
            fontFamily: font,
            background: "transparent",
            border: 0,
            outline: "none",
            padding: 0,
            margin: 0,
            caretColor: ACCENT,
          }
          return (
            <div
              ref={editorRef}
              style={{ position: "absolute", left: seat.x + gap, top: seat.y + gap, width: w, height: h, pointerEvents: "none" }}
              onPointerDown={onEditorPointerDown}
            >
              <textarea
                ref={titleRef}
                autoFocus={ed.focus === "title"}
                defaultValue={n.title}
                placeholder="write…"
                onFocus={(e) => {
                  // the caret goes to the end — again a frame later, after the double-click that opened the editor has
                  // landed on the fresh textarea and selected the word beneath it
                  const el = e.currentTarget
                  const end = () => el.setSelectionRange(el.value.length, el.value.length)
                  end()
                  requestAnimationFrame(end)
                }}
                onBlur={onEditorBlur}
                onKeyDown={onEditorKey}
                onChange={(e) => {
                  // the box grows with its words at once, before React's turn, so the caret never scrolls the text
                  // up; it stops at the page's room, and scrolls from there
                  if (!sized) {
                    e.currentTarget.style.height = "auto"
                    e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, room - wordsTop - 6)}px`
                  }
                  setEditing(Option.some({ ...ed, draft: e.currentTarget.value }))
                }}
                rows={1}
                style={{
                  ...field,
                  position: "absolute",
                  left: SPINE_W + PAD,
                  top: wordsTop,
                  width: tw,
                  height: sized ? h - wordsTop - 6 : Math.min(lines * HAND * LEAD, room - wordsTop - 6),
                  overflowY: "auto" as const,
                  scrollbarWidth: "none" as const,
                  fontSize: HAND,
                  lineHeight: LEAD,
                  color: INK,
                  resize: "none",
                }}
              />
              {valued && (
                <input
                  ref={valueRef}
                  autoFocus={ed.focus === "number"}
                  defaultValue={n.number}
                  placeholder="·"
                  onBlur={onEditorBlur}
                  onKeyDown={onEditorKey}
                  onFocus={(e) => e.currentTarget.select()}
                  style={{
                    ...field,
                    position: "absolute",
                    left: w - PAD - CELL,
                    top: CELL_TOP,
                    width: CELL,
                    height: CELL,
                    textAlign: "center",
                    fontSize: 14,
                    lineHeight: 1,
                    color: look.tint,
                  }}
                />
              )}
            </div>
          )
        },
      })}

      {/* the kinds: a list beneath the note whose symbol was clicked */}
      {Option.match(menuNote, {
        onNone: () => null,
        onSome: (n) => (
          <KindList
            note={{ ...n, x: seatOf(n).x + gap, y: seatOf(n).y }}
            noteH={heightOf(n)}
            padHeight={height}
            onPick={(k) => {
              set(rekind(page, [n.id], k))
              setMenu(Option.none())
            }}
            onRemove={removePicked}
          />
        ),
      })}
    </div>
  )
}

/** The page's number, in the hand, at the foot's outer corner — the mage numbered the pages. */
function PageNumber({ n, font, height }: { n: number; font: string; height: number }) {
  return <Text x={ORIGIN + 3} y={height - ORIGIN - 15} text={String(n)} fontFamily={font} fontSize={13} fill={DIM} opacity={0.8} listening={false} />
}

/** A page at rest, read-only: its rows and ink as the live page draws them, with nothing to touch. The lifting page is drawn with this. */
function QuietPage({ page, font, gap, width, height }: { page: Page; font: string; gap: number; width: number; height: number }) {
  const room = height - ORIGIN * 2
  return (
    <>
      {page.notes.map((n) => {
        const look = kindLook(n.kind)
        const blank = n.kind === "blank"
        const valued = takesValue(n.kind)
        const tw = titleWidth(n.kind, n.w, gap)
        const lines = n.h > 0 ? linesOf(n.title, tw, font) : Math.min(MAX_LINES, linesOf(n.title, tw, font))
        const mh = n.h > 0 ? n.h : Math.min(rowHeight(lines, gap), room)
        const seat = within({ x: n.x, y: n.y }, n.w, mh, width, height)
        const w = n.w - gap * 2
        const h = mh - gap * 2
        return (
          <Group key={n.id} x={seat.x + gap} y={seat.y + gap}>
            <Rect x={0} y={0} width={w} height={h} fill={PLATE} cornerRadius={3} shadowColor="#000" shadowBlur={8} shadowOffsetY={2} shadowOpacity={0.5} />
            <Rect x={0.5} y={0.5} width={w - 1} height={h - 1} cornerRadius={3} stroke={look.tint} strokeWidth={1} opacity={blank ? 0.3 : 0.55} />
            <Rect x={0.5} y={0.5} width={SPINE_W} height={h - 1} fill={look.tint} opacity={blank ? 0.04 : 0.1} cornerRadius={[3, 0, 0, 3]} />
            <Line points={[SPINE_W + 0.5, 1, SPINE_W + 0.5, h - 1]} stroke={look.tint} strokeWidth={1} opacity={blank ? 0.2 : 0.4} />
            <Path
              x={SPINE_W / 2 - 8}
              y={Math.min(h / 2, LINE_MID) - 8}
              data={look.glyph}
              stroke={look.tint}
              strokeWidth={1.3}
              lineCap="round"
              lineJoin="round"
              opacity={blank ? 0.45 : 1}
              {...(blank ? { dash: [2, 2.5] } : {})}
            />
            <Group clipX={SPINE_W + 1} clipY={WORDS_TOP} clipWidth={tw + PAD * 2 - 1} clipHeight={h - WORDS_TOP - (n.h > 0 ? 6 : 0)}>
              <Text
                x={SPINE_W + PAD}
                y={WORDS_TOP}
                width={tw}
                {...(n.h > 0 ? {} : { height: h - WORDS_TOP - 4, ellipsis: true })}
                verticalAlign="top"
                text={n.title}
                fontFamily={font}
                fontSize={HAND}
                lineHeight={LEAD}
                fill={INK}
                wrap="word"
              />
            </Group>
            {valued && (
              <>
                <Rect
                  x={w - PAD - CELL + 0.5}
                  y={CELL_TOP + 0.5}
                  width={CELL - 1}
                  height={CELL - 1}
                  cornerRadius={3}
                  stroke={look.tint}
                  strokeWidth={1}
                  opacity={n.number === "" ? 0.35 : 0.85}
                  {...(n.number === "" ? { dash: [3, 3] } : {})}
                />
                <Text
                  x={w - PAD - CELL}
                  y={CELL_TOP}
                  width={CELL}
                  height={CELL}
                  align="center"
                  verticalAlign="middle"
                  text={n.number}
                  fontFamily={font}
                  fontSize={n.number.length > 2 ? 11 : 14}
                  fill={look.tint}
                />
              </>
            )}
          </Group>
        )
      })}
      {page.ink.map((s) => (
        <Line key={s.id} points={outlineOf(s, false)} closed fill={s.color} opacity={0.92} lineJoin="round" />
      ))}
    </>
  )
}

/**
 * The page edges stacked beside the page: one hairline per page, each a
 * little further out and a little shorter than the last, so the stack reads
 * as sheets folded back (left) or still to come (right). Past a dozen the
 * lines close up rather than reach further. The strip is the handle: drag
 * it and the book turns under the hand; tap it and it turns one page.
 */
function EdgeStack({
  side,
  count,
  height,
  ...handlers
}: {
  side: "left" | "right"
  count: number
  height: number
  onPointerDown: (e: RPointerEvent<HTMLDivElement>) => void
}) {
  const [hot, setHot] = useState(false)
  const shown = Math.min(count, EDGE_SHOWN)
  const step = count <= EDGE_SHOWN ? 1.8 : (EDGE_SHOWN * 1.8) / count
  const lines = Array.from({ length: Math.min(count, 40) }, (_, k) => k + 1)
  return (
    <div
      {...handlers}
      onPointerEnter={() => setHot(true)}
      onPointerLeave={() => setHot(false)}
      className="absolute top-0 touch-none select-none"
      style={{ [side]: -EDGE_W, width: EDGE_W, height, cursor: count > 0 ? "grab" : "default" }}
      aria-label={side === "left" ? `${count} pages turned` : `${count} pages to come`}
    >
      {lines.map((k) => (
        <span
          key={k}
          aria-hidden
          className="absolute"
          style={{
            [side === "left" ? "right" : "left"]: Math.round(k * step * 10) / 10,
            top: Math.min(k, shown) * 0.5 + 1,
            bottom: Math.min(k, shown) * 0.5 + 1,
            width: 1,
            background: INK,
            opacity: (hot ? 0.5 : 0.32) * Math.max(0.35, 1 - k / (EDGE_SHOWN * 1.6)),
          }}
        />
      ))}
    </div>
  )
}

const ROW = 24

/** The kinds, one to a row, beneath the note (above it when the page's edge is near); the current one is marked. */
function KindList({ note, noteH, padHeight, onPick, onRemove }: { note: Note; noteH: number; padHeight: number; onPick: (kind: NoteKind) => void; onRemove: () => void }) {
  const listH = ROW * KINDS.length + 1 + ROW + 16
  const below = note.y + noteH + 4 + listH <= padHeight
  const row = (word: string, tint: string, glyph: string, current: boolean, act: () => void) => (
    <button
      key={word}
      type="button"
      onClick={act}
      aria-pressed={current}
      className="mv-eyebrow"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        height: ROW,
        padding: "0 10px 0 8px",
        border: 0,
        borderLeft: `2px solid ${current ? tint : "transparent"}`,
        background: current ? `color-mix(in srgb, ${tint} 12%, transparent)` : "transparent",
        color: tint,
        cursor: "pointer",
        textAlign: "left",
      }}
      onMouseEnter={(e) => {
        if (!current) e.currentTarget.style.background = "rgba(215,210,224,0.06)"
      }}
      onMouseLeave={(e) => {
        if (!current) e.currentTarget.style.background = "transparent"
      }}
    >
      <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={glyph} />
      </svg>
      <span>{word}</span>
    </button>
  )
  return (
    <div
      style={{
        position: "absolute",
        left: note.x,
        top: below ? note.y + noteH + 4 : note.y - listH - 4,
        width: 124,
        padding: "4px 0",
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: 3,
        boxShadow: "0 6px 18px rgba(0,0,0,.55)",
        zIndex: 2,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {KINDS.map((k) => {
        const look = kindLook(k)
        return row(look.word, look.tint, look.glyph, note.kind === k, () => onPick(k))
      })}
      <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
      {row("remove", DIM, "M4 4 L12 12 M12 4 L4 12", false, onRemove)}
    </div>
  )
}
