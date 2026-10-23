# The dice/felt language, unified — build plan

> **Landed** (2026-10-23, MAG-13 → MAG-19): the unified die, the one ghost,
> the provenance inks and the explosion-parentage record are built and
> recorded in ADR-0024; `FeltDie` and `Die` are gone. Decision 3's motion —
> the burst — landed as MAG-18, and Phases 0.1 and 1 (the `.mv-glitch`
> removal, `<Felt>`) as MAG-12. This plan is history.

Status: draft plan (2026-07-20). Supersedes the ad-hoc CastCard diamond
experiment; folds it into one grammar for the whole app.

## The four decisions (owner, 2026-07-20)

1. **All dice.** The diamond/felt grammar is the default for *every* die in the
   app, not just the vulgar Cast felt — the Chronicle roll cards included.
2. **Unify.** `FeltDie` (unrolled pool die) and `Die` (rolled face) collapse
   into one primitive. No two mechanisms rendering "a die on the felt."
3. **Domain change.** Explosions record parentage: which 10 (or 9/8) spawned
   each die. A 10 can then *truly* burst into its children — the honest version
   of "explode the rows," not an indented stack.
4. **Full resolved.** The resolved-felt treatment (diamond faces, ghost/eaten
   dice, tag-chip provenance, Tides beneath, one-line resolution) cascades up
   through the draft → Tides → paradox rungs, so the whole ladder reads as one
   continuous felt.

## End state

One `Die` primitive renders both an unrolled pool die (valueless, kind-colored,
optionally motion-animated) and a rolled face (value-derived success/paradox
tone, ring, ghost) as pixel-identical diamonds on a single extracted `<Felt>`
surface. Every dice surface in the app — the caster's tray, the declaration
felt, all four Cast rungs across all three seats, and the Chronicle roll
cards — speaks it. The roll result carries explosion parentage end to end, and
the felt animates each explosion bursting from its trigger.

Because all three seats mount the *same* `CastCard`, and the roll cards share
`Die`, the visual work concentrates in two files (`Die`, a new `Felt`) plus the
domain roll-result shape — the seats and steps fall out for free.

---

## Phase 0 — Baseline cleanup (1 commit)

- **0.1** Remove the dead `.mv-glitch` CSS + keyframes from `styles.css` (the
  reverted HAVOC experiment); confirm the current diamond `Die`/`ghost` props
  are intentional and documented. No visual change. `bunx vitest run` green.

## Phase 1 — Extract `<Felt>` (1–2 commits)

The felt surface is hand-inlined at three sites; there is no component to
restyle once.

- **1.1** Create `src/components/game/Felt.tsx` encapsulating the `mv-felt`
  container (border `--line`, `color-mix` accent wash, radius, focus ring).
- **1.2** Replace the inline felt containers in `DicePoolBuilder`,
  `DeclarationFelt`, and `CastCard` with `<Felt>`. Pure refactor — pixel-diff
  the three surfaces before/after. Green.

## Phase 2 — Unify the die primitive (KEYSTONE, 3–5 small commits)

Fold `FeltDie`'s capabilities into `Die` behind a discriminated prop, then
migrate every caller and delete `FeltDie`.

- **2.1** Design the unified `Die` API. One diamond geometry (single size
  ladder, radius, rotation source), one ghost/dashed recipe, one paradox-glyph
  placement (counter-rotated). Sketch:
  ```
  type DieProps =
    | { mode: "pool"; kind: "sheet"|"loose"|"willpower"|"paradox"|"paradoxBase";
        motion?: boolean; ghost?: boolean; ... }   // was FeltDie
    | { mode: "face"; v: number; again: number; tone?: "paradox";
        ring?: "rote"|"exp"; chance?: boolean; ghost?: boolean; ... } // was Die
  // shared: size, diamond geometry, the ghost recipe, glyph counter-rotation
  ```
  `motion` carries FeltDie's presence springs + layout glide; face mode stays
  static. Both render the identical diamond.
- **2.2** Implement unified `Die`; keep `FeltDie` alive temporarily.
- **2.3** Migrate the *face* callers (CastCard resolved felt, ActivityLog roll
  cards) to `mode: "face"`. Per decision (1), roll cards become diamonds here.
- **2.4** Migrate the *pool* callers (DicePoolBuilder, DeclarationFelt, CastCard
  pre-roll) to `mode: "pool"`; delete `FeltDie`.
- **2.5** Reconcile geometry so pool and face diamonds are pixel-consistent on
  the same felt (the pre-roll `FeltDie` diamond vs resolved `Die` diamond
  mismatch). Visual check in **both mounts** (roll zone + Chronicle feed) at
  **every rung**. Green.

## Phase 3 — Cascade the grammar up the ladder (1–2 commits)

Mostly falls out of Phase 2 (pre-roll dice are now the unified diamond).

- **3.1** Unify the two "ghost" meanings onto the one recipe: eaten-by-
  containment (pre-roll) and declared-not-rolled (resolved) render identically.
- **3.2** Verify tag-chip provenance + Tides-beneath-felt + one-line resolution
  read correctly at draft/Tides/paradox/resolved for caster, ST, and spectator.
  Adjust spacing where the narrower feed-mount width differs from the zone.
  Green + eyes on all 3 seats.

## Phase 4 — Explosion parentage (DOMAIN, the big one, 4–6 commits)

Independent track; the UI burst (4d) depends on Phase 2 + 4a–c. Isolated so its
migration risk never blocks 1–3.

- **4a** Roll-result shape (`src/domain/dice.ts`). Thread parentage through
  `cascadeExplosions`'s recursive batches. Proposed tolerant shape (matches the
  repo's "boundary decode heals old documents" pattern):
  ```
  explosions: Array<{ value: number; parentIndex: number | null }>
  ```
  Decode accepts legacy `number[]` and upgrades each to `{value, parentIndex:
  null}` (parentless → renders without a tether). Success counting unchanged
  (counts values). `Random.withSeed` tests updated. **Sub-decision:** parallel
  `explosionParents: number[]` vs the struct array above — struct is cleaner,
  parallel array is a smaller schema diff. (Recommend struct.)
- **4b** Persisted shape. `CastDoc.castExplosions` / `paradoxExplosions`
  (`tables.ts`) → the new shape via `schema-bridge`; update the `Cast` domain
  class (`cast.ts`), `CastPatch`/`CastDraft` (`game-store.ts`), the `convexLive`
  adapter writes, the in-memory store, and the conformance tests. Boundary
  decode tolerates old flat docs.
- **4c** Flows. `rollParadox` + `releaseCast` store parented explosions
  (`vulgar-cast.ts`).
- **4d** UI burst. In the unified `Die`/felt, render each explosion diamond
  spawning from its `parentIndex` — an entrance animation (burst out of the
  trigger) and/or spatial grouping. This is the sanctioned execution of
  "explode the rows." Legacy parentless explosions fall back to the flat inline
  render. Green + eyes.

## Phase 5 — All-dice sweep + record the decision (2–3 commits)

- **5.1** Grep every remaining dice render; ensure all route through the unified
  `Die`. Retire or re-point the stale private `Die` copy in the prototype route
  (`component-polish.tsx`).
- **5.2** Decide the fate of adjacent shape families **out of scope unless we
  say otherwise**: the containment cockpit health *boxes* (squares — likely stay
  distinct from dice) and the masthead Will/Mana *pips* (◈/◇ — different family,
  share only the ghost recipe). Default: leave both; document why.
- **5.3** ADR: amend ADR-0022 (or new ADR) recording the unified dice/felt
  language and the explosion-parentage domain change; update `CONTEXT.md`
  vocabulary if a term is needed (e.g. "burst"/"trigger die").

---

## Risks & checkpoints

- **Geometry drift (Phase 2.5):** the whole point is pool + face diamonds
  matching on one felt. This is the highest-attention visual step.
- **Stored-shape migration (Phase 4b):** existing playtest casts hold flat
  `number[]` explosions. The tolerant decode must upgrade them, not crash — same
  healing pattern used for the #118 orphan and the id-strip decode.
- **All-dice ripple (Phase 2.3):** flipping roll cards to diamonds touches the
  Chronicle's non-cast rolls; confirm contested/other roll cards still read.
- **Test gate:** `bunx vitest run` green after every commit; `bun run lint`
  (no `switch`, domain purity) clean. Eyes-on in both mounts × 3 seats at the
  end of Phases 2, 3, 4.

## Suggested order

Phase 0 → 1 → 2 → 3 land the unified visual language (biggest payoff, no data
risk). Phase 4 is a self-contained domain track that can follow. Phase 5 closes
it out and records it.
