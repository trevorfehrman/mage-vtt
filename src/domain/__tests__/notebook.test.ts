import { Schema } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  addInk,
  addShape,
  Book,
  bookFrom,
  changedPages,
  clearPage,
  commit,
  drawOrder,
  duplicateNotes,
  editOpen,
  EMPTY_BOOK,
  EMPTY_PAGE,
  emptyHistory,
  GRID,
  holds,
  inkBox,
  isBlankPage,
  isOneGroup,
  MAX_INK_POINTS,
  mentions,
  MIN_H,
  MIN_W,
  moveMany,
  nearestSlot,
  NOTE_W,
  ofKind,
  only,
  ORIGIN,
  Page,
  pagesHolding,
  PAGES,
  placeAt,
  putDown,
  raise,
  recolor,
  redo,
  rekind,
  removeMany,
  reshape,
  resize,
  retitle,
  revalue,
  setMark,
  shapeBox,
  shapeStands,
  snap,
  swept,
  taken,
  takesValue,
  thinned,
  toggleGroup,
  turnTo,
  undo,
  within,
  withGroups,
  type Ink,
  type Note,
  type Shape,
} from "../notebook"

const note = (id: string, over: Partial<Note> = {}): Note => ({
  id,
  kind: "blank",
  x: ORIGIN,
  y: ORIGIN,
  title: "",
  number: "",
  lasts: "",
  group: "",
  w: NOTE_W,
  h: 0,
  ...over,
})
const ink = (id: string, points: ReadonlyArray<number>, over: Partial<Ink> = {}): Ink => ({ id, points, color: "#fff", pressured: false, group: "", ...over })
const shape = (id: string, over: Partial<Shape> = {}): Shape => ({ id, shape: "rect", x0: 10, y0: 10, x1: 50, y1: 40, color: "#fff", fill: "none", group: "", ...over })
const page = (over: Partial<Page> = {}): Page => ({ ...EMPTY_PAGE, ...over })
const tall = () => GRID * 2

describe("the lattice", () => {
  it("snaps to the dots, half a pitch in from the edge", () => {
    expect(snap(ORIGIN)).toBe(ORIGIN)
    expect(snap(ORIGIN + GRID - 1)).toBe(ORIGIN + GRID)
    expect(snap(ORIGIN + GRID / 2 - 1)).toBe(ORIGIN)
  })

  it("nudges a note that would hang past the page back inside it", () => {
    const seat = within({ x: 900, y: -40 }, NOTE_W, tall(), 768, 432)
    expect(seat.x).toBe(snap(768 - ORIGIN - NOTE_W))
    expect(seat.y).toBe(ORIGIN)
  })

  it("the kinds that carry a value are armor, boost, condition and mark", () => {
    expect(["armor", "boost", "condition", "mark"].every((k) => takesValue(k as Note["kind"]))).toBe(true)
    expect(["spell", "scene", "blank"].some((k) => takesValue(k as Note["kind"]))).toBe(false)
  })
})

describe("the edits", () => {
  it("places a plain note on the lattice, named by the stamp, last in the draw order", () => {
    const p = placeAt(EMPTY_PAGE, 100, 70, "s1")
    expect(p.notes).toHaveLength(1)
    expect(p.notes[0]).toMatchObject({ id: "ns1", kind: "blank", x: snap(100), y: snap(70), w: NOTE_W, h: 0 })
    expect(p.order).toEqual(["ns1"])
  })

  it("resizes to whole cells, never under the least", () => {
    const p = resize(page({ notes: [note("a")] }), "a", 10, 10)
    expect(p.notes[0]).toMatchObject({ w: MIN_W, h: MIN_H })
    const q = resize(page({ notes: [note("a")] }), "a", GRID * 7 + 5, GRID * 3 - 5)
    expect(q.notes[0]).toMatchObject({ w: GRID * 7, h: GRID * 3 })
  })

  it("retitles, revalues, and drops a value the new kind cannot carry", () => {
    const p = revalue(retitle(page({ notes: [note("a", { kind: "armor" })] }), "a", "Shielding"), "a", "3")
    expect(p.notes[0]).toMatchObject({ title: "Shielding", number: "3" })
    expect(rekind(p, ["a"], "spell").notes[0]).toMatchObject({ kind: "spell", number: "" })
    expect(rekind(p, ["a"], "boost").notes[0]).toMatchObject({ kind: "boost", number: "3" })
  })

  it("moves notes to where they landed and carries strokes and shapes by the shift", () => {
    const p = page({ notes: [note("a")], ink: [ink("i", [0, 0, 0.5, 10, 10, 0.5])], shapes: [shape("h")] })
    const q = moveMany(p, [{ id: "a", x: 60, y: 84 }], [{ id: "i", dx: 5, dy: 7 }, { id: "h", dx: 1, dy: 2 }])
    expect(q.notes[0]).toMatchObject({ x: 60, y: 84 })
    expect(q.ink[0]!.points).toEqual([5, 7, 0.5, 15, 17, 0.5])
    expect(q.shapes[0]).toMatchObject({ x0: 11, y0: 12, x1: 51, y1: 42 })
  })

  it("removes notes, strokes and shapes alike, and their place in the order", () => {
    const p = page({ notes: [note("a"), note("b")], ink: [ink("i", [])], shapes: [shape("h")], order: ["a", "h", "b"] })
    const q = removeMany(p, ["a", "i", "h"])
    expect(q.notes.map((n) => n.id)).toEqual(["b"])
    expect(q.ink).toEqual([])
    expect(q.shapes).toEqual([])
    expect(q.order).toEqual(["b"])
  })

  it("duplicates picked notes a cell over, loose of their group, with fresh ids", () => {
    const p = duplicateNotes(page({ notes: [note("a", { group: "g1" })], order: ["a"] }), ["a"], "s")
    expect(p.notes).toHaveLength(2)
    expect(p.notes[1]).toMatchObject({ id: "ads0", x: ORIGIN + GRID, y: ORIGIN + GRID, group: "" })
    expect(p.order).toEqual(["a", "ads0"])
  })

  it("clears a page to the empty page, and leaves an empty page as it is", () => {
    expect(clearPage(EMPTY_PAGE)).toBe(EMPTY_PAGE)
    expect(isBlankPage(clearPage(page({ notes: [note("a")] })))).toBe(true)
  })
})

describe("ink", () => {
  it("lays a stroke, and a long one thinned to the Convex array's room", () => {
    const short = ink("i", [0, 0, 0.5, 1, 1, 0.5])
    expect(addInk(EMPTY_PAGE, short).ink[0]).toBe(short)
    const long = ink("j", Array.from({ length: (MAX_INK_POINTS + 600) * 3 }, (_, k) => k))
    const laid = addInk(EMPTY_PAGE, long).ink[0]!
    expect(laid.points).toHaveLength(MAX_INK_POINTS * 3)
    // first and last points kept, the rest in order
    expect(laid.points.slice(0, 3)).toEqual([0, 1, 2])
    expect(laid.points.slice(-3)).toEqual(long.points.slice(-3))
  })

  it("thinning leaves a stroke within the limit untouched", () => {
    const s = ink("i", Array.from({ length: MAX_INK_POINTS * 3 }, (_, k) => k))
    expect(thinned(s)).toBe(s)
  })

  it("measures a stroke's box from its points", () => {
    expect(inkBox(ink("i", [10, 20, 0.5, 30, 5, 0.5, 15, 40, 0.5]))).toEqual({ x: 10, y: 5, w: 20, h: 35 })
  })
})

describe("shapes", () => {
  it("adds a shape to the page and the order; reshapes to the pixel; recolors the picked", () => {
    const p = addShape(page({ notes: [note("a")], order: ["a"] }), shape("h"))
    expect(p.order).toEqual(["a", "h"])
    const q = reshape(p, "h", { x0: 1.4, y0: 2.6, x1: 9.5, y1: 3.2 })
    expect(q.shapes[0]).toMatchObject({ x0: 1, y0: 3, x1: 10, y1: 3 })
    expect(recolor(q, ["h"], "#abc").shapes[0]!.color).toBe("#abc")
  })

  it("a shape stands only once it is a cell or so each way; its box squares its corners", () => {
    expect(shapeStands(shape("h", { x0: 0, y0: 0, x1: 7, y1: 20 }))).toBe(false)
    expect(shapeStands(shape("h", { x0: 20, y0: 20, x1: 0, y1: 0 }))).toBe(true)
    expect(shapeBox(shape("h", { x0: 50, y0: 40, x1: 10, y1: 10 }))).toEqual({ x: 10, y: 10, w: 40, h: 30 })
  })
})

describe("the draw order", () => {
  it("draws the order first, then whatever it does not name, notes before shapes", () => {
    const p = page({ notes: [note("a"), note("b")], shapes: [shape("h"), shape("k")], order: ["h", "a"] })
    expect(drawOrder(p).map((d) => ("note" in d ? d.note.id : d.shape.id))).toEqual(["h", "a", "b", "k"])
  })

  it("raising puts the picked thing last and leaves an already-top one alone", () => {
    const p = page({ notes: [note("a"), note("b")], shapes: [shape("h")], order: ["a", "h", "b"] })
    expect(raise(p, "a").order).toEqual(["h", "b", "a"])
    expect(raise(p, "b")).toBe(p)
    expect(raise(p, "nobody")).toBe(p)
  })
})

describe("groups", () => {
  const grouped = page({
    notes: [note("a", { group: "g" }), note("b", { group: "g" }), note("c")],
    ink: [ink("i", [0, 0, 0.5], { group: "g" })],
  })

  it("picking one member picks the rest", () => {
    expect(withGroups(grouped, ["a"])).toEqual(["a", "b", "i"])
    expect(withGroups(grouped, ["c"])).toEqual(["c"])
  })

  it("is one group only when the ids are exactly a whole group", () => {
    expect(isOneGroup(grouped, ["a", "b", "i"])).toBe(true)
    expect(isOneGroup(grouped, ["a", "b"])).toBe(false)
    expect(isOneGroup(grouped, ["a", "c"])).toBe(false)
  })

  it("toggling binds the ids under the stamp's group, or looses a whole one", () => {
    const bound = toggleGroup(page({ notes: [note("a"), note("b")] }), ["a", "b"], "s")
    expect(bound.notes.map((n) => n.group)).toEqual(["gs", "gs"])
    const loosed = toggleGroup(grouped, ["a", "b", "i"], "s")
    expect([...loosed.notes.map((n) => n.group), ...loosed.ink.map((s) => s.group)]).toEqual(["", "", "", ""])
  })
})

describe("the sweep", () => {
  it("takes what the box touches, in either direction, with their groups", () => {
    const p = page({
      notes: [note("a", { x: ORIGIN, y: ORIGIN, group: "g" }), note("far", { x: 600, y: 300 })],
      ink: [ink("i", [500, 20, 0.5, 520, 30, 0.5], { group: "g" })],
      shapes: [shape("h", { x0: 100, y0: 300, x1: 140, y1: 340 })],
    })
    // a sweep dragged up-left over the first note only
    expect(swept(p, { x: 60, y: 60, w: -50, h: -50 }, tall)).toEqual(["a", "i"])
    expect(swept(p, { x: 90, y: 290, w: 20, h: 20 }, tall)).toEqual(["h"])
    expect(swept(p, { x: 700, y: 400, w: 10, h: 10 }, tall)).toEqual([])
  })
})

describe("the clipboard", () => {
  const source = page({
    notes: [note("a", { group: "g" }), note("b", { group: "g" }), note("c")],
    ink: [ink("i", [1, 2, 0.5], { group: "g" })],
    shapes: [shape("h")],
    order: ["h", "a", "c", "b"],
  })

  it("takes the picked things as a fragment that keeps their draw order", () => {
    const clip = taken(source, ["a", "b", "i", "h"])
    expect(clip.notes.map((n) => n.id)).toEqual(["a", "b"])
    expect(clip.ink.map((s) => s.id)).toEqual(["i"])
    expect(clip.shapes.map((s) => s.id)).toEqual(["h"])
    expect(clip.order).toEqual(["h", "a", "b"])
  })

  it("puts the fragment down fresh: new ids, one new group for the old one, laid above the page", () => {
    const clip = taken(source, ["a", "b", "i", "h"])
    const laid = putDown(page({ notes: [note("z")], order: ["z"] }), clip, "s", 0)
    expect(laid.ids).toEqual(["nsp0", "nsp1", "isp0", "hsp0"])
    expect(laid.page.order).toEqual(["z", "hsp0", "nsp0", "nsp1"])
    const groups = [...laid.page.notes.slice(1).map((n) => n.group), laid.page.ink[0]!.group]
    expect(groups).toEqual(["gs0", "gs0", "gs0"])
    expect(laid.page.ink[0]!.points).toEqual([1, 2, 0.5])
  })

  it("offsets everything but the pressure when put down a cell over", () => {
    const clip = taken(source, ["a", "i", "h"])
    const laid = putDown(EMPTY_PAGE, clip, "s", GRID)
    expect(laid.page.notes[0]).toMatchObject({ x: ORIGIN + GRID, y: ORIGIN + GRID })
    expect(laid.page.ink[0]!.points).toEqual([1 + GRID, 2 + GRID, 0.5])
    expect(laid.page.shapes[0]).toMatchObject({ x0: 10 + GRID, y0: 10 + GRID, x1: 50 + GRID, y1: 40 + GRID })
  })
})

describe("the thin book", () => {
  const book: Book = {
    ...EMPTY_BOOK,
    pages: EMPTY_BOOK.pages.map((p, i) =>
      i === 1 ? page({ notes: [note("s", { kind: "spell", title: "Mage Sight" }), note("b", { kind: "boost" })] }) : i === 4 ? page({ notes: [note("t", { kind: "spell", title: "Postcognition" })] }) : p,
    ),
  }

  it("reads by kind and by word, any case, and composes", () => {
    expect(pagesHolding(book, ofKind("spell"))).toEqual([1, 4])
    expect(pagesHolding(book, mentions("mage"))).toEqual([1])
    expect(pagesHolding(book, (n) => ofKind("spell")(n) && mentions("post")(n))).toEqual([4])
    expect(holds(book.pages[1]!, ofKind("armor"))).toBe(false)
    expect(mentions("  ")(note("x"))).toBe(true)
  })

  it("shows only the notes the reading keeps, the page otherwise as it was", () => {
    const read = only(book.pages[1]!, ofKind("spell"))
    expect(read.notes.map((n) => n.id)).toEqual(["s"])
    expect(read).not.toBe(book.pages[1])
  })

  it("finds the nearest slot in a view, the one after when between two", () => {
    expect(nearestSlot([1, 4], 2)).toBe(0)
    expect(nearestSlot([1, 4], 3)).toBe(1)
    expect(nearestSlot([1, 5], 3)).toBe(1)
    expect(nearestSlot([], 3)).toBe(-1)
  })
})

describe("the book", () => {
  it("is nine pages, opened at the front, the ribbon at the front", () => {
    expect(EMPTY_BOOK.pages).toHaveLength(PAGES)
    expect(EMPTY_BOOK).toMatchObject({ open: 0, mark: 0 })
  })

  it("turns within its covers and marks within its covers, unchanged when nothing moves", () => {
    expect(turnTo(EMPTY_BOOK, 20).open).toBe(PAGES - 1)
    expect(turnTo(EMPTY_BOOK, -3).open).toBe(0)
    expect(turnTo(EMPTY_BOOK, 0)).toBe(EMPTY_BOOK)
    expect(setMark(EMPTY_BOOK, 4.4).mark).toBe(4)
    expect(setMark(EMPTY_BOOK, 0)).toBe(EMPTY_BOOK)
  })

  it("edits the open page only, and is itself when the edit changed nothing", () => {
    const b = turnTo(EMPTY_BOOK, 3)
    const edited = editOpen(b, (p) => placeAt(p, 50, 50, "s"))
    expect(edited.pages[3]!.notes).toHaveLength(1)
    expect(edited.pages.filter((p) => p !== EMPTY_PAGE)).toHaveLength(1)
    expect(editOpen(b, (p) => p)).toBe(b)
  })

  it("decodes through its Schema", () => {
    expect(Schema.decodeUnknownSync(Book)(JSON.parse(JSON.stringify(EMPTY_BOOK)))).toEqual(EMPTY_BOOK)
  })
})

describe("the store's reading and writing (ADR-0027)", () => {
  it("builds the book from stored pages, a blank where the server has no row, the mark within the covers", () => {
    const rows = [
      { page: 2, ...page({ notes: [note("a")] }) },
      { page: 7, ...page({ shapes: [shape("h")] }) },
      { page: 40, ...page({ notes: [note("lost")] }) },
    ]
    const book = bookFrom(rows, 11)
    expect(book.pages).toHaveLength(PAGES)
    expect(book.pages[2]!.notes.map((n) => n.id)).toEqual(["a"])
    expect(book.pages[7]!.shapes.map((s) => s.id)).toEqual(["h"])
    expect(book.pages.filter(isBlankPage)).toHaveLength(7)
    expect(book).toMatchObject({ open: 0, mark: PAGES - 1 })
    // the row's index does not ride into the page
    expect("page" in book.pages[2]!).toBe(false)
  })

  it("names the pages a commit point changed, by reference", () => {
    const before = turnTo(EMPTY_BOOK, 5)
    const after = editOpen(before, (p) => placeAt(p, 50, 50, "s"))
    expect(changedPages(before, after)).toEqual([5])
    expect(changedPages(after, after)).toEqual([])
    // an undo changes the page back: the previous reference, so it writes again
    const h = commit(emptyHistory(before), after)
    expect(changedPages(after, undo(h).present)).toEqual([5])
    // a turn or a mark changes no page
    expect(changedPages(after, setMark(turnTo(after, 1), 8))).toEqual([])
  })
})

describe("the history", () => {
  it("commits, undoes and redoes; a commit of the same present is no commit; a new commit clears the future", () => {
    const a = EMPTY_BOOK
    const b = editOpen(a, (p) => placeAt(p, 50, 50, "1"))
    const c = editOpen(b, (p) => placeAt(p, 90, 90, "2"))
    const h = commit(commit(emptyHistory(a), b), c)
    expect(commit(h, c)).toBe(h)
    expect(h.past).toHaveLength(2)
    const back = undo(h)
    expect(back.present).toBe(b)
    expect(back.future).toEqual([c])
    expect(redo(back).present).toBe(c)
    expect(undo(undo(back))).toEqual(undo(back))
    const forked = commit(back, editOpen(b, (p) => placeAt(p, 10, 10, "3")))
    expect(forked.future).toEqual([])
    expect(redo(forked)).toBe(forked)
  })
})
