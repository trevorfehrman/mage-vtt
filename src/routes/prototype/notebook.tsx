// PROTOTYPE — throwaway. MAG-75 audition (2026-10-28/29): the mage's
// notebook, the status space the owner asked for — "something like a
// notebook ... a mini whiteboard that's personal to the mage ... quick tools
// that add things that are categorical." Look-and-feel round, the owner's
// lodestars: "a mage's note book is relatively neat. the handwriting is
// neat, a little scholarly ... click anywhere and start the note ...
// helpfully align to something ... categories need to be easy to swap ...
// easy to clear and change ... how would a mage build a magic notebook."
// Round two: "kalam is the font ... there are too many buttons in the tool
// bar, it should be a typeset icon like Aa ... and a quill, undo and redo
// icons and a clear icon. we also need a select tool."
// Knob: ?rule=dots|lines|none. Tools: select, write, pen (three inks).
// Mock data; no Convex. DELETE once specced.
import { Suspense, lazy, useEffect, useState, type ReactNode } from "react"
import { ClientOnly, createFileRoute, useNavigate } from "@tanstack/react-router"
import { Eraser, Feather, MousePointer2, Redo2, Undo2 } from "lucide-react"
import { clearPage, EMPTY_PAGE, GRID, INKS, emptyHistory, redo, undo, type History, type Tool } from "./-notebook-page"
import type { Rule } from "./-notebook-pad"

const Pad = lazy(() => import("./-notebook-pad").then((m) => ({ default: m.NotebookPad })))

/** The hand: Kalam (owner, 2026-10-29: "kalam is the font"). */
const HAND = "Kalam"
const RULES = ["dots", "lines", "none"] as const
const isRule = (v: unknown): v is Rule => typeof v === "string" && (RULES as ReadonlyArray<string>).includes(v)

export const Route = createFileRoute("/prototype/notebook")({
  validateSearch: (search: Record<string, unknown>) => ({
    rule: isRule(search.rule) ? search.rule : ("dots" as Rule),
  }),
  component: Notebook,
})

const WIDTH = GRID * 32
const HEIGHT = GRID * 18

function Notebook() {
  const { rule } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [history, setHistory] = useState<History>(() => emptyHistory(EMPTY_PAGE))
  const [tool, setTool] = useState<Tool>("write")
  const [ink, setInk] = useState(INKS[0]!.color)

  // the hand, loaded only here
  useEffect(() => {
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = "https://fonts.googleapis.com/css2?family=Kalam:wght@300;400&display=swap"
    document.head.appendChild(link)
    return () => {
      link.remove()
    }
  }, [])

  const clear = () =>
    setHistory((h) => {
      const next = clearPage(h.present)
      return next === h.present ? h : { past: [...h.past, h.present], present: next, future: [] }
    })
  const empty = history.present.notes.length === 0 && history.present.ink.length === 0

  return (
    <div className="min-h-screen" style={{ background: "var(--void, #07060a)", color: "var(--ink)" }}>
      <div className="mx-auto grid gap-4 py-10" style={{ width: WIDTH }}>
        {/* a stand-in for the title card the notebook sits beneath */}
        <div className="mv-cornered mv-panel p-4">
          <h2 className="mv-h text-[30px] leading-none">The Little Bear</h2>
          <span className="mv-eyebrow">Gnosis 5 · Stamina 2 · title card stands here</span>
        </div>

        <div className="mv-panel mv-cornered grid gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <span className="mv-eyebrow mr-2 whitespace-nowrap">Notebook</span>
              <ToolButton label="select" on={tool === "select"} onClick={() => setTool("select")}>
                <MousePointer2 size={15} strokeWidth={1.6} />
              </ToolButton>
              <ToolButton label="write" on={tool === "write"} onClick={() => setTool("write")}>
                <span style={{ fontFamily: HAND, fontSize: 16, lineHeight: 1, marginTop: -2 }}>Aa</span>
              </ToolButton>
              <ToolButton label="pen" on={tool === "pen"} onClick={() => setTool("pen")}>
                <Feather size={15} strokeWidth={1.6} />
              </ToolButton>
              {tool === "pen" && (
                <span className="ml-2 flex items-center gap-2">
                  {INKS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setInk(c.color)}
                      aria-pressed={ink === c.color}
                      aria-label={c.name}
                      className="rounded-full"
                      style={{
                        width: 12,
                        height: 12,
                        background: c.color,
                        outline: ink === c.color ? "1px solid var(--accent)" : "1px solid transparent",
                        outlineOffset: 2,
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <ToolButton label="undo" on={false} disabled={history.past.length === 0} onClick={() => setHistory(undo)}>
                <Undo2 size={15} strokeWidth={1.6} />
              </ToolButton>
              <ToolButton label="redo" on={false} disabled={history.future.length === 0} onClick={() => setHistory(redo)}>
                <Redo2 size={15} strokeWidth={1.6} />
              </ToolButton>
              <span className="mx-1 h-4 w-px" style={{ background: "var(--line)" }} />
              <ToolButton label="clear" on={false} disabled={empty} onClick={clear}>
                <Eraser size={15} strokeWidth={1.6} />
              </ToolButton>
            </div>
          </div>
          <div style={{ marginLeft: -16, marginRight: -16, marginBottom: -16, borderTop: "1px solid var(--line)" }}>
            <ClientOnly fallback={<div style={{ width: WIDTH, height: HEIGHT }} />}>
              <Suspense fallback={<div style={{ width: WIDTH, height: HEIGHT }} />}>
                <Pad font={HAND} tool={tool} inkColor={ink} rule={rule} history={history} onHistory={setHistory} width={WIDTH} height={HEIGHT} />
              </Suspense>
            </ClientOnly>
          </div>
        </div>
        <p className="mv-data" style={{ fontSize: 11, color: "var(--dim)" }}>
          write: click the page and write · click a note to pick it, the fan or 1–7 swaps its kind, ⌫ removes · double-click rewrites · drag and it settles on the lattice · select: sweep, shift-click adds, ⌘A takes all; a drag moves them together · pen: draw; click a stroke to pick it · ⌘Z / ⇧⌘Z · ⌘D duplicates · the pad must have focus
        </p>
      </div>

      {/* The knob — foreign to the mv language on purpose. */}
      <div className="fixed top-1.5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-zinc-100 px-4 py-2 text-zinc-900 shadow-lg">
        {RULES.map((r) => (
          <button
            key={r}
            onClick={() => void navigate({ search: { rule: r }, replace: true })}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${r === rule ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-300"}`}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  )
}

/** One toolbar control: an icon in a square, lit in the accent while its tool is in hand. */
function ToolButton({ label, on, disabled, onClick, children }: { label: string; on: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className="grid place-items-center rounded-sm border disabled:opacity-30"
      style={{
        width: 28,
        height: 28,
        borderColor: on ? "var(--accent)" : "var(--line)",
        color: on ? "var(--accent)" : "var(--ink)",
        background: "transparent",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  )
}
