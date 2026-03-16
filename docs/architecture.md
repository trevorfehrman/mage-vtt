# Architecture

## Stack Overview

| Layer | Technology | Responsibility |
|---|---|---|
| Framework | TanStack Start | SSR, file-based routing, server functions |
| Data layer | Convex | Real-time database, serverless functions, subscriptions |
| Data fetching | TanStack Query + `@convex-dev/react-query` | Client-side caching, SSR hydration, live updates |
| Auth | Better Auth + `@convex-dev/better-auth` | Session cookies, email/password, OAuth |
| Type system | Effect v4 beta | Typed errors, services/layers, Schema, observability |
| State machines | XState v5 | Game logic, UI state (dice pool builder, canvas tools) |
| UI | shadcn/ui v4 + Tailwind CSS v4 | Component library, styling |
| AI | Vercel AI SDK + Convex | Storyteller chatbot, rules RAG, character creation |

## Data Flow

```
Browser (React + TanStack Router)
  ├── TanStack Query ←→ Convex WebSocket (live subscriptions)
  ├── XState actors (local UI state machines)
  ├── Effect services (client-side orchestration)
  └── Better Auth client (session management)
        │
        ▼
Convex Cloud
  ├── Queries (pure, deterministic, real-time)
  ├── Mutations (transactional writes)
  ├── Actions (side effects: AI calls, external APIs)
  │     └── Effect used here for composition, retries, error handling
  ├── HTTP routes (Better Auth endpoints)
  └── Vector search (rules RAG embeddings)
```

## Where Each Technology Lives

### Effect
- **Inside Convex actions**: Complex orchestration, external API calls, error recovery
- **Inside Convex mutations**: Typed error handling, validation via Schema
- **Client-side `src/domain/`**: Shared Schema types (branded IDs, domain models, tagged errors)
- **Client-side services**: (future) Effect services for non-Convex concerns

Effect does NOT replace Convex's runtime. Convex owns the server lifecycle. Effect augments each function from the inside.

### XState
- **Dice pool builder**: Accumulate stats → display pool → roll → show results → exploding rerolls
- **Canvas/whiteboard tools**: Tool selection (draw, erase, select), undo/redo
- **Game session flow**: Lobby → character selection → play → pause → end
- **Character creation wizard**: Multi-step form with validation and AI suggestions

### Convex
- **All persistent state**: Characters, sessions, maps, dice rolls, messages
- **Real-time sync**: Subscriptions for multiplayer (cursors, dice results, chat)
- **AI workflows**: `@convex-dev/agent` for long-running AI tasks
- **Vector search**: Rules RAG embeddings and queries

### TanStack Start
- **SSR**: Server-rendered pages with hydration
- **File-based routing**: `src/routes/` directory structure
- **Server functions**: Auth route handlers, API endpoints
- **React Query integration**: `useSuspenseQuery(convexQuery(...))` for SSR + live updates
