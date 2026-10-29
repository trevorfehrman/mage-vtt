// PROTOTYPE — throwaway (MAG-75 audition, 2026-10-28). The mage's notebook
// drawn with react-konva: the page is a plain array of notes and ink
// (Schema, in -notebook-page.ts), Konva only renders it; every edit is a pure
// function over the page, and undo / redo is a history of pages. Client-only
// (Konva needs a window), so the route lazy-loads this file inside ClientOnly.
// No app imports; mock only.
import { useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent } from "react"
import { Match, Option } from "effect"
import { Group, Layer, Line, Rect, Stage, Text } from "react-konva"
import type Konva from "konva"
import {
  addInk,
  commit,
  duplicateNote,
  hash,
  kindLook,
  moveNote,
  noteHeight,
  NOTE_W,
  placeAt,
  redo,
  removeInk,
  removeNote,
  retitle,
  STAMPS,
  undo,
  wobblyRect,
  type History,
  type Ink,
  type Note,
  type Page,
  type Tool,
} from "./-notebook-page"

type Picked = { readonly kind: "note"; readonly id: string } | { readonly kind: "ink"; readonly id: string }
type Editing = { readonly id: string; readonly x: number; readonly y: number; readonly w: number; readonly text: string }

const BLANK = STAMPS[STAMPS.length - 1]!

export function NotebookPad({
  font,
  tool,
  inkColor,
  history,
  onHistory,
  width,
  height,
}: {
  font: string
  tool: Tool
  inkColor: string
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
  }

  const editBox = (n: Note): Editing => ({
    id: n.id,
    x: n.x,
    y: n.y + (n.kind === "blank" ? 6 : 22),
    w: NOTE_W,
    text: n.title,
  })

  const pointer = (): Option.Option<{ x: number; y: number }> =>
    Option.fromNullishOr(stageRef.current?.getPointerPosition())

  // the pointer on the bare page, by tool: select clears the pick, pen
  // begins a stroke; the text tool waits for the click (below), because the
  // mousedown's own default action moves focus to the pad and would blur an
  // editor opened this early
  const onStageDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const onPage = e.target === e.target.getStage()
    Match.value(tool).pipe(
      Match.when("select", () => {
        if (onPage) setPicked(Option.none())
      }),
      Match.when("text", () => undefined),
      Match.when("pen", () => {
        Option.map(pointer(), (p) => {
          setStroke(Option.some({ id: `i${Date.now().toString(36)}`, points: [p.x, p.y], color: inkColor }))
        })
      }),
      Match.exhaustive,
    )
  }
  // the text tool writes a blank note where the page was clicked and opens it
  const onStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool !== "text" || e.target !== e.target.getStage()) return
    Option.map(pointer(), (p) => {
      stamped.current += 1
      const next = placeAt(page, BLANK, p.x - 8, p.y - 14, stamped.current)
      set(next)
      const n = next.notes[next.notes.length - 1]
      if (n) {
        setPicked(Option.some({ kind: "note", id: n.id }))
        setEditing(Option.some(editBox(n)))
      }
    })
  }
  const onStageMove = () => {
    if (tool !== "pen" || Option.isNone(stroke)) return
    Option.map(pointer(), (p) => {
      setStroke(Option.some({ ...stroke.value, points: [...stroke.value.points, p.x, p.y] }))
    })
  }
  const onStageUp = () => {
    if (Option.isNone(stroke)) return
    if (stroke.value.points.length >= 4) set(addInk(page, stroke.value))
    setStroke(Option.none())
  }

  const drawing = tool === "pen"
  const notesDraggable = tool === "select"

  return (
    <div
      tabIndex={0}
      onKeyDown={onKey}
      className="relative outline-none"
      style={{ width, height, background: "var(--panel)", cursor: drawing ? "crosshair" : tool === "text" ? "text" : "default" }}
      data-fonts={fontsReady}
    >
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        onMouseDown={onStageDown}
        onClick={onStageClick}
        onMouseMove={onStageMove}
        onMouseUp={onStageUp}
        onMouseLeave={onStageUp}
      >
        <Layer listening={!drawing}>
          {/* the page's faint rule, a notebook's lines */}
          {Array.from({ length: Math.floor(height / 28) }, (_, i) => (
            <Line key={i} points={[0, 28 * (i + 1), width, 28 * (i + 1)]} stroke="#d7d2e0" opacity={0.045} strokeWidth={1} />
          ))}
          {page.notes.map((n) => {
            const look = kindLook(n.kind)
            const h = noteHeight(n)
            const isSel = Option.contains(pickedNote, n.id)
            const blank = n.kind === "blank"
            const isEditing = Option.exists(editing, (ed) => ed.id === n.id)
            return (
              <Group
                key={n.id}
                id={n.id}
                x={n.x}
                y={n.y}
                rotation={n.rot}
                draggable={notesDraggable}
                onMouseDown={() => {
                  if (tool === "select") setPicked(Option.some({ kind: "note", id: n.id }))
                }}
                onDragEnd={(e) => set(moveNote(page, n.id, e.target.x(), e.target.y()))}
                onDblClick={() => {
                  if (tool === "select") setEditing(Option.some(editBox(n)))
                }}
              >
                {/* a blank is a scribble on the page: no frame unless picked */}
                <Rect width={NOTE_W} height={h} fill="#d7d2e0" opacity={blank ? 0.001 : 0.035} cornerRadius={2} />
                {(!blank || isSel) && (
                  <Line
                    points={wobblyRect(hash(n.id), NOTE_W, h)}
                    stroke={isSel ? "#6fae97" : look.tint}
                    strokeWidth={isSel ? 1.6 : 1.1}
                    opacity={isSel ? (blank ? 0.5 : 1) : 0.7}
                    {...(blank ? { dash: [4, 5] } : {})}
                    lineJoin="round"
                    tension={0.02}
                  />
                )}
                {look.eyebrow !== "" && (
                  <Text x={12} y={9} text={look.eyebrow} fontFamily="JetBrains Mono" fontSize={9} letterSpacing={1.6} fill={look.tint} />
                )}
                {n.lasts === "scene" && (
                  <Text x={NOTE_W - 58} y={8} text="this scene" fontFamily={font} fontSize={13} fill="#807b8f" />
                )}
                {n.onMe && n.kind !== "scene" && !blank && (
                  <Text x={NOTE_W - 34} y={h - 20} text="on me" fontFamily={font} fontSize={12} fill="#807b8f" />
                )}
                {!isEditing && (
                  <Text
                    x={12}
                    y={blank ? 8 : 24}
                    width={NOTE_W - 24}
                    text={blank && n.title === "" ? "write…" : n.title}
                    fontFamily={font}
                    fontSize={22}
                    fill={blank && n.title === "" ? "#807b8f" : "#d7d2e0"}
                    opacity={blank && n.title === "" ? 0.6 : 1}
                    wrap="word"
                  />
                )}
                {n.number !== "" && (
                  <Text x={12} y={h - 38} text={n.number} fontFamily={font} fontSize={30} fill={look.tint} />
                )}
              </Group>
            )
          })}
        </Layer>
        <Layer listening={tool === "select"}>
          {page.ink.map((s) => {
            const isSel = Option.contains(pickedInk, s.id)
            return (
              <Line
                key={s.id}
                points={[...s.points]}
                stroke={s.color}
                strokeWidth={isSel ? 3 : 2}
                opacity={isSel ? 1 : 0.9}
                tension={0.4}
                lineCap="round"
                lineJoin="round"
                hitStrokeWidth={14}
                {...(isSel ? { shadowColor: "#6fae97", shadowBlur: 6 } : {})}
                onMouseDown={() => setPicked(Option.some({ kind: "ink", id: s.id }))}
              />
            )
          })}
          {Option.match(stroke, {
            onNone: () => null,
            onSome: (s) => (
              <Line points={[...s.points]} stroke={s.color} strokeWidth={2} opacity={0.9} tension={0.4} lineCap="round" lineJoin="round" listening={false} />
            ),
          })}
        </Layer>
      </Stage>
      {Option.match(editing, {
        onNone: () => null,
        onSome: (ed) => (
          <textarea
            autoFocus
            defaultValue={ed.text}
            placeholder="write…"
            onBlur={(e) => {
              const text = e.currentTarget.value
              const isBlank = page.notes.some((n) => n.id === ed.id && n.kind === "blank")
              set(text.trim() === "" && isBlank ? removeNote(page, ed.id) : retitle(page, ed.id, text))
              setEditing(Option.none())
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                e.currentTarget.blur()
              }
              if (e.key === "Escape") setEditing(Option.none())
            }}
            rows={2}
            style={{
              position: "absolute",
              left: ed.x + 10,
              top: ed.y,
              width: ed.w - 20,
              fontFamily: font,
              fontSize: 22,
              lineHeight: 1.1,
              color: "#d7d2e0",
              background: "transparent",
              border: 0,
              borderBottom: "1px dashed #6fae97",
              outline: "none",
              padding: "0 2px",
              resize: "none",
              caretColor: "#6fae97",
            }}
          />
        ),
      })}
    </div>
  )
}
