# Every die is one diamond, and a cast remembers its triggers

> **Amended** (2026-10-23, MAG-18 — the burst lands). The "what this ADR
> does not decide" reservation below is discharged: every rolled row — the
> Chronicle's roll cards and the Cast card's Paradox and CAST rows, on
> every seat — now draws through one `BurstFaces` component in the burst
> order. **How a burst looks:** each explosion stands beside the trigger
> that spawned it, and a trigger with its children sits on one filled
> **plate** — a single object that never wraps apart, so the relationship
> survives a row wrap (anything living in the gap does not). The plate is
> nearly square (3px, an echo of the die's own 4px), filled with a tint of
> the dice's ring ink (verdigris; red on the Paradox row), and **flush**:
> it reaches 2px past the diamonds' points and is pulled out by the same,
> so its dice keep the row's grid and spacing and the row keeps its height
> (`platePad`). Behind the dice a slow **fog** of the same ink drifts while
> the roll is fresh — the feed's newest roll card, a live cast's Paradox
> row — and holds still on history. Auditioned on the owner's eye and set
> aside: corners brought together until they touched (it read as a layout
> bug, not as consequence), faint per-die dressings (halos, rippled rings,
> a spark, an inherited ink), a pill and rounder radii, a sliding fog, and
> louder effects (an edge beam, sparkles, a heat shimmer, burst rays).
> **How it moves:** a
> child springs out of the die before it — from one box-and-gap to the
> left, scaled to 0.4 and unseen, on the felt's accrete spring — each
> generation one beat (90ms) after the last, so cause reads before effect
> before effect's effect; the trigger itself stands where the row put it.
> Reduced motion renders every die at once; the grouping still says it.
> **Legacy casts** (parentless explosions) fall back to single-die
> clusters at the row's end — the inline render they always had. **One
> doctrine adjusted:** the Paradox row's contained successes "ghost from
> the row's end" (MAG-45), and the row is now the *burst* row, the one the
> eye walks — so the last N successes in burst order ghost, computed in
> the plan (`burstPlan`), not in the card. The CAST row's eaten ghosts
> trail the whole row for the same reason. Rules in
> `src/components/game/burst-look.ts`, plain functions over Schema shapes.

Adopted 2026-10-23 at the close of the "Dice/felt unified language" project
(MAG-13 → MAG-19; the owner's four decisions of 2026-07-20 in
`docs/vulgar-dice-language-plan.md`, worked eyes-on through the
dressing-room tours of 2026-10-22 and 2026-10-23). This ADR records what
is now built and reserves one amendment for what is not yet. It extends
ADR-0021 (the polish standards) and ADR-0022 (the felt's doctrine on the
cast card); neither is contradicted.

## One primitive, two jobs

**The app has one die, `UnifiedDie`, and it does both die jobs behind a
discriminated `mode`:** `pool` is an unrolled die on a felt — valueless,
colored by where it came from, entering and leaving with the accrete
spring, skimmable where the felt allows; `face` is a rolled die — its
value inside, its tone read from the dice domain's outcome rules
(`isDieSuccess`, `isDieDramaticFailure`, `isDieExplosive`; the component
derives nothing). The look rules live in `src/components/game/die-look.ts`
as plain functions over Schema shapes (ADR-0014, ADR-0017) — `poolLook`,
`poolClass`, `faceLook` — and `UnifiedDie.tsx` only lays pixels. The two
components that preceded it, `FeltDie` (the pool job) and `Die` (the face
job), are deleted; every caller moved: the dice tray, the declaration
felt, the Cast card's three pre-roll seats and its resolved faces, the
Chronicle's roll cards, and the polish route's audition and roll card.

Rejected: two components sharing design tokens. That is what existed, and
the 2026-10-22 tour found them to be two slightly different diamonds —
radius, border placement and ghost recipe had each drifted. Shared tokens
do not stop drift; one component does. The cost accepted is a
discriminated-union prop surface (a pool die cannot be handed a face's
`v`, and the type system says so), which the owner judged cheaper than a
second diamond.

**One geometry, settled by eye.** The owner's four rulings from the tour
are the geometry: a 4px radius in both modes; every die's base outline is a
1px border *inside* the box, so a pool die resolving into a face occupies
exactly the same pixels; rote and explosion rings stay a box-shadow
*outside* it; the 20/24px size ladder stands and callers keep the sizes
they pass. Whatever stands inside the diamond — an Arcanum glyph, a face
value — counter-rotates so it reads upright.

## One ghost

A die that is not (yet) real is drawn one way: dashed in the die's own ink
over a transparent body, at 45%. A price being weighed before the commit
(the containment bet's dice, the mitigation row's red dice ghosting from
the Paradox row's end), a declared die Paradox ate before the throw (the
resolved felt's empty slots), and the chance-die stand-in on an empty
Paradox row are the same mark. Rejected: the old face ghost, which was
grey — the owner's call on the tour was that an eaten verdigris die should
fade to a faint verdigris dash, not to a different colour. A ghost never
lights (see below) and a ghost in the first slot keeps the first slot's
key, so a flood turns one motion element from ghost to solid in place.

## Provenance inks, and holes

Every unrolled die wears where it came from, and the felt says it with
colour, not tags (MAG-44's audition, ADR-0022's Tides amendment): the
sheet's dice and Gnosis verdigris; an Arcanum's dice its Supernal realm's
metal with the Arcanum glyph inside (the one symbol kept — it is both
glyph and colour); High Speech white, the ink that is no identity's;
Willpower the `--will` amethyst, the same hue on the felt and on the
masthead's pips. Reality's dice are **holes**: a Paradox die is a scorch in
the felt — the Gnosis base in verdigris, the Tides' dice in Paradox red at
a heavier fill — whose rim-burn breathes at rest (the ambient-motion
exception recorded on ADR-0021). The Cast card's group hover **lights** a
kind: every die of the hovered kind glows in its own ink (a ring and an
outside bloom; a lit hole holds its breath), so the tooltip's "Gnosis 3:
+2 − Tool: −1" and the dice it names are visibly one group.

## The diamond is reserved for a die

Two shape families stand beside the felt and were deliberately left as
they are. **The health boxes** — the sheet's track, the masthead's
mini-track, and the cockpit's containment boxes on the Cast card — are the
printed sheet's squares with the damage glyph inside (╱ ✕ ✳, the Resistant
dot beneath; WoD p. 171). **The masthead's Will and Mana pips** are the ◈
glyph repeated, a count of spendable points with a hollow pending ghost of
their own (ADR-0022's pass 3). Neither is rotated, neither takes a face,
neither moved under this project; MAG-44 re-inked the Will pips to the
felt's amethyst, and that is the whole of their change.

Why: the diamond means *this will be rolled, or was*. A wound is not
rolled and a Mana point is not rolled; the box clicks that buy Paradox
dice back are a bet placed against a wound, not a die, and the pips the
felt arms are a spend, not a pool. Give either the die's silhouette and
the felt starts to lie about what is at stake. Consequence: `UnifiedDie`
never grows a `box` or `pip` mode, and a new die *job* is a new rule in
`die-look.ts` plus a row in the audition, never a new component.

## A cast remembers its triggers

The domain change the owner asked for in decision 3 is built as a
**record**, not yet as motion. A rolled roll's explosions are no longer a
flat list of faces: each is `{ value, parentIndex }`, where `parentIndex`
is the **trigger die** that spawned it — an index into the roll's combined
sequence (rolls, then rote rerolls, then explosions) and always a die that
was itself at or above the Again threshold in a prior generation. The
cascade threads the lineage as it rolls, one child per trigger, so a
chain (a 10 whose child is a 10) is a line, never a tree. Both the Paradox
roll and the release roll persist the parented shape on the Cast document;
the schema bridge, the store port, the live adapter and the in-memory
store carry it in lockstep (MAG-14). Casts written before lineage existed
still hold bare faces, and they are healed to parentless structs
(`parentIndex: null`) at exactly one door, `healCastExplosions`, which the
seam decode and the feed projection share — so the two boundaries cannot
drift, and a legacy cast never crashes.

The **burst** — the order a felt draws when it honours lineage — is also
built, as the pure function `burstClusters`: every base die followed by
the chain it spawned, chains following only the first claimant of a parent
and only forward, so malformed parentage (cycles, self-references,
duplicates, out-of-range indices) can neither loop nor crash; whatever no
chain reaches renders inline at the row's end in stored order, which is
exactly the pre-lineage render. Rejected: computing the burst in the
component. The order is a rule about the roll, and the legacy fallback is
a rule about the record; both belong in `src/domain/dice.ts` where seeded
tests can pin them.

**What this ADR did not decide when adopted:** how an explosion *moves*.
At adoption every felt still drew explosions inline, in stored order, and
nothing called `burstClusters` but its tests; the substrate was recorded
so that MAG-18 would be purely a rendering ticket. *(Discharged by the
2026-10-23 amendment above: MAG-18 landed the burst.)*

## Consequences

- `UnifiedDie` is the only die. A sweep on 2026-10-23 found die geometry
  (the 45° stance, the 20/24 ladder) in `UnifiedDie.tsx`, `die-look.ts`
  and the Cast card's 20px tooltip-trigger seats, and nowhere else; the
  polish route's last private square die was retired with this ADR.
- The audition at `/prototype/component-polish` is the die's proof
  surface: every pool kind solid, ghost, lit and at both sizes, every face
  state, and a live felt per kind for the springs. A change to
  `die-look.ts` is checked there first (ADR-0021's workbench rule).
- `FeltDie` and `Die` are names in history only (ADR-0021's amendments,
  the plan doc, the campaign's commit messages); no doc should describe
  them as present.
- Glossary (CONTEXT.md, "Dice pools"): **felt**, **ghost** (of a die),
  **hole**, **trigger die**, **burst** are the table's words.
- MAG-18 amended the burst section above (header note). MAG-17's two open owner calls
  (whether every seat sees the caster's containment ghosts before the
  Cast; whether a Mana-mitigated die stays ghosted in the record) are
  presentation choices under "one ghost" and do not reopen this ADR.
