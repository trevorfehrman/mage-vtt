// PROTOTYPE — throwaway (MAG-75 audition). The notebook's page as data,
// free of any canvas library: the Schema, the pure edits, the history, the
// stamps, the ruling. The route and the Konva pad both read this file.
// No app imports; mock only.
//
// Look-and-feel round (owner, 2026-10-28): "a mage's notebook is relatively
// neat. the handwriting is neat, a little scholarly ... click anywhere and
// start the note ... drag it into place and for it to helpfully align to
// something ... categories need to be easy to swap ... easy to clear and
// change ... words and perhaps another section for a value ... how would a
// mage build a magic notebook, that should be the atmosphere."
import { Array as Arr, Match, Option, Schema } from "effect"

// --- The page (what Convex would hold) ---

export const NoteKind = Schema.Literals(["spell", "armor", "boost", "condition", "mark", "scene", "blank"])
export type NoteKind = typeof NoteKind.Type
export const KINDS: ReadonlyArray<NoteKind> = ["blank", "spell", "armor", "boost", "condition", "mark", "scene"]

export const Note = Schema.Struct({
  id: Schema.String,
  kind: NoteKind,
  x: Schema.Number,
  y: Schema.Number,
  /** Degrees; a neat hand squares its notes, so this stays within a degree. */
  rot: Schema.Number,
  title: Schema.String,
  /** The value the kind carries ("2", "+2 Dex", "−1"); empty when none. */
  number: Schema.String,
  /** "scene" = over when the scene closes; "" = until crossed out. */
  lasts: Schema.Literals(["scene", ""]),
  onMe: Schema.Boolean,
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

/** What the pointer does on the page: write (click = note, drag = move) or draw. */
export const Tool = Schema.Literals(["write", "pen"])
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
/** Every nth dot is a hairline tick — the lattice's own sigil. */
export const GRID_TICK_EVERY = 4
export const snap = (v: number): number => Math.round(v / GRID) * GRID
export const snapPoint = (x: number, y: number): { x: number; y: number } => ({ x: snap(x), y: snap(y) })

// --- The stamps: what one click drops on the page ---

export type Stamp = { readonly kind: NoteKind; readonly label: string; readonly title: string; readonly number: string; readonly lasts: "scene" | ""; readonly onMe: boolean }

export const STAMPS: ReadonlyArray<Stamp> = [
  { kind: "spell", label: "Spell", title: "Unseen Aegis", number: "", lasts: "scene", onMe: true },
  { kind: "armor", label: "Armor", title: "Unseen Aegis", number: "2", lasts: "scene", onMe: true },
  { kind: "boost", label: "Boost", title: "Honing the Form", number: "+2", lasts: "scene", onMe: true },
  { kind: "condition", label: "Condition", title: "stunned", number: "−2", lasts: "", onMe: true },
  { kind: "mark", label: "Mark", title: "Brand — eyes of a goat", number: "", lasts: "", onMe: true },
  { kind: "scene", label: "Scene", title: "the Mausoleum", number: "", lasts: "", onMe: false },
  { kind: "blank", label: "Note", title: "", number: "", lasts: "", onMe: false },
]
export const BLANK: Stamp = STAMPS[STAMPS.length - 1]!

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
 * The kind's word, ink, and gutter glyph — a small mark in a 16-box, drawn
 * in the margin beside the note the way a scholar annotates. SVG path data
 * so Konva's Path and a DOM <path> both draw it.
 */
export const kindLook = (kind: NoteKind): { eyebrow: string; tint: string; glyph: string } =>
  Match.value(kind).pipe(
    // a casting: a sigil ring with its bindi
    Match.when("spell", () => ({ eyebrow: "SPELL", tint: "#6fae97", glyph: "M8 2.5 A5.5 5.5 0 1 0 8 13.5 A5.5 5.5 0 1 0 8 2.5 Z M8 7 A1 1 0 1 0 8 9 A1 1 0 1 0 8 7 Z" })),
    // a ward: the shield's shoulder and point
    Match.when("armor", () => ({ eyebrow: "ARMOR", tint: "#d7d2e0", glyph: "M3 3 H13 V8.5 C13 11.5 8 14 8 14 C8 14 3 11.5 3 8.5 Z" })),
    // a lift: two chevrons rising
    Match.when("boost", () => ({ eyebrow: "BOOST", tint: "#6fae97", glyph: "M3.5 8.5 L8 4 L12.5 8.5 M3.5 13 L8 8.5 L12.5 13" })),
    // a weight: two chevrons sinking
    Match.when("condition", () => ({ eyebrow: "CONDITION", tint: "#b56d60", glyph: "M3.5 3 L8 7.5 L12.5 3 M3.5 7.5 L8 12 L12.5 7.5" })),
    // a brand: three strokes through one point
    Match.when("mark", () => ({ eyebrow: "MARK", tint: "#e29659", glyph: "M8 2 V14 M3 5 L13 11 M3 11 L13 5" })),
    // the stage: a crescent, the scene's hour
    Match.when("scene", () => ({ eyebrow: "SCENE", tint: "#807b8f", glyph: "M11.5 2.5 A6 6 0 1 0 11.5 13.5 A4.6 4.6 0 1 1 11.5 2.5 Z" })),
    Match.when("blank", () => ({ eyebrow: "", tint: "#807b8f", glyph: "" })),
    Match.exhaustive,
  )

// --- A seeded hand: the same note always wobbles the same way ---

export const hash = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
/** A tiny seeded generator (mulberry32) so a note's jitter is a function of its id. */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Nine cells wide; three tall with a kind, two as a plain note. */
export const NOTE_W = GRID * 9
export const noteHeight = (n: Note): number => (n.kind === "blank" ? GRID * 2 : GRID * 3)

/**
 * A rectangle ruled by a steady hand: one open stroke around the four sides,
 * each a hair off true, that starts a touch left of the top-left corner and
 * ends a touch past it along the top edge — the pen overlapping its own
 * start, never leaving a tail.
 */
export const wobblyRect = (seed: number, w: number, h: number): number[] => {
  const r = rng(seed)
  const j = () => (r() - 0.5) * 1.8
  const over = () => r() * 4 + 3
  return [
    -over(), j(),
    w + j(), j(),
    w + j(), h + j(),
    j(), h + j(),
    j(), j(),
    over() + 2, j(),
  ]
}

/**
 * A ring drawn in one pass of the pen: twelve points around a circle, each
 * a hair off the radius, overlapping its start by a point — the value's
 * seat on the note.
 */
export const wobblyRing = (seed: number, cx: number, cy: number, radius: number): number[] => {
  const r = rng(seed)
  const pts: number[] = []
  for (let i = 0; i <= 13; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2
    const rr = radius + (r() - 0.5) * 1.6
    pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
  }
  return pts
}

const lean = (r: () => number): number => (r() - 0.5) * 1.2

export const placeStamp = (page: Page, stamp: Stamp, nth: number): Page => {
  const id = `n${Date.now().toString(36)}${nth}`
  const r = rng(hash(id))
  const col = page.notes.length % 3
  const row = Math.floor(page.notes.length / 3) % 4
  return {
    ...page,
    notes: [
      ...page.notes,
      {
        id,
        kind: stamp.kind,
        x: GRID * (1 + col * 10),
        y: GRID * (1 + row * 4),
        rot: lean(r),
        title: stamp.title,
        number: stamp.number,
        lasts: stamp.lasts,
        onMe: stamp.onMe,
      },
    ],
  }
}

/** A note where the pen touched, squared to the lattice: the write tool's click. */
export const placeAt = (page: Page, stamp: Stamp, x: number, y: number, nth: number): Page => {
  const id = `n${Date.now().toString(36)}${nth}`
  const r = rng(hash(id))
  const p = snapPoint(x, y)
  return {
    ...page,
    notes: [
      ...page.notes,
      { id, kind: stamp.kind, x: p.x, y: p.y, rot: lean(r), title: stamp.title, number: stamp.number, lasts: stamp.lasts, onMe: stamp.onMe },
    ],
  }
}

export const addInk = (page: Page, ink: Ink): Page => ({ ...page, ink: [...page.ink, ink] })
export const removeInk = (page: Page, id: string): Page => ({ ...page, ink: page.ink.filter((s) => s.id !== id) })

const edit = (page: Page, id: string, f: (n: Note) => Note): Page => ({ ...page, notes: page.notes.map((n) => (n.id === id ? f(n) : n)) })

export const moveNote = (page: Page, id: string, x: number, y: number): Page => edit(page, id, (n) => ({ ...n, x, y }))
export const retitle = (page: Page, id: string, title: string): Page => edit(page, id, (n) => ({ ...n, title }))
export const revalue = (page: Page, id: string, number: string): Page => edit(page, id, (n) => ({ ...n, number }))
/** Swap the kind; a value the new kind cannot carry is dropped. */
export const rekind = (page: Page, id: string, kind: NoteKind): Page =>
  edit(page, id, (n) => ({ ...n, kind, number: takesValue(kind) ? n.number : "" }))
export const removeNote = (page: Page, id: string): Page => ({ ...page, notes: page.notes.filter((n) => n.id !== id) })
export const duplicateNote = (page: Page, id: string): Page =>
  Option.match(Arr.findFirst(page.notes, (n) => n.id === id), {
    onNone: () => page,
    onSome: (n) => {
      const nid = `${n.id}d${page.notes.length}`
      const r = rng(hash(nid))
      return { ...page, notes: [...page.notes, { ...n, id: nid, x: n.x + GRID, y: n.y + GRID, rot: lean(r) }] }
    },
  })
export const clearPage = (page: Page): Page => (page.notes.length === 0 && page.ink.length === 0 ? page : EMPTY_PAGE)
