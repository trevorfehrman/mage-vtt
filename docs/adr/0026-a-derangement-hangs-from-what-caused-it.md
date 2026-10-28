# A derangement hangs from what caused it, and the player marks it

Adopted 2026-10-28 (MAG-60, inside the sheet-completeness arc P-MAG-15;
owner's framing of the same day: "the challenge here is to communicate two
types, and to associate one type with the specific pip of the wisdom track
that's missing"). **Amended the same evening**: the owner tore the pip out —
"i wanna tear out all the logic of assigning a derangement to a specific
wisdom pip, i don't anticipate that these will happen often enough for the
players to forget what they're associated with, we can cross that bridge if
and when we come to it" — so a lasting one now simply stands. **Amended
again later that night**: the zone, its fog, its ghost and the "take as
lasting | Bedlam" switch came out ("remove the zone, the ghost button,
derangements becomes the header of an accordion … take away the symbol,
take away the lasting vs bedlam toggle … the debuff on the sheet once
selected is way too big"), so the sheet draws the accordion described in
§2 as amended, and the mark from the sheet is always lasting.

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
   is the cause: `lasting` for one a failed degeneration left behind
   (Mage p. 79); `scene` with the Scene a Bedlam one is bound to; `until`
   with an expiry stamped from the Wisdom table at the moment of the mark.
   Whether it still stands is **derived at read time** against the moment
   — the open Scene, the clock — and nothing ever has to clear it: a
   lasting one stands until put down by hand, a scene-bound one while that
   Scene is the open one, a clocked one until its expiry. (As first
   adopted the lasting hold was `lostDot` with the Wisdom rank it cost,
   standing while that dot was lost; the owner withdrew the tie to the pip
   the same day, see above.)
2. **The sheet draws derangements as an accordion** beneath the title
   card's title row, its heading — the opener, a caret beside it — on
   Health's and Wisdom's left edge, always present. Beneath the heading,
   always: the held ones as small chips, the name in the display serif (it
   is fiction) in its hold's ink — the wound's bruise for a lasting one,
   Paradox red for a Bedlam's — with the full reading in a tooltip on
   hover; or, holding none, the sentence "You are not deranged." Either
   opens the body; a chip opens it on its own pair at its own depth. The
   body is two-sided: the nine pairs as rows that say both names, and the
   chosen pair's two forms read whole — what sets it off and the roll that
   resists, the bout, the Bedlam weakness — parted by a line with the
   *turn* on it, a half-lit disc lit toward the live form, the other form
   dimmed; a click on the turn or on the dimmed form turns it, the mild
   form live by default. One button at the corner: *Derange* takes the
   live form, *Compose* — Resolve + Composure being what resists a
   derangement — puts a held one down.
3. **The player marks it**, through `markSheet`: `derangement: { name,
   bedlam? }` — lasting unless `bedlam` is set, in which case the hold is
   the open Scene at Wisdom 5+ (refused when none is open) or the table's
   clock below. The sheet's accordion never sets `bedlam`; that door
   stays for the cast card's Bedlam rung to pass later. `shedDerangement: name` is the mark in reverse. Which
   derangement is chosen stays between player and Storyteller, as the book
   says. The Storyteller inherits the door through the normal ladder
   (Override-recorded), as with every mark.
4. **One pair, one depth.** A pair is one affliction at two depths (WoD
   p. 97: the severe form is what the mild one worsens into), so taking a
   name drops its partner: Hysteria over a held Phobia deepens it, Phobia
   over a held Hysteria lightens it. A derangement mark writes the list
   whole, so whatever no longer stands at that moment leaves the row with
   it. (The Wisdom-mark shedding of the first adoption went with the pip.)

## Consequences

- The ticket's "Storyteller picks it through the ST hand-edit surface" is
  superseded; `handEditSheet` does not take derangements. The resolved
  Bedlam rung on the cast card does not place one either: the ST says
  "Depression for the scene", the player marks it, as on paper.
- A Bedlam mark at Wisdom 5+ needs a Scene open. In downtime it is
  refused, which is the rule: a scene-long affliction with no scene has
  nothing to bind to.
- Fixation's Bedlam duration (a die roll's worth of scenes, Mage p. 269)
  is not clocked; it binds to the Scene like the rest, the Chronicle line
  carries the book's note, and the table re-marks it if it should run on.
- Nothing on the sheet says which Wisdom dot a lasting one cost; the
  Chronicle line ("Phobia (lasting)") and the player's memory carry it.
  If that proves too little at the table, the pip comes back as a note on
  the hold, not as a door.
- The template carries an empty `derangements` list; no live character
  holds one today, so no re-ingest is owed by this change.
- The `derangements` column is optional and absent means none; rows
  written before it decode unchanged. Stored rows may hold stale entries
  (an expired clock, a closed Scene) until the next derangement mark; the
  sheet never shows them.
