// PROTOTYPE — throwaway (MAG-75 audition). The notebook's page as data,
// free of any canvas library: the Schema, the pure edits, the history, the
// kinds, the ruling, the groups. The route and the Konva pad both read this
// file. No app imports; mock only.
//
// The mood (owner, 2026-10-29): "notebook, need, mage, methodical, this is
// their second brain. quick, clear, revisable." Each note is a ledger row
// with three places to touch: its symbol, its words, its value.
import { Array as Arr, Match, Option, Schema } from "effect"

// --- The page (what Convex would hold) ---

export const NoteKind = Schema.Literals(["blank", "spell", "armor", "boost", "condition", "mark", "scene"])
export type NoteKind = typeof NoteKind.Type
export const KINDS: ReadonlyArray<NoteKind> = ["blank", "spell", "armor", "boost", "condition", "mark", "scene"]

export const Note = Schema.Struct({
  id: Schema.String,
  kind: NoteKind,
  x: Schema.Number,
  y: Schema.Number,
  title: Schema.String,
  /** The value the kind carries ("2", "+2", "−1"); empty when none. */
  number: Schema.String,
  /** "scene" = over when the scene closes; "" = until crossed out. */
  lasts: Schema.Literals(["scene", ""]),
  /** The group this note moves with; "" when it moves alone. */
  group: Schema.String,
  /** Width in px, a whole number of cells. */
  w: Schema.Number,
  /** Height in px, a whole number of cells; 0 = as tall as its words, up to the cap. */
  h: Schema.Number,
})
export type Note = typeof Note.Type

/**
 * One pen stroke: the pointer's points with their pressure, flattened
 * [x0, y0, p0, x1, y1, p1, …]. A mouse reports 0.5 for every point, so a
 * stroke with no real pressure takes its weight from speed instead.
 */
export const Ink = Schema.Struct({
  id: Schema.String,
  points: Schema.Array(Schema.Number),
  color: Schema.String,
  /** True when a pen reported pressure; false for a mouse or trackpad. */
  pressured: Schema.Boolean,
  group: Schema.String,
})
export type Ink = typeof Ink.Type

export const Page = Schema.Struct({ notes: Schema.Array(Note), ink: Schema.Array(Ink) })
export type Page = typeof Page.Type

export const EMPTY_PAGE: Page = { notes: [], ink: [] }

/** What the pointer does on the page: pick, touch, sweep and move (double-click on bare page writes a note), or draw. */
export const Tool = Schema.Literals(["select", "pen"])
export type Tool = typeof Tool.Type

/** The pen's inks: the page's own, the accent, the ember. */
export const INKS: ReadonlyArray<{ readonly name: string; readonly color: string }> = [
  { name: "bone", color: "#d7d2e0" },
  { name: "verdigris", color: "#6fae97" },
  { name: "ember", color: "#e29659" },
]

// --- The book: pages in order, one of them open ---
//
// Pagination round (owner, 2026-10-29): "a note is an item on a page, a page
// is a page" — "this is a notebook with its half folded around behind it,
// like a person in the field using it." The book always ends on one blank
// page, so it never runs out; the open page is the one the hand is on.

export const Book = Schema.Struct({ pages: Schema.Array(Page), open: Schema.Number })
export type Book = typeof Book.Type

export const isBlankPage = (p: Page): boolean => p.notes.length === 0 && p.ink.length === 0
export const EMPTY_BOOK: Book = { pages: [EMPTY_PAGE], open: 0 }

/** The page at an index; past the back, a blank. */
export const pageAt = (book: Book, i: number): Page => book.pages[i] ?? EMPTY_PAGE
export const openPage = (book: Book): Page => pageAt(book, book.open)
/** The last page's index: the blank at the back. */
export const lastIndex = (book: Book): number => book.pages.length - 1
/** Turn to a page; the index is held within the book. */
export const turnTo = (book: Book, i: number): Book => {
  const open = Math.max(0, Math.min(lastIndex(book), Math.round(i)))
  return open === book.open ? book : { ...book, open }
}
/**
 * The book keeps exactly one blank page at the back: writing on the last
 * page grows the book by one; clearing the page before a blank sheds the
 * spare — never the page the hand is on.
 */
const tidy = (book: Book): Book => {
  const pages = [...book.pages]
  const last = pages[pages.length - 1]
  if (last === undefined || !isBlankPage(last)) pages.push(EMPTY_PAGE)
  while (pages.length >= 2 && isBlankPage(pages[pages.length - 1]!) && isBlankPage(pages[pages.length - 2]!) && pages.length - 1 > book.open) pages.pop()
  return pages.length === book.pages.length && pages.every((p, i) => p === book.pages[i]) ? book : { ...book, pages }
}
/** An edit of the open page. */
export const editOpen = (book: Book, f: (page: Page) => Page): Book => {
  const before = openPage(book)
  const after = f(before)
  if (after === before) return book
  return tidy({ ...book, pages: book.pages.map((p, i) => (i === book.open ? after : p)) })
}

export type History<T = Book> = { readonly past: ReadonlyArray<T>; readonly present: T; readonly future: ReadonlyArray<T> }

export const emptyHistory = <T,>(present: T): History<T> => ({ past: [], present, future: [] })
export const commit = <T,>(h: History<T>, next: T): History<T> =>
  next === h.present ? h : { past: [...h.past, h.present], present: next, future: [] }
export const undo = <T,>(h: History<T>): History<T> =>
  Option.match(Arr.last(h.past), {
    onNone: () => h,
    onSome: (prev) => ({ past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] }),
  })
export const redo = <T,>(h: History<T>): History<T> =>
  Option.match(Arr.head(h.future), {
    onNone: () => h,
    onSome: (next) => ({ past: [...h.past, h.present], present: next, future: h.future.slice(1) }),
  })

// --- The ruling: the lattice the notes align to ---

/** The lattice's pitch in px; every note's corner lands on a dot. */
export const GRID = 24
/** The lattice starts half a pitch in from the page's edge, so the margin is even all round. */
export const ORIGIN = GRID / 2
/** Every nth dot is a hairline tick — the lattice's own sigil. */
export const GRID_TICK_EVERY = 4
export const snap = (v: number): number => Math.round((v - ORIGIN) / GRID) * GRID + ORIGIN
export const snapPoint = (x: number, y: number): { x: number; y: number } => ({ x: snap(x), y: snap(y) })

// --- The note's measure: a ledger row ---

/** Eight cells wide to start; a hand can resize to five at the least. */
export const NOTE_W = GRID * 8
export const MIN_W = GRID * 5
export const MIN_H = GRID * 2
/** Two cells tall; one more for each line the words wrap to, up to three lines. */
export const NOTE_H = GRID * 2
export const MAX_LINES = 3
/** The spine: the tinted column at the left that holds the symbol. */
export const SPINE_W = 24
/** The value's cell: a square at the right, on the row's header line with the kind's word and the symbol. */
export const CELL = 22
/** A note that would hang past the page's edge is nudged back onto the lattice inside it. */
export const within = (p: { x: number; y: number }, w: number, h: number, pageW: number, pageH: number): { x: number; y: number } => ({
  x: Math.max(ORIGIN, Math.min(p.x, snap(pageW - ORIGIN - w))),
  y: Math.max(ORIGIN, Math.min(p.y, snap(pageH - ORIGIN - h))),
})

/** Whether the kind carries a value beside its words. */
export const takesValue = (kind: NoteKind): boolean =>
  Match.value(kind).pipe(
    Match.when("armor", () => true),
    Match.when("boost", () => true),
    Match.when("condition", () => true),
    Match.when("mark", () => true),
    Match.when("spell", () => false),
    Match.when("scene", () => false),
    Match.when("blank", () => false),
    Match.exhaustive,
  )

/**
 * The kind's word, ink, and sigil — a small mark in a 16-box, drawn in the
 * note's spine. SVG path data so Konva's Path and a DOM <path> both draw it.
 * The word names the kind in the list; the row itself shows only the sigil
 * and the ink (owner, 2026-10-29: "i just want the kind title out of there").
 */
export const kindLook = (kind: NoteKind): { word: string; tint: string; glyph: string } =>
  Match.value(kind).pipe(
    // a casting: a sigil ring with its bindi
    Match.when("spell", () => ({ word: "spell", tint: "#6fae97", glyph: "M8 2.5 A5.5 5.5 0 1 0 8 13.5 A5.5 5.5 0 1 0 8 2.5 Z M8 7 A1 1 0 1 0 8 9 A1 1 0 1 0 8 7 Z" })),
    // a ward: the shield's shoulder and point
    Match.when("armor", () => ({ word: "armor", tint: "#d7d2e0", glyph: "M3 3 H13 V8.5 C13 11.5 8 14 8 14 C8 14 3 11.5 3 8.5 Z" })),
    // a lift: two chevrons rising
    Match.when("boost", () => ({ word: "boost", tint: "#6c9fd8", glyph: "M3.5 8.5 L8 4 L12.5 8.5 M3.5 13 L8 8.5 L12.5 13" })),
    // a weight: two chevrons sinking
    Match.when("condition", () => ({ word: "condition", tint: "#e29659", glyph: "M3.5 3 L8 7.5 L12.5 3 M3.5 7.5 L8 12 L12.5 7.5" })),
    // a brand: three strokes through one point
    Match.when("mark", () => ({ word: "mark", tint: "#dc5a4f", glyph: "M8 2 V14 M3 5 L13 11 M3 11 L13 5" })),
    // the stage: a crescent, the scene's hour
    Match.when("scene", () => ({ word: "scene", tint: "#b8607f", glyph: "M11.5 2.5 A6 6 0 1 0 11.5 13.5 A4.6 4.6 0 1 1 11.5 2.5 Z" })),
    // a plain note: an empty seat for a symbol
    Match.when("blank", () => ({ word: "note", tint: "#807b8f", glyph: "M8 3 A5 5 0 1 0 8 13 A5 5 0 1 0 8 3 Z" })),
    Match.exhaustive,
  )

// The kinds' inks (owner, 2026-10-29: "mark should be red ... boost should be
// blue, scene should be like a wine"): spell verdigris, armor bone, boost
// blue, condition ember, mark red, scene wine — each bright enough that its
// 9px word clears the panel.

// --- The edits ---

/** A plain note where the pen touched, squared to the lattice: the write tool's click. */
export const placeAt = (page: Page, x: number, y: number, nth: number): Page => {
  const p = snapPoint(x, y)
  return {
    ...page,
    notes: [...page.notes, { id: `n${Date.now().toString(36)}${nth}`, kind: "blank", x: p.x, y: p.y, title: "", number: "", lasts: "", group: "", w: NOTE_W, h: 0 }],
  }
}

export const addInk = (page: Page, ink: Ink): Page => ({ ...page, ink: [...page.ink, ink] })

const edit = (page: Page, ids: ReadonlyArray<string>, f: (n: Note) => Note): Page => ({
  ...page,
  notes: page.notes.map((n) => (ids.includes(n.id) ? f(n) : n)),
})

export type Move = { readonly id: string; readonly x: number; readonly y: number }
export type Shift = { readonly id: string; readonly dx: number; readonly dy: number }
/** Several things settle at once: notes to where they landed, strokes by how far they were carried. */
export const moveMany = (page: Page, moves: ReadonlyArray<Move>, shifts: ReadonlyArray<Shift>): Page => ({
  notes: page.notes.map((n) =>
    Option.match(Arr.findFirst(moves, (m) => m.id === n.id), { onNone: () => n, onSome: (m) => ({ ...n, x: m.x, y: m.y }) }),
  ),
  ink: page.ink.map((s) =>
    Option.match(Arr.findFirst(shifts, (m) => m.id === s.id), {
      onNone: () => s,
      onSome: (m) => ({ ...s, points: s.points.map((v, i) => (i % 3 === 0 ? v + m.dx : i % 3 === 1 ? v + m.dy : v)) }),
    }),
  ),
})
/** A picked note rises above the rest: the page keeps the order it draws in. */
export const raise = (page: Page, id: string): Page =>
  Option.match(Arr.findFirst(page.notes, (n) => n.id === id), {
    onNone: () => page,
    onSome: (n) => (page.notes[page.notes.length - 1] === n ? page : { ...page, notes: [...page.notes.filter((m) => m.id !== id), n] }),
  })
/** A hand's resize: whole cells, never narrower or shorter than the least. */
export const resize = (page: Page, id: string, w: number, h: number): Page =>
  edit(page, [id], (n) => ({ ...n, w: Math.max(MIN_W, Math.round(w / GRID) * GRID), h: Math.max(MIN_H, Math.round(h / GRID) * GRID) }))
export const retitle = (page: Page, id: string, title: string): Page => edit(page, [id], (n) => ({ ...n, title }))
export const revalue = (page: Page, id: string, number: string): Page => edit(page, [id], (n) => ({ ...n, number }))
/** Swap the kind of every picked note; a value the new kind cannot carry is dropped. */
export const rekind = (page: Page, ids: ReadonlyArray<string>, kind: NoteKind): Page =>
  edit(page, ids, (n) => ({ ...n, kind, number: takesValue(kind) ? n.number : "" }))
/** Remove whatever is picked: notes and strokes alike. */
export const removeMany = (page: Page, ids: ReadonlyArray<string>): Page => ({
  notes: page.notes.filter((n) => !ids.includes(n.id)),
  ink: page.ink.filter((s) => !ids.includes(s.id)),
})
export const duplicateNotes = (page: Page, ids: ReadonlyArray<string>): Page => ({
  ...page,
  notes: [
    ...page.notes,
    ...page.notes
      .filter((n) => ids.includes(n.id))
      .map((n, i) => ({ ...n, id: `${n.id}d${page.notes.length + i}`, x: n.x + GRID, y: n.y + GRID, group: "" })),
  ],
})
export const clearPage = (page: Page): Page => (page.notes.length === 0 && page.ink.length === 0 ? page : EMPTY_PAGE)

// --- Groups: things that move as one ---

const groupOf = (page: Page, id: string): string =>
  page.notes.find((n) => n.id === id)?.group ?? page.ink.find((s) => s.id === id)?.group ?? ""

/** The ids with every member of any group among them: picking one picks the rest. */
export const withGroups = (page: Page, ids: ReadonlyArray<string>): ReadonlyArray<string> => {
  const groups = ids.map((id) => groupOf(page, id)).filter((g) => g !== "")
  const members = [...page.notes, ...page.ink].filter((x) => groups.includes(x.group)).map((x) => x.id)
  return [...ids, ...members.filter((id) => !ids.includes(id))]
}
/** True when the ids are exactly one whole group: the button then ungroups. */
export const isOneGroup = (page: Page, ids: ReadonlyArray<string>): boolean => {
  const groups = ids.map((id) => groupOf(page, id))
  const g = groups[0]
  return ids.length > 1 && g !== undefined && g !== "" && groups.every((x) => x === g) && withGroups(page, ids).length === ids.length
}
/** Bind the ids into one group, or loose them if they already are one. */
export const toggleGroup = (page: Page, ids: ReadonlyArray<string>): Page => {
  const group = isOneGroup(page, ids) ? "" : `g${Date.now().toString(36)}`
  return {
    notes: page.notes.map((n) => (ids.includes(n.id) ? { ...n, group } : n)),
    ink: page.ink.map((s) => (ids.includes(s.id) ? { ...s, group } : s)),
  }
}

// --- The sweep ---

export type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
const overlaps = (a: Box, b: Box): boolean => {
  const ax0 = Math.min(a.x, a.x + a.w)
  const ax1 = Math.max(a.x, a.x + a.w)
  const ay0 = Math.min(a.y, a.y + a.h)
  const ay1 = Math.max(a.y, a.y + a.h)
  return b.x < ax1 && b.x + b.w > ax0 && b.y < ay1 && b.y + b.h > ay0
}
/** A stroke's extent, from its points. */
export const inkBox = (s: Ink): Box => {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let i = 0; i + 1 < s.points.length; i += 3) {
    x0 = Math.min(x0, s.points[i]!)
    x1 = Math.max(x1, s.points[i]!)
    y0 = Math.min(y0, s.points[i + 1]!)
    y1 = Math.max(y1, s.points[i + 1]!)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}
/** What a sweep of the select tool takes: any note or stroke whose box the sweep touches, with their groups. */
export const swept = (page: Page, box: Box, heightOf: (n: Note) => number): ReadonlyArray<string> =>
  withGroups(page, [
    ...page.notes.filter((n) => overlaps(box, { x: n.x, y: n.y, w: n.w, h: heightOf(n) })).map((n) => n.id),
    ...page.ink.filter((s) => overlaps(box, inkBox(s))).map((s) => s.id),
  ])

// --- A seeded book, for thumbing through on the rig ---

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
/** A book of n written pages (and the blank at the back), each page a few rows settled on the lattice. */
export const seedBook = (n: number): Book => {
  const rnd = lcg(n * 7919 + 17)
  const cols = 32
  const rows = 18
  const pages: Page[] = []
  for (let p = 0; p < n; p++) {
    const notes: Note[] = []
    const count = 2 + Math.floor(rnd() * 5)
    for (let k = 0; k < count; k++) {
      const [kind, title, number] = SEED_WORDS[Math.floor(rnd() * SEED_WORDS.length)]!
      const w = GRID * (6 + Math.floor(rnd() * 8))
      const x = ORIGIN + GRID * Math.floor(rnd() * (cols - w / GRID))
      const y = ORIGIN + GRID * Math.floor(rnd() * (rows - 3))
      notes.push({ id: `s${p}-${k}`, kind, x, y, title, number, lasts: "", group: "", w, h: 0 })
    }
    pages.push({ notes, ink: [] })
  }
  return tidy({ pages, open: 0 })
}
