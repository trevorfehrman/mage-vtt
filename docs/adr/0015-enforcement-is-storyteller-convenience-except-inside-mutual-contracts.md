# Enforcement is Storyteller convenience, except inside mutual contracts

Rules automation exists to serve the Storyteller, never to police them. The app
enforces rules in two distinct regimes:

1. **Outside a contract** (most of play): computed values are *editable
   defaults*, refusals are for players, and the Storyteller always has a door —
   acting in a player's stead, hand edits, sheetless rolls, dealing damage by
   fiat, voiding a Cast. Where a rule is ambiguous or the fiction demands it,
   the ST bends it; the app's job is to make the bend *visible* (Override
   provenance, ADR-0006), never to prevent it.
2. **Inside a mutual contract** (a Cast past its point of no return, and any
   future flow where two parties commit resources against each other's rolls):
   enforcement is brutal and symmetric. Neither party — including the
   Storyteller — can silently back away, reorder steps, or edit committed
   values. The only exit besides playing it out is the ST's `void`, which is
   not a quiet retreat but an Override-stamped, table-visible repair.

## Why

The Storyteller's job is hard, and rule-bending is usually done *to keep the
game fun and moving* — the ST is our friend, not a fraud risk. A VTT that
polices them adds friction exactly where the human is already carrying the most
load. Meanwhile the moments that genuinely need enforcement are the contested
ones, where drama depends on both sides trusting that committed chips stay
committed. Splitting the regimes gives each moment what it needs: latitude
where judgment rules, rigidity where tension does.

This generalizes ADR-0011 (sheet checks encode representability, not game
legality) from the sheet to the whole action system, and it resolves how
`void` coexists with "neither party backs away": silent rule-bending is
impossible; visible rule-bending is a feature.

## Consequences

- Every new feature must classify its writes: ST-authority actions (plain,
  no Override — e.g. dealing damage, conducting combat), fudge-lane actions
  (Override-stamped — hand edits, in-stead actions, voids), or contract moves
  (status-checked, order-enforced, refused with typed errors for *both* roles).
- Computed rule values (Paradox pools, tick costs, modifiers) are presented as
  defaults the ST can adjust, not verdicts. Rules ambiguity is resolved by ST
  edit, not by us picking an interpretation and locking it in.
- The ST must always be able to reconstruct a correct game action manually
  (paper NPCs via sheetless rolls and hand-typed values), even when a richer
  automated path exists.
- Players do not get these doors: player writes stay action-mediated and
  refusals for players are real.
