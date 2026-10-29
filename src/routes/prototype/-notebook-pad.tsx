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
// write). Strokes pick, sweep and move like notes; groups move as one.
import { useEffect, useMemo, useRef, useState, type FocusEvent as RFocusEvent, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from "react"
import { Match, Option } from "effect"
import { Group, Layer, Line, Path, Rect, Stage, Text } from "react-konva"
import Konva from "konva"
import { getStroke } from "perfect-freehand"
import {
  addInk,
  CELL,
  commit,
  duplicateNotes,
  GRID,
  GRID_TICK_EVERY,
  KINDS,
  kindLook,
  moveMany,
  NOTE_W,
  noteHeight,
  ORIGIN,
  placeAt,
  redo,
  rekind,
  removeMany,
  retitle,
  revalue,
  snapPoint,
  SPINE_W,
  swept,
  takesValue,
  toggleGroup,
  undo,
  withGroups,
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

type Editing = { readonly id: string; readonly focus: "title" | "number" }
/** A drag in flight: everything moving, and where each node began. */
type Drag = { readonly ids: ReadonlyArray<string>; readonly origin: Record<string, { x: number; y: number }> }

/** The ruling knob the route hands down. */
export type Rule = "dots" | "lines" | "none"

/** The pen's character (perfect-freehand): a nib that thins with speed or pressure, smoothed, tapered at both ends. */
const PEN = { size: 5, thinning: 0.65, smoothing: 0.55, streamline: 0.5, start: { taper: 24 }, end: { taper: 32 } }

const INK = "#d7d2e0"
const DIM = "#807b8f"
const ACCENT = "#6fae97"
const HAND = 18
const LEAD = 1.1
const PAD = 10

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

/** The words' column: after the spine, before the value's cell when there is one. */
const titleWidth = (n: Note): number => NOTE_W - SPINE_W - PAD * 2 - (takesValue(n.kind) ? CELL + PAD : 0)
/** Konva measures text as it draws, so one offstage Text measures how many lines a title takes. */
const measurer = new Konva.Text({ fontSize: HAND, lineHeight: LEAD, wrap: "word" })
const linesOf = (n: Note, font: string): number => {
  if (n.kind === "blank" || n.title === "") return 1
  measurer.setAttrs({ text: n.title, width: titleWidth(n), fontFamily: font })
  return Math.min(2, Math.max(1, Math.round(measurer.height() / (HAND * LEAD))))
}

export function NotebookPad({
  font,
  tool,
  inkColor,
  rule,
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
  picked: ReadonlyArray<string>
  onPicked: (ids: ReadonlyArray<string>) => void
  history: History
  onHistory: (h: History) => void
  width: number
  height: number
}) {
  const page = history.present
  const [editing, setEditing] = useState<Option.Option<Editing>>(Option.none())
  /** The note whose list of kinds is open beneath it. */
  const [menu, setMenu] = useState<Option.Option<string>>(Option.none())
  const [stroke, setStroke] = useState<Option.Option<Ink>>(Option.none())
  const [sweep, setSweep] = useState<Option.Option<Box>>(Option.none())
  const [fontsReady, setFontsReady] = useState(0)
  const stamped = useRef(0)
  const stageRef = useRef<Konva.Stage>(null)
  const padRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const valueRef = useRef<HTMLInputElement>(null)
  const drag = useRef<Option.Option<Drag>>(Option.none())
  /** Where a press inside the editor began; moving far enough from it hands the press to the note as a drag. */
  const editorPress = useRef<Option.Option<{ x: number; y: number }>>(Option.none())
  /** When the editor last closed, or a sweep last ended: the click that did it must not write or clear a pick. */
  const settledAt = useRef(0)

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

  const set = (next: Page) => onHistory(commit(history, next))
  const noteById = (id: string): Option.Option<Note> => Option.fromNullishOr(page.notes.find((n) => n.id === id))
  const pickedNotes = page.notes.filter((n) => picked.includes(n.id))
  const nodeOf = (id: string): Option.Option<Konva.Node> => Option.fromNullishOr(stageRef.current?.findOne(`#${id}`))
  const heightOf = (n: Note): number => noteHeight(linesOf(n, font))

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
    // 1–7 swap the picked notes' kind, in the list's order
    const digit = Number.parseInt(e.key, 10)
    if (pickedNotes.length > 0 && digit >= 1 && digit <= KINDS.length) {
      const kind = KINDS[digit - 1]
      if (kind !== undefined) set(rekind(page, picked, kind))
    }
  }

  // --- picking: a click takes one (and its group), shift-click adds or removes, a sweep takes a region ---

  const pick = (id: string, shift: boolean) => {
    const ids = withGroups(page, [id])
    const allIn = ids.every((x) => picked.includes(x))
    if (shift) onPicked(allIn ? picked.filter((p) => !ids.includes(p)) : [...picked, ...ids.filter((x) => !picked.includes(x))])
    else if (!allIn) onPicked(ids)
    if (!Option.contains(menu, id)) setMenu(Option.none())
  }

  // --- the editor: the note's words and, when its kind takes one, its value ---

  const openEditor = (n: Note, focus: "title" | "number") => {
    onPicked([n.id])
    setMenu(Option.none())
    setEditing(Option.some({ id: n.id, focus }))
  }
  const closeEditor = (keep: boolean) =>
    Option.map(editing, (ed) => {
      settledAt.current = Date.now()
      Option.map(noteById(ed.id), (n) => {
        const title = keep ? (titleRef.current?.value ?? n.title) : n.title
        const number = keep ? (valueRef.current?.value ?? n.number) : n.number
        const emptyBlank = title.trim() === "" && n.kind === "blank"
        set(emptyBlank ? removeMany(page, [ed.id]) : revalue(retitle(page, ed.id, title.trim()), ed.id, number.trim()))
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
    if (e.key === "Escape") closeEditor(false)
  }
  // a press inside the editor that travels becomes a drag of the note: the
  // edit commits, Konva is told where the pointer is, and the note's group
  // takes the drag from there (Konva follows the window's pointer thereafter)
  const onEditorPointerDown = (e: RPointerEvent<HTMLElement>) => {
    editorPress.current = Option.some({ x: e.clientX, y: e.clientY })
  }
  const onEditorPointerMove = (e: RPointerEvent<HTMLElement>) =>
    Option.map(editorPress.current, (from) => {
      if (e.buttons === 0) {
        editorPress.current = Option.none()
        return
      }
      if (Math.hypot(e.clientX - from.x, e.clientY - from.y) < 6) return
      editorPress.current = Option.none()
      Option.map(editing, (ed) => {
        closeEditor(true)
        const stage = stageRef.current
        if (stage === null) return
        stage.setPointersPositions(e.nativeEvent)
        Option.map(nodeOf(ed.id), (node) => node.startDrag())
      })
    })

  const pointer = (): Option.Option<{ x: number; y: number }> =>
    Option.fromNullishOr(stageRef.current?.getPointerPosition())
  /** The pen's pressure when the device reports one; a mouse says 0.5 and we say so. */
  const pressureOf = (evt: Event): { p: number; real: boolean } =>
    evt instanceof PointerEvent && evt.pointerType === "pen" ? { p: evt.pressure, real: true } : { p: 0.5, real: false }

  // the pointer on the bare page, by tool: the pen begins a stroke, select
  // begins a sweep; the write tool waits for the click (below), because the
  // mousedown's own default action moves focus to the pad and would blur an
  // editor opened this early
  const onStageDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const onPage = e.target === e.target.getStage()
    Match.value(tool).pipe(
      Match.when("write", () => undefined),
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
  // a click on the bare page: with a list open, something picked, or an
  // editor just closed, it only shuts and clears; otherwise the write tool
  // writes a note there and opens it
  const onStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target !== e.target.getStage()) return
    if (Date.now() - settledAt.current < 250) return
    if (Option.isSome(menu) || picked.length > 0 || Option.isSome(editing)) {
      setMenu(Option.none())
      onPicked([])
      return
    }
    if (tool !== "write") return
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
      const isNote = page.notes.some((n) => n.id === x)
      if (!isNote) {
        shifts.push({ id: x, dx, dy })
        continue
      }
      Option.map(x === id ? Option.some(node) : nodeOf(x), (target) => {
        const p = snapPoint(target.x(), target.y())
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
  /** A note that has just appeared lands: a short drift down onto its place. */
  const arrive = (node: Konva.Group | null) => {
    if (node === null || node.getAttr("landed") === true) return
    node.setAttr("landed", true)
    const y = node.y()
    node.opacity(0)
    node.y(y - 5)
    node.to({ opacity: 1, y, duration: 0.18, easing: Konva.Easings.EaseOut })
  }

  const drawing = tool === "pen"
  const writing = tool === "write"
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
        </Layer>
        <Layer listening={!drawing}>
          {page.notes.map((n) => {
            const look = kindLook(n.kind)
            const h = heightOf(n)
            const isSel = picked.includes(n.id)
            const blank = n.kind === "blank"
            const isEditing = Option.exists(editing, (ed) => ed.id === n.id)
            const valued = takesValue(n.kind)
            const tw = titleWidth(n)
            const cellX = NOTE_W - PAD - CELL
            const cellY = (h - CELL) / 2
            return (
              <Group
                key={n.id}
                id={n.id}
                ref={arrive}
                x={n.x}
                y={n.y}
                draggable={!drawing}
                onMouseDown={(e) => pick(n.id, e.evt.shiftKey)}
                onDragStart={() => onDragStart(n.id)}
                onDragMove={(e) => onDragMove(n.id, e.target)}
                onDragEnd={(e) => onDragEnd(n.id, e.target)}
              >
                {/* the row: a plate, a crisp border in the kind's ink */}
                <Rect x={0} y={0} width={NOTE_W} height={h} fill={INK} opacity={0.03} cornerRadius={3} />
                <Rect
                  x={0.5}
                  y={0.5}
                  width={NOTE_W - 1}
                  height={h - 1}
                  cornerRadius={3}
                  stroke={isSel ? ACCENT : look.tint}
                  strokeWidth={isSel ? 1.5 : 1}
                  opacity={isSel ? 1 : blank ? 0.3 : 0.55}
                  listening={false}
                />
                {/* the spine: the symbol's seat; click it and the kinds list opens */}
                <Group onClick={() => writing && setMenu(Option.contains(menu, n.id) ? Option.none() : Option.some(n.id))}>
                  <Rect x={0.5} y={0.5} width={SPINE_W} height={h - 1} fill={look.tint} opacity={blank ? 0.04 : 0.1} cornerRadius={[3, 0, 0, 3]} />
                  <Line points={[SPINE_W + 0.5, 1, SPINE_W + 0.5, h - 1]} stroke={look.tint} strokeWidth={1} opacity={blank ? 0.2 : 0.4} />
                  <Path
                    x={SPINE_W / 2 - 8}
                    y={h / 2 - 8}
                    data={look.glyph}
                    stroke={look.tint}
                    strokeWidth={1.3}
                    lineCap="round"
                    lineJoin="round"
                    opacity={blank ? 0.45 : 1}
                    {...(blank ? { dash: [2, 2.5] } : {})}
                  />
                </Group>
                {/* the words: the kind's word above, the title beneath, one left edge; click to write */}
                <Group onClick={() => writing && openEditor(n, "title")}>
                  <Rect x={SPINE_W + 1} y={0} width={tw + PAD * 2 - 1} height={h} fill={INK} opacity={0.001} />
                  {!blank && (
                    <Text x={SPINE_W + PAD} y={7} text={look.word.toUpperCase()} fontFamily="JetBrains Mono" fontSize={9} letterSpacing={1.6} fill={look.tint} listening={false} />
                  )}
                  {!isEditing && (
                    <Text
                      x={SPINE_W + PAD}
                      y={blank ? 0 : 19}
                      width={tw}
                      height={blank ? h : h - 19 - 5}
                      verticalAlign={blank ? "middle" : "top"}
                      text={blank && n.title === "" ? "write…" : n.title}
                      fontFamily={font}
                      fontSize={HAND}
                      lineHeight={LEAD}
                      fill={blank && n.title === "" ? DIM : INK}
                      opacity={blank && n.title === "" ? 0.6 : 1}
                      wrap="word"
                      ellipsis
                      listening={false}
                    />
                  )}
                </Group>
                {/* the value's cell: a square centered on the row; faint and dashed until a value is written; click to write */}
                {valued && (
                  <Group onClick={() => writing && openEditor(n, "number")}>
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
                        fontSize={n.number.length > 2 ? 12 : 16}
                        fill={look.tint}
                        listening={false}
                      />
                    )}
                  </Group>
                )}
              </Group>
            )
          })}
        </Layer>
        <Layer listening={!drawing}>
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
      </Stage>

      {/* the editor: the note's words, and its value when the kind takes one */}
      {Option.match(Option.zipWith(editing, editingNote, (ed, n) => ({ ed, n })), {
        onNone: () => null,
        onSome: ({ ed, n }) => {
          const h = heightOf(n)
          const blank = n.kind === "blank"
          const valued = takesValue(n.kind)
          const tw = titleWidth(n)
          const look = kindLook(n.kind)
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
              style={{ position: "absolute", left: n.x, top: n.y, width: NOTE_W, height: h, pointerEvents: "none" }}
              onPointerDown={onEditorPointerDown}
              onPointerMove={onEditorPointerMove}
            >
              <textarea
                ref={titleRef}
                autoFocus={ed.focus === "title"}
                defaultValue={n.title}
                placeholder="write…"
                onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
                onBlur={onEditorBlur}
                onKeyDown={onEditorKey}
                rows={blank ? 1 : 2}
                style={{
                  ...field,
                  position: "absolute",
                  left: SPINE_W + PAD,
                  top: blank ? (h - HAND * LEAD) / 2 : 19,
                  width: tw,
                  fontSize: HAND,
                  lineHeight: LEAD,
                  color: INK,
                  resize: "none",
                  overflow: "hidden",
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
                    left: NOTE_W - PAD - CELL,
                    top: (h - CELL) / 2,
                    width: CELL,
                    height: CELL,
                    textAlign: "center",
                    fontSize: 16,
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
            note={n}
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
