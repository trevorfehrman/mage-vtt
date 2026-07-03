# Server-side rules enforcement via ctx-as-Effect-service ports

Enforced game logic (build pool → roll → compute paradox/mana/damage → mutate
sheet, plus authority checks) runs server-side in Convex through a **rules-
enforcement seam**: a thin *flow layer* that stitches the pure Effect domain to
Convex via two Effect services (ports), not by inlining Convex `ctx` calls in each
mutation. Leaf domain rules in `src/domain/` stay pure (`Effect<A, E, never>`);
only the flow layer (`src/domain/flows/*`) carries a requirement
(`R = GameStore | CurrentActor`). Two adapters satisfy the ports — `ConvexLive`
(backed by `ctx.db` + `requireUser`) and `InMemory` (tests) — and `Effect.provide`
happens once, at the `enforcedMutation` boundary. The existing `runConvexEffect`
bridge is kept. Ports speak Effect-Schema **domain mirrors** (`CharacterSheet`,
`Session`), decoded at the adapter — not Convex's generated `Doc<T>`. Full design:
`docs/enforcement-seam.md`.

## Why

Today only `convex/rolls.ts` enforces rules, and it inlines a dance
(authenticate → authorize → run domain Effect → hand-map into `ctx.db.insert` →
log → map errors) that every future flow would copy-paste. A `design-it-twice`
exploration (four parallel interface designs) had two independently converge on
ctx-as-Effect-service — which is also the core idea of **confect**, the Effect+
Convex library. That convergence is the signal: it's the idiomatic shape. Making
Convex a *service* (rather than reads-before / writes-after hooks) lets flows
compose as ordinary `yield*` pipelines and — because a second real adapter exists
(`InMemory`) — makes enforced flows unit-testable with **zero Convex** and
deterministic dice (`Random.withSeed`). Domain mirrors (vs. `Doc<T>`) keep the
domain Convex-free, consistent with the project's brand/Schema-everything ethos.

**confect was rejected: it is an Effect v3 library and we are on v4 by decision**
(`effect-v4-bump`). Running v3 and v4 together is unworkable — our v4 domain
Effects can't execute inside a v3 handler, and `Context.Tag`/`Layer` resolve by
reference per Effect instance, so services fail silently across the two copies.
Re-evaluate only if confect ships a v4 release.

## Consequences

- **Build order:** this seam gates the automated flows (spellcasting, combat) —
  build it before them.
- **New surface:** `convex/lib/enforce.ts` (`enforcedMutation`), `src/domain/ports/*`
  (`GameStore`, `CurrentActor`), `src/domain/authz.ts`, `src/domain/flows/*`,
  Schema mirrors in `src/domain/`, and the `ConvexLive`/`InMemory` adapters, kept
  honest by a conformance test.
- **Discipline to hold:** leaf rules must stay `R = never`; only flows carry the
  port requirement. If that leaks into the calculators, the requirement
  metastasizes and the 155+ pure-domain tests lose their purity.
- **Invariant:** every enforced mutation emits an activity-log line (ADR-0003).
- **Atomicity** is inherited from Convex's transaction, not re-implemented — no
  write-buffer/commit-log (it would desync from Convex's txn).
- **Scope:** enforced *writes* only. Read/query handlers stay plain Convex
  `query`s; `GameStore` is doc-level, grown by the rule of two, never a mirror of
  `ctx.db`.
- The hand-maintained mirror duplication this introduces is retired later by the
  `schema-bridge` slice (ADR-0005).
