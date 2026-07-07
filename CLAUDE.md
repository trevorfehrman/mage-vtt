Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun run <script>` instead of `npm run <script>`
- Use `bun add` instead of `npm install`
- Bun automatically loads .env, so don't use dotenv.

## Stack

- **Framework**: TanStack Start (built on Vite + Nitro for SSR deployment)
- **Backend**: Convex (real-time database, serverless functions)
- **Auth**: Better Auth + `@convex-dev/better-auth` (no webhooks, session cookies)
- **Type system**: Effect v4 beta — typed errors, services/layers, Schema, streams
- **State machines**: XState v5 — installed but not yet implemented (planned for dice pool builder, initiative tracker, canvas tools)
- **UI**: shadcn/ui v4 + Tailwind CSS v4
- **AI**: Vercel AI SDK (`@ai-sdk/anthropic`, `@ai-sdk/react`)
- **Testing**: `bunx vitest run` (NOT `bun test`) + @effect/vitest v4 beta

## Effect Coding Rules

This project uses Effect v4 beta. Core concepts are the same as v3 but some APIs are renamed.

- Use `Effect.fn("Name.method")` for all named effectful functions.
- Use `Effect.gen` only for anonymous/inline effects.
- Use `.pipe()` for cross-cutting concerns (timeout, retry, logging, spans).
- Define services as `Context.Tag` classes with readonly method interfaces.
- Implement services as `Layer.effect` (async) or `Layer.sync` (sync).
- Use service-driven development: contracts first, orchestration against interfaces, implement layers separately.
- `Effect.provide` goes once at the entry point.
- Store parameterized layers in module-level constants (memoization is by reference).
- Before writing Effect code involving any `@effect/*` package, use Context7 to fetch current documentation.
- Use `bunx effect-solutions show <topic>` for idiomatic patterns (note: targets v3, translate mentally for v4).
- Domain types go in `src/domain/` using Effect Schema.
- Errors use `Schema.TaggedErrorClass` (v4 name, was `Schema.TaggedError` in v3) — yieldable, no `Effect.fail()` wrapper needed.
- Brand nearly all primitive types (IDs, stats, etc.).
- Data shapes are Schema, always — a manual `interface` is legal only for capability contracts: `Context.Tag` service methods and React props carrying functions/JSX (ADR-0017).
- Never write `switch` — dispatch through `Match` (`Match.exhaustive` for closed sets, `Match.orElse` for open spaces). Zero exceptions (ADR-0018).
- Pure functions use the pure half of the toolbox — `Match`, `Option`, `Data`, `Array`/`Record`/`HashMap` modules — not `for`/`while`/`new Map`/`new Set`. "Plain function" (ADR-0014) means no `Effect` type, not plain JavaScript (ADR-0019).

### Effect v4 API Differences from v3

- `Schema.TaggedError` → `Schema.TaggedErrorClass`
- `Schema.Union(A, B, C)` → `Schema.Union([A, B, C])` (takes array)
- `Schema.Literal("a", "b")` → `Schema.Literals(["a", "b"])` (takes array, plural)
- `.pipe(Schema.isInt())` → `.check(Schema.isInt())` for applying filters
- `Schema.decode` → `Schema.decodeUnknownEffect` for parsing unknown input
- `Random.nextIntBetween(1, 10)` — inclusive on both bounds (was exclusive upper in v3)

## Convex Patterns

- Convex functions (queries, mutations, actions) run in Convex's runtime.
- The Effect↔Convex seam is BUILT and is the enforced convention (ADR-0004/0005/0007): every game-rules write goes through `convex/lib/enforce.ts` (`enforcedMutation` → `convexLive` layer → domain flow in `src/domain/flows/`). Reads stay plain by decision (ADR-0004). Game-table validators are derived from domain Schemas via `src/domain/schema-bridge.ts` — never hand-write a validator for a shape that has a domain Schema.
- `convex/search.ts` has the RAG vector search endpoint (working).
- Schema types in `src/domain/` are shared between client and Convex.

## Testing

- Use `bunx vitest run` (NOT `bun test`) for all tests.
- Import `{ describe, expect, it }` from `@effect/vitest`.
- `it.effect()` for effectful code; plain `it()` for pure rules leaves (ADR-0014); `it.scoped()` for resource tests.
- `Random.withSeed("seed")` for deterministic dice tests.
- TDD skill installed (Matt Pocock's red-green-refactor workflow).
- 518 tests across the domain, flows, machines, and seam, all green.

## Project Structure

```
src/
├── components/    — React components (shadcn + custom)
├── domain/        — Effect domain logic (rules leaves, flows, ports, seam)
│   ├── __tests__/ — All test files
│   ├── dice.ts, character.ts, health.ts, ...
│   └── index.ts   — Re-exports
├── lib/           — Auth client, auth server utilities
├── routes/        — TanStack Router file-based routes
└── router.tsx     — Router configuration

convex/
├── schema.ts      — Database schema (ruleChunks, spells, rotes, paths, orders)
├── ingest.ts      — Data upload mutations
├── search.ts      — RAG vector search endpoint
├── auth.ts        — Better Auth setup
├── http.ts        — Auth HTTP routes
└── convex.config.ts — Better Auth component registration

scripts/           — Bun scripts for data pipeline
├── extract-pages.ts, parse-spells.ts, apply-corrections.ts
├── extract-rules.ts, chunk-text.ts, chunk-wod.ts
├── generate-rule-chunks.ts, embed-and-upload.ts, embed-all.ts
├── ingest-character.ts — Dev-side character upsert into a Session (issue #16)
├── add-phantom-member.ts — Dev-side fake session member ("dev:" userId) for solo playtesting

data/              — Extracted game data (committed)
├── pages/         — 402 Mage pages (JSON)
├── wod-pages/     — 226 WoD Core pages (JSON)
├── spells.json, path-data.json, character-rules.json
├── chunks.json, wod-chunks.json, rule-chunks.json
├── characters/    — Ingestable character files (example-character.json is the template)

docs/              — Technical documentation
```

## Agent skills

### Issue tracker

Issues and PRDs are tracked as GitHub issues in `trevorfehrman/mage-vtt` via the `gh` CLI. External PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles using their default names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root (created lazily by `/domain-modeling`). See `docs/agents/domain.md`.
