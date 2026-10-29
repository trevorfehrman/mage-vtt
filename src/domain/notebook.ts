/**
 * The mage's notebook (MAG-75, ADR-0027): the Book as data and every pure
 * edit over it, free of any canvas library. The pad (react-konva, in
 * `src/components/game/NotebookPad.tsx`) only renders a Page and calls these;
 * the store (`use-notebook.ts`) writes the Pages a commit point changed.
 *
 * The mood (owner, 2026-10-29): "notebook, need, mage, methodical, this is
 * their second brain. quick, clear, revisable." Each note is a ledger row
 * with three places to touch: its symbol, its words, its value. Nine pages,
 * always; one open under the hand; one marked by the ribbon.
 *
 * Ids and group names are minted by the hand, not here: every edit that
 * makes a new thing takes a `stamp` (the pad's counter and clock), so this
 * module stays clockless (ADR-0014). Raw primitives throughout, as in every
 * stored mirror (ADR-0011): a Page is what the `notebookPages` table holds.
 */
import { Array as Arr, Match, Option, Record as Rec, Schema } from "effect"

// --- The page (what Convex holds, one row per page) ---

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

// Shapes (owner, 2026-10-29): "enough but simple" — a rectangle and an
// ellipse, in the kind inks, filled none / hatch / wash. Lines and arrows
// were built and taken out the same day ("i don't think line and arrow will
// ever beat the quill"). Shapes are freeform: nothing about them snaps —
// "sizing the shapes should be smooth and the placement shouldn't snap
// either" — the lattice is for notes. A shape is "like anything else, that
// can be under or over" a note: the page keeps ONE draw order over notes
// and shapes, and picking raises either to the top of it.
export const ShapeKind = Schema.Literals(["rect", "ellipse"])
export type ShapeKind = typeof ShapeKind.Type
export const SHAPES: ReadonlyArray<ShapeKind> = ["rect", "ellipse"]
export const Fill = Schema.Literals(["none", "hatch", "wash"])
export type Fill = typeof Fill.Type
export const FILLS: ReadonlyArray<Fill> = ["none", "hatch", "wash"]
export const Shape = Schema.Struct({
  id: Schema.String,
  shape: ShapeKind,
  /** The box's two corners, in px, wherever the hand put them. */
  x0: Schema.Number,
  y0: Schema.Number,
  x1: Schema.Number,
  y1: Schema.Number,
  color: Schema.String,
  fill: Fill,
  group: Schema.String,
})
export type Shape = typeof Shape.Type

export const Page = Schema.Struct({
  notes: Schema.Array(Note),
  ink: Schema.Array(Ink),
  shapes: Schema.Array(Shape),
  /** The draw order of notes and shapes, by id, first beneath; ink always draws over. */
  order: Schema.Array(Schema.String),
})
export type Page = typeof Page.Type

export const EMPTY_PAGE: Page = { notes: [], ink: [], shapes: [], order: [] }
export const isBlankPage = (p: Page): boolean => p.notes.length === 0 && p.ink.length === 0 && p.shapes.length === 0

/**
 * Convex holds at most 8192 elements in one array, and a stroke's points are
 * one flat array: a long, slow stroke is thinned to this many points before
 * it is laid, first and last kept, the rest sampled evenly. 2400 points is
 * twenty seconds of a 120Hz pointer; no stroke a hand draws needs them all.
 */
export const MAX_INK_POINTS = 2400
export const thinned = (ink: Ink, max: number = MAX_INK_POINTS): Ink => {
  const count = Math.floor(ink.points.length / 3)
  if (count <= max) return ink
  const points = Arr.makeBy(max, (i) => Math.round((i * (count - 1)) / (max - 1))).flatMap((k) => [ink.points[k * 3]!, ink.points[k * 3 + 1]!, ink.points[k * 3 + 2]!])
  return { ...ink, points }
}

// --- The book: nine pages, one of them open, one of them marked ---
//
// Pagination round (owner, 2026-10-29): "a note is an item on a page, a page
// is a page" — "this is a notebook with its half folded around behind it,
// like a person in the field using it." The book is nine pages, always
// (owner: "cap the pages at a default permanent 9 ... 1–9 seems good"); the
// open page is the one the hand is on; the ribbon marks one page — "it's
// literally just a bookmark ... a memory tool for the user."

export const PAGES = 9
export const Book = Schema.Struct({ pages: Schema.Array(Page), open: Schema.Number, mark: Schema.Number })
export type Book = typeof Book.Type
export const EMPTY_BOOK: Book = { pages: Arr.makeBy(PAGES, () => EMPTY_PAGE), open: 0, mark: 0 }

const toPage = (i: number): number => Math.max(0, Math.min(PAGES - 1, Math.round(i)))
/** The ribbon laid at a page. */
export const setMark = (book: Book, i: number): Book => {
  const mark = toPage(i)
  return mark === book.mark ? book : { ...book, mark }
}
/** The page at an index; past the back, a blank. */
export const pageAt = (book: Book, i: number): Page => book.pages[i] ?? EMPTY_PAGE
export const openPage = (book: Book): Page => pageAt(book, book.open)
/** The last page's index. */
export const lastIndex = (book: Book): number => book.pages.length - 1
/** Turn to a page; the index is held within the book. */
export const turnTo = (book: Book, i: number): Book => {
  const open = Math.max(0, Math.min(lastIndex(book), Math.round(i)))
  return open === book.open ? book : { ...book, open }
}
/** An edit of the open page. */
export const editOpen = (book: Book, f: (page: Page) => Page): Book => {
  const before = openPage(book)
  const after = f(before)
  if (after === before) return book
  return { ...book, pages: book.pages.map((p, i) => (i === book.open ? after : p)) }
}

// --- The store's reading and writing of the book (ADR-0027) ---

/** A page as the server holds it: the page's index on its row. */
export const StoredPage = Schema.Struct({ page: Schema.Number, ...Page.fields })
export type StoredPage = typeof StoredPage.Type

/** The book from its stored pages and its mark: nine pages, a blank for any the server has no row for, opened at the front. */
export const bookFrom = (rows: ReadonlyArray<StoredPage>, mark: number): Book => ({
  pages: Arr.makeBy(PAGES, (i) =>
    Option.match(Arr.findFirst(rows, (r) => r.page === i), {
      onNone: () => EMPTY_PAGE,
      onSome: ({ notes, ink, shapes, order }) => ({ notes, ink, shapes, order }),
    }),
  ),
  open: 0,
  mark: toPage(mark),
})
/** The pages that differ between two books, by index: every edit makes a fresh page, so reference is identity. */
export const changedPages = (before: Book, after: Book): ReadonlyArray<number> =>
  after.pages.flatMap((p, i) => (p === before.pages[i] ? [] : [i]))

// --- The thin book: the whole book, read by one kind ---
//
// Tabs round (owner, 2026-10-29): a tab for each kind at the page's right
// edge; clicking one thins the book — pages holding none of that kind drop
// out, the other kinds hide on the pages that remain, positions untouched,
// and the wheel runs unchanged over the thinner book; click it again and the
// book is whole. Nothing is generated and nothing is read-only: the thin
// book is the same book, and every page in it is still the page it was.
//
// ⌘F (owner, 2026-10-29: "probably just a search field in the header of
// the notebook") is the same mechanism keyed by a word: pages with a match
// stay, the rows that match are the ones shown, the matched words lit. A
// tab and a word compose: both must hold.

/** What a reading keeps: a note of the kind. */
export const ofKind = (kind: NoteKind) => (n: Note): boolean => n.kind === kind
/** What a reading keeps: a note whose words mention the query, any case; an empty query keeps every note. */
export const mentions = (query: string) => {
  const q = query.trim().toLowerCase()
  return (n: Note): boolean => q === "" || n.title.toLowerCase().includes(q)
}
/** Whether a page holds a note the reading keeps. */
export const holds = (page: Page, keep: (n: Note) => boolean): boolean => page.notes.some(keep)
/** The pages that hold such a note, by index, in order. */
export const pagesHolding = (book: Book, keep: (n: Note) => boolean): ReadonlyArray<number> => book.pages.flatMap((p, i) => (holds(p, keep) ? [i] : []))
/** The page as read: only the notes the reading keeps, its ink kept. The notes are still on the page, where they were. */
export const only = (page: Page, keep: (n: Note) => boolean): Page => ({ ...page, notes: page.notes.filter(keep) })
/** The slot in a view (indices into the whole book) nearest a page of the whole book; between two, the one after. */
export const nearestSlot = (view: ReadonlyArray<number>, i: number): number =>
  view.reduce((best, v, s) => (best < 0 || Math.abs(v - i) <= Math.abs(view[best]! - i) ? s : best), -1)

// --- The history: undo and redo, in the hand, never on the server ---

export const History = Schema.Struct({ past: Schema.Array(Book), present: Book, future: Schema.Array(Book) })
export type History = typeof History.Type

export const emptyHistory = (present: Book): History => ({ past: [], present, future: [] })
/** A commit point: the history remembers where it was. */
export const commit = (h: History, next: Book): History =>
  next === h.present ? h : { past: [...h.past, h.present], present: next, future: [] }
export const undo = (h: History): History =>
  Option.match(Arr.last(h.past), {
    onNone: () => h,
    onSome: (prev) => ({ past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] }),
  })
export const redo = (h: History): History =>
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
/** The value's cell: a square at the right, on the row's header line with the symbol — small enough that the header fits the row's first cell. */
export const CELL = 18
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

// --- The edits ---

/** A plain note where the pen touched, squared to the lattice: the double-click. */
export const placeAt = (page: Page, x: number, y: number, stamp: string): Page => {
  const p = snapPoint(x, y)
  const id = `n${stamp}`
  return {
    ...page,
    notes: [...page.notes, { id, kind: "blank", x: p.x, y: p.y, title: "", number: "", lasts: "", group: "", w: NOTE_W, h: 0 }],
    order: [...page.order, id],
  }
}

export const addInk = (page: Page, ink: Ink): Page => ({ ...page, ink: [...page.ink, thinned(ink)] })
export const addShape = (page: Page, shape: Shape): Page => ({ ...page, shapes: [...page.shapes, shape], order: [...page.order, shape.id] })
/** A shape's two corners moved: as the hand left them, to the pixel. */
export const reshape = (page: Page, id: string, pts: { x0: number; y0: number; x1: number; y1: number }): Page => ({
  ...page,
  shapes: page.shapes.map((s) => (s.id === id ? { ...s, x0: Math.round(pts.x0), y0: Math.round(pts.y0), x1: Math.round(pts.x1), y1: Math.round(pts.y1) } : s)),
})
/** The picked shapes in another ink. */
export const recolor = (page: Page, ids: ReadonlyArray<string>, color: string): Page => ({
  ...page,
  shapes: page.shapes.map((s) => (ids.includes(s.id) ? { ...s, color } : s)),
})

export const Box = Schema.Struct({ x: Schema.Number, y: Schema.Number, w: Schema.Number, h: Schema.Number })
export type Box = typeof Box.Type
/** A shape's box: its two points squared. */
export const shapeBox = (s: Shape): Box => ({ x: Math.min(s.x0, s.x1), y: Math.min(s.y0, s.y1), w: Math.abs(s.x1 - s.x0), h: Math.abs(s.y1 - s.y0) })
/** The least a shape can be, each way; a drag under it is a slip and makes nothing. */
export const MIN_SHAPE = 8
export const shapeStands = (s: Shape): boolean => Math.abs(s.x1 - s.x0) >= MIN_SHAPE && Math.abs(s.y1 - s.y0) >= MIN_SHAPE

/** Notes and shapes in the order they draw. */
export const Drawn = Schema.Union([Schema.Struct({ note: Note }), Schema.Struct({ shape: Shape })])
export type Drawn = typeof Drawn.Type
const drawnId = (d: Drawn): string => ("note" in d ? d.note.id : d.shape.id)
/** The page's order first, then anything it does not name, notes before shapes. */
export const drawOrder = (page: Page): ReadonlyArray<Drawn> => {
  const named = page.order.flatMap((id): ReadonlyArray<Drawn> =>
    Option.match(Arr.findFirst(page.notes, (x) => x.id === id), {
      onSome: (note) => [{ note }],
      onNone: () => Option.match(Arr.findFirst(page.shapes, (x) => x.id === id), { onSome: (shape) => [{ shape }], onNone: () => [] }),
    }),
  )
  const unnamedNotes: ReadonlyArray<Drawn> = page.notes.filter((n) => !page.order.includes(n.id)).map((note) => ({ note }))
  const unnamedShapes: ReadonlyArray<Drawn> = page.shapes.filter((s) => !page.order.includes(s.id)).map((shape) => ({ shape }))
  return [...named, ...unnamedNotes, ...unnamedShapes]
}

const edit = (page: Page, ids: ReadonlyArray<string>, f: (n: Note) => Note): Page => ({
  ...page,
  notes: page.notes.map((n) => (ids.includes(n.id) ? f(n) : n)),
})

export const Move = Schema.Struct({ id: Schema.String, x: Schema.Number, y: Schema.Number })
export type Move = typeof Move.Type
export const Shift = Schema.Struct({ id: Schema.String, dx: Schema.Number, dy: Schema.Number })
export type Shift = typeof Shift.Type
/** Several things settle at once: notes to where they landed, strokes and shapes by how far they were carried. */
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
  shapes: page.shapes.map((s) =>
    Option.match(Arr.findFirst(shifts, (m) => m.id === s.id), {
      onNone: () => s,
      onSome: (m) => ({ ...s, x0: s.x0 + m.dx, y0: s.y0 + m.dy, x1: s.x1 + m.dx, y1: s.y1 + m.dy }),
    }),
  ),
  order: page.order,
})
/** A picked note or shape rises above the rest: the page keeps the order it draws in. */
export const raise = (page: Page, id: string): Page => {
  if (!page.notes.some((n) => n.id === id) && !page.shapes.some((s) => s.id === id)) return page
  const order = drawOrder(page).map(drawnId)
  if (order[order.length - 1] === id) return page
  return { ...page, order: [...order.filter((x) => x !== id), id] }
}
/** A hand's resize: whole cells, never narrower or shorter than the least. */
export const resize = (page: Page, id: string, w: number, h: number): Page =>
  edit(page, [id], (n) => ({ ...n, w: Math.max(MIN_W, Math.round(w / GRID) * GRID), h: Math.max(MIN_H, Math.round(h / GRID) * GRID) }))
export const retitle = (page: Page, id: string, title: string): Page => edit(page, [id], (n) => ({ ...n, title }))
export const revalue = (page: Page, id: string, number: string): Page => edit(page, [id], (n) => ({ ...n, number }))
/** Swap the kind of every picked note; a value the new kind cannot carry is dropped. */
export const rekind = (page: Page, ids: ReadonlyArray<string>, kind: NoteKind): Page =>
  edit(page, ids, (n) => ({ ...n, kind, number: takesValue(kind) ? n.number : "" }))
/** Remove whatever is picked: notes, strokes and shapes alike. */
export const removeMany = (page: Page, ids: ReadonlyArray<string>): Page => ({
  notes: page.notes.filter((n) => !ids.includes(n.id)),
  ink: page.ink.filter((s) => !ids.includes(s.id)),
  shapes: page.shapes.filter((s) => !ids.includes(s.id)),
  order: page.order.filter((id) => !ids.includes(id)),
})
/** Copies of the picked notes, a cell over, loose of any group. */
export const duplicateNotes = (page: Page, ids: ReadonlyArray<string>, stamp: string): Page => {
  const copies = page.notes.filter((n) => ids.includes(n.id)).map((n, i) => ({ ...n, id: `${n.id}d${stamp}${i}`, x: n.x + GRID, y: n.y + GRID, group: "" }))
  return { ...page, notes: [...page.notes, ...copies], order: [...page.order, ...copies.map((n) => n.id)] }
}
export const clearPage = (page: Page): Page => (isBlankPage(page) ? page : EMPTY_PAGE)

// --- The clipboard: things taken off a page, to be put down on another ---
//
// (owner, 2026-10-29: the one real gap is to "move things around" — consolidate
// the suspects onto a clean page.) What is taken is a page fragment: the
// picked notes, strokes and shapes as they are. Putting it down gives
// everything fresh ids and fresh groups (a group put down twice is two
// groups), at the same place on the lattice — or one cell over when it is
// put down on the page it was copied from, as a duplicate is.

/** The picked notes, strokes and shapes, as a page fragment. */
export const taken = (page: Page, ids: ReadonlyArray<string>): Page => ({
  notes: page.notes.filter((n) => ids.includes(n.id)),
  ink: page.ink.filter((s) => ids.includes(s.id)),
  shapes: page.shapes.filter((s) => ids.includes(s.id)),
  order: drawOrder(page).map(drawnId).filter((id) => ids.includes(id)),
})
/** The fragment laid on a page, fresh, offset by `by` px both ways: the page, and the ids of what was laid down. */
export const putDown = (page: Page, clip: Page, stamp: string, by: number): { readonly page: Page; readonly ids: ReadonlyArray<string> } => {
  // every group in the fragment becomes a new group, once
  const groups = Rec.fromEntries(
    Arr.dedupe([...clip.notes, ...clip.ink, ...clip.shapes].map((x) => x.group).filter((g) => g !== "")).map((g, i) => [g, `g${stamp}${i}`] as const),
  )
  const regroup = (g: string): string => groups[g] ?? ""
  const notes = clip.notes.map((n, i) => ({ ...n, id: `n${stamp}p${i}`, x: n.x + by, y: n.y + by, group: regroup(n.group) }))
  const ink = clip.ink.map((s, i) => ({
    ...s,
    id: `i${stamp}p${i}`,
    points: by === 0 ? s.points : s.points.map((v, k) => (k % 3 === 2 ? v : v + by)),
    group: regroup(s.group),
  }))
  const shapes = clip.shapes.map((s, i) => ({ ...s, id: `h${stamp}p${i}`, x0: s.x0 + by, y0: s.y0 + by, x1: s.x1 + by, y1: s.y1 + by, group: regroup(s.group) }))
  // the fragment keeps its own draw order, laid above everything on the page
  const fresh = Rec.fromEntries([
    ...clip.notes.map((n, i) => [n.id, notes[i]!.id] as const),
    ...clip.shapes.map((s, i) => [s.id, shapes[i]!.id] as const),
  ])
  const laid = drawOrder(clip).flatMap((d) => Option.toArray(Option.fromNullishOr(fresh[drawnId(d)])))
  return {
    page: { notes: [...page.notes, ...notes], ink: [...page.ink, ...ink], shapes: [...page.shapes, ...shapes], order: [...page.order, ...laid] },
    ids: [...notes.map((n) => n.id), ...ink.map((s) => s.id), ...shapes.map((s) => s.id)],
  }
}

// --- Groups: things that move as one ---

const groupOf = (page: Page, id: string): string =>
  Option.getOrElse(
    Arr.findFirst([...page.notes, ...page.ink, ...page.shapes], (x) => x.id === id).pipe(Option.map((x) => x.group)),
    () => "",
  )

/** The ids with every member of any group among them: picking one picks the rest. */
export const withGroups = (page: Page, ids: ReadonlyArray<string>): ReadonlyArray<string> => {
  const groups = ids.map((id) => groupOf(page, id)).filter((g) => g !== "")
  const members = [...page.notes, ...page.ink, ...page.shapes].filter((x) => groups.includes(x.group)).map((x) => x.id)
  return [...ids, ...members.filter((id) => !ids.includes(id))]
}
/** True when the ids are exactly one whole group: the button then ungroups. */
export const isOneGroup = (page: Page, ids: ReadonlyArray<string>): boolean => {
  const groups = ids.map((id) => groupOf(page, id))
  const g = groups[0]
  return ids.length > 1 && g !== undefined && g !== "" && groups.every((x) => x === g) && withGroups(page, ids).length === ids.length
}
/** Bind the ids into one group, or loose them if they already are one. */
export const toggleGroup = (page: Page, ids: ReadonlyArray<string>, stamp: string): Page => {
  const group = isOneGroup(page, ids) ? "" : `g${stamp}`
  return {
    ...page,
    notes: page.notes.map((n) => (ids.includes(n.id) ? { ...n, group } : n)),
    ink: page.ink.map((s) => (ids.includes(s.id) ? { ...s, group } : s)),
    shapes: page.shapes.map((s) => (ids.includes(s.id) ? { ...s, group } : s)),
  }
}

// --- The sweep ---

const overlaps = (a: Box, b: Box): boolean => {
  const ax0 = Math.min(a.x, a.x + a.w)
  const ax1 = Math.max(a.x, a.x + a.w)
  const ay0 = Math.min(a.y, a.y + a.h)
  const ay1 = Math.max(a.y, a.y + a.h)
  return b.x < ax1 && b.x + b.w > ax0 && b.y < ay1 && b.y + b.h > ay0
}
/** A stroke's extent, from its points. */
export const inkBox = (s: Ink): Box => {
  const ext = s.points.reduce(
    (b, v, i) =>
      i % 3 === 0 ? { ...b, x0: Math.min(b.x0, v), x1: Math.max(b.x1, v) } : i % 3 === 1 ? { ...b, y0: Math.min(b.y0, v), y1: Math.max(b.y1, v) } : b,
    { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
  )
  return { x: ext.x0, y: ext.y0, w: ext.x1 - ext.x0, h: ext.y1 - ext.y0 }
}
/** What a sweep of the select tool takes: any note, stroke or shape whose box the sweep touches, with their groups. */
export const swept = (page: Page, box: Box, heightOf: (n: Note) => number): ReadonlyArray<string> =>
  withGroups(page, [
    ...page.notes.filter((n) => overlaps(box, { x: n.x, y: n.y, w: n.w, h: heightOf(n) })).map((n) => n.id),
    ...page.ink.filter((s) => overlaps(box, inkBox(s))).map((s) => s.id),
    ...page.shapes.filter((s) => overlaps(box, shapeBox(s))).map((s) => s.id),
  ])
