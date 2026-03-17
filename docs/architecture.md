# Architecture

## Stack Overview

| Layer | Technology | Status |
|---|---|---|
| Framework | TanStack Start (Vite + Nitro for SSR) | Deployed |
| Data layer | Convex | Live (third-cricket-842) |
| Data fetching | TanStack Query + `@convex-dev/react-query` | Wired |
| Auth | Better Auth + `@convex-dev/better-auth` | Working (Google OAuth) |
| Type system | Effect v4 beta | 155 tests, 24 domain modules |
| State machines | XState v5 | Installed, not yet implemented |
| UI | shadcn/ui v4 + Tailwind CSS v4 | Scaffold only |
| AI/RAG | OpenAI embeddings + Convex vectorSearch | 1,627 chunks, search working |
| AI chat | Vercel AI SDK | Installed, not yet implemented |

## Data Flow

```
Browser (React + TanStack Router)
  ├── TanStack Query ←→ Convex WebSocket (live subscriptions)
  ├── XState actors (planned — local UI state machines)
  ├── Effect domain logic (155 tests — dice, spellcasting, combat, etc.)
  └── Better Auth client (session cookies)
        │
        ▼
Convex Cloud
  ├── Queries (pure, deterministic, real-time)
  ├── Mutations (transactional writes)
  ├── Actions (side effects: AI calls, external APIs)
  ├── HTTP routes (Better Auth endpoints)
  └── Vector search (1,627 embedded rule chunks from both rulebooks)
```

## Where Each Technology Lives

### Effect — Domain Logic Layer
- **`src/domain/`**: 24 modules, 155 tests. All game mechanics: dice, character, spellcasting, paradox, combat, initiative, health, merits, mana, wisdom, spirits, legacies, environment.
- **NOT yet in Convex functions**: Planned Convex-Effect wrapper will bring this logic server-side.
- All domain types use Effect Schema (branded IDs, TaggedErrorClass, Schema.Class).

### XState — UI State (Planned)
- Dice pool builder, initiative tracker, canvas tools, session flow, character creation wizard.
- Will call Effect domain functions as actions per Sandro Maglione's integration pattern.

### Convex — Persistence + Real-time
- All persistent state: characters, sessions, rolls, messages, rule chunks.
- Real-time sync via subscriptions.
- RAG vector search endpoint (`convex/search.ts`).
- Auth (Better Auth component).

### TanStack Start — Web Framework
- SSR with hydration.
- File-based routing (`src/routes/`).
- Server functions for auth.
- React Query integration for data fetching.

## RAG Architecture

Three-tier vector search strategy:

1. **Fine-grained rule chunks** (34 chunks, avg 161 chars) — precise rule statements from domain logic. Rank highest for mechanical questions.
2. **Section chunks** (1,593 chunks, avg ~1700 chars) — paragraph-level text from both rulebooks. Provide context and lore.
3. **Homebrew chunks** — override base rules (e.g., tick initiative replaces standard initiative). No conflicting results.

Both Mage: The Awakening (402 pages) and WoD Core Rulebook (226 pages) are fully extracted, chunked, embedded, and searchable.
