# Decision Map: Reengaging with Mage VTT

Loose idea → plan. Resolving these open questions clears the path to a UI the
owner is happy with, a chosen video-chat stack, and best-practice Effect/XState
code. When no open tickets remain, run `/to-prd` to schedule implementation.

The **whole map** is loaded into every session — keep it compact. Link assets;
don't inline them.

## Notes

- **Domain**: Mage: The Awakening (1st Edition) VTT. See `CONTEXT.md`.
- **Consult every session**: `CONTEXT.md`, `docs/adr/`, `docs/agents/domain.md`.
- **Skills**: `/prototype` for UI tickets; `/domain-modeling` when new terms
  surface; follow CLAUDE.md's "Effect v4 API Differences" for any Effect code;
  use Context7 for `@effect/*` docs.
- **Standing decisions (settled, not open):**
  - Effect and XState are confirmed foundations — not up for replacement.
  - shadcn/ui + Tailwind stay — the UI problems are aesthetic + layout +
    component-feel, not the toolkit.
  - Already on Effect **v4 beta** (`effect@4.0.0-beta.33`); v3 is not in play.
  - Video chat is committed; only its technology is open.
  - effect-solutions advice is to be applied *in full* when its ticket resolves.
- **One ticket per session. Every session ends with a handoff.**

## effect-v4-bump: Bump within Effect v4 beta (33 → latest)?

Blocked by: —
Status: open
Type: Research

### Question

We're on `effect@4.0.0-beta.33` and `@effect/vitest@4.0.0-beta.33`; the current
beta is ~beta.59. Should we bump now, and what breaks if we do? Gates the two
Effect audit tickets so they target the version we'll actually run. (Resolved
inline: we are already on v4 beta, not v3 — this is a point bump, not a
migration.) Produce a short go/no-go with the notable changes 33→latest.

### Answer

_(unresolved)_

## video-chat-tech: What technology powers video chat?

Blocked by: —
Status: open
Type: Research

### Question

Video chat is committed (currently a `VideoPlaceholder` stub, left panel of
`SessionLayout`). Peer-to-peer WebRTC vs a SaaS (Daily, LiveKit, Twilio,
Agora)? Evaluate against Convex + TanStack Start (SSR) fit, cost at small-table
scale (~2–6 participants), and build effort. Output a recommendation as a
summary asset. UI placement is out of scope here — it folds into `ui-direction`.

### Answer

_(unresolved)_

## ui-direction: Overall UI direction — layout, visual identity, component feel

Blocked by: —
Status: open
Type: Prototype

### Question

Owner is dissatisfied on three axes at once: **visual/aesthetic** (generic
"default shadcn" feel; wants a Mage/occult identity), **layout & information
architecture** (the three-panel arrangement — what's primary vs buried, panel
sizes, where video tiles live), and **component-level feel** (`DicePoolBuilder`,
`CharacterSheet`, `ActivityLog` density/interaction). shadcn/Tailwind stay.
Build a throwaway prototype (via `/prototype`) to react to and establish a
direction. Expect this to spawn narrower follow-up tickets (per-component
polish, layout finalize) once a direction is chosen.

### Answer

_(unresolved)_

## effect-audit: Apply effect-solutions best practices to the Effect code

Blocked by: effect-v4-bump
Status: open
Type: Research

### Question

Read the effect-solutions CLI *in its entirety* (`bunx effect-solutions list`,
then `show` every doc) and audit `src/domain/` (24 modules, ~155 tests) against
it. Produce a summary asset: every applicable best practice + a concrete,
ordered checklist of changes to make. Owner wants all applicable advice applied
— implementation happens later (via `/to-prd` → `/implement`); this ticket only
produces the findings + plan. Translate any v3-targeted advice to v4 per
CLAUDE.md.

### Answer

_(unresolved)_

## effect-xstate-bridge: How should Effect and XState interface?

Blocked by: effect-v4-bump
Status: open
Type: Research

### Question

Read Sandro Maglione's articles on bridging Effect and XState. Produce a summary
of the recommended pattern and how it applies here: the dice-pool XState machine
(`src/machines/dice-pool.ts`) ↔ the Effect domain (`src/domain/`), plus planned
machines (the Tick-based initiative tracker — see ADR-0001 — and canvas tools).
Output an integration recommendation as a summary asset.

### Answer

_(unresolved)_
