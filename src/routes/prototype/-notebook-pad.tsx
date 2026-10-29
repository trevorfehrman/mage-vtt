// PROTOTYPE — throwaway (MAG-75 audition, 2026-10-28). The mage's notebook
// drawn with react-konva: the page is a plain array of notes and ink
// (Schema, in -notebook-page.ts), Konva only renders it; every edit is a pure
// function over the page, and undo / redo is a history of pages. Client-only
// (Konva needs a window), so the route lazy-loads this file inside ClientOnly.
// No app imports; mock only.
//
// Look-and-feel round, "the ruled lattice" (owner's pick, 2026-10-28): quiet
// magic in what the page does — a lattice of dots the notes settle onto, a
// category glyph in the gutter beside each note, a ringed seat for a value,
// the mage's Path glyph as a faint bookplate. One write tool: click the page
// and a note opens; click a note to pick it; double-click to rewrite; drag and
// it drifts to the ruling. The pen stays its own tool.
import { useEffect, useMemo, useRef, useState, type FocusEvent as RFocusEvent, type KeyboardEvent as RKeyboardEvent } from "react"
import { Match, Option } from "effect"
import { Group, Layer, Line, Path, Rect, Stage, Text } from "react-konva"
import Konva from "konva"
import { getStroke } from "perfect-freehand"
import {
  addInk,
  BLANK,
  commit,
  duplicateNote,
  GRID,
  GRID_TICK_EVERY,
  hash,
  KINDS,
  kindLook,
  moveNote,
  noteHeight,
  NOTE_W,
  placeAt,
  redo,
  rekind,
  removeInk,
  removeNote,
  retitle,
  revalue,
  snapPoint,
  takesValue,
  undo,
  wobblyRect,
  wobblyRing,
  type History,
  type Ink,
  type Note,
  type NoteKind,
  type Page,
  type Tool,
} from "./-notebook-page"

type Picked = { readonly kind: "note"; readonly id: string } | { readonly kind: "ink"; readonly id: string }
type Editing = { readonly id: string; readonly focus: "title" | "number" }

/** The knobs the route hands down: the ruling and the note's frame. */
export type Rule = "dots" | "lines" | "none"
export type Frame = "stroke" | "plate" | "none"

/** The pen's character (perfect-freehand): a nib that thins with speed or pressure, smoothed, tapered at both ends. */
const PEN = { size: 5, thinning: 0.65, smoothing: 0.55, streamline: 0.5, start: { taper: 24 }, end: { taper: 32 } }

const INK = "#d7d2e0"
const DIM = "#807b8f"
const ACCENT = "#6fae97"

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

/** Where the value sits on a note: a ring at the right, on the note's midline. */
const ringSeat = (h: number) => ({ cx: NOTE_W - 30, cy: h / 2 + 5, r: 17 })

export function NotebookPad({
  font,
  tool,
  inkColor,
  rule,
  frame,
  history,
  onHistory,
  width,
  height,
}: {
  font: string
  tool: Tool
  inkColor: string
  rule: Rule
  frame: Frame
  history: History
  onHistory: (h: History) => void
  width: number
  height: number
}) {
  const page = history.present
  const [picked, setPicked] = useState<Option.Option<Picked>>(Option.none())
  const [editing, setEditing] = useState<Option.Option<Editing>>(Option.none())
  const [stroke, setStroke] = useState<Option.Option<Ink>>(Option.none())
  const [fontsReady, setFontsReady] = useState(0)
  const stamped = useRef(0)
  const stageRef = useRef<Konva.Stage>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const valueRef = useRef<HTMLInputElement>(null)
  /** When the editor last closed: the click that closed it must not open another note. */
  const closedAt = useRef(0)

  const tile = useMemo(() => rulingTile(rule), [rule])

  // Konva measures text at draw time, so the layer redraws once the hand is loaded.
  useEffect(() => {
    let live = true
    void document.fonts.load(`22px "${font}"`).then(() => {
      if (live) setFontsReady((n) => n + 1)
    })
    return () => {
      live = false
    }
  }, [font])

  const set = (next: Page) => onHistory(commit(history, next))
  const pickedNote = Option.flatMap(picked, (p) => (p.kind === "note" ? Option.some(p.id) : Option.none()))
  const pickedInk = Option.flatMap(picked, (p) => (p.kind === "ink" ? Option.some(p.id) : Option.none()))
  const noteById = (id: string): Option.Option<Note> => Option.fromNullishOr(page.notes.find((n) => n.id === id))

  const removePicked = () =>
    Option.match(picked, {
      onNone: () => undefined,
      onSome: (p) => {
        set(p.kind === "note" ? removeNote(page, p.id) : removeInk(page, p.id))
        setPicked(Option.none())
      },
    })

  const onKey = (e: RKeyboardEvent<HTMLDivElement>) => {
    if (Option.isSome(editing)) return
    const meta = e.metaKey || e.ctrlKey
    if (meta && e.key.toLowerCase() === "z") {
      e.preventDefault()
      onHistory(e.shiftKey ? redo(history) : undo(history))
      return
    }
    if (meta && e.key.toLowerCase() === "d" && Option.isSome(pickedNote)) {
      e.preventDefault()
      set(duplicateNote(page, pickedNote.value))
      return
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault()
      removePicked()
      return
    }
    if (e.key === "Escape") setPicked(Option.none())
    // 1–7 swap the picked note's kind, in the strip's order
    const digit = Number.parseInt(e.key, 10)
    if (Option.isSome(pickedNote) && digit >= 1 && digit <= KINDS.length) {
      const kind = KINDS[digit - 1]
      if (kind !== undefined) set(rekind(page, pickedNote.value, kind))
    }
  }

  // --- the editor: the note's words and, when its kind takes one, its value ---

  const openEditor = (n: Note, focus: "title" | "number") => {
    setPicked(Option.some({ kind: "note", id: n.id }))
    setEditing(Option.some({ id: n.id, focus }))
  }
  const closeEditor = (keep: boolean) =>
    Option.map(editing, (ed) => {
      closedAt.current = Date.now()
      Option.map(noteById(ed.id), (n) => {
        const title = keep ? (titleRef.current?.value ?? n.title) : n.title
        const number = keep ? (valueRef.current?.value ?? n.number) : n.number
        const next = title.trim() === "" && n.kind === "blank" ? removeNote(page, ed.id) : revalue(retitle(page, ed.id, title), ed.id, number.trim())
        set(next)
      })
      setEditing(Option.none())
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

  const pointer = (): Option.Option<{ x: number; y: number }> =>
    Option.fromNullishOr(stageRef.current?.getPointerPosition())
  /** The pen's pressure when the device reports one; a mouse says 0.5 and we say so. */
  const pressureOf = (evt: Event): { p: number; real: boolean } =>
    evt instanceof PointerEvent && evt.pointerType === "pen" ? { p: evt.pressure, real: true } : { p: 0.5, real: false }

  // the pointer on the bare page, by tool: the pen begins a stroke; the
  // write tool waits for the click (below), because the mousedown's own
  // default action moves focus to the pad and would blur an editor opened
  // this early
  const onStageDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    Match.value(tool).pipe(
      Match.when("write", () => undefined),
      Match.when("pen", () => {
        Option.map(pointer(), (p) => {
          const pr = pressureOf(e.evt)
          setStroke(Option.some({ id: `i${Date.now().toString(36)}`, points: [p.x, p.y, pr.p], color: inkColor, pressured: pr.real }))
        })
      }),
      Match.exhaustive,
    )
  }
  // the write tool: a click on the bare page writes a note there and opens
  // it — unless the click is the one that just closed an editor
  const onStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool !== "write" || e.target !== e.target.getStage()) return
    if (Date.now() - closedAt.current < 250) {
      setPicked(Option.none())
      return
    }
    Option.map(pointer(), (p) => {
      stamped.current += 1
      const next = placeAt(page, BLANK, p.x - 12, p.y - 16, stamped.current)
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

  /** A dropped note drifts to the lattice, then the page records where it settled. */
  const settle = (n: Note, node: Konva.Node) => {
    const p = snapPoint(node.x(), node.y())
    node.to({
      x: p.x,
      y: p.y,
      duration: 0.16,
      easing: Konva.Easings.EaseOut,
      onFinish: () => set(moveNote(page, n.id, p.x, p.y)),
    })
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
  const stripNote = Option.isSome(editing) ? Option.none<Note>() : Option.flatMap(pickedNote, noteById)

  return (
    <div
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
            <Rect x={0} y={0} width={width} height={height} fillPatternImage={tile as unknown as HTMLImageElement /* Konva draws any CanvasImageSource; its type names only an image */} fillPatternRepeat="repeat" fillPatternScale={{ x: 0.5, y: 0.5 }} />
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
            const isSel = Option.contains(pickedNote, n.id)
            const blank = n.kind === "blank"
            const isEditing = Option.exists(editing, (ed) => ed.id === n.id)
            const valued = takesValue(n.kind)
            const seat = ringSeat(h)
            const textX = blank ? 12 : 32
            const textW = NOTE_W - textX - (valued ? 62 : 12)
            const framed = frame === "stroke" && !blank
            return (
              <Group
                key={n.id}
                id={n.id}
                ref={land}
                x={n.x}
                y={n.y}
                rotation={n.rot}
                draggable={tool === "write"}
                onMouseDown={() => setPicked(Option.some({ kind: "note", id: n.id }))}
                onDragEnd={(e) => settle(n, e.target)}
                onDblClick={() => openEditor(n, "title")}
              >
                {/* the plate: the hit area, and a breath of fill when the frame asks for it */}
                <Rect width={NOTE_W} height={h} fill={INK} opacity={blank || frame === "none" ? 0.001 : frame === "plate" ? 0.05 : 0.03} cornerRadius={2} />
                {(framed || isSel) && (
                  <Line
                    points={wobblyRect(hash(n.id), NOTE_W, h)}
                    stroke={isSel ? ACCENT : look.tint}
                    strokeWidth={isSel ? 1.5 : 1}
                    opacity={isSel ? (blank ? 0.55 : 1) : 0.6}
                    {...(isSel && !framed ? { dash: [4, 5] } : {})}
                    lineJoin="round"
                    tension={0.02}
                  />
                )}
                {/* the gutter: the kind's glyph and word, the scholar's marginal mark */}
                {!blank && (
                  <>
                    <Path x={8} y={8} data={look.glyph} stroke={look.tint} strokeWidth={1.3} lineCap="round" lineJoin="round" />
                    <Text x={32} y={11} text={look.eyebrow} fontFamily="JetBrains Mono" fontSize={9} letterSpacing={1.6} fill={look.tint} />
                  </>
                )}
                {n.lasts === "scene" && (
                  <Text x={NOTE_W - 74} y={11} width={62} align="right" text="this scene" fontFamily={font} fontSize={12} fill={DIM} />
                )}
                {!isEditing && (
                  <Text
                    x={textX}
                    y={blank ? 12 : 26}
                    width={textW}
                    text={blank && n.title === "" ? "write…" : n.title}
                    fontFamily={font}
                    fontSize={21}
                    lineHeight={1.05}
                    fill={blank && n.title === "" ? DIM : INK}
                    opacity={blank && n.title === "" ? 0.6 : 1}
                    wrap="word"
                    ellipsis
                  />
                )}
                {/* the value's seat: a ring at the right; faint and dashed until a value is written */}
                {valued && (
                  <Group onClick={() => openEditor(n, "number")}>
                    <Line
                      points={wobblyRing(hash(n.id) + 7, seat.cx, seat.cy, seat.r)}
                      stroke={look.tint}
                      strokeWidth={1.1}
                      opacity={n.number === "" ? 0.35 : 0.85}
                      {...(n.number === "" ? { dash: [3, 4] } : {})}
                      tension={0.4}
                      lineJoin="round"
                    />
                    {!isEditing && (
                      <Text
                        x={seat.cx - 28}
                        y={seat.cy - 12}
                        width={56}
                        align="center"
                        text={n.number}
                        fontFamily={font}
                        fontSize={n.number.length > 3 ? 15 : 22}
                        fill={look.tint}
                      />
                    )}
                  </Group>
                )}
              </Group>
            )
          })}
        </Layer>
        <Layer listening={tool === "write"}>
          {page.ink.map((s) => {
            const isSel = Option.contains(pickedInk, s.id)
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
                onMouseDown={() => setPicked(Option.some({ kind: "ink", id: s.id }))}
              />
            )
          })}
          {Option.match(stroke, {
            onNone: () => null,
            onSome: (s) => (
              <Line points={outlineOf(s, true)} closed fill={s.color} opacity={0.92} lineJoin="round" listening={false} />
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
          const textX = blank ? 12 : 32
          const textW = NOTE_W - textX - (valued ? 62 : 12)
          const look = kindLook(n.kind)
          return (
            <div ref={editorRef} style={{ position: "absolute", left: n.x, top: n.y, width: NOTE_W, height: h, pointerEvents: "none" }}>
              <textarea
                ref={titleRef}
                autoFocus={ed.focus === "title"}
                defaultValue={n.title}
                placeholder="write…"
                onBlur={onEditorBlur}
                onKeyDown={onEditorKey}
                rows={2}
                style={{
                  position: "absolute",
                  left: textX,
                  top: blank ? 12 : 26,
                  width: textW,
                  pointerEvents: "auto",
                  fontFamily: font,
                  fontSize: 21,
                  lineHeight: 1.05,
                  color: INK,
                  background: "transparent",
                  border: 0,
                  outline: "none",
                  padding: 0,
                  margin: 0,
                  resize: "none",
                  caretColor: ACCENT,
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
                    position: "absolute",
                    left: seat.cx - 22,
                    top: seat.cy - 13,
                    width: 44,
                    pointerEvents: "auto",
                    textAlign: "center",
                    fontFamily: font,
                    fontSize: 22,
                    lineHeight: 1,
                    color: look.tint,
                    background: "transparent",
                    border: 0,
                    outline: "none",
                    padding: 0,
                    margin: 0,
                    caretColor: ACCENT,
                  }}
                />
              )}
            </div>
          )
        },
      })}

      {/* the kind strip: beside a picked note, one click swaps its category */}
      {Option.match(stripNote, {
        onNone: () => null,
        onSome: (n) => {
          const h = noteHeight(n)
          const below = n.y + h + 30 < height
          const stripW = 452
          return (
            <div
              style={{
                position: "absolute",
                left: Math.min(n.x, width - stripW),
                top: below ? n.y + h + 6 : n.y - 26,
                display: "flex",
                alignItems: "center",
                gap: 4,
                whiteSpace: "nowrap",
                width: "max-content",
                padding: "2px 4px",
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 2,
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {KINDS.map((k, i) => (
                <KindChip key={k} kind={k} nth={i + 1} current={n.kind === k} onPick={() => set(rekind(page, n.id, k))} />
              ))}
              <span style={{ width: 1, height: 12, background: "var(--line)", margin: "0 2px" }} />
              <button
                type="button"
                onClick={removePicked}
                className="mv-eyebrow"
                style={{ padding: "1px 5px", color: DIM, cursor: "pointer", border: 0, background: "transparent", lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          )
        },
      })}
    </div>
  )
}

function KindChip({ kind, nth, current, onPick }: { kind: NoteKind; nth: number; current: boolean; onPick: () => void }) {
  const look = kindLook(kind)
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={current}
      className="mv-eyebrow"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 5px",
        borderRadius: 2,
        border: `1px solid ${current ? look.tint : "transparent"}`,
        color: look.tint,
        opacity: current ? 1 : 0.75,
        cursor: "pointer",
        background: "transparent",
        lineHeight: 1,
      }}
    >
      {look.glyph !== "" && (
        <svg width={11} height={11} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={look.glyph} />
        </svg>
      )}
      <span>{kind === "blank" ? "note" : look.eyebrow.toLowerCase()}</span>
      <span style={{ opacity: 0.45, fontSize: 8 }}>{nth}</span>
    </button>
  )
}
