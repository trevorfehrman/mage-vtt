// PROTOTYPE — throwaway. MAG-75 audition (2026-10-28): the mage's notebook,
// the status space the owner asked for — "something like a notebook ... a
// mini whiteboard that's personal to the mage ... quick tools that add things
// that are categorical." Look-and-feel round, the owner's lodestars: "a mage's
// note book is relatively neat. the handwriting is neat, a little scholarly
// ... click anywhere and start the note ... helpfully align to something ...
// categories need to be easy to swap ... easy to clear and change ... how
// would a mage build a magic notebook."
// Knobs: ?font=patrick|architects|handlee|kalam|nanum · ?rule=dots|lines|none
// · ?frame=stroke|plate|none. Tools: write, pen (three inks).
// Mock data; no Convex. DELETE once specced.
import { Suspense, lazy, useEffect, useState } from "react"
import { ClientOnly, createFileRoute, useNavigate } from "@tanstack/react-router"
import { Match } from "effect"
import { clearPage, EMPTY_PAGE, GRID, INKS, STAMPS, emptyHistory, placeStamp, redo, undo, type History, type Tool } from "./-notebook-page"
import type { Frame, Rule } from "./-notebook-pad"

const Pad = lazy(() => import("./-notebook-pad").then((m) => ({ default: m.NotebookPad })))

// the hands under audition: neat print first (the owner's pick), two that join
const FONTS = ["patrick", "architects", "handlee", "kalam", "nanum"] as const
type Font = (typeof FONTS)[number]
const isFont = (v: unknown): v is Font => typeof v === "string" && (FONTS as ReadonlyArray<string>).includes(v)
const fontFamily = (f: Font): string =>
  Match.value(f).pipe(
    Match.when("patrick", () => "Patrick Hand"),
    Match.when("architects", () => "Architects Daughter"),
    Match.when("handlee", () => "Handlee"),
    Match.when("kalam", () => "Kalam"),
    Match.when("nanum", () => "Nanum Pen Script"),
    Match.exhaustive,
  )
const RULES = ["dots", "lines", "none"] as const
const isRule = (v: unknown): v is Rule => typeof v === "string" && (RULES as ReadonlyArray<string>).includes(v)
const FRAMES = ["stroke", "plate", "none"] as const
const isFrame = (v: unknown): v is Frame => typeof v === "string" && (FRAMES as ReadonlyArray<string>).includes(v)

export const Route = createFileRoute("/prototype/notebook")({
  validateSearch: (search: Record<string, unknown>) => ({
    font: isFont(search.font) ? search.font : ("patrick" as Font),
    rule: isRule(search.rule) ? search.rule : ("dots" as Rule),
    frame: isFrame(search.frame) ? search.frame : ("stroke" as Frame),
  }),
  component: Notebook,
})

const WIDTH = GRID * 32
const HEIGHT = GRID * 18

const chip = "mv-eyebrow whitespace-nowrap rounded-sm border px-2 py-1 disabled:opacity-40"

function Notebook() {
  const { font, rule, frame } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [history, setHistory] = useState<History>(() => emptyHistory(EMPTY_PAGE))
  const [stamped, setStamped] = useState(0)
  const [tool, setTool] = useState<Tool>("write")
  const [ink, setInk] = useState(INKS[0]!.color)

  // the hands under audition, loaded only here
  useEffect(() => {
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href =
      "https://fonts.googleapis.com/css2?family=Patrick+Hand&family=Architects+Daughter&family=Handlee&family=Kalam:wght@300;400&family=Nanum+Pen+Script&display=swap"
    document.head.appendChild(link)
    return () => {
      link.remove()
    }
  }, [])

  const stamp = (i: number) => {
    const s = STAMPS[i]
    if (s === undefined) return
    setHistory((h) => ({ past: [...h.past, h.present], present: placeStamp(h.present, s, stamped), future: [] }))
    setStamped((n) => n + 1)
  }
  const clear = () =>
    setHistory((h) => {
      const next = clearPage(h.present)
      return next === h.present ? h : { past: [...h.past, h.present], present: next, future: [] }
    })

  const knob = (patch: Partial<{ font: Font; rule: Rule; frame: Frame }>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })

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
            <div className="flex items-center gap-1.5">
              <span className="mv-eyebrow mr-1 whitespace-nowrap">Notebook</span>
              {(["write", "pen"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTool(t)}
                  aria-pressed={tool === t}
                  className={chip}
                  style={{
                    borderColor: tool === t ? "var(--accent)" : "var(--line)",
                    color: tool === t ? "var(--accent)" : undefined,
                    cursor: "pointer",
                  }}
                >
                  {t}
                </button>
              ))}
              {tool === "pen" &&
                INKS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setInk(c.color)}
                    aria-pressed={ink === c.color}
                    aria-label={c.name}
                    className="rounded-full"
                    style={{
                      width: 14,
                      height: 14,
                      background: c.color,
                      outline: ink === c.color ? "1px solid var(--accent)" : "1px solid transparent",
                      outlineOffset: 2,
                      cursor: "pointer",
                    }}
                  />
                ))}
            </div>
            <div className="flex items-center gap-1.5">
              {STAMPS.map((s, i) => (
                <button
                  key={s.kind}
                  type="button"
                  onClick={() => stamp(i)}
                  className={`${chip} hover:text-[var(--accent)]`}
                  style={{ borderColor: "var(--line)", background: "transparent", cursor: "pointer" }}
                >
                  {s.label}
                </button>
              ))}
              <span className="mx-1 h-4 w-px" style={{ background: "var(--line)" }} />
              <button type="button" onClick={() => setHistory(undo)} disabled={history.past.length === 0} className={chip} style={{ borderColor: "var(--line)", cursor: "pointer" }}>
                Undo
              </button>
              <button type="button" onClick={() => setHistory(redo)} disabled={history.future.length === 0} className={chip} style={{ borderColor: "var(--line)", cursor: "pointer" }}>
                Redo
              </button>
              <button
                type="button"
                onClick={clear}
                disabled={history.present.notes.length === 0 && history.present.ink.length === 0}
                className={chip}
                style={{ borderColor: "var(--line)", cursor: "pointer" }}
              >
                Clear
              </button>
            </div>
          </div>
          <div style={{ marginLeft: -16, marginRight: -16, marginBottom: -16, borderTop: "1px solid var(--line)" }}>
            <ClientOnly fallback={<div style={{ width: WIDTH, height: HEIGHT }} />}>
              <Suspense fallback={<div style={{ width: WIDTH, height: HEIGHT }} />}>
                <Pad
                  font={fontFamily(font)}
                  tool={tool}
                  inkColor={ink}
                  rule={rule}
                  frame={frame}
                  history={history}
                  onHistory={setHistory}
                  width={WIDTH}
                  height={HEIGHT}
                />
              </Suspense>
            </ClientOnly>
          </div>
        </div>
        <p className="mv-data" style={{ fontSize: 11, color: "var(--dim)" }}>
          write: click the page and write · click a note to pick it, 1–7 or the strip swaps its kind, ⌫ removes · double-click rewrites · drag and it settles on the lattice · pen: draw; click a stroke to pick it · ⌘Z / ⇧⌘Z · ⌘D duplicates · the pad must have focus
        </p>
      </div>

      {/* The knobs — foreign to the mv language on purpose. */}
      <div className="fixed top-1.5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-zinc-100 px-4 py-2 text-zinc-900 shadow-lg">
        {FONTS.map((f) => (
          <button
            key={f}
            onClick={() => knob({ font: f })}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${f === font ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-300"}`}
          >
            {fontFamily(f)}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-zinc-400" />
        {RULES.map((r) => (
          <button
            key={r}
            onClick={() => knob({ rule: r })}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${r === rule ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-300"}`}
          >
            {r}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-zinc-400" />
        {FRAMES.map((f) => (
          <button
            key={f}
            onClick={() => knob({ frame: f })}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${f === frame ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-300"}`}
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  )
}
