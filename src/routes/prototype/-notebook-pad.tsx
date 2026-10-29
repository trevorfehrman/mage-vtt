// PROTOTYPE — throwaway (MAG-75 audition, 2026-10-28). The mage's notebook
// drawn with react-konva: the page is a plain array of notes (Schema), Konva
// only renders it; every edit is a pure function over the page, and undo /
// redo is a history of pages. Client-only (Konva needs a window), so the
// route lazy-loads this file inside ClientOnly. No app imports; mock only.
import { useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent } from "react"
import { Option } from "effect"
import { Group, Layer, Line, Rect, Stage, Text } from "react-konva"
import type Konva from "konva"

import {
  commit,
  duplicateNote,
  hash,
  kindLook,
  moveNote,
  noteHeight,
  NOTE_W,
  redo,
  removeNote,
  retitle,
  undo,
  wobblyRect,
  type History,
  type Note,
  type Page,
} from "./-notebook-page"

// --- The pad ---

export function NotebookPad({
  font,
  history,
  onHistory,
  width,
  height,
}: {
  font: string
  history: History
  onHistory: (h: History) => void
  width: number
  height: number
}) {
  const page = history.present
  const [selected, setSelected] = useState<Option.Option<string>>(Option.none())
  const [editing, setEditing] = useState<Option.Option<{ id: string; x: number; y: number; w: number; text: string }>>(Option.none())
  const [fontsReady, setFontsReady] = useState(0)
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

  const onKey = (e: RKeyboardEvent<HTMLDivElement>) => {
    if (Option.isSome(editing)) return
    const meta = e.metaKey || e.ctrlKey
    if (meta && e.key.toLowerCase() === "z") {
      e.preventDefault()
      onHistory(e.shiftKey ? redo(history) : undo(history))
      return
    }
    if (meta && e.key.toLowerCase() === "d" && Option.isSome(selected)) {
      e.preventDefault()
      set(duplicateNote(page, selected.value))
      return
    }
    if ((e.key === "Backspace" || e.key === "Delete") && Option.isSome(selected)) {
      e.preventDefault()
      set(removeNote(page, selected.value))
      setSelected(Option.none())
      return
    }
    if (e.key === "Escape") setSelected(Option.none())
  }

  const beginEdit = (n: Note) => {
    const stage = stageRef.current
    if (!stage) return
    const node = stage.findOne(`#${n.id}`)
    if (!node) return
    const box = node.getClientRect()
    setEditing(Option.some({ id: n.id, x: box.x, y: box.y + 22, w: box.width, text: n.title }))
  }

  return (
    <div
      tabIndex={0}
      onKeyDown={onKey}
      className="relative outline-none"
      style={{ width, height, background: "var(--panel)" }}
      data-fonts={fontsReady}
    >
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) setSelected(Option.none())
        }}
      >
        <Layer>
          {/* the page's faint rule, a notebook's lines */}
          {Array.from({ length: Math.floor(height / 28) }, (_, i) => (
            <Line key={i} points={[0, 28 * (i + 1), width, 28 * (i + 1)]} stroke="#d7d2e0" opacity={0.045} strokeWidth={1} />
          ))}
          {page.notes.map((n) => {
            const look = kindLook(n.kind)
            const h = noteHeight(n)
            const isSel = Option.contains(selected, n.id)
            return (
              <Group
                key={n.id}
                id={n.id}
                x={n.x}
                y={n.y}
                rotation={n.rot}
                draggable
                onMouseDown={() => setSelected(Option.some(n.id))}
                onDragEnd={(e) => set(moveNote(page, n.id, e.target.x(), e.target.y()))}
                onDblClick={() => beginEdit(n)}
              >
                <Rect width={NOTE_W} height={h} fill="#d7d2e0" opacity={0.035} cornerRadius={2} />
                <Line
                  points={wobblyRect(hash(n.id), NOTE_W, h)}
                  stroke={isSel ? "#6fae97" : look.tint}
                  strokeWidth={isSel ? 1.6 : 1.1}
                  opacity={isSel ? 1 : 0.7}
                  lineJoin="round"
                  tension={0.02}
                />
                {look.eyebrow !== "" && (
                  <Text x={12} y={9} text={look.eyebrow} fontFamily="JetBrains Mono" fontSize={9} letterSpacing={1.6} fill={look.tint} />
                )}
                {n.lasts === "scene" && (
                  <Text x={NOTE_W - 58} y={8} text="this scene" fontFamily={font} fontSize={13} fill="#807b8f" />
                )}
                {n.onMe && n.kind !== "scene" && n.kind !== "blank" && (
                  <Text x={NOTE_W - 34} y={h - 20} text="on me" fontFamily={font} fontSize={12} fill="#807b8f" />
                )}
                <Text x={12} y={look.eyebrow === "" ? 14 : 24} width={NOTE_W - 24} text={n.title} fontFamily={font} fontSize={22} fill="#d7d2e0" wrap="word" />
                {n.number !== "" && (
                  <Text x={12} y={h - 38} text={n.number} fontFamily={font} fontSize={30} fill={look.tint} />
                )}
              </Group>
            )
          })}
        </Layer>
      </Stage>
      {Option.match(editing, {
        onNone: () => null,
        onSome: (ed) => (
          <textarea
            autoFocus
            defaultValue={ed.text}
            onBlur={(e) => {
              set(retitle(page, ed.id, e.currentTarget.value))
              setEditing(Option.none())
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                e.currentTarget.blur()
              }
              if (e.key === "Escape") setEditing(Option.none())
            }}
            style={{
              position: "absolute",
              left: ed.x + 10,
              top: ed.y,
              width: ed.w - 20,
              fontFamily: font,
              fontSize: 22,
              lineHeight: 1.1,
              color: "#d7d2e0",
              background: "#0e0d13",
              border: "1px solid #6fae97",
              outline: "none",
              padding: "2px 4px",
              resize: "none",
            }}
          />
        ),
      })}
    </div>
  )
}
