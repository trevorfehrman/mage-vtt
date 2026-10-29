// PROTOTYPE — throwaway (MAG-75 audition). The notebook's page as data,
// free of any canvas library: the Schema, the pure edits, the history, the
// stamps. The route and whichever pad renders it (Konva first, React Flow
// second) both read this file. No app imports; mock only.
import { Array as Arr, Match, Option, Schema } from "effect"

// --- The page (what Convex would hold) ---

export const NoteKind = Schema.Literals(["spell", "armor", "boost", "condition", "mark", "scene", "blank"])
export type NoteKind = typeof NoteKind.Type

export const Note = Schema.Struct({
  id: Schema.String,
  kind: NoteKind,
  x: Schema.Number,
  y: Schema.Number,
  /** Degrees; the hurry in the hand. */
  rot: Schema.Number,
  title: Schema.String,
  /** The number the kind carries ("2", "+2 Dex", "−1"); empty when none. */
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

/** What the pointer does on the page: pick and move, write, or draw. */
export const Tool = Schema.Literals(["select", "text", "pen"])
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

// --- The stamps: what one click drops on the page ---

export type Stamp = { readonly kind: NoteKind; readonly label: string; readonly title: string; readonly number: string; readonly lasts: "scene" | ""; readonly onMe: boolean }

export const STAMPS: ReadonlyArray<Stamp> = [
  { kind: "spell", label: "Spell", title: "Unseen Aegis", number: "", lasts: "scene", onMe: true },
  { kind: "armor", label: "Armor", title: "Unseen Aegis", number: "2", lasts: "scene", onMe: true },
  { kind: "boost", label: "Boost", title: "Honing the Form", number: "+2 Dex", lasts: "scene", onMe: true },
  { kind: "condition", label: "Condition", title: "stunned", number: "−2", lasts: "", onMe: true },
  { kind: "mark", label: "Mark", title: "Brand — eyes of a goat", number: "", lasts: "", onMe: true },
  { kind: "scene", label: "Scene", title: "the Mausoleum", number: "", lasts: "", onMe: false },
  { kind: "blank", label: "Blank", title: "", number: "", lasts: "", onMe: false },
]

/** The kind's eyebrow word and ink. */
export const kindLook = (kind: NoteKind): { eyebrow: string; tint: string } =>
  Match.value(kind).pipe(
    Match.when("spell", () => ({ eyebrow: "SPELL", tint: "#6fae97" })),
    Match.when("armor", () => ({ eyebrow: "ARMOR", tint: "#d7d2e0" })),
    Match.when("boost", () => ({ eyebrow: "BOOST", tint: "#6fae97" })),
    Match.when("condition", () => ({ eyebrow: "CONDITION", tint: "#b56d60" })),
    Match.when("mark", () => ({ eyebrow: "MARK", tint: "#e29659" })),
    Match.when("scene", () => ({ eyebrow: "SCENE", tint: "#807b8f" })),
    Match.when("blank", () => ({ eyebrow: "", tint: "#807b8f" })),
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

export const NOTE_W = 196
export const noteHeight = (n: Note): number => (n.kind === "blank" ? 44 : n.number === "" ? 70 : 92)

/**
 * A rectangle drawn in a hurry: one open stroke around the four sides, each
 * a little off true, that starts a touch left of the top-left corner and
 * ends a touch past it along the top edge — the pen overlapping its own
 * start, never leaving a tail.
 */
export const wobblyRect = (seed: number, w: number, h: number): number[] => {
  const r = rng(seed)
  const j = () => (r() - 0.5) * 3.5
  const over = () => r() * 6 + 4
  return [
    -over(), j(),
    w + j(), j(),
    w + j(), h + j(),
    j(), h + j(),
    j(), j(),
    over() + 2, j(),
  ]
}

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
        x: 24 + col * 240 + r() * 16,
        y: 20 + row * 100 + r() * 12,
        rot: (r() - 0.5) * 5,
        title: stamp.title,
        number: stamp.number,
        lasts: stamp.lasts,
        onMe: stamp.onMe,
      },
    ],
  }
}

/** A note where the pen touched: the Text tool's click. */
export const placeAt = (page: Page, stamp: Stamp, x: number, y: number, nth: number): Page => {
  const id = `n${Date.now().toString(36)}${nth}`
  const r = rng(hash(id))
  return {
    ...page,
    notes: [
      ...page.notes,
      { id, kind: stamp.kind, x, y, rot: (r() - 0.5) * 4, title: stamp.title, number: stamp.number, lasts: stamp.lasts, onMe: stamp.onMe },
    ],
  }
}

export const addInk = (page: Page, ink: Ink): Page => ({ ...page, ink: [...page.ink, ink] })
export const removeInk = (page: Page, id: string): Page => ({ ...page, ink: page.ink.filter((s) => s.id !== id) })

export const moveNote = (page: Page, id: string, x: number, y: number): Page => ({
  ...page,
  notes: page.notes.map((n) => (n.id === id ? { ...n, x, y } : n)),
})
export const retitle = (page: Page, id: string, title: string): Page => ({
  ...page,
  notes: page.notes.map((n) => (n.id === id ? { ...n, title } : n)),
})
export const removeNote = (page: Page, id: string): Page => ({ ...page, notes: page.notes.filter((n) => n.id !== id) })
export const duplicateNote = (page: Page, id: string): Page =>
  Option.match(Arr.findFirst(page.notes, (n) => n.id === id), {
    onNone: () => page,
    onSome: (n) => {
      const nid = `${n.id}d${page.notes.length}`
      const r = rng(hash(nid))
      return { ...page, notes: [...page.notes, { ...n, id: nid, x: n.x + 18, y: n.y + 22, rot: (r() - 0.5) * 5 }] }
    },
  })

