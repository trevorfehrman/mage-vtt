// PROTOTYPE — throwaway (MAG-75 audition, 2026-10-28/29). The mage's
// notebook drawn with react-konva: the page is a plain array of notes and ink
// (Schema, in -notebook-page.ts), Konva only renders it; every edit is a pure
// function over the page, and undo / redo is a history of pages. Client-only
// (Konva needs a window), so the route lazy-loads this file inside ClientOnly.
// No app imports; mock only.
//
// "The ruled lattice" (owner's pick, 2026-10-28): quiet magic in what the
// page does — a lattice of dots the notes settle onto, a sigil in each note's
// corner, a ring for a value, the mage's Path glyph as a faint bookplate.
// Round two (2026-10-29): crisp borders, a select tool with shift-click and a
// sweep, several notes moving as one, a radial fan of kinds that springs open
// from the picked note's corner, and a drag that works even from inside the
// editor.
import { useEffect, useMemo, useRef, useState, type FocusEvent as RFocusEvent, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from "react"
import { Match, Option } from "effect"
import { motion } from "motion/react"
import { Circle, Group, Layer, Line, Path, Rect, Stage, Text } from "react-konva"
import Konva from "konva"
import { getStroke } from "perfect-freehand"
import {
  addInk,
  commit,
  duplicateNotes,
  GRID,
  GRID_TICK_EVERY,
  KINDS,
  kindLook,
  moveNotes,
  noteHeight,
  NOTE_W,
  notesWithin,
  ORIGIN,
  placeAt,
  redo,
  rekind,
  removeMany,
  retitle,
  revalue,
  snapPoint,
  takesValue,
  undo,
  type History,
  type Ink,
  type Move,
  type Note,
  type NoteKind,
  type Page,
  type Tool,
} from "./-notebook-page"

type Editing = { readonly id: string; readonly focus: "title" | "number" }
type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
/** A drag in flight: every note moving, and where each began. */
type Drag = { readonly ids: ReadonlyArray<string>; readonly origin: Record<string, { x: number; y: number }> }

/** The ruling knob the route hands down. */
export type Rule = "dots" | "lines" | "none"

/** The pen's character (perfect-freehand): a nib that thins with speed or pressure, smoothed, tapered at both ends. */
const PEN = { size: 5, thinning: 0.65, smoothing: 0.55, streamline: 0.5, start: { taper: 24 }, end: { taper: 32 } }

const INK = "#d7d2e0"
const DIM = "#807b8f"
const ACCENT = "#6fae97"
const HAND = 19

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

/** Where the value sits on a note: a ring at the bottom right. */
const ringSeat = (h: number) => ({ cx: NOTE_W - 26, cy: h - 24, r: 14 })
/** The words' column: flush with the kind's word, clear of the ring when there is one. */
const titleBox = (n: Note, h: number) => ({
  x: 12,
  y: n.kind === "blank" ? 0 : 26,
  w: NOTE_W - 24 - (takesValue(n.kind) ? 40 : 0),
  h: n.kind === "blank" ? h : h - 26,
})

export function NotebookPad({
  font,
  tool,
  inkColor,
  rule,
  history,
  onHistory,
  width,
  height,
}: {
  font: string
  tool: Tool
  inkColor: string
  rule: Rule
  history: History
  onHistory: (h: History) => void
  width: number
  height: number
}) {
  const page = history.present
  const [picked, setPicked] = useState<ReadonlyArray<string>>([])
  const [editing, setEditing] = useState<Option.Option<Editing>>(Option.none())
  const [stroke, setStroke] = useState<Option.Option<Ink>>(Option.none())
  const [sweep, setSweep] = useState<Option.Option<Box>>(Option.none())
  /** True from a drag's first move until the last note has settled: the fan stays shut meanwhile. */
  const [moving, setMoving] = useState(false)
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

  const removePicked = () => {
    if (picked.length === 0) return
    set(removeMany(page, picked))
    setPicked([])
  }

  const onKey = (e: RKeyboardEvent<HTMLDivElement>) => {
    if (Option.isSome(editing)) return
    const meta = e.metaKey || e.ctrlKey
    if (meta && e.key.toLowerCase() === "z") {
      e.preventDefault()
      onHistory(e.shiftKey ? redo(history) : undo(history))
      return
    }
    if (meta && e.key.toLowerCase() === "d" && pickedNotes.length > 0) {
      e.preventDefault()
      set(duplicateNotes(page, picked))
      return
    }
    if (meta && e.key.toLowerCase() === "a") {
      e.preventDefault()
      setPicked([...page.notes.map((n) => n.id), ...page.ink.map((s) => s.id)])
      return
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault()
      removePicked()
      return
    }
    if (e.key === "Escape") setPicked([])
    // 1–7 swap the picked notes' kind, in the fan's order
    const digit = Number.parseInt(e.key, 10)
    if (pickedNotes.length > 0 && digit >= 1 && digit <= KINDS.length) {
      const kind = KINDS[digit - 1]
      if (kind !== undefined) set(rekind(page, picked, kind))
    }
  }

  // --- picking: a click takes one, shift-click adds one, a sweep takes a region ---

  const pick = (id: string, shift: boolean) => {
    if (shift) setPicked(picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id])
    else if (!picked.includes(id)) setPicked([id])
  }

  // --- the editor: the note's words and, when its kind takes one, its value ---

  const openEditor = (n: Note, focus: "title" | "number") => {
    setPicked([n.id])
    setEditing(Option.some({ id: n.id, focus }))
  }
  const closeEditor = (keep: boolean) =>
    Option.map(editing, (ed) => {
      settledAt.current = Date.now()
      Option.map(noteById(ed.id), (n) => {
        const title = keep ? (titleRef.current?.value ?? n.title) : n.title
        const number = keep ? (valueRef.current?.value ?? n.number) : n.number
        const emptyBlank = title.trim() === "" && n.kind === "blank"
        set(emptyBlank ? removeMany(page, [ed.id]) : revalue(retitle(page, ed.id, title), ed.id, number.trim()))
        if (emptyBlank) setPicked([])
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
          setStroke(Option.some({ id: `i${Date.now().toString(36)}`, points: [p.x, p.y, pr.p], color: inkColor, pressured: pr.real }))
        })
      }),
      Match.exhaustive,
    )
  }
  // a click on the bare page: with something picked, or an editor just
  // closed, it only clears the pick; otherwise the write tool writes a note
  // there and opens it
  const onStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target !== e.target.getStage()) return
    if (Date.now() - settledAt.current < 250) return
    if (picked.length > 0 || Option.isSome(editing)) {
      setPicked([])
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
      const taken = notesWithin(page, box)
      setPicked(e.shiftKey ? [...picked, ...taken.filter((id) => !picked.includes(id))] : taken)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
  })

  // --- moving: the dragged note carries everything picked with it, then they all settle ---

  const onDragStart = (n: Note) => {
    const ids = picked.includes(n.id) ? picked : [n.id]
    const origin: Record<string, { x: number; y: number }> = {}
    for (const m of page.notes) if (ids.includes(m.id)) origin[m.id] = { x: m.x, y: m.y }
    drag.current = Option.some({ ids, origin })
    setMoving(true)
  }
  const onDragMove = (n: Note, node: Konva.Node) =>
    Option.map(drag.current, (d) => {
      const from = d.origin[n.id]
      if (from === undefined) return
      const dx = node.x() - from.x
      const dy = node.y() - from.y
      for (const id of d.ids) {
        const o = d.origin[id]
        if (id !== n.id && o !== undefined) Option.map(nodeOf(id), (other) => other.position({ x: o.x + dx, y: o.y + dy }))
      }
    })
  /** Every dragged note drifts to the lattice; when the last lands, the page records where they settled. */
  const onDragEnd = (n: Note, node: Konva.Node) => {
    const d = Option.getOrElse(drag.current, (): Drag => ({ ids: [n.id], origin: {} }))
    drag.current = Option.none()
    const moves: Move[] = []
    let landing = 0
    for (const id of d.ids) {
      Option.map(id === n.id ? Option.some(node) : nodeOf(id), (target) => {
        const p = snapPoint(target.x(), target.y())
        moves.push({ id, x: p.x, y: p.y })
        landing += 1
        target.to({
          x: p.x,
          y: p.y,
          duration: 0.16,
          easing: Konva.Easings.EaseOut,
          onFinish: () => {
            landing -= 1
            if (landing === 0) {
              set(moveNotes(page, moves))
              setMoving(false)
            }
          },
        })
      })
    }
  }
  /** A note that has just appeared lands: a short drift down onto its place. */
  const land = (node: Konva.Group | null) => {
    if (node === null || node.getAttr("landed") === true) return
    node.setAttr("landed", true)
    const y = node.y()
    node.opacity(0)
    node.y(y - 5)
    node.to({ opacity: 1, y, duration: 0.18, easing: Konva.Easings.EaseOut })
  }

  const drawing = tool === "pen"
  const editingNote = Option.flatMap(editing, (ed) => noteById(ed.id))
  const fanNote = moving || Option.isSome(editing) || pickedNotes.length !== 1 ? Option.none<Note>() : Option.fromNullishOr(pickedNotes[0])

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
            const h = noteHeight(n)
            const isSel = picked.includes(n.id)
            const blank = n.kind === "blank"
            const isEditing = Option.exists(editing, (ed) => ed.id === n.id)
            const valued = takesValue(n.kind)
            const seat = ringSeat(h)
            const tb = titleBox(n, h)
            return (
              <Group
                key={n.id}
                id={n.id}
                ref={land}
                x={n.x}
                y={n.y}
                draggable={!drawing}
                onMouseDown={(e) => pick(n.id, e.evt.shiftKey)}
                onDragStart={() => onDragStart(n)}
                onDragMove={(e) => onDragMove(n, e.target)}
                onDragEnd={(e) => onDragEnd(n, e.target)}
                onDblClick={() => openEditor(n, "title")}
              >
                {/* the plate and the border: crisp, in the kind's ink; a plain note shows a border only while picked */}
                <Rect x={0} y={0} width={NOTE_W} height={h} fill={INK} opacity={blank ? 0.001 : 0.03} cornerRadius={2} />
                {(!blank || isSel) && (
                  <Rect
                    x={0.5}
                    y={0.5}
                    width={NOTE_W - 1}
                    height={h - 1}
                    cornerRadius={2}
                    stroke={isSel ? ACCENT : look.tint}
                    strokeWidth={isSel ? 1.5 : 1}
                    opacity={isSel ? 1 : 0.55}
                    {...(isSel && blank ? { dash: [4, 4] } : {})}
                    listening={false}
                  />
                )}
                {/* the sigil in the corner, the word flush left */}
                {!blank && (
                  <>
                    <Path x={NOTE_W - 24} y={8} data={look.glyph} stroke={look.tint} strokeWidth={1.3} lineCap="round" lineJoin="round" />
                    <Text x={12} y={11} text={look.word.toUpperCase()} fontFamily="JetBrains Mono" fontSize={9} letterSpacing={1.6} fill={look.tint} />
                  </>
                )}
                {n.lasts === "scene" && (
                  <Text x={NOTE_W - 100} y={10} width={70} align="right" text="this scene" fontFamily={font} fontSize={12} fill={DIM} />
                )}
                {!isEditing && (
                  <Text
                    x={tb.x}
                    y={tb.y}
                    width={tb.w}
                    height={tb.h}
                    verticalAlign={blank ? "middle" : "top"}
                    text={blank && n.title === "" ? "write…" : n.title}
                    fontFamily={font}
                    fontSize={HAND}
                    lineHeight={1.05}
                    fill={blank && n.title === "" ? DIM : INK}
                    opacity={blank && n.title === "" ? 0.6 : 1}
                    wrap="word"
                    ellipsis
                  />
                )}
                {/* the value's seat: a ring at the bottom right; faint and dashed until a value is written */}
                {valued && (
                  <Group onClick={() => openEditor(n, "number")}>
                    <Circle
                      x={seat.cx}
                      y={seat.cy}
                      radius={seat.r}
                      stroke={look.tint}
                      strokeWidth={1}
                      opacity={n.number === "" ? 0.35 : 0.85}
                      {...(n.number === "" ? { dash: [3, 3] } : {})}
                    />
                    {!isEditing && (
                      <Text
                        x={seat.cx - 24}
                        y={seat.cy - 10}
                        width={48}
                        align="center"
                        text={n.number}
                        fontFamily={font}
                        fontSize={n.number.length > 3 ? 13 : 18}
                        fill={look.tint}
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
                points={outlineOf(s, false)}
                closed
                fill={s.color}
                opacity={isSel ? 1 : 0.92}
                lineJoin="round"
                hitStrokeWidth={10}
                stroke={isSel ? ACCENT : s.color}
                strokeWidth={isSel ? 1 : 0.5}
                {...(isSel ? { shadowColor: ACCENT, shadowBlur: 6 } : {})}
                onMouseDown={(e) => pick(s.id, e.evt.shiftKey)}
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
          const h = noteHeight(n)
          const blank = n.kind === "blank"
          const valued = takesValue(n.kind)
          const seat = ringSeat(h)
          const tb = titleBox(n, h)
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
                onBlur={onEditorBlur}
                onKeyDown={onEditorKey}
                rows={blank ? 1 : 2}
                style={{
                  ...field,
                  position: "absolute",
                  left: tb.x,
                  top: blank ? (h - HAND * 1.05) / 2 : tb.y,
                  width: tb.w,
                  fontSize: HAND,
                  lineHeight: 1.05,
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
                    left: seat.cx - 20,
                    top: seat.cy - 11,
                    width: 40,
                    textAlign: "center",
                    fontSize: 18,
                    lineHeight: 1,
                    color: look.tint,
                  }}
                />
              )}
            </div>
          )
        },
      })}

      {/* the fan: from a picked note's corner, the kinds spring open on an arc */}
      {Option.match(fanNote, {
        onNone: () => null,
        onSome: (n) => <KindFan note={n} padWidth={width} onPick={(k) => set(rekind(page, [n.id], k))} onRemove={removePicked} />,
      })}
    </div>
  )
}

const FAN_RADIUS = 74
const FAN_ITEM = 22

/**
 * The radial menu: anchored on the note's top-right corner, where its sigil
 * sits. Seven kinds and a remove, each springing out along the arc in turn.
 * The arc opens rightward from the top-right corner when there is room, and
 * leftward from the top-left corner otherwise; tilted down near the top.
 */
function KindFan({ note, padWidth, onPick, onRemove }: { note: Note; padWidth: number; onPick: (kind: NoteKind) => void; onRemove: () => void }) {
  const [hovered, setHovered] = useState<Option.Option<number>>(Option.none())
  const right = note.x + NOTE_W + FAN_RADIUS + FAN_ITEM + 60 <= padWidth
  // too near the top and the arc would reach into the toolbar: tilt it down
  const first = note.y >= FAN_RADIUS + 4 ? -75 : -20
  const items: ReadonlyArray<{ word: string; tint: string; glyph: string; act: () => void; current: boolean }> = [
    ...KINDS.map((k) => ({ ...kindLook(k), act: () => onPick(k), current: note.kind === k })),
    { word: "remove", tint: DIM, glyph: "M4 4 L12 12 M12 4 L4 12", act: onRemove, current: false },
  ]
  const span = 150
  const angleOf = (i: number) => {
    const a = first + (span / (items.length - 1)) * i
    return ((right ? a : 180 - a) * Math.PI) / 180
  }
  return (
    <div style={{ position: "absolute", left: right ? note.x + NOTE_W : note.x, top: note.y, width: 0, height: 0 }} onMouseDown={(e) => e.preventDefault()}>
      {items.map((it, i) => {
        const a = angleOf(i)
        const x = Math.cos(a) * FAN_RADIUS
        const y = Math.sin(a) * FAN_RADIUS
        const isHover = Option.contains(hovered, i)
        return (
          <motion.button
            key={it.word}
            type="button"
            aria-label={it.word}
            aria-pressed={it.current}
            onClick={it.act}
            onMouseEnter={() => setHovered(Option.some(i))}
            onMouseLeave={() => setHovered(Option.none())}
            initial={{ x: -FAN_ITEM / 2, y: -FAN_ITEM / 2, scale: 0, opacity: 0 }}
            animate={{ x: x - FAN_ITEM / 2, y: y - FAN_ITEM / 2, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 520, damping: 30, delay: i * 0.022 }}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: FAN_ITEM,
              height: FAN_ITEM,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: "var(--panel)",
              border: `1px solid ${it.tint}`,
              boxShadow: it.current ? `0 0 0 2px var(--panel), 0 0 0 3px ${it.tint}` : "0 1px 4px rgba(0,0,0,.5)",
              color: it.tint,
              opacity: it.current || isHover ? 1 : 0.8,
              cursor: "pointer",
              padding: 0,
            }}
          >
            <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={it.glyph} />
            </svg>
            {/* the word, only for the kind under the pointer, just beyond its glyph */}
            {isHover && (
              <span
                className="mv-eyebrow"
                style={{
                  position: "absolute",
                  ...(right ? { left: FAN_ITEM + 6 } : { right: FAN_ITEM + 6 }),
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: it.tint,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                }}
              >
                {it.word}
              </span>
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
