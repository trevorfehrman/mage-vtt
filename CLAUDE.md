Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun run <script>` instead of `npm run <script>`
- Use `bun add` instead of `npm install`
- Bun automatically loads .env, so don't use dotenv.

## Stack

- **Framework**: TanStack Start (React, file-based routing via TanStack Router)
- **Backend**: Convex (real-time database, serverless functions)
- **Auth**: Better Auth + `@convex-dev/better-auth` (no webhooks, session cookies)
- **Type system**: Effect v4 beta — typed errors, services/layers, Schema, streams
- **State machines**: XState v5 — game logic, dice pool builder, canvas tools
- **UI**: shadcn/ui v4 + Tailwind CSS v4
- **AI**: Vercel AI SDK (`@ai-sdk/anthropic`, `@ai-sdk/react`)
- **Testing**: vitest + @effect/vitest

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
- Errors use `Schema.TaggedError` — yieldable, no `Effect.fail()` wrapper needed.
- Brand nearly all primitive types (IDs, stats, etc.).

## Convex Patterns

- Convex functions (queries, mutations, actions) run in Convex's runtime — Effect augments them from the inside.
- Use the thin Effect wrapper in `convex/lib/effect.ts` for Effect-ified context.
- Actions are where Effect shines most — retries, timeouts, error recovery for external API calls.
- Schema types in `src/domain/` are shared between client and Convex.

## Testing

- Use `vitest` (not `bun test`) for Effect tests.
- Import `{ describe, expect, it }` from `@effect/vitest`.
- `it.effect()` for most tests, `it.scoped()` for resource tests.
- `TestClock` and `TestRandom` for deterministic game logic tests.

## Project Structure

```
src/
├── components/    — React components (shadcn + custom)
├── domain/        — Effect Schema types shared between client and Convex
├── integrations/  — TanStack Query setup
├── lib/           — Utilities (auth client, auth server, etc.)
├── routes/        — TanStack Router file-based routes
└── router.tsx     — Router configuration

convex/
├── lib/           — Shared utilities (Effect wrapper)
├── schema.ts      — Database schema
└── *.ts           — Convex functions (queries, mutations, actions)

docs/              — Technical documentation
```
