# The notebook is notes, read by no rule

Adopted 2026-10-29 (MAG-75, the sheet-completeness arc P-MAG-15). The mage's
notebook — nine pages of notes, quill strokes and shapes under the title card
— is the one surface on the sheet that **no rule reads**: nothing in the pool,
the cast ladder or the Activity feed ever looks at it (owner, triage
2026-10-28: "the app reads nothing from it"; "probably pure notes"). That
one fact decides its persistence shape.

## Decision

1. **Its writes skip the enforcement seam.** ADR-0004's `enforcedMutation` →
   `convexLive` → domain flow exists to put game-rules writes behind the
   authority ladder, the Override record and the Activity entry. A note has
   no rule to enforce, no authority to fudge and no Chronicle line to earn,
   so the notebook writes through **plain mutations behind `requireMember`**
   (the membership gate of issue #37) — like reads do, and as ADR-0004 left
   room for ("reads stay plain"). The owner of the character writes; the
   gate is membership, not ownership, because the Storyteller correcting a
   player's page is not an Override of anything. Every member reads (owner,
   2026-10-29: "everyone should be able to read them").
2. **The shape is still Schema-first.** The table's validators derive from
   the domain `Page` and `Book` Schemas through `schema-bridge.ts`
   (ADR-0005). Skipping the seam is a decision about authority, not about
   where a shape lives: `src/domain/notebook.ts` is the one source of truth
   for what a note is.
3. **One document per page, nine per character.** Every edit lands on the
   page in hand (`editOpen`), and a quill stroke is the commonest edit, so a
   commit point writes one page's document whole and the other eight pages'
   ink never travels again ("ink per stroke", owner 2026-10-29). The
   `notebookPages` table holds them, keyed by character and page index. The
   ribbon's page is the book's one fact that is not a page's, so it sits on
   a one-row-per-character `notebooks` table beside them. Which page is
   open is the hand's, not the book's: client state, never stored.
4. **Undo is local; the server holds only the present.** `History<Book>`
   lives in the client. The pad hydrates once from the query and from then
   on local history is the truth: a commit point diffs the new book against
   the old page by page and writes the pages whose reference changed, which
   covers an undo, a redo and a clear in the same breath. Incoming server
   changes while the pad is open are not merged into a live history; a
   notebook is one hand's.

## Considered

- *One `notebooks` document per character holding the whole `Book`.*
  Simplest, and the book is small — but every stroke would re-upload every
  stroke on nine pages, and a well-used notebook's ink would walk toward
  Convex's 1 MiB document ceiling as one blob. Per-page keeps each document
  a page's worth.
- *One row per stroke / per note.* The strict reading of "ink per stroke".
  Ordering, groups, the draw order and the sweep all span a page and would
  have to be reassembled on read; nothing today needs that grain. Split a
  page further only when a page's size says so.
- *Through the seam anyway, for uniformity.* Rejected: the seam's cost is a
  flow, a decode and an Activity entry per write, and a flow for a write
  that enforces nothing teaches the next reader that notes are rules.

## Consequences

- No Activity line is written for a note; the Chronicle is for the game.
- `convex/notebook.ts` holds `getForCharacter` (plain query, `requireMember`)
  and `writePage` / `setMark` (plain mutations, `requireMember`). Nothing
  in `src/domain/flows/` knows the notebook exists.
