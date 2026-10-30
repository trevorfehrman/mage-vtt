// The mage's notebook on the sheet (MAG-75, ADR-0027): the panel under the
// title card — a heading that opens it, and inside, the toolbar and the pad.
// Shut by default and slim (owner, 2026-10-29: the resting height is the
// heading's; "so long as the animation is smooth like our other height
// expanders"), it opens on the sheet's one fold curve, and the pad — Konva,
// client-only — is loaded the first time it opens and stays mounted after,
// so a second opening is instant and the page in hand is kept.
//
// The look-and-feel rounds, in the owner's words (2026-10-28/29): "a mage's
// note book is relatively neat. the handwriting is neat, a little scholarly
// ... click anywhere and start the note ... helpfully align to something ...
// categories need to be easy to swap ... easy to clear and change."
// "there are too many buttons in the tool bar ... a quill, undo and redo
// icons and a clear icon. we also need a select tool." "it would be cool to
// have a group button as well." ⌘F: "probably just a search field in the
// header of the notebook."
import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react"
import { ClientOnly } from "@tanstack/react-router"
import { ChevronDown, Circle, Eraser, Feather, Group, MousePointer2, Redo2, Search, Square, Undo2, Ungroup } from "lucide-react"
import type { Id } from "../../../convex/_generated/dataModel"
import { Input } from "#/components/ui/input"
import { clearPage, commit, editOpen, FILLS, isBlankPage, isOneGroup, openPage, redo, SHAPES, toggleGroup, undo, type Fill, type History, type ShapeKind } from "#/domain/notebook"
import { useNotebook } from "#/hooks/use-notebook"
import { Fold } from "./Fold"
import { FOOTER_H, freshStamp, HAND_FONT, HAND_FONT_HREF, INKS, PAGE_H, PAGE_W, type Tool } from "./notebook-look"

const Pad = lazy(() => import("./NotebookPad").then((m) => ({ default: m.NotebookPad })))

/** The notebook with its store: the sheet's composition (every member reads; the hand that drives the sheet writes). */
export function SheetNotebook({ sessionId, characterId, editable }: { sessionId: Id<"sessions">; characterId: Id<"characters">; editable: boolean }) {
  const { history, setHistory } = useNotebook(sessionId, characterId, editable)
  return <Notebook history={history} onHistory={(h) => setHistory(h)} editable={editable} />
}

/**
 * The notebook as a controlled panel: the history is the caller's (the store
 * on the sheet, a plain state on the gallery). `history` undefined = the
 * pages have not arrived; the heading shows and the fold holds a blank.
 */
export function Notebook({ history, onHistory, editable }: { history: History | undefined; onHistory: (h: History) => void; editable: boolean }) {
  const [open, setOpen] = useState(false)
  /** Once opened, the pad stays mounted: Konva's stage and the hand's place on the wheel survive a shut fold. */
  const [everOpen, setEverOpen] = useState(false)
  const [tool, setTool] = useState<Tool>("select")
  const [ink, setInk] = useState(INKS[0]!.color)
  /** The shape tool: which shape, filled how; its ink is the quill's. */
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rect")
  const [fill, setFill] = useState<Fill>("none")
  const [picked, setPicked] = useState<ReadonlyArray<string>>([])
  /** The word the book is read by; empty, the book is whole. */
  const [search, setSearch] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  const stamped = useRef(0)

  // the hand, loaded once for the page
  useEffect(() => {
    if (!open || document.getElementById("mv-hand-font") !== null) return
    const link = document.createElement("link")
    link.id = "mv-hand-font"
    link.rel = "stylesheet"
    link.href = HAND_FONT_HREF
    document.head.appendChild(link)
  }, [open])

  // ⌘F while the notebook is open goes to its field, not the browser's find
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  /** The hand goes back to the pad, so the arrows and the keys work at once. */
  const toPad = () => document.getElementById("notebook-pad")?.focus({ preventScroll: true })
  const toggle = () => {
    setOpen((o) => !o)
    setEverOpen(true)
  }

  const page = history === undefined ? undefined : openPage(history.present)
  const empty = page === undefined || isBlankPage(page)
  const oneGroup = page !== undefined && isOneGroup(page, picked)
  const set = (f: (h: History) => History) => {
    if (history !== undefined) onHistory(f(history))
  }
  const stamp = () => freshStamp(stamped)
  const clear = () => set((h) => commit(h, editOpen(h.present, clearPage)))
  const group = () => set((h) => commit(h, editOpen(h.present, (p) => toggleGroup(p, picked, stamp()))))
  const written = history === undefined ? 0 : history.present.pages.filter((p) => !isBlankPage(p)).length

  return (
    <div className="mv-panel grid gap-3 p-4">
      {/* the heading: the opener; shut, it is the whole notebook */}
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={toggle} aria-expanded={open} className="mv-key mv-eyebrow flex w-fit items-center gap-1.5" style={{ color: open ? "var(--ink)" : undefined }}>
          Notebook
          <ChevronDown size={10} strokeWidth={1.5} aria-hidden style={{ transition: "transform 200ms", transform: open ? "rotate(180deg)" : "none" }} />
        </button>
        {!open && history !== undefined && (
          <span className="mv-data" style={{ fontSize: 11, color: "var(--dim)" }}>
            {written === 0 ? "nine blank pages" : `${written} of 9 pages written · ribbon at ${history.present.mark + 1}`}
          </span>
        )}
      </div>

      {/* the body bleeds to the panel's edges: the page is the panel's width, the tabs stand past its right edge, the ribbon's tail past its foot */}
      <div style={{ marginLeft: -16, marginRight: -16, marginBottom: -16 }}>
        <Fold open={open} bleed>
          <div className="grid gap-3" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
            {/* the toolbar, in the panel's gutter */}
            <div className="flex items-center justify-between gap-3 px-4">
              <div className="flex items-center gap-1">
                {editable ? (
                  <>
                    <ToolButton label="select" on={tool === "select"} onClick={() => setTool("select")}>
                      <MousePointer2 size={15} strokeWidth={1.6} />
                    </ToolButton>
                    <ToolButton label="quill" on={tool === "pen"} onClick={() => setTool("pen")}>
                      <Feather size={15} strokeWidth={1.6} />
                    </ToolButton>
                    <ToolButton label="shape" on={tool === "shape"} onClick={() => setTool("shape")}>
                      <Square size={14} strokeWidth={1.6} />
                    </ToolButton>
                  </>
                ) : (
                  <span className="mv-data" style={{ fontSize: 11, color: "var(--dim)" }}>
                    another's pages — read, not written
                  </span>
                )}
                {editable && tool !== "select" && (
                  /* the inks, the six kinds': the quill's and the shapes' alike */
                  <span className="ml-2 flex items-center gap-[5px]">
                    {INKS.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setInk(c.color)}
                        aria-pressed={ink === c.color}
                        aria-label={`${c.name} ink`}
                        className="rounded-full"
                        style={{
                          width: 10,
                          height: 10,
                          background: c.color,
                          outline: ink === c.color ? "1px solid var(--accent)" : "1px solid transparent",
                          outlineOffset: 2,
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </span>
                )}
                {editable && tool === "shape" && (
                  /* the shape's options, small so the header keeps its width: the two shapes and one fill button that cycles none → hatch → wash and shows which */
                  <span className="ml-2 flex items-center gap-0.5">
                    <span className="mr-1.5 h-4 w-px" style={{ background: "var(--line)" }} />
                    {SHAPES.map((k) => (
                      <ToolButton key={k} label={k} on={shapeKind === k} small onClick={() => setShapeKind(k)}>
                        {k === "rect" ? <Square size={12} strokeWidth={1.6} /> : <Circle size={12} strokeWidth={1.6} />}
                      </ToolButton>
                    ))}
                    <span className="mx-1.5 h-4 w-px" style={{ background: "var(--line)" }} />
                    <ToolButton label={`fill ${fill}`} on={fill !== "none"} small onClick={() => setFill(FILLS[(FILLS.indexOf(fill) + 1) % FILLS.length] ?? "none")}>
                      <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden>
                        {fill === "hatch" && (
                          <>
                            <defs>
                              <pattern id="mv-hatch" width="3.5" height="3.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                                <line x1="0" y1="0" x2="0" y2="3.5" stroke="currentColor" strokeWidth="1" />
                              </pattern>
                            </defs>
                            <rect x={1.5} y={1.5} width={9} height={9} fill="url(#mv-hatch)" />
                          </>
                        )}
                        {fill === "wash" && <rect x={1.5} y={1.5} width={9} height={9} fill="currentColor" opacity={0.35} />}
                        <rect x={1.5} y={1.5} width={9} height={9} fill="none" stroke="currentColor" strokeWidth={1} />
                      </svg>
                    </ToolButton>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {/* the word: the repo's field, at the tool buttons' height; ⌘F lands here, Enter goes back to the page, Escape lets the word go */}
                <span className="relative flex items-center">
                  <Search size={13} strokeWidth={1.6} aria-hidden className="pointer-events-none absolute left-2" style={{ color: search === "" ? "var(--dim)" : "var(--accent)" }} />
                  <Input
                    ref={searchRef}
                    type="text"
                    aria-label="find"
                    placeholder="find…"
                    value={search}
                    spellCheck={false}
                    className="h-7 w-[140px] pl-7 text-[12px]"
                    style={{ borderRadius: 2 /* the tool buttons' rounded-sm; mv-field's own 3px would win over the utility */ }}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        toPad()
                      }
                      if (e.key === "Escape") {
                        e.preventDefault()
                        setSearch("")
                        toPad()
                      }
                    }}
                  />
                </span>
                {editable && (
                  <>
                    <span className="mx-1 h-4 w-px" style={{ background: "var(--line)" }} />
                    <ToolButton label={oneGroup ? "ungroup" : "group"} on={oneGroup} disabled={picked.length < 2} onClick={group}>
                      {oneGroup ? <Ungroup size={15} strokeWidth={1.6} /> : <Group size={15} strokeWidth={1.6} />}
                    </ToolButton>
                    <span className="mx-1 h-4 w-px" style={{ background: "var(--line)" }} />
                    <ToolButton label="undo" on={false} disabled={history === undefined || history.past.length === 0} onClick={() => set(undo)}>
                      <Undo2 size={15} strokeWidth={1.6} />
                    </ToolButton>
                    <ToolButton label="redo" on={false} disabled={history === undefined || history.future.length === 0} onClick={() => set(redo)}>
                      <Redo2 size={15} strokeWidth={1.6} />
                    </ToolButton>
                    <span className="mx-1 h-4 w-px" style={{ background: "var(--line)" }} />
                    <ToolButton label="clear" on={false} disabled={empty} onClick={clear}>
                      <Eraser size={15} strokeWidth={1.6} />
                    </ToolButton>
                  </>
                )}
              </div>
            </div>
            <div style={{ borderTop: "1px solid var(--line)", width: PAGE_W, height: PAGE_H + FOOTER_H }}>
              {everOpen && history !== undefined && (
                <ClientOnly fallback={null}>
                  <Suspense fallback={null}>
                    <Pad
                      font={HAND_FONT}
                      tool={editable ? tool : "select"}
                      inkColor={ink}
                      shapeKind={shapeKind}
                      fill={fill}
                      search={search}
                      picked={picked}
                      onPicked={setPicked}
                      history={history}
                      onHistory={onHistory}
                      width={PAGE_W}
                      height={PAGE_H}
                      readOnly={!editable}
                    />
                  </Suspense>
                </ClientOnly>
              )}
            </div>
          </div>
        </Fold>
      </div>
    </div>
  )
}

/** One toolbar control: an icon in a square, lit in the accent while its tool is in hand; small for a tool's own options. */
function ToolButton({ label, on, disabled, small, onClick, children }: { label: string; on: boolean; disabled?: boolean; small?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className="mv-key grid place-items-center rounded-sm border disabled:opacity-30"
      style={{
        width: small ? 22 : 28,
        height: small ? 22 : 28,
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
