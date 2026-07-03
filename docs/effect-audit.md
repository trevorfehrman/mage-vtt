# Effect code audit — findings + change plan

Asset for the `effect-audit` ticket (`docs/decision-map.md`). Audits
`src/domain/` (29 modules, **180 tests**) against the full `effect-solutions`
best-practice set (v4-translated: **[`effect-solutions-checklist.md`](./effect-solutions-checklist.md)**).
Targets the bumped toolchain (`effect@4.0.0-beta.92` — see `effect-v4-bump.md`).
**This ticket produces the plan only**; changes land via `/to-prd` → `/implement`.

## Headline: the domain is already strongly idiomatic v4

Not an overhaul — polish. Already compliant, do **not** re-litigate:

- **`Effect.fn("Name.method")` everywhere** — 105/105 named spans; `Effect.gen`
  used only twice, both correctly anonymous/inline (`dice.ts`, the invite-code
  generator in `session.ts`).
- **Errors** — `Schema.TaggedErrorClass` ×20 in a clean central `errors.ts`; no
  legacy `class extends Error` / `Data.TaggedError`; errors yielded directly
  (`yield* new E(…)`), only one `Effect.fail` (a boundary helper).
- **Schema** — `Schema.Literals` (plural) ×19, `Schema.Union([...])` array-form
  ×3; **zero** v3 singular forms; refinements use v4 `.check(…)`.
- **IDs branded** with paired `typeof X.Type` exports (`ids.ts`).
- **tsconfig** already strong — `strict`, `exactOptionalPropertyTypes`,
  `noUnusedLocals/Parameters`, `noImplicitOverride`, `noFallthroughCasesInSwitch`,
  `verbatimModuleSyntax`, bundler mode; LSP plugin wired + `prepare` patch.
- **No `Context`/`Layer`** — correct: the domain is pure functions returning
  Effects; services/DI belong to the (future) Convex-Effect integration, not here.

## Findings (ordered by impact ÷ effort)

### F1 — `return yield*` on never-succeeding Effects  ·  biggest, mechanical
31 LSP `missingReturnYieldStar` sites: `character.ts` ×11, `general-merits.ts` ×5,
`merits.ts` ×5, `session.ts` ×3, `combat.ts` ×2, `resources.ts` ×2, `health.ts` ×1,
`spell-control.ts` ×1, `spellcasting.ts` ×1. Each is `yield* new SomeError(…)`
without `return`, which forces a **dead `throw new Error("unreachable")`** to
satisfy TS (5 of them: `session.ts` ×3, `combat.ts` ×2). Fix: `yield* new E(…)` →
`return yield* new E(…)`, then delete the unreachable throws. Clears 31
diagnostics + 5 throws. Purely mechanical, zero behavior change.

### F2 — Brand the stat/dots primitives  ·  widest surface
CLAUDE.md: "brand nearly all primitive types (IDs, **stats**, etc.)." IDs are
branded, but `Dots1to5`/`Dots0to5`/`Dots0to10` (`character.ts`) are refined
(`.check`) **unbranded** `Schema.Number`; likely the same for Gnosis, Mana,
Willpower, Wisdom, health levels, and tick counts across modules. Fix:
`Schema.Number.check(…).pipe(Schema.brand("Dots1to5"))` + paired type exports;
construct with `.make()`. Ripples through structs + call sites → do module-by-
module, tests green each step. Verify per stat family — leave any that are
genuinely never mixed.

### F3 — `Match.exhaustive` for tagged-union dispatch  ·  small
`chat.ts:73-74` hand-dispatches `msg.visibility._tag === "public"/"whisper"` on a
`Schema.Union` → replace with `Match.value(msg.visibility).pipe(Match.tag("public",
…), Match.tag("whisper", …), Match.exhaustive)` for compiler-enforced totality
(`Match` is currently unused anywhere in the domain). `combat.ts:129,176`
`switch(input.type)`/`switch(damageType)` on literal unions — optional Match
conversion (already guarded by `noFallthroughCasesInSwitch`).

### F4 — tsconfig `lib` → add `ES2023`  ·  trivial, do first
`paradox-effects.ts` uses `Array.findLast` (ES2023) but `lib` is `["ES2022", …]` →
a real baseline `tsc` error. Set `lib: ["ES2023", "DOM", "DOM.Iterable"]`.
Optional nits: `moduleDetection: "force"`, `$schema` URL for LSP-option autocomplete.

### F5 — `convex-effect.ts` type tightening  ·  small (redesign deferred)
The Effect↔Convex adapter concentrates the roughness: `as any` (L59), `as unknown`
(L70), and a `Record<string,unknown>`→`Value` cast (L95, a real baseline tsc
error). Tighten these types. The 4 boundary `throw`s (L95,102,103,106) are
**appropriate** — Convex functions throw — leave them; the one `Effect.fail`
(L119) is fine (returns an Effect outside a generator). **Deeper redesign of this
adapter belongs to a separate architecture decision** — the "Convex-Effect
enforcement plumbing" open sub-question in `app-capabilities.md` (see below).

### F6 — Test-suite spot-checks  ·  verify, likely already clean
Confirm: all test files import from `@effect/vitest` (not `vitest`); dice tests
use `Random.withSeed`; no `Random.nextIntBetween` off-by-one from v4's
inclusive-upper-bound change; no committed `.only`. `package.json` `test` is
`vitest run` ✓.

## Ordered change checklist (for `/to-prd` → `/implement`)

1. **F4** — tsconfig `lib: ES2023` (clears the `findLast` error). Trivial.
2. **F1** — `return yield*` sweep + delete unreachable throws (31 sites / 5
   throws). Re-run `bunx vitest run` (expect 180 green) + `tsc` (31 diagnostics
   clear). Mechanical.
3. **F3** — `Match.exhaustive` in `chat.ts` (+ optional `combat.ts` switches).
4. **F2** — brand stat/dots primitives, module-by-module, tests green each step.
   Widest surface — its own commit series.
5. **F5** — tighten `convex-effect.ts` types (`as any` / `Value` cast); leave
   adapter throws.
6. **F6** — test spot-checks.

Guardrail: **no behavioral change expected** — the 180-test suite is the safety
net (it stayed green across the beta.33→92 bump). F1/F3/F4/F5 are type/idiom-only;
F2 is the only one that touches value construction.

## Recommended follow-up (owner's call — not spawned here)

The audit repeatedly bumps into the **Convex-Effect boundary** (`convex-effect.ts`
+ the fact the domain has no server-side enforcement layer). "How domain logic
runs server-side to authoritatively enforce rules" is a genuine **architecture
decision** already flagged as an open sub-question in `app-capabilities.md` (it
gates the automated cast/attack/paradox flows). It could become a
`convex-effect-plumbing` map ticket, or fold into `/to-prd`. Left to the owner to
avoid ticket sprawl this late in the map.
