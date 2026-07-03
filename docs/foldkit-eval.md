# foldkit Evaluation — go/no-go

Research asset for the `foldkit-eval` ticket in `docs/decision-map.md`.
Question: should we adopt **foldkit** to replace parts of **shadcn** (UI) and/or
**XState** (state)? **Verdict: NO-GO** as a stack replacement. Keep React +
TanStack Start + shadcn + Tailwind; XState stays on the table. One narrow future
option (embed-island spike) is parked, not adopted.

## What foldkit actually is

A **full, all-in frontend framework** implementing **The Elm Architecture
(TEA)** on top of **Effect-TS**. One immutable Model → pure `Update` → side
effects as returned `Command` values run by the runtime. No React, no hooks, no
components with local state. Renders through its **own virtual DOM (Snabbdom)**.

Ships as one coherent system: type-safe bidirectional **routing**, **state**
(TEA), a **UI kit** (`@foldkit/ui`: dialog, menu, tabs, listbox, combobox,
button, checkbox, disclosure…), **form validation**, **devtools** (time-travel),
and testing primitives.

- **Maturity:** pre-1.0 (`v0.x`), MIT, active (~568★, 1,334 commits, 321
  releases as of Jul 2026). README: *"pre-1.0. The core API is stable, but
  breaking changes may occur in minor releases."*
- **SSR:** explicitly unsupported. Site: *"Foldkit is a client-side SPA
  framework. Static generation is possible, but you'll roll your own."*
- **Adoption:** *"isn't an incremental adoption. It's a different architecture,
  and migrating means a rewrite."* One escape hatch: **`Runtime.embed` runs a
  Foldkit widget inside any existing app (React included)** — island-level only.

## Why "partial replacement" doesn't apply

The ticket assumed we could take foldkit's UI to swap some shadcn, or its state
model to swap XState, while keeping React + TanStack Start. That framing is a
**category error**:

- foldkit's UI kit renders via **its own VDOM, not React** — you cannot mount
  `@foldkit/ui` components in a React tree.
- foldkit's state is **the whole app architecture** (the `Update` function),
  not a machine you instantiate per widget. "foldkit replaces XState" is only
  true if the entire frontend is rewritten in foldkit.

So the real choice is binary, not per-layer:

- **(A) Wholesale adoption** — replace React, TanStack Start, TanStack Router,
  shadcn, XState, `@ai-sdk/react`, and `convex/react` bindings. A ground-up
  frontend rewrite that **loses SSR** and discards the already-built React UI.
- **(B) Embed islands** — `Runtime.embed` a self-contained foldkit widget (e.g.
  one hairy interactive surface) inside the React shell. The only true "partial"
  path; island-level, not layer-level.
- **(C) Don't adopt** — keep React + shadcn + Tailwind; use XState for machines.

## Fit against our stack

| Factor | Assessment |
|---|---|
| **Effect alignment** | **Strong** — foldkit is Effect-native; we're already Effect-v4-heavy (24 domain modules). The author's ideal fit is *"teams already using Effect-TS."* That's us. This is foldkit's one big draw here. |
| **SSR** | **Conflict.** TanStack Start was chosen for SSR (CLAUDE.md). foldkit is SPA-only. (Mitigating: an authed real-time VTT barely needs SSR — the cost is real but low for *this* app.) |
| **Convex** | No foldkit integration; real-time subscriptions would be hand-wired as Commands via Convex's vanilla-JS client. Non-trivial. |
| **Auth / AI SDK** | Better Auth's TanStack/React integration and `@ai-sdk/react` hooks are React-bound; wholesale adoption re-plumbs both against Effect/foldkit primitives. |
| **shadcn parity** | `@foldkit/ui` covers common primitives but the ecosystem is *"scarce"* vs shadcn/Radix. A component-rich VTT means building a lot regardless. |
| **XState** | TEA subsumes state-machine needs **only under wholesale adoption**. On React, XState remains the answer → `effect-xstate-bridge` stands. |
| **Maturity/risk** | pre-1.0, breaking changes in minors, tiny ecosystem, Elm's "excellence ≠ adoption" cautionary tale. Compounds with our Effect **v4 beta** risk (two fast-moving pre-1.0 deps). |
| **Migration cost** | Wholesale = full frontend rewrite, throwing away shipped, working React UI (SessionLayout, CharacterSheet, DicePoolBuilder, ActivityLog, ChatInput) exactly as `app-capabilities` calls for building much *more* UI. |

## Verdict (per layer, as the ticket asked)

- **Replace shadcn (UI): NO.** Can't get foldkit's UI without its framework.
  Wholesale adoption to gain a *narrower* UI kit, while losing SSR + React
  ecosystem + shipped components, isn't worth it.
- **Replace XState (state): NO — not as a drop-in.** foldkit's TEA is an
  architecture, not a library you add. It does **not** resolve
  `effect-xstate-bridge`; XState stays for React islands.
- **Overall: NO-GO** on adopting foldkit as a stack replacement now. Keep
  React + TanStack Start + shadcn + Tailwind; proceed with XState.

## Parked (do NOT act on now)

**foldkit `Runtime.embed` island spike.** If one complex, self-contained
interactive surface (dice-pool builder, tick-initiative tracker, or the canvas
whiteboard) proves painful in React+XState, a foldkit-embedded island is a
plausible experiment — Effect-native, isolated, reversible. This is a *future
prototype option*, not a stack decision, and gates nothing. Revisit only if such
a component becomes a pain point during implementation.

## Sources

- Foldkit site — <https://foldkit.dev/> and <https://foldkit.dev/ui/overview>
- GitHub — <https://github.com/foldkit/foldkit>
- Critical assessment — <https://braindetox.kr/en/posts/foldkit_frontend_framework_2026.html>
- Elm Discourse show-and-tell — <https://discourse.elm-lang.org/t/foldkit-the-elm-architecture-in-typescript-powered-by-effect/10579>
