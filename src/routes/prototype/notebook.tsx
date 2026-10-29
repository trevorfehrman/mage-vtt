// PROTOTYPE — throwaway. MAG-75 audition (2026-10-28): the mage's notebook,
// the status space the owner asked for — "something like a notebook ... a
// mini whiteboard that's personal to the mage ... quick tools that add things
// that are categorical ... neat and orderly but still handwritten and just a
// little haphazard, like the notes of someone in a hurry under duress."
// First audition: react-konva. (React Flow is the second, same stamps.)
// Knobs: ?font=caveat|kalam|patrick. Mock data; no Convex. DELETE once specced.
import { Suspense, lazy, useEffect, useState } from "react"
import { ClientOnly, createFileRoute, useNavigate } from "@tanstack/react-router"
import { Match } from "effect"
import { STAMPS, emptyHistory, placeStamp, redo, undo, type History } from "./-notebook-page"

const Pad = lazy(() => import("./-notebook-pad").then((m) => ({ default: m.NotebookPad })))

const FONTS = ["caveat", "kalam", "patrick"] as const
type Font = (typeof FONTS)[number]
const isFont = (v: unknown): v is Font => typeof v === "string" && (FONTS as ReadonlyArray<string>).includes(v)
const fontFamily = (f: Font): string =>
  Match.value(f).pipe(
    Match.when("caveat", () => "Caveat"),
    Match.when("kalam", () => "Kalam"),
    Match.when("patrick", () => "Patrick Hand"),
    Match.exhaustive,
  )

export const Route = createFileRoute("/prototype/notebook")({
  validateSearch: (search: Record<string, unknown>) => ({
    font: isFont(search.font) ? search.font : ("caveat" as Font),
  }),
  component: Notebook,
})

const WIDTH = 768
const HEIGHT = 440

function Notebook() {
  const { font } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [history, setHistory] = useState<History>(() => emptyHistory({ notes: [] }))
  const [stamped, setStamped] = useState(0)

  // the three hands under audition, loaded only here
  useEffect(() => {
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href =
      "https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600&family=Kalam:wght@300;400&family=Patrick+Hand&display=swap"
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

  return (
    <div className="min-h-screen" style={{ background: "var(--void, #07060a)", color: "var(--ink)" }}>
      <div className="mx-auto grid gap-4 py-10" style={{ width: WIDTH }}>
        {/* a stand-in for the title card the notebook sits beneath */}
        <div className="mv-cornered mv-panel p-4">
          <h2 className="mv-h text-[30px] leading-none">The Little Bear</h2>
          <span className="mv-eyebrow">Gnosis 5 · Stamina 2 · title card stands here</span>
        </div>

        <div className="mv-panel mv-cornered grid gap-3 p-4">
          <div className="flex items-center justify-between">
            <span className="mv-eyebrow">Notebook</span>
            <div className="flex items-center gap-1.5">
              {STAMPS.map((s, i) => (
                <button
                  key={s.kind}
                  type="button"
                  onClick={() => stamp(i)}
                  className="mv-eyebrow rounded-sm border px-2 py-1 hover:text-[var(--accent)]"
                  style={{ borderColor: "var(--line)", background: "transparent", cursor: "pointer" }}
                  title="Stamp one onto the page"
                >
                  {s.label}
                </button>
              ))}
              <span className="mx-1 h-4 w-px" style={{ background: "var(--line)" }} />
              <button
                type="button"
                onClick={() => setHistory(undo)}
                disabled={history.past.length === 0}
                className="mv-eyebrow rounded-sm border px-2 py-1 disabled:opacity-40"
                style={{ borderColor: "var(--line)", cursor: "pointer" }}
              >
                Undo
              </button>
              <button
                type="button"
                onClick={() => setHistory(redo)}
                disabled={history.future.length === 0}
                className="mv-eyebrow rounded-sm border px-2 py-1 disabled:opacity-40"
                style={{ borderColor: "var(--line)", cursor: "pointer" }}
              >
                Redo
              </button>
            </div>
          </div>
          <div style={{ marginLeft: -16, marginRight: -16, marginBottom: -16, borderTop: "1px solid var(--line)" }}>
            <ClientOnly fallback={<div style={{ width: WIDTH, height: HEIGHT }} />}>
              <Suspense fallback={<div style={{ width: WIDTH, height: HEIGHT }} />}>
                <Pad font={fontFamily(font)} history={history} onHistory={setHistory} width={WIDTH} height={HEIGHT} />
              </Suspense>
            </ClientOnly>
          </div>
        </div>
        <p className="mv-data" style={{ fontSize: 11, color: "var(--dim)" }}>
          click selects · drag moves · double-click edits the title · ⌫ removes · ⌘Z / ⇧⌘Z · ⌘D duplicates · the pad must have focus
        </p>
      </div>

      {/* The knobs — foreign to the mv language on purpose. */}
      <div className="fixed top-1.5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-zinc-100 px-4 py-2 text-zinc-900 shadow-lg">
        {FONTS.map((f) => (
          <button
            key={f}
            onClick={() => void navigate({ search: { font: f }, replace: true })}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              f === font ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-300"
            }`}
            title="MAG-75: the hand the notebook is written in"
          >
            {fontFamily(f)}
          </button>
        ))}
      </div>
    </div>
  )
}
