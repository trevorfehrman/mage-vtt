// PROTOTYPE RIG — the notebook gallery (MAG-75). The REAL Notebook panel
// (src/components/game/Notebook.tsx, the pad in NotebookPad.tsx) fed a local
// history instead of the Convex store: the surface a change to the pad is
// auditioned on without the session route's load (memory: the dressing room
// paints black for up to 40s; this rig reloads in seconds). Nothing here
// persists; a reload opens on the seed. Never linked from shipping
// navigation. The design history that shaped the pad is in the pad's own
// header, in the owner's words.
//
// Knobs: ?seed=1|5|9 (how many pages are written); ?read=true shows another
// member's notebook — the pages turn, the tabs and the word read, nothing is
// touched.
import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Notebook } from "#/components/game/Notebook"
import { emptyHistory, EMPTY_PAGE, GRID, ORIGIN, PAGES, takesValue, type Book, type Note, type NoteKind, type Page } from "#/domain/notebook"

export const Route = createFileRoute("/prototype/notebook")({
  validateSearch: (search: Record<string, unknown>) => ({
    seed: typeof search.seed === "number" ? Math.max(0, Math.min(PAGES, Math.round(search.seed))) : 5,
    read: search.read === true || search.read === "true",
  }),
  component: Gallery,
})

function Gallery() {
  const { seed, read } = Route.useSearch()
  const [history, setHistory] = useState(() => emptyHistory(seedBook(seed)))
  return (
    <div className="min-h-screen" style={{ background: "var(--void, #07060a)", color: "var(--ink)" }}>
      <div className="mx-auto grid w-full max-w-3xl gap-6 py-10">
        {/* a stand-in for the title card the notebook sits beneath */}
        <div className="mv-cornered mv-panel p-4">
          <h2 className="mv-h text-[30px] leading-none">The Little Bear</h2>
          <span className="mv-eyebrow">Gnosis 5 · Stamina 2 · title card stands here</span>
        </div>
        <Notebook history={history} onHistory={setHistory} editable={!read} />
        <div className="mv-panel mv-cornered p-4">
          <span className="mv-eyebrow">Attributes & Skills stand here</span>
        </div>
      </div>
    </div>
  )
}

// ── A seeded book, for thumbing through ─────────────────────────────────────

const SEED_WORDS: ReadonlyArray<readonly [NoteKind, string, string]> = [
  ["spell", "Mage Sight on the archive door — resonance of grief, old", ""],
  ["armor", "Shielding (Forces), scene", "3"],
  ["boost", "Perfected Luck on the lockpick", "+2"],
  ["condition", "Shaken after the Abyssal thing in the stairwell", "−1"],
  ["mark", "The Seer's agent knows my face now", "1"],
  ["scene", "Dockside warehouse, 3am, tide out", ""],
  ["blank", "Ask Kestrel about the ledger with the burnt corner", ""],
  ["blank", "Why does the compass spin near the fountain?", ""],
  ["spell", "Postcognition, the fountain — 7 successes, saw a ring", ""],
  ["blank", "Suspects: the archivist · the twins · Halloran", ""],
  ["condition", "Spent, Mana 2 of 11", "−2"],
  ["boost", "Nimbus flared, Gnosis +1 to Awakening checks tonight", "+1"],
  ["blank", "Buy chalk. Lots of chalk.", ""],
  ["scene", "Sanctum, after", ""],
  ["armor", "Mage Armor (Matter)", "2"],
  ["mark", "Owed: one favor to the Guardians", "1"],
]
/** A deterministic hand: a tiny LCG, so the same seed thumbs the same book. */
const lcg = (seed: number) => {
  let x = seed >>> 0
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0
    return x / 4294967296
  }
}
/** A book of nine pages, the first n of them written, each a few rows settled on the lattice. */
const seedBook = (n: number): Book => {
  const rnd = lcg(n * 7919 + 17)
  const cols = 32
  const rows = 18
  const pages: Page[] = []
  for (let p = 0; p < Math.min(n, PAGES); p++) {
    const notes: Note[] = []
    const count = 2 + Math.floor(rnd() * 5)
    for (let k = 0; k < count; k++) {
      const [kind, title, number] = SEED_WORDS[Math.floor(rnd() * SEED_WORDS.length)]!
      const w = GRID * ((takesValue(kind) ? 8 : 6) + Math.floor(rnd() * 8))
      const x = ORIGIN + GRID * Math.floor(rnd() * (cols - w / GRID))
      const y = ORIGIN + GRID * Math.floor(rnd() * (rows - 3))
      notes.push({ id: `s${p}-${k}`, kind, x, y, title, number, lasts: "", group: "", w, h: 0 })
    }
    pages.push({ notes, ink: [], shapes: [], order: notes.map((n) => n.id) })
  }
  while (pages.length < PAGES) pages.push(EMPTY_PAGE)
  return { pages, open: 0, mark: 0 }
}
