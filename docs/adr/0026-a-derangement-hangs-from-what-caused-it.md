# A derangement hangs from what caused it, and the player marks it

Adopted 2026-10-28 (MAG-60, inside the sheet-completeness arc P-MAG-15;
owner's framing of the same day: "the challenge here is to communicate two
types, and to associate one type with the specific pip of the wisdom track
that's missing").

## Context

The book gives a mage a derangement two ways (CONTEXT.md → Derangement):
permanently, when a Wisdom degeneration roll fails and the follow-up roll
fails too — tied to the dot lost, gone when it is bought back (Mage p. 79);
or temporarily, from a Bedlam Paradox, for the Paradox's duration off the
Wisdom table (Mage p. 268): one scene at Wisdom 5 and above, hours and
days below. The ticket as filed asked for a Derangements line with a
`source` and an optional `until`, placed by the Storyteller through the
hand-edit surface. Two things were wrong with that. A line of names loses
the one fact that matters about each — *what it is tied to* — and a
stored duration has to be cleaned up by someone. And the owner wants no
Storyteller UI built in this arc: every mark on the sheet is the player's
own paper gesture (ADR-0025).

## Decision

1. **A held derangement is a name and a hold**, never a duration. The hold
   is the cause: `lostDot` with the Wisdom rank it cost; `scene` with the
   Scene it is bound to; `until` with an expiry stamped from the Wisdom
   table at the moment of the mark. Whether it still stands is **derived
   at read time** against the moment — the sheet's Wisdom, the open
   Scene, the clock — and nothing ever has to clear it: a permanent one
   stands while its dot is lost, a scene-bound one while that Scene is the
   open one, a clocked one until its expiry.
2. **The sheet draws the two kinds by what they hang from.** Under the
   Wisdom meter, a permanent one is pinned by a stem through the hollow
   cell it cost and the name hangs off the stem; a Bedlam one wears the
   Paradox glyph, its weakness in a few words, and its clock ("scene", or
   the time left). No source word, no hover: the stem says "this dot", the
   glyph says "Paradox".
3. **The player marks it**, through `markSheet`: `derangement: { name,
   cause }` where the cause is the dot just lost (the hold is the dot one
   above Wisdom now — the player marks Wisdom down first; nothing at 10)
   or Bedlam (the open Scene at Wisdom 5+, refused when none is open; the
   table's clock below). `shedDerangement: name` is the mark in reverse.
   Which derangement is chosen stays between player and Storyteller, as
   the book says. The Storyteller inherits the door through the normal
   ladder (Override-recorded), as with every mark.
4. **Two writes keep the stored list honest without a sweeper.** A
   derangement mark writes the list whole, so whatever no longer stands at
   that moment leaves the row with it. A Wisdom mark that buys a dot back
   sheds the derangement that dot carried, so a later loss of the same dot
   starts clean — the derived rule alone would have resurrected the old
   affliction.

## Consequences

- The ticket's "Storyteller picks it through the ST hand-edit surface" is
  superseded; `handEditSheet` does not take derangements. The resolved
  Bedlam rung on the cast card does not place one either: the ST says
  "Depression for the scene", the player marks it, as on paper.
- A Bedlam mark at Wisdom 5+ needs a Scene open. In downtime it is
  refused, which is the rule: a scene-long affliction with no scene has
  nothing to bind to.
- Fixation's Bedlam duration (a die roll's worth of scenes, Mage p. 269)
  is not modelled; it binds to the Scene like the rest and the table
  re-marks it if it should run on.
- The `derangements` column is optional and absent means none; rows
  written before it decode unchanged. Stored rows may hold stale entries
  (an expired clock, a closed Scene) until the next derangement mark; the
  sheet never shows them.
