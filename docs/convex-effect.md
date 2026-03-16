# Convex + Effect Integration

## The Boundary

Convex owns the server runtime. Effect augments Convex functions from the inside — it does not replace Convex's execution model.

```
Convex Function (query/mutation/action)
  └── Effect.gen(function* () {
        // Effect composition, typed errors, retries, etc.
        // Convex ctx methods wrapped to return Effect
      })
```

## The Wrapper Pattern

`convex/lib/effect.ts` provides a thin wrapper that converts Convex's Promise-returning context methods to Effect-returning equivalents.

Instead of:
```ts
const user = await ctx.db.get(userId)  // returns Doc | null, throws on error
```

With the wrapper:
```ts
const user = yield* db.get(userId)  // returns Effect<Doc, NotFoundError>
```

## Where to Use Effect in Convex

### Queries (read-only)
Use Effect for:
- Schema validation of return types
- Error narrowing (convert null results to typed errors)
- Complex data transformations

Don't use Effect for:
- Simple queries that just fetch and return — keep them plain

### Mutations (transactional writes)
Use Effect for:
- Multi-step mutations with typed error paths
- Validation before writes (Schema.decode)
- Business rule enforcement

### Actions (side effects — this is where Effect shines)
Use Effect for everything:
- External API calls with retries and timeouts
- AI SDK calls with error recovery
- Complex orchestration (call API → validate → write to DB)
- Rate limiting, circuit breaking

## Running Effects in Convex

Effects must be converted back to Promises at the Convex function boundary:

```ts
import { Effect } from "effect"
import { mutation } from "./_generated/server"

export const createCharacter = mutation({
  args: { ... },
  handler: async (ctx, args) => {
    return Effect.runPromise(
      Effect.gen(function* () {
        // Effect code here
      })
    )
  }
})
```

## Shared Schema Types

Domain types in `src/domain/` use Effect Schema and are imported by both client code and Convex functions. This gives you a single source of truth for validation, serialization, and TypeScript types.
