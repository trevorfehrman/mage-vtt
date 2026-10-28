# Purses refill by the player's mark, and Destiny is one of them

Adopted 2026-10-27 (MAG-67, inside the Merits arc MAG-59; owner's call of
the same day: "the player handles this, not the Storyteller").

## Context

The sheet has three purses the book returns to the player — Willpower at
scene and chapter boundaries, Mana by oblation at a Hallow, scouring or
Prime 3, and Destiny each chapter (Mage p. 81: a pool of destiny dice equal
to twice the Merit's dots, "added to any rolls"). Before this decision a
roll debited Willpower and a cast debited Mana, but nothing gave either
back except the Storyteller's hand edit, and Destiny did not exist as sheet
state at all: the Merits audition staged its pips into the dice pool as a
modifier named after the Merit, so they reset to full when the roll
resolved — a per-roll toggle, not a purse. The grill of 2026-10-27 had
already ruled that nothing in code names a Merit and that no new buttons
go in the dice tray.

## Decision

1. **Destiny is sheet state.** `destinyCurrent` sits beside the Merit; its
   capacity is shape — twice the dots, read off the typed `purse`
   mechanic — so the column is absent-means-full and only ever read
   clamped to the capacity (a re-ingest at fewer dots never shows more
   than the purse holds).
2. **Spending is the roll's act.** The pips the player stages land in the
   pool as a typed `purse` component (`{ type: "purse", name: "Destiny",
   dots }`), never a modifier by name. On resolve the enforced roll flow
   debits the anchoring sheet by that many, exactly as Willpower's spend
   goes today, refusing `InsufficientDestiny` before anything rolls or
   writes, and refusing a purse on a free pool, which has no sheet to fund
   it. An abandoned roll spends nothing. The record keeps the component,
   so the Chronicle names Destiny.
3. **Refill is a mark.** `markSheet` takes `destinyCurrent`,
   `willpowerCurrent` and `manaCurrent` beside the track and Wisdom, walks
   the same ownership ladder (the owner plainly, an ST or Dev in their
   stead Override-recorded) and lands one Chronicle line ("Arctus marked
   Destiny 2 → 4"). Each purse fills to its printed size and no further.
   The bane's cost is the same gesture in reverse; the Storyteller's hand
   edit stays the repair path.
4. **Click-through, both ways.** On the door, Destiny's pips show three
   states in one row — in the purse (verdigris ring), staged into this
   roll (ember, the rightmost of what is left), gone this chapter (dim,
   hollow). A purse pip stages itself and every purse pip right of it; a
   staged pip takes itself and every staged pip left of it back; a gone
   pip fills the purse through itself. One grammar for spend and refill:
   "click the thing you're marking". The agent recommended this over a
   one-tap whole-purse refill; the owner has not yet ruled, so this is the
   working default and the one-tap alternative is a one-line change in
   `pipTap`.

## Consequences

- Willpower and Mana now have a refill door the player owns, with the
  same capacity checks the repair applies. Their place on the sheet
  (clicking the header's numerals; Hallow's dots per day as the oblation
  mark's default) is not yet drawn — the domain door is complete, the
  gesture is wired for Destiny only.
- The dice tray gained no buttons: Destiny is staged on the sheet, in the
  door, and shows in the tray as sheet dice named Destiny.
- Scouring also costs health; for now the player marks both and the
  Chronicle shows both. A dedicated act can come later.
