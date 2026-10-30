// The mage's notebook on the sheet (MAG-75, ADR-0027): the panel under the
// title card — shut, a closed notebook; open, the toolbar and the pad.
// Shut by default and slim (owner, 2026-10-29: the resting height is the
// cover's; "so long as the animation is smooth like our other height
// expanders"), it opens on the sheet's one fold curve, and the pad — Konva,
// client-only — is loaded the first time it opens and stays mounted after,
// so a second opening is instant and the page in hand is kept.
//
// The cover (owner, 2026-10-29: "style the collapsed notebook to something
// that _gestures_ to a closed notebook"): the panel's face with the mage's
// name written on it in the hand, the seven kind tabs peeking past its
// right edge as the index tabs of a shut notebook do (lit where the book
// holds that kind), and the ribbon's tail hanging out of its foot where the
// bookmark sits in the book. A tap anywhere on the cover opens it; the
// cover folds away as the page folds open. "Used, not worn": nothing on it
// is wear — the name, the tabs and the ribbon are the mage's own doing.
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
import { Circle, Eraser, Feather, Group, MousePointer2, Redo2, Search, Square, Undo2, Ungroup } from "lucide-react"
import type { Id } from "../../../convex/_generated/dataModel"
import { Input } from "#/components/ui/input"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "#/components/ui/alert-dialog"
import { clearPage, commit, editOpen, FILLS, isBlankPage, isOneGroup, KINDS, ofKind, openPage, pagesHolding, PAGES, redo, SHAPES, toggleGroup, undo, type Fill, type History, type ShapeKind } from "#/domain/notebook"
import { useNotebook } from "#/hooks/use-notebook"
import { Fold } from "./Fold"
import { FOOTER_H, freshStamp, HAND_FONT, HAND_FONT_HREF, INKS, kindLook, PAGE_H, PAGE_W, RIBBON, type Tool } from "./notebook-look"

const Pad = lazy(() => import("./NotebookPad").then((m) => ({ default: m.NotebookPad })))

/** The cover's height, and the ribbon's tail hanging from its foot: narrower than the open book's, as a shut book shows less of it. */
const COVER_H = 52
const COVER_RIBBON_W = 14
const COVER_TAIL = 16
const COVER_NOTCH = 6
/** The cover's tabs: ticks past the right edge, one per kind, standing a little further where the book holds that kind. */
const TICK_H = 4
const TICK_GAP = 2
const TICK_OUT = 8
const TICK_OUT_HELD = 11

/** The notebook with its store: the sheet's composition (every member reads; the hand that drives the sheet writes). */
export function SheetNotebook({ sessionId, characterId, editable, cover }: { sessionId: Id<"sessions">; characterId: Id<"characters">; editable: boolean; cover: string }) {
  const { history, setHistory } = useNotebook(sessionId, characterId, editable)
  return <Notebook history={history} onHistory={(h) => setHistory(h)} editable={editable} cover={cover} />
}

/**
 * The notebook as a controlled panel: the history is the caller's (the store
 * on the sheet, a plain state on the gallery). `history` undefined = the
 * pages have not arrived; the cover shows and will not open. `cover` is
 * what is written on the cover: the mage's name.
 */
export function Notebook({ history, onHistory, editable, cover }: { history: History | undefined; onHistory: (h: History) => void; editable: boolean; cover: string }) {
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
  /** The eraser asks before it clears the page (owner, 2026-10-29: "that seems dangerous"). */
  const [clearing, setClearing] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const stamped = useRef(0)

  // the hand, loaded once for the page: the cover wears it too
  useEffect(() => {
    if (document.getElementById("mv-hand-font") !== null) return
    const link = document.createElement("link")
    link.id = "mv-hand-font"
    link.rel = "stylesheet"
    link.href = HAND_FONT_HREF
    document.head.appendChild(link)
  }, [])

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
  const lift = () => {
    if (history === undefined) return
    setOpen(true)
    setEverOpen(true)
  }
  const shut = () => setOpen(false)

  const page = history === undefined ? undefined : openPage(history.present)
  const empty = page === undefined || isBlankPage(page)
  const oneGroup = page !== undefined && isOneGroup(page, picked)
  const set = (f: (h: History) => History) => {
    if (history !== undefined) onHistory(f(history))
  }
  const stamp = () => freshStamp(stamped)
  const clear = () => set((h) => commit(h, editOpen(h.present, clearPage)))
  const group = () => set((h) => commit(h, editOpen(h.present, (p) => toggleGroup(p, picked, stamp()))))
  const openPageNumber = history === undefined ? 1 : history.present.open + 1
  const mark = history === undefined ? 0 : history.present.mark
  /** Which kinds the book holds anywhere: those tabs stand further out on the cover. */
  const held = KINDS.map((k) => history !== undefined && pagesHolding(history.present, ofKind(k)).length > 0)

  return (
    <div className="mv-panel relative" style={{ padding: 0 }}>
      {/* the eraser's question: the page goes whole — its notes, its ink, its shapes; the other eight stay; ⌘Z brings it back until the sheet is left */}
      <AlertDialog open={clearing} onOpenChange={setClearing}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear page {openPageNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              Every note, stroke and shape on this page goes. The other pages stay. Undo brings it back until you leave the sheet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={toPad}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clear()
                toPad()
              }}
            >
              Clear the page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* the cover: folds away as the page folds open */}
      <Fold open={!open} bleed>
        <button
          type="button"
          onClick={lift}
          aria-expanded={open}
          aria-label={`open ${cover}'s notebook`}
          disabled={history === undefined}
          className="mv-key mv-notebook-cover relative block w-full text-left"
          style={{ height: COVER_H, padding: "0 16px", background: "transparent", border: 0, cursor: history === undefined ? "default" : "pointer" }}
        >
          {/* the name on the cover, in the hand */}
          <span className="mv-notebook-cover-name" style={{ fontFamily: HAND_FONT, fontSize: 17, lineHeight: 1, color: "var(--dim)", transition: "color 160ms" }}>
            {cover}
          </span>
          {/* the tabs' edges, past the right edge of the cover */}
          <span aria-hidden className="absolute" style={{ left: "100%", top: (COVER_H - (KINDS.length * (TICK_H + TICK_GAP) - TICK_GAP)) / 2, width: TICK_OUT_HELD + 1 }}>
            {KINDS.map((k, i) => (
              <span
                key={k}
                className="absolute"
                style={{
                  left: 0,
                  top: i * (TICK_H + TICK_GAP),
                  width: held[i] ? TICK_OUT_HELD : TICK_OUT,
                  height: TICK_H,
                  background: kindLook(k).tint,
                  opacity: held[i] ? 0.85 : 0.22,
                  borderRadius: "0 2px 2px 0",
                  transition: "width 160ms, opacity 160ms",
                }}
              />
            ))}
          </span>
          {/* the ribbon's tail, out of the cover's foot where the bookmark sits in the book */}
          <span
            aria-hidden
            className="absolute"
            style={{
              top: "100%",
              left: `calc(${((mark + 0.5) / PAGES) * 100}% - ${COVER_RIBBON_W / 2}px)`,
              width: COVER_RIBBON_W,
              height: COVER_TAIL,
              background: RIBBON,
              clipPath: `polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - ${COVER_NOTCH}px), 0 100%)`,
              filter: "drop-shadow(0 2px 3px rgba(0,0,0,.5))",
              transition: "left 220ms ease-out",
            }}
          />
        </button>
      </Fold>

      {/* the body: the page is the panel's width, the tabs stand past its right edge, the ribbon's tail past its foot */}
      <Fold open={open} bleed>
        <div className="grid gap-3" style={{ paddingTop: 12 }}>
          {/* the toolbar, in the panel's gutter; the book shuts from its left */}
          <div className="flex items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-1">
              <button type="button" onClick={shut} aria-label="shut the notebook" className="mv-key mv-eyebrow mr-2 flex items-center gap-1.5" style={{ color: "var(--dim)" }}>
                shut
              </button>
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
                  <ToolButton label="clear page" on={false} disabled={empty} onClick={() => setClearing(true)}>
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
