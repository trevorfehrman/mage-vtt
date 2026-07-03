# effect-solutions best-practice checklist (v4-translated)

Reference companion to `docs/effect-audit.md`. The full, actionable rule set
distilled from the `effect-solutions` CLI (all 10 topics), translated from the
docs' v3 examples to this project's **Effect v4 beta** per CLAUDE.md. Use as the
grading rubric for `src/domain/`. `cli` and `config` are low-relevance for a pure
domain library (one-liners at the end).

## Basics — Effect.fn, Effect.gen, pipe

- **Use `Effect.fn("Name.method")` for every named effectful function** — named
  spans for tracing/telemetry. Detect: named `const x = Effect.fn(` missing a
  string label; named effectful fns written as bare `Effect.gen`.
- **Use `Effect.gen` only for anonymous/inline effects** — top-level programs,
  layer bodies, inline blocks.
- **Wrap even nullary methods in `Effect.fn`** so tracing still applies.
- **`return yield*` an Effect that never succeeds** — gives the generator a
  definitive exit point for type-narrowing/tooling; removes the need for dead
  `throw "unreachable"` guards. (This is the LSP `missingReturnYieldStar` rule.)
- **Use `yield*` for sequencing inside generators** — no nested `.then`/`.flatMap`.
- **Use `.pipe()` for cross-cutting concerns only** — timeout, retry, tap/logging,
  spans, annotations — not business logic.
- **Combine per-attempt timeout + retry + overall timeout for external calls**
  (`Schedule.exponential`/`recurs`/`spaced`). Low relevance for pure domain.

## Services & Layers

- **Define services as tag classes** — CLAUDE.md standard: `Context.Tag` classes
  with a unique `@path/Name` identifier (docs use `Context.Service`; keep the
  project convention consistent).
- **Keep service methods dependency-free (`R = never`)** — deps via Layer
  composition, not method signatures.
- **All service interface properties `readonly`.**
- **Implement services as `Layer.effect` (dependent/async) or `Layer.sync` (pure)**
  — body: (1) `yield*` deps, (2) define methods with `Effect.fn`, (3) `return` the
  object.
- **Name layers camelCase + `Layer` suffix**, expose as `static readonly layer`.
- **Contracts before implementations** — sketch leaf tags, orchestrate against
  interfaces, implement layers separately.
- **`Effect.provide` exactly once at the entry point** — never scatter `provide`
  through business logic.
- **Store parameterized layer constructors in a module-level constant** —
  memoization is by reference (calling `X.layer({...})` twice makes two instances).

## Data Modeling — Schema, brands, variants

- **Records/products → `Schema.Class`** (`class X extends Schema.Class<X>("X")({…})`),
  behavior as getters/methods on the class body.
- **Simple string/number variants → `Schema.Literals([...])`** (v4 plural+array).
- **Tagged variants → `Schema.TaggedClass` + `Schema.Union([...])`** (array form).
- **Pattern-match tagged unions with `Match.value(x).pipe(Match.tag(…), Match.exhaustive)`**
  — end with `Match.exhaustive` for compiler-enforced totality. Flag hand-rolled
  `switch (x._tag)` / `if (x._tag === …)` chains.
- **Brand nearly all semantically-meaningful primitives — not just IDs** (stats,
  counts, timestamps, slugs…). Pattern: `Schema.Number.check(…).pipe(Schema.brand("X"))`.
- **Construct branded values with `.make()`** (no raw literals / `as X` casts).
- **Export both the schema and its `typeof X.Type`.**
- **Apply refinements with `.check(…)` (v4), not `.pipe(Schema.isInt())`.**
- **Decode untrusted input with `Schema.decodeUnknownEffect` (v4)** (v3 `Schema.decode`).
- **Parse JSON with `Schema.fromJsonString` + decode**, not raw `JSON.parse` around
  domain types.
- **Prefer precise primitives** — `Schema.NonEmptyString`, `Schema.NumberFromString`,
  `Schema.Array`, `Schema.Date`.

## Error Handling

- **Domain errors → `Schema.TaggedErrorClass` (v4)** (v3 `Schema.TaggedError`); not
  `class extends Error` / `Data.TaggedError`.
- **Yield tagged errors directly — no `Effect.fail` wrapper** (`yield* new E({…})`).
- **Combine related errors into a `Schema.Union([...])` alias.**
- **Typed errors for recoverable failures** (validation, not-found, permission);
  **defects (`Effect.orDie`) for unrecoverable invariant violations.**
- **Almost never catch defects** (only at boundaries via `Effect.exit`/`catchAllDefect`).
- **Recover with the narrowest combinator** — `catchTag`/`catchTags` over blanket
  `catch`, to preserve remaining errors in the type.
- **Wrap unknown/external errors in a `Schema.Defect` field** at I/O boundaries so
  errors stay serializable.

## Testing (@effect/vitest)

- **Import `describe/expect/it` from `@effect/vitest`**, not plain `vitest`.
- **Run with `vitest run` / `bunx vitest run`, never `bun test`.**
- **`it.effect(...)` for Effect tests**; v4 scoping is automatic (no explicit
  `it.scoped` needed — CLAUDE.md still references it; verify per test).
- **`it.live(...)` only when you need the real clock**; otherwise `TestClock.adjust`.
- **Deterministic randomness** — `Random.withSeed("seed")`; remember
  `Random.nextIntBetween(1,N)` is **inclusive both bounds** in v4 (audit off-by-one).
- **Provide layers inline per test** (`.pipe(Effect.provide(testLayer))`); `it.layer`
  only to share expensive resources.
- **Arrange/act/assert**; no committed `.only`.

## TypeScript config & setup

- **Full strictness** — `strict`, `exactOptionalPropertyTypes`, `noUnusedLocals`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`.
- **Modern module target** — `target: ES2022`, `moduleDetection: "force"`.
- **Bundler mode (Vite)** — `moduleResolution: "bundler"`, `verbatimModuleSyntax`,
  `allowImportingTsExtensions`, `noEmit`. (`module: "preserve"` is the doc rec;
  `ESNext` is acceptable.)
- **`lib` must cover used APIs** — e.g. `Array.findLast` needs `ES2023`.
- **Wire `@effect/language-service`** in `plugins` + persist `effect-language-service
  patch` via a `prepare` script; optional `$schema` URL for plugin-option autocomplete.

## config / cli (one-liners — pure domain should contain neither)

- **config:** define a config *service* reading `Config.*` via `Layer.effect`, brand
  + validate with `Config.schema`, wrap secrets in `Config.redacted`. Flag any
  `Config.*`/`ConfigProvider.*` inside `src/domain/`.
- **cli:** `Command.make` + `Argument`/`Flag` + `Command.run` on a platform layer.
  Flag any `effect/unstable/cli` import inside `src/domain/`.

### Items to verify against exact v4 API
`Context.Tag` (CLAUDE.md) vs `Context.Service` (docs); `it.scoped` vs automatic
scoping; `Effect.Service`; `Logger.layer` signature.
