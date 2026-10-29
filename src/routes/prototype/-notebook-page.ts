// PROTOTYPE — throwaway (MAG-75 audition). The notebook's page as data,
// free of any canvas library: the Schema, the pure edits, the history, the
// kinds, the ruling. The route and the Konva pad both read this file.
// No app imports; mock only.
//
// Look-and-feel round (owner, 2026-10-28/29): "a mage's notebook is
// relatively neat. the handwriting is neat, a little scholarly ... click
// anywhere and start the note ... helpfully align to something ... categories
// need to be easy to swap ... easy to clear and change ... these notes can
// have crisp designed borders so long as the text is handwriting font ...
// the stamps need to be a bit more compact and conservative."
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
})
export type Ink = typeof Ink.Type

export const Page = Schema.Struct({ notes: Schema.Array(Note), ink: Schema.Array(Ink) })
export type Page = typeof Page.Type

export const EMPTY_PAGE: Page = { notes: [], ink: [] }

/** What the pointer does on the page: pick (and sweep), write (click = note), or draw. */
export const Tool = Schema.Literals(["select", "write", "pen"])
export type Tool = typeof Tool.Type

/** The pen's inks: the page's own, the accent, the ember. */
export const INKS: ReadonlyArray<{ readonly name: string; readonly color: string }> = [
  { name: "bone", color: "#d7d2e0" },
  { name: "verdigris", color: "#6fae97" },
  { name: "ember", color: "#e29659" },
]

export type History = { readonly past: ReadonlyArray<Page>; readonly present: Page; readonly future: ReadonlyArray<Page> }

export const emptyHistory = (present: Page): History => ({ past: [], present, future: [] })
export const commit = (h: History, next: Page): History =>
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

/** Eight cells wide; three tall with a kind, two as a plain note. */
export const NOTE_W = GRID * 8
export const noteHeight = (n: Note): number => (n.kind === "blank" ? GRID * 2 : GRID * 3)

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
 * note's corner. SVG path data so Konva's Path and a DOM <path> both draw it.
 */
export const kindLook = (kind: NoteKind): { word: string; tint: string; glyph: string } =>
  Match.value(kind).pipe(
    // a casting: a sigil ring with its bindi
    Match.when("spell", () => ({ word: "spell", tint: "#6fae97", glyph: "M8 2.5 A5.5 5.5 0 1 0 8 13.5 A5.5 5.5 0 1 0 8 2.5 Z M8 7 A1 1 0 1 0 8 9 A1 1 0 1 0 8 7 Z" })),
    // a ward: the shield's shoulder and point
    Match.when("armor", () => ({ word: "armor", tint: "#d7d2e0", glyph: "M3 3 H13 V8.5 C13 11.5 8 14 8 14 C8 14 3 11.5 3 8.5 Z" })),
    // a lift: two chevrons rising
    Match.when("boost", () => ({ word: "boost", tint: "#6fae97", glyph: "M3.5 8.5 L8 4 L12.5 8.5 M3.5 13 L8 8.5 L12.5 13" })),
    // a weight: two chevrons sinking
    Match.when("condition", () => ({ word: "condition", tint: "#b56d60", glyph: "M3.5 3 L8 7.5 L12.5 3 M3.5 7.5 L8 12 L12.5 7.5" })),
    // a brand: three strokes through one point
    Match.when("mark", () => ({ word: "mark", tint: "#e29659", glyph: "M8 2 V14 M3 5 L13 11 M3 11 L13 5" })),
    // the stage: a crescent, the scene's hour
    Match.when("scene", () => ({ word: "scene", tint: "#807b8f", glyph: "M11.5 2.5 A6 6 0 1 0 11.5 13.5 A4.6 4.6 0 1 1 11.5 2.5 Z" })),
    // a plain note: a single line of the page
    Match.when("blank", () => ({ word: "note", tint: "#807b8f", glyph: "M3 8 H13" })),
    Match.exhaustive,
  )

// --- The edits ---

/** A plain note where the pen touched, squared to the lattice: the write tool's click. */
export const placeAt = (page: Page, x: number, y: number, nth: number): Page => {
  const p = snapPoint(x, y)
  return {
    ...page,
    notes: [...page.notes, { id: `n${Date.now().toString(36)}${nth}`, kind: "blank", x: p.x, y: p.y, title: "", number: "", lasts: "" }],
  }
}

export const addInk = (page: Page, ink: Ink): Page => ({ ...page, ink: [...page.ink, ink] })

const edit = (page: Page, ids: ReadonlyArray<string>, f: (n: Note) => Note): Page => ({
  ...page,
  notes: page.notes.map((n) => (ids.includes(n.id) ? f(n) : n)),
})

export type Move = { readonly id: string; readonly x: number; readonly y: number }
/** Several notes settle at once: the dragged one and everything picked with it. */
export const moveNotes = (page: Page, moves: ReadonlyArray<Move>): Page => ({
  ...page,
  notes: page.notes.map((n) =>
    Option.match(Arr.findFirst(moves, (m) => m.id === n.id), { onNone: () => n, onSome: (m) => ({ ...n, x: m.x, y: m.y }) }),
  ),
})
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
    ...page.notes.filter((n) => ids.includes(n.id)).map((n, i) => ({ ...n, id: `${n.id}d${page.notes.length + i}`, x: n.x + GRID, y: n.y + GRID })),
  ],
})
export const clearPage = (page: Page): Page => (page.notes.length === 0 && page.ink.length === 0 ? page : EMPTY_PAGE)

/** The notes a sweep of the select tool takes: any whose box the sweep touches. */
export const notesWithin = (page: Page, box: { x: number; y: number; w: number; h: number }): ReadonlyArray<string> => {
  const x0 = Math.min(box.x, box.x + box.w)
  const x1 = Math.max(box.x, box.x + box.w)
  const y0 = Math.min(box.y, box.y + box.h)
  const y1 = Math.max(box.y, box.y + box.h)
  return page.notes.filter((n) => n.x < x1 && n.x + NOTE_W > x0 && n.y < y1 && n.y + noteHeight(n) > y0).map((n) => n.id)
}
