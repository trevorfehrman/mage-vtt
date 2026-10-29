// PROTOTYPE — throwaway. MAG-75 audition (2026-10-28/29): the mage's
// notebook, the status space the owner asked for — "something like a
// notebook ... a mini whiteboard that's personal to the mage ... quick tools
// that add things that are categorical." Look-and-feel round, the owner's
// lodestars: "a mage's note book is relatively neat. the handwriting is
// neat, a little scholarly ... click anywhere and start the note ...
// helpfully align to something ... categories need to be easy to swap ...
// easy to clear and change ... how would a mage build a magic notebook."
// Round three: "each note just needs three active areas, text value and
// symbol ... it would be cool to have a group button as well."
// Round two: "kalam is the font ... there are too many buttons in the tool
// bar, it should be a typeset icon like Aa ... and a quill, undo and redo
// icons and a clear icon. we also need a select tool."
// Round four: "regardless of what cursor i'm on clicking on the symbol should
// bring up that menu ... forgo the typography tool entirely if we left new
// note to be a double click ... mark should be red ... boost should be blue
// scene should be like a wine."
// The pagination round: "a note is an item on a page, a page is a page ...
// a notebook with its half folded around behind it ... feel. velocity ...
// quickly thumb through their notebook even if just for fun but arrive on
// the page they want quickly as well."
// The tabs round: seven tabs past the right edge; one held out thins the
// book to its kind (pages without it fall out, other kinds hide, the wheel
// runs over what is left). ⌘F: "probably just a search field in the header
// of the notebook" — the same thinning keyed by a word, the words lit.
// Knobs: ?rule=dots|lines|none; ?gap=0|2|3|4 (the gutter a plate keeps inside
// its lattice box); ?feel=soft|mid|far (the wheel's momentum); seed 1 / 8 / 40.
// The book is kept in localStorage between reloads (owner, 2026-10-29: "we
// can't test this iteratively if i have to fill out 10 pages or whatever
// each time myself"); a fresh browser opens on the 8-page seed.
// Mock data; no Convex. DELETE once specced.
import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react"
import { ClientOnly, createFileRoute, useNavigate } from "@tanstack/react-router"
import { Circle, Eraser, Feather, Group, MousePointer2, Redo2, Search, Square, Undo2, Ungroup } from "lucide-react"
import { Option, Schema } from "effect"
import { Input } from "#/components/ui/input"
import { Book, clearPage, commit, editOpen, EMPTY_BOOK, FILLS, GRID, grownBook, INKS, isBlankPage, emptyHistory, isOneGroup, openPage, redo, seedBook, SHAPES, toggleGroup, undo, type Fill, type History, type ShapeKind, type Tool } from "./-notebook-page"
import type { Feel, Rule } from "./-notebook-pad"

const Pad = lazy(() => import("./-notebook-pad").then((m) => ({ default: m.NotebookPad })))

/** The hand: Kalam (owner, 2026-10-29: "kalam is the font"). */
const HAND = "Kalam"
const RULES = ["dots", "lines", "none"] as const
const FEELS = ["soft", "mid", "far"] as const
const isFeel = (v: unknown): v is Feel => typeof v === "string" && (FEELS as ReadonlyArray<string>).includes(v)
const GAPS = [0, 2, 3, 4] as const
type Gap = (typeof GAPS)[number]
const isGap = (v: unknown): v is Gap => typeof v === "number" && (GAPS as ReadonlyArray<number>).includes(v)
const isRule = (v: unknown): v is Rule => typeof v === "string" && (RULES as ReadonlyArray<string>).includes(v)

export const Route = createFileRoute("/prototype/notebook")({
  validateSearch: (search: Record<string, unknown>) => ({
    rule: isRule(search.rule) ? search.rule : ("dots" as Rule),
    gap: isGap(search.gap) ? search.gap : (3 as Gap),
    feel: isFeel(search.feel) ? search.feel : ("mid" as Feel),
  }),
  component: Notebook,
})

const WIDTH = GRID * 32
const HEIGHT = GRID * 18
/** Where the rig keeps the book between reloads. */
const STORE = "mage-vtt:notebook-rig"
const decodeBook = Schema.decodeUnknownOption(Book)
const parseJson = Option.liftThrowable((raw: string): unknown => JSON.parse(raw))
/** The stored book (grown, if it was stored before shapes), or the seed when there is none or it no longer parses. */
const storedBook = (): Book => {
  const raw = window.localStorage.getItem(STORE)
  if (raw === null) return seedBook(5)
  return Option.getOrElse(Option.flatMap(parseJson(raw), (json) => decodeBook(grownBook(json))), () => seedBook(5))
}

function Notebook() {
  const { rule, gap, feel } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [history, setHistory] = useState<History<Book>>(() => emptyHistory(EMPTY_BOOK))
  const [loaded, setLoaded] = useState(false)
  const [tool, setTool] = useState<Tool>("select")
  const [ink, setInk] = useState(INKS[0]!.color)
  /** The shape tool: which shape, filled how; its ink is the quill's. */
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rect")
  const [fill, setFill] = useState<Fill>("none")
  const [picked, setPicked] = useState<ReadonlyArray<string>>([])
  /** The word the book is read by; empty, the book is whole. */
  const [search, setSearch] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  // ⌘F anywhere on the page goes to the field, not the browser's find
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  /** The hand goes back to the pad, so the arrows and the keys work at once. */
  const toPad = () => document.getElementById("notebook-pad")?.focus({ preventScroll: true })

  // the book comes back from the browser's store after mount (the server knows nothing of it), and goes back on every change
  useEffect(() => {
    setHistory(emptyHistory(storedBook()))
    setLoaded(true)
  }, [])
  useEffect(() => {
    if (loaded) window.localStorage.setItem(STORE, JSON.stringify(history.present))
  }, [loaded, history.present])

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

  const page = openPage(history.present)
  const clear = () => setHistory((h) => commit(h, editOpen(h.present, clearPage)))
  const empty = isBlankPage(page)
  const oneGroup = isOneGroup(page, picked)
  const group = () => setHistory((h) => commit(h, editOpen(h.present, (p) => toggleGroup(p, picked))))
  const seed = (n: number) => {
    setHistory(emptyHistory(seedBook(n)))
    setPicked([])
  }

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
              <ToolButton label="pen" on={tool === "pen"} onClick={() => setTool("pen")}>
                <Feather size={15} strokeWidth={1.6} />
              </ToolButton>
              <ToolButton label="shape" on={tool === "shape"} onClick={() => setTool("shape")}>
                <Square size={14} strokeWidth={1.6} />
              </ToolButton>
              {tool !== "select" && (
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
              {tool === "shape" && (
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
              {/* the word: the repo's field (mv-field: mono, line border, accent on focus), at the tool buttons' height; ⌘F lands here, Enter goes back to the page, Escape lets the word go */}
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
              <span className="mx-1 h-4 w-px" style={{ background: "var(--line)" }} />
              <ToolButton label={oneGroup ? "ungroup" : "group"} on={oneGroup} disabled={picked.length < 2} onClick={group}>
                {oneGroup ? <Ungroup size={15} strokeWidth={1.6} /> : <Group size={15} strokeWidth={1.6} />}
              </ToolButton>
              <span className="mx-1 h-4 w-px" style={{ background: "var(--line)" }} />
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
            <ClientOnly fallback={<div style={{ width: WIDTH, height: HEIGHT + 36 }} />}>
              <Suspense fallback={<div style={{ width: WIDTH, height: HEIGHT + 36 }} />}>
                {loaded && <Pad font={HAND} tool={tool} inkColor={ink} shapeKind={shapeKind} fill={fill} rule={rule} gap={gap} feel={feel} search={search} picked={picked} onPicked={setPicked} history={history} onHistory={setHistory} width={WIDTH} height={HEIGHT} />}
              </Suspense>
            </ClientOnly>
          </div>
        </div>
        <p className="mv-data" style={{ fontSize: 11, color: "var(--dim)", marginTop: 14 /* the ribbon's tail hangs past the panel */ }}>
          double-click the page and write · a note has three places to touch: its symbol (the kinds, in any tool), its words, its value · 1–7 also swaps the kind, ⌫ removes · drag and it settles on the lattice · a picked row has a grip at its corner: drag it to resize, it snaps to the dots; a sized row scrolls under the wheel · sweep, shift-click adds, ⌘A takes all; a drag moves them together; ⌘G groups them · pen: draw; click a stroke to pick it · the quill and the shapes share the six kind inks · shape: drag a rectangle or an ellipse, filled none / hatch / wash — freeform, nothing snaps; a picked shape has handles; 1–7 recolor it; shapes and notes stack in one order, a pick raises · ⌘Z / ⇧⌘Z · ⌘D duplicates · ⌘X / ⌘C take what is picked, ⌘V puts it down on the page in hand (on another page: the same spot; on its own: a cell over) · the pad must have focus · turn the page: the wheel in the footer (drag it, tap a number, scroll over it), ← → · the book is nine pages · the ribbon is a bookmark hanging over a page's number: drag it along the numbers to mark another page, tap it to turn there · the tabs at the right edge: hold one out and the book thins to that kind — pages without it fall out, the rest show only it, the wheel runs over what is left; click it again and the book is whole · with a tab out, a new note is of its kind · ⌘F: a word in the header's field thins the book the same way, the word lit where the rows say it; Enter goes back to the page, Escape lets the word go
        </p>
      </div>

      {/* The knob — foreign to the mv language on purpose. */}
      <div className="fixed top-1.5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-zinc-100 px-4 py-2 text-zinc-900 shadow-lg">
        {RULES.map((r) => (
          <button
            key={r}
            onClick={() => void navigate({ search: (s) => ({ ...s, rule: r }), replace: true })}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${r === rule ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-300"}`}
          >
            {r}
          </button>
        ))}
        <span className="mx-1 h-3 w-px bg-zinc-400" />
        {FEELS.map((f) => (
          <button
            key={f}
            onClick={() => void navigate({ search: (s) => ({ ...s, feel: f }), replace: true })}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${f === feel ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-300"}`}
          >
            {f}
          </button>
        ))}
        <span className="mx-1 h-3 w-px bg-zinc-400" />
        {GAPS.map((g) => (
          <button
            key={g}
            onClick={() => void navigate({ search: (s) => ({ ...s, gap: g }), replace: true })}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${g === gap ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-300"}`}
          >
            gap {g}
          </button>
        ))}
        <span className="mx-1 h-3 w-px bg-zinc-400" />
        {[1, 5, 9].map((n) => (
          <button key={n} onClick={() => seed(n)} className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap hover:bg-zinc-300">
            seed {n}
          </button>
        ))}
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
      className="grid place-items-center rounded-sm border disabled:opacity-30"
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
