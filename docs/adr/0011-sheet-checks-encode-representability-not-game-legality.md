# Sheet checks encode representability, not game legality

There are three layers of "legal" in the app: **DB-legal** (can this be stored —
the derived Convex validator, pure infra), **sheet-legal** (is this a coherent
character sheet — the checked `CharacterSheet` domain schema, validated at every
adapter decode), and **game-legal** (is this *move* allowed — the flows and pure
calculators, the only layer god-mode/Override may bend). We decided that
sheet-legal encodes **representability only**: what physically fits in the
sheet's boxes (dots 0–10, one of five Paths, the four health-box states) —
deliberately *not* game rules like Gnosis-dependent trait caps or allocation
totals, which stay in layer 3 as move rules.

## Why

Layer-2 checks run on every read, so a check that's wrong bricks a sheet
mid-session — the worst failure mode in the app. Concrete case: `Dots1to5`
attribute checks would make a legitimate Gnosis 6+ character (trait cap rises
above 5) undecodable, and would also brick deliberately fudged sheets, even
though fudging is a first-class feature (ADR-0006). Because every write —
including Override writes — goes through `patchSheet` with domain-typed values,
a sheet that can be written can always be read back; keeping layer 2 permissive
preserves that property.

The tightening asymmetry also favors loose-first: tightening layer 2 later is a
survey-and-migrate chore over real beta data, while starting tight means
discovering a wrong check via a player-facing decode failure. When beta evidence
says a value is always wrong, encode it as a layer-3 move rule first (gates only
future writes, no migration, freely reversible); promote it to layer 2 only when
a violation would be evidence of a bug rather than of play (e.g. Gnosis 11).

## Consequences

- The existing `Dots1to5`/`Dots0to5` checks in `src/domain/character.ts` loosen
  to representability bounds when they migrate into `CharacterSheet`.
- The strict `Character` class is **absorbed** into `CharacterSheet` (one domain
  type, not a strict-creation twin): its field structs and derived getters
  (`maxMana`, `willpower`, `defense`, …) carry over, and creation strictness
  lives solely in `validateCreationRules` — which was always a layer-3 move rule
  for the "create a character" move, not sheet-legality.
- The type system will not catch weird-but-representable states (6 Strength at
  Gnosis 3); move validation and the Storyteller's eyes are the guard, and
  Override provenance (ADR-0006) records the deliberate ones.
- UX must tolerate out-of-book values on the rendered sheet rather than assume
  book maxima.
- **The compensating control is the narrow write port**, not the checks: with
  layer 2 permissive, the only guard against illegal sheet changes is what
  `GameStore.patchSheet` admits. `SheetPatch` is therefore deliberately limited
  to the fields play mutates (`manaCurrent`, `willpowerCurrent`, `healthTrack`);
  traits and identity are unreachable until a flow (advancement, ST sheet-edit)
  earns them a door with its own authority story. Widening the patch type is a
  design decision, not a convenience edit.
