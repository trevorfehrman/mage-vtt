/**
 * The notebook's look (MAG-75): the pure half of the pad — what a kind
 * looks like, the wheel's and the ribbon's measures, the row's geometry —
 * kept apart from the Konva rendering as `merit-ring-look.ts` is from the
 * ring. No React, no Konva, no app state: numbers and strings a test can
 * read. Every value here was settled with the owner's hand on the rig
 * (2026-10-28/29); the rig's knobs (?rule, ?gap, ?feel) are gone and their
 * settled values pinned: dots ruling, a 3px gutter, the "mid" feel.
 */
import { Match, Schema } from "effect"
import { CELL, GRID, KINDS, SPINE_W, takesValue, type NoteKind } from "#/domain/notebook"

/** What the pointer does on the page: pick, touch, sweep and move (double-click on bare page writes a note), draw with the quill, or draw a shape. */
export const Tool = Schema.Literals(["select", "pen", "shape"])
export type Tool = typeof Tool.Type

/** A fresh name for a thing the hand makes: the clock and a count, so two made in one tick differ (the domain is clockless, ADR-0014). */
export const freshStamp = (counter: { current: number }): string => {
  counter.current += 1
  return `${Date.now().toString(36)}${counter.current}`
}

/** The hand: Kalam (owner, 2026-10-29: "kalam is the font"). */
export const HAND_FONT = "Kalam"
export const HAND_FONT_HREF = "https://fonts.googleapis.com/css2?family=Kalam:wght@300;400&display=swap"

/**
 * The page's measure: 32 by 18 cells, the panel's full width, with the tabs
 * standing a tab's width past the panel's border — the rig's look, kept
 * (owner, 2026-10-29: "the tabs have to stick out from the frame"; a
 * 31-cell page with the tabs in its last cell read as "kinda still inside").
 * The sheet's center column has to leave that width to the right of the
 * panel; on a column too narrow for it the column's scroll clips them, and
 * that is accepted over shifting the whole sheet for the notebook's sake.
 */
export const PAGE_W = GRID * 32
export const PAGE_H = GRID * 18
/** The gutter: px the plate is drawn inside its lattice box, on every side (owner: "snapping just a few pixels inside the dots? this way every note next to each other have margin"). */
export const GAP = 3

/**
 * The kind's word, ink, and sigil — a small mark in a 16-box, drawn in the
 * note's spine. SVG path data so Konva's Path and a DOM <path> both draw it.
 * The word names the kind in the list; the row itself shows only the sigil
 * and the ink (owner, 2026-10-29: "i just want the kind title out of there").
 */
export const KindLook = Schema.Struct({ word: Schema.String, tint: Schema.String, glyph: Schema.String })
export type KindLook = typeof KindLook.Type
export const kindLook = (kind: NoteKind): KindLook =>
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
    // a plain note: a bullet, the simplest mark a hand makes before a line of words (owner, 2026-10-29: "bare notes deserve an icon, keep it very simple")
    Match.when("blank", () => ({ word: "note", tint: "#807b8f", glyph: "M8 5.5 A2.5 2.5 0 1 0 8 10.5 A2.5 2.5 0 1 0 8 5.5 Z" })),
    Match.exhaustive,
  )

// The kinds' inks (owner, 2026-10-29: "mark should be red ... boost should be
// blue, scene should be like a wine"): spell verdigris, armor bone, boost
// blue, condition ember, mark red, scene wine — each bright enough that its
// 9px word clears the panel.

/** The inks the quill and the shapes draw in: the six kinds' (owner, 2026-10-29: "quill should have all the ink colors too"). */
export const InkChoice = Schema.Struct({ name: Schema.String, color: Schema.String })
export type InkChoice = typeof InkChoice.Type
export const INKS: ReadonlyArray<InkChoice> = KINDS.filter((k) => k !== "blank").map((k) => ({ name: k, color: kindLook(k).tint }))

// ── The palette the pad draws in ───────────────────────────────────────────
// Hex, not tokens, on purpose: Konva paints a canvas, where a CSS variable
// cannot be read, so the four tokens the pad uses (--ink, --dim, --accent,
// --panel) are pinned here at their values, and the six kind inks are the
// notebook's own (chosen on the rig, 2026-10-29). If the tokens move, these
// move with them.
export const INK = "#d7d2e0"
export const DIM = "#807b8f"
export const ACCENT = "#6fae97"
/** The plate: a hair above the panel. */
export const PLATE = "#121118"
/** The accent at 30% over the plate, as one opaque color: what a selection in the editor wears. */
export const SELECTION = "#2e403e"
/** The ribbon: a calming red; its width; how far its tail hangs past the frame (the tail is the handle); the cut of its swallowtail. */
export const RIBBON = "#a65852"
export const RIBBON_W = 24
export const TAIL = 26
export const NOTCH = 10

// ── The wheel: the book's pages in a row under the page ─────────────────────
/** the footer's height, and one page's width on the wheel */
export const FOOTER_H = 36
export const PITCH = 40
/** the number in hand grows from NUM to NUM_IN_HAND */
export const NUM = 12
export const NUM_IN_HAND = 17
/** the hinge: degrees a page swings in from, about its spine, and how long; both shrink with the wheel's speed, to a flutter at RIFFLE pages per second */
export const HINGE = 14
export const SWING = 0.22
export const RIFFLE = 12
/** The momentum (the rig's "mid"; owner: "smoother momentum and a little bit faster ... a touch more inertia"): how far a flick carries, how quick a notch's chase is. */
export const FEEL = { power: 0.6, timeConstant: 280, stiffness: 320, damping: 33 }
/** A trackpad stream's travel, in px, for one page. */
export const WHEEL_PAGE = 420
/** How far past a cover the wheel can be pulled, in pages, and how it resists: a rubber band, not a wall. */
export const GIVE = 0.3
/** How the page strains with it: degrees about its spine and px aside, per page of give. */
export const GIVE_DEG = 30
export const GIVE_PX = 36
export const rubber = (d: number): number => GIVE * (1 - 1 / (1 + 2.5 * d))
/** A number's slide to its new place when the book thins or fills, and how long a page that fell out takes to fall. */
export const SLIDE = { type: "spring" as const, stiffness: 300, damping: 30 }
export const DROP = 0.25
/** The tabs: how far each stands past the page's edge, how tall, and how much further the one held out comes. */
export const TAB_W = 24
export const TAB_H = 40
export const TAB_OUT = 3

// ── The row's measure ──────────────────────────────────────────────────────
export const HAND = 18
export const LEAD = 1.1
export const PAD = 10
/**
 * Where the words hang from; the symbol and the value's cell center on the
 * first line of them. The whole header line lives in the row's first
 * lattice cell, so a row laid one cell over another leaves the symbol,
 * the first words and the value of the one beneath in view (owner,
 * 2026-10-29: "the icons and values should be aligned and sized such that
 * when notes overlay each other both are visible").
 */
export const WORDS_TOP = 6
/**
 * The first line's visual middle. Kalam's ink rides high in its line box
 * (ascent 19 / descent 10 at 18px, measured): the ink of a typical line
 * centers about a pixel above the box's middle, so the symbol and the value
 * center there, and a one-line row's words sit centered in its plate.
 */
export const LINE_MID = WORDS_TOP + (HAND * LEAD) / 2 - 1
export const CELL_TOP = LINE_MID - CELL / 2
/**
 * A row's height for its lines: what the words need plus the gutter, rounded
 * up to HALF cells, never under a cell and a half. Half cells, because the
 * header must sit in the first cell (so stacked rows stay readable) and a
 * one-line row two whole cells tall then floats its line high (owner,
 * 2026-10-29: "for a single line default sized note the text is no longer
 * centered in the y-axis. is this a pick your poison situation?"). A row a
 * hand has sized still snaps to whole cells.
 */
export const HALF = GRID / 2
export const rowHeight = (lines: number, gap: number): number => Math.max(GRID * 1.5, Math.ceil((WORDS_TOP + lines * HAND * LEAD + 6 + gap * 2) / HALF) * HALF)
/** The grip's reach from the row's corner, and the fade's depth at a scrolling row's foot. */
export const GRIP = 10
export const FADE = 28
/**
 * The words' column: inside the gutter, after the spine, before the value's
 * cell when there is one. `w` is the row's width on the lattice; the plate
 * is drawn `gap` px inside it on every side, so rows on neighboring cells
 * keep a margin between them.
 */
export const titleWidth = (kind: NoteKind, w: number, gap: number): number => w - gap * 2 - SPINE_W - PAD * 2 - (takesValue(kind) ? CELL + PAD : 0)

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/** A shape's line. */
export const SHAPE_STROKE = 1.5
/** A hex ink at an alpha, for a wash. */
export const washOf = (hex: string, alpha: number): string => {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
/** The pen's character (perfect-freehand): a nib that thins with speed or pressure, smoothed, tapered at both ends. */
export const PEN = { size: 5, thinning: 0.65, smoothing: 0.55, streamline: 0.5, start: { taper: 24 }, end: { taper: 32 } }
