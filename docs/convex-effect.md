# Convex + Effect Integration

## Current Status

**Effect is used extensively in `src/domain/`** — 155 tests across 24 domain modules covering both rulebooks completely. All game logic (dice, spellcasting, combat, character creation, etc.) is pure Effect code.

**Effect is NOT yet used inside Convex functions.** The Convex functions (`convex/*.ts`) use plain TypeScript. The Convex-Effect wrapper described below is planned but not built.

## The Boundary

Convex owns the server runtime. Effect augments Convex functions from the inside — it does not replace Convex's execution model.

## Planned Integration Pattern

When the wrapper is built, Convex functions will use Effect like this:

```ts
// convex/mutations/createCharacter.ts
export const createCharacter = mutation({
  args: { ... },
  handler: async (ctx, args) => {
    return Effect.runPromise(
      Effect.gen(function* () {
        const character = yield* createCharacter(args)
        yield* validateCreationRules(character)
        // persist to Convex
      })
    )
  }
})
```

Effects must be converted back to Promises at the Convex function boundary via `Effect.runPromise`.

## What Works Today

- **Domain logic**: All game mechanics in `src/domain/` use Effect (Schema validation, typed errors, Effect.fn tracing)
- **RAG search**: `convex/search.ts` uses OpenAI embeddings + Convex vectorSearch (no Effect needed — it's a simple action)
- **Data pipeline**: Bun scripts extract, parse, chunk, embed game data (no Effect needed)

## What's Next

1. Build thin Convex-Effect wrapper (`convex/lib/effect.ts`)
2. Use domain logic from Convex mutations (validate character creation, dice rolls, etc.)
3. Typed error recovery in Convex actions (AI calls, external APIs)
