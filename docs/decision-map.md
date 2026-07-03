# Decision Map: Reengaging with Mage VTT

Loose idea → plan. Resolving these open questions clears the path to a settled
stack (incl. the foldkit question), a shared spec of what the app must do, a UI
the owner is happy with, a chosen video-chat stack, and best-practice Effect
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
  - Effect is a confirmed foundation — not up for replacement.
  - **Settled: React + TanStack Start + shadcn + Tailwind + XState all stay.**
    `foldkit-eval` resolved NO-GO (see `docs/foldkit-eval.md`) — foldkit is an
    all-in, no-SSR rewrite, not a partial swap. Optional future `Runtime.embed`
    island spike is parked and gates nothing.
  - Already on Effect **v4 beta** — bumped 33 → **beta.92** (`effect-v4-bump`,
    RESOLVED: clean, 180/180 tests, no code changes). v4 is still beta (npm
    `latest` = v3 `3.21.4`); v3 is not in play. See `docs/effect-v4-bump.md`.
  - **UI layout = 4-section grid** (`layout-finalize`): video **left rail** ·
    **tabbed-whiteboard center** (Whiteboard · Character · Rules) · activity log
    **+ dice pool + chat right rail** · **collapsible FFX-style initiative
    tracker bottom** (combat-only). No top band; no action hotbar.
  - **Visual identity** (`visual-identity`, RESOLVED): **dark supernal void**,
    arcane **not** synthwave (no neon/gradients), **legibility absolute**. Type =
    **Cinzel** display · Manrope body · JetBrains Mono data. Accent = **Verdigris**
    `#6fae97` (metal-coded per-Path flair reserved). Distinctiveness = the ten
    **Arcana as a functional hybrid glyph set** + the **Supernal compass** hero.
    See `docs/visual-identity.md` + `docs/mage-iconography.md`.
  - **Component language** (`component-polish`, RESOLVED): **sheet-as-controller**
    direct manipulation (sheet builds the pool · pool is the readout · log is the
    record); Verdigris = active-state **and** success; Cinzel names / mono data /
    Manrope prose; glyphs only where their Arcanum appears. See
    `docs/component-polish.md`.
  - Video chat is committed; only its technology is open.
  - effect-solutions advice is to be applied *in full* when its ticket resolves.
- **One ticket per session. Every session ends with a handoff.**

## effect-v4-bump: Bump within Effect v4 beta (33 → latest)?

Blocked by: —
Status: resolved
Type: Research

### Question

We're on `effect@4.0.0-beta.33` and `@effect/vitest@4.0.0-beta.33`; the current
beta is ~beta.59. Should we bump now, and what breaks if we do? Gates the two
Effect audit tickets so they target the version we'll actually run. (Resolved
inline: we are already on v4 beta, not v3 — this is a point bump, not a
migration.) Produce a short go/no-go with the notable changes 33→latest.

### Answer

**GO — clean bump, applied to the working tree.** Write-up:
**[`docs/effect-v4-bump.md`](./effect-v4-bump.md)**.

Latest is **beta.92** (v4 is *still beta*; npm `latest` is the v3 line `3.21.4`).
Bumped `effect` + `@effect/vitest` → `4.0.0-beta.92` and `@effect/language-service`
→ `^0.86.2`, then verified empirically (33→92, 59 betas):

- **180/180 tests pass, unchanged.**
- **Typecheck 54→54, zero new type errors** — the only diff is the LSP rewording
  its `missingReturnYieldStar` advisory. Our whole Effect surface compiled
  **with no code changes**.

Bump is applied but **uncommitted** (`package.json` + `bun.lock`) so the audits
target beta.92; revert with `git checkout package.json bun.lock && bun install`.

**Map impact:** unblocks **both** `effect-audit` and `effect-xstate-bridge` (they
now target beta.92). The 31 `missingReturnYieldStar` advisories are handed to
`effect-audit`. Re-evaluate when v4.0.0 **stable** ships.

## video-chat-tech: What technology powers video chat?

Blocked by: —
Status: resolved
Type: Research

### Question

Video chat is committed (currently a `VideoPlaceholder` stub, left panel of
`SessionLayout`). Peer-to-peer WebRTC vs a SaaS (Daily, LiveKit, Twilio,
Agora)? Evaluate against Convex + TanStack Start (SSR) fit, cost at small-table
scale (~2–6 participants), and build effort. Output a recommendation as a
summary asset. UI placement is out of scope here — it folds into `ui-direction`.

### Answer

**RESOLVED — recommend Daily (SaaS SFU) for the MVP.** Full write-up:
**[`docs/video-chat-tech.md`](./video-chat-tech.md)**.

At real usage (a weekly home game of ≤6 ≈ **~7k participant-min/mo**) Daily's
**10k-participant-min free tier is production-usable → $0**, integration is an
afternoon (`@daily-co/daily-react`), and it fits the stack cleanly: video mounts
**client-only** (SSR non-issue — `getUserMedia` is browser-only), and room +
per-user token are minted in a **Convex action** (`runConvexEffect`) keyed off
the **same room id the existing `@convex-dev/presence` component already uses**.
This keeps the scarce build budget on the rules engine.

- **Runner-up: LiveKit Cloud** — better $/min at higher volume, and OSS core for a
  self-host escape hatch, but its free tier (5k min) is dev-only, so this exact
  usage tips it to ~$50/mo. Pick it if usage outgrows Daily's free tier.
- **Twilio is NOT dead** — the 2024 EOL was reversed; viable but no edge here.
  **Agora** = scale/region-oriented, no benefit at 6.
- **Convex-signaled P2P mesh** is the most on-brand (~$0, Convex-native
  signaling) but highest build effort (WebRTC lifecycle + TURN ops) — **parked**
  as a future cost-optimization, not the MVP path.

Integration sketch + revisit triggers are in the asset. Implementation deferred
to `/to-prd` → `/implement`.

## foldkit-eval: Is foldkit worth adopting over parts of shadcn / XState?

Blocked by: —
Status: resolved
Type: Research

### Question

Owner wants to understand **foldkit** before committing to more stack work. It's
eyed as a partial replacement for **shadcn** (UI) and/or **XState** (state
machines). Investigate: what foldkit actually is and its model; what it covers
vs. shadcn and vs. XState (overlap, gaps, what it does *not* replace); fit with
our stack — TanStack Start (SSR), Convex, Effect v4, Tailwind (which stays);
maturity/maintenance/bundle cost; and migration effort if we adopted it. Output
a go/no-go recommendation as a summary asset, scoped per layer (UI, state) since
we might take it for one and not the other. This gates `ui-direction` and
`effect-xstate-bridge` — resolving it may invalidate or reshape both (esp.
`effect-xstate-bridge`, which assumes XState stays). Use Context7/web for docs.

### Answer

**NO-GO** as a stack replacement. Full write-up:
**[`docs/foldkit-eval.md`](./foldkit-eval.md)**.

- **What it is:** an all-in TEA (Elm Architecture) framework on Effect-TS with
  its **own VDOM (Snabbdom), not React**; ships routing + state + UI kit +
  forms. Pre-1.0, **SPA-only (no SSR)**, *"migrating means a rewrite"* (lone
  escape hatch: `Runtime.embed` islands inside a React app).
- **Why the "partial" framing fails:** foldkit's UI can't mount in React, and
  its state model *is* the whole app architecture — so you can't take "just the
  UI" or "just the state." It's binary: wholesale rewrite (loses SSR, discards
  the shipped React UI) or nothing.
- **Verdict:** keep **React + TanStack Start + shadcn + Tailwind**; XState
  stays. Strong Effect alignment isn't enough to justify a full frontend rewrite
  + SSR loss + pre-1.0/ecosystem risk mid-project.
- **Parked (gates nothing):** a future `Runtime.embed` **island spike** for one
  hairy interactive surface (dice builder / initiative / canvas) if it ever
  proves painful in React+XState. A prototype option, not a stack decision.

**Map impact:** `ui-direction` unblocked (shadcn/Tailwind confirmed).
`effect-xstate-bridge` premise holds (XState stays) — now blocked only by
`effect-v4-bump`.

## app-capabilities: A detailed account of everything the app must do

Blocked by: —
Status: resolved
Type: Grilling

### Question

Produce a shared, detailed capability inventory — the full account of what the
Mage VTT must do — as a linked asset. Grill the owner to surface features and
flows, and read existing sources (`CONTEXT.md`, `docs/`, `src/routes/`,
`src/components/`, `src/domain/`) so the inventory reconciles what's already
built with what's intended. Organize by area (session/table flow, video, dice &
mechanics, character sheet, initiative, canvas, rules/RAG, auth, GM vs. player
roles). This gates `ui-direction` (can't design the UI without knowing what the
app must do) and is a strong candidate input for a later `/to-prd` run. Scope to
*what* the app does, not *how* it's built.

### Answer

Full inventory: **[`docs/app-capabilities.md`](./app-capabilities.md)**.
Foundational product decisions from the grilling:

- **Rules-enforcing engine** — the app drives play (action → build pool → roll →
  auto-compute paradox/mana/damage → apply to sheet). This is why the domain is
  modeled so deeply; the gap is almost entirely the interaction + server-side
  enforcement layer.
- **Three authority tiers**: Player / Storyteller (full control in their
  session) / **Dev** (Trevor — global god-mode across all sessions).
- **Map = shared whiteboard**, theater-of-the-mind, decoupled from rules (token
  positions do NOT feed range/cover; combat modifiers entered by hand).
- **AI is an open-ended assist surface** (rules Q&A, ST improv, creation
  assistant, image-gen — not a closed list).
- **MVP must-haves** beyond what's built: character-creation wizard,
  spellcasting flow, combat + tick-initiative tracker (w/ paradox + mana),
  whiteboard + tokens + NPC management, rules browse/read + LLM Q&A, roster
  view, Dev god-mode, blob storage (portraits + handouts).
- **Built today**: sessions, sheet display, dice pool + roll, chat/whispers,
  unified activity log, presence, RAG retrieval endpoint.

Surfaced open sub-questions (see asset) worth their own tickets/PRD input:
Convex-Effect server-side enforcement plumbing (gates the automated flows),
handout model, sheet-mutation/undo model, whiteboard fidelity, multi-sitting
campaigns.

## ui-direction: Overall UI direction — layout, visual identity, component feel

Blocked by: foldkit-eval, app-capabilities
Status: resolved
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

Prototype (3 switchable directions) + write-up:
**[`docs/ui-direction.md`](./ui-direction.md)**; route
`src/routes/prototype/ui-direction.tsx`. Decided on **two separate axes**:

- **Layout = the 5-section grid** (top + left + center + right + bottom), with
  corrections: **video → left rail** (not a top ribbon), **cut the stat-chip
  rail** (redundant with the sheet tab), **top band needs a real job**, **bottom
  dice bar too thin**. Center stays the tabbed workspace (Whiteboard default ·
  Character · Rules+LLM answer); log in the right rail.
- **Palette / visual identity = UNDECIDED.** None of the three occult skins nail
  it — **not** Grimoire-by-default. Needs its own exploration.
- Components need substantial refinement.

**Spawned three follow-ups:** `layout-finalize` (what earns the horizontal
bands — seed: initiative tracker top, action/rote hotbar bottom), `visual-
identity` (occult palette from scratch), `component-polish` (after palette+grid).

## layout-finalize: What earns the long horizontal bands? Settle the 5-section grid.

Blocked by: —
Status: resolved
Type: Prototype

### Question

Follows `ui-direction` (resolved) — **the 5-section grid is chosen**. Resolve the
part the owner couldn't envision: **what content genuinely exploits the wide-but-
short top and bottom bands**, then settle the final grid (panel sizes, collapse
behavior, whether bands are combat-only). Seed hypotheses (see
`docs/ui-direction.md`): **top band = tick-based initiative tracker** (FFX-style
portrait timeline, ADR-0001); **bottom band = action/rote hotbar + dice** (richer
than the thin dice strip). Constraints already set: video = left rail, log =
right rail, tabbed-whiteboard center. Iterate on
`src/routes/prototype/ui-direction.tsx`. Output: the settled grid, recorded here
+ in the asset.

### Answer

Prototype: `src/routes/prototype/layout-5section.tsx` (Exploration ⇄ Combat
toggle). **Settled: a 4-section grid, not 5.**

- **Left rail:** video. **Center:** tabbed workspace (Whiteboard default ·
  Character · Rules). **Right rail:** activity log **+ dice pool + chat** (dice
  moved here — it is *not* the bottom band).
- **Bottom band:** a **collapsible, FFX-style tick initiative tracker** —
  portraits of PCs *and* NPCs ordered by tick (ADR-0001). Shown in combat,
  collapsed out of combat. This is the owner's favorite element.
- **No top band** — owner isn't reaching for one ("call it four sections for
  now"). It can return later if a real job appears (the initiative-top idea is
  retired in favor of initiative-bottom).
- **Action/rote hotbar: rejected** — owner sees no action-combos worth
  shortcutting. **Deferred question (not a layout matter):** how casting/attacks
  are actually triggered in the UI (likely from the sheet / spell list) — folds
  into `component-polish` and the spellcasting flow at `/to-prd` time.

## visual-identity: Nail the occult palette, type, and texture

Blocked by: —
Status: resolved
Type: Prototype

### Question

Follows `ui-direction` (resolved) — **none of the three prototype skins nailed
the occult identity**; palette is explicitly undecided (not Grimoire-by-default).
Explore the visual language from scratch: color system (light/dark), display +
body type, texture/motifs (sigils, wax, parchment, astral glow — or something
else), and how it reads against shadcn/Tailwind v4 tokens in `src/styles.css`
(which currently ship a teal/tropical theme to be replaced). Prototype a few
distinct occult identities to react to. Independent of `layout-finalize` (skin
vs. grid). Output: a chosen palette/type/texture spec + tokens.

### Answer

**RESOLVED (Pass 4).** Settled spec + copy-pasteable tokens:
**[`docs/visual-identity.md`](./visual-identity.md)**. Iconography research:
**[`docs/mage-iconography.md`](./mage-iconography.md)**. Approved prototype:
`src/routes/prototype/visual-identity-2.tsx`
(`?accent=verdigris&display=cinzel`); Pass 3 kept at `visual-identity.tsx`.

Chosen: **Cinzel** display · Manrope body · **JetBrains Mono** data; accent =
**Verdigris** `#6fae97` on a **dark supernal void** (bg `#08080c`). Distinctiveness
closed the "generic dark UI" gap via Mage's **own iconography used functionally**,
not more ornament:

- **The ten Arcana as a hybrid glyph set** (geometric skeleton + calligraphic
  signature: spiral / barbed point / bindi dot) on rolls, dice pool, spells, the
  Paradox card, and the sheet. Prime = the hero glyph. App-mark = the Pentacle.
- **Hero moment = the Supernal compass** (astrolabe + Watchtower pentagram behind
  the whiteboard — the pentacle-in-circle the research names as *the* on-brand
  layout device).
- **Atmosphere = restrained**: etched borders + corner-ticks, one illuminated
  drop-cap, geometry watermark behind panels only, emanation (not neon) lighting.

**Map impact:** `component-polish` now unblocked (both blockers — `visual-identity`
+ `layout-finalize` — resolved). Applying the tokens to `src/styles.css` and real
components is implementation, deferred to `component-polish` / `/to-prd`.

## component-polish: Refine the individual components in the chosen skin

Blocked by: visual-identity, layout-finalize
Status: resolved
Type: Prototype

### Question

Follows `ui-direction`. Once the palette (`visual-identity`) and grid
(`layout-finalize`) are settled, refine the **component-level feel** —
`DicePoolBuilder`, `CharacterSheet`, `ActivityLog`, and the whiteboard tools —
for density, interaction, and occult identity. Prototype per-component (may
itself spawn per-component tickets). Output: a component visual/interaction spec
+ refined prototype pieces.

### Answer

**RESOLVED (core loop).** Component design language + per-component decisions:
**[`docs/component-polish.md`](./component-polish.md)**. Interactive exemplar:
`src/routes/prototype/component-polish.tsx` (toggle traits → build pool → roll →
log, wired for real in the locked skin).

Settled the shared language against the **core play loop** (the coupled
CharacterSheet ↔ DicePoolBuilder ↔ ActivityLog roll card): Cinzel names / mono
data / Manrope prose; Verdigris = both active-state **and** success; functional
Arcana glyphs (only where their Arcanum appears); corner-tick framing on hero
surfaces only; **sheet-as-controller** direct-manipulation model (sheet builds
the pool, pool is the readout, log is the record) — the pattern all future
roll-driven flows reuse.

**Map impact:** covered 3 of the 4 named surfaces. Spawned **`whiteboard-tools`**
for the 4th (greenfield, not polish). ActivityLog edge-states + spellcasting
triggers fold into `/to-prd`. Applying tokens/glyphs to real components +
`src/styles.css` is implementation (`/to-prd` → `/implement`).

## whiteboard-tools: Design the shared whiteboard + token tools

Blocked by: —
Status: resolved
Type: Prototype

### Question

The 4th surface named by `component-polish`, split out because the whiteboard is
**greenfield** (only a placeholder exists) — design-from-scratch, not polish.
The map is the **shared whiteboard**, theater-of-the-mind, decoupled from rules
(token positions do NOT feed range/cover — see `app-capabilities.md` + ADR
context). Design, in the locked identity (`docs/visual-identity.md` +
`component-polish.md`): the **token model** (PC/NPC tokens, labels, the
Storyteller placing/moving them), **drawing tools** (pen / shapes / ward-lines /
text), NPC/handout surfacing, and the right **fidelity** for theater-of-mind
(how much is "map" vs "sketchpad"). Resolves the open "whiteboard fidelity"
question from `app-capabilities.md`. Prototype a tool palette + a sample scene to
react to. Output: a whiteboard interaction/visual spec + prototype.

### Answer

**RESOLVED.** Interaction/visual spec: **[`docs/whiteboard-tools.md`](./whiteboard-tools.md)**.
Approved interactive prototype: `src/routes/prototype/whiteboard.tsx` (pick a
tool, draw, drag tokens, erase).

Two owner decisions settle the open "fidelity" question:
- **Authority = fully collaborative** — anyone draws/erases and moves any token
  (not ST-only). Real-time synced; presence = avatar cluster + live remote
  cursors; last-write-wins per element.
- **Fidelity = light-map** — faint dot/ley-grid + portrait/initial tokens (PC
  verdigris ring · NPC oxblood ring), freeform ink on top. Still theater-of-mind,
  **NOT a tactical grid** (no snap/measure, decoupled from rules).

Tool palette: **Select · Pen · Line · Text · PC · NPC · Erase · Clear-ink**.
Layers: dot-grid backdrop (+ future handout image) → ink → tokens → remote
cursors. Handout model, token↔character/portrait binding, and undo fold into
`/to-prd` (already tracked as `app-capabilities.md` open sub-questions).

**Map impact:** the **UI thread is now fully specced** (layout · visual-identity ·
component-polish · whiteboard-tools all resolved). Remaining frontier is the
Effect chain + video. No new tickets spawned.

## effect-audit: Apply effect-solutions best practices to the Effect code

Blocked by: effect-v4-bump
Status: resolved
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

**RESOLVED.** Audit + ordered change plan: **[`docs/effect-audit.md`](./effect-audit.md)**.
v4-translated best-practice rubric (all 10 effect-solutions topics):
**[`docs/effect-solutions-checklist.md`](./effect-solutions-checklist.md)**.

**Verdict: already strongly idiomatic v4** — polish, not overhaul. (`Effect.fn`
named ×105, `TaggedErrorClass` ×20, `Literals`/array-`Union`, branded IDs, strict
tsconfig, LSP wired.) Six findings, ordered by impact÷effort:

- **F1** `return yield*` on never-succeeding Effects — 31 LSP sites; deletes 5
  dead `throw "unreachable"` guards. Mechanical, no behavior change.
- **F2** brand the stat/dots primitives (refined but unbranded) — widest surface.
- **F3** `Match.exhaustive` for tagged-union dispatch (`chat.ts` `_tag` if-chain).
- **F4** tsconfig `lib` → `ES2023` (fixes the `findLast` error). Trivial, first.
- **F5** tighten `convex-effect.ts` types (`as any`/`Value` cast); leave adapter throws.
- **F6** test spot-checks (`@effect/vitest` imports, `Random.withSeed`, no `.only`).

Guardrail: the 180-test suite (green across the bump). Implementation → `/to-prd`.

**Map impact:** surfaces a possible **`convex-effect-plumbing`** architecture
ticket (the server-side enforcement boundary — already an open sub-question in
`app-capabilities.md`); left for the owner to spawn or fold into `/to-prd`.

## effect-xstate-bridge: How should Effect and XState interface?

Blocked by: effect-v4-bump
Status: resolved
Type: Research

_(`foldkit-eval` resolved NO-GO → XState confirmed; this ticket's premise holds.)_

### Question

Read Sandro Maglione's articles on bridging Effect and XState. Produce a summary
of the recommended pattern and how it applies here: the dice-pool XState machine
(`src/machines/dice-pool.ts`) ↔ the Effect domain (`src/domain/`), plus planned
machines (the Tick-based initiative tracker — see ADR-0001 — and canvas tools).
Output an integration recommendation as a summary asset.

### Answer

**RESOLVED.** Integration recommendation:
**[`docs/effect-xstate-bridge.md`](./effect-xstate-bridge.md)**.

Pattern (Sandro Maglione, adapted): **XState orchestrates, Effect executes, the
actor is the seam.** Machine context = plain serializable data; Effects run only
inside actors (`fromPromise` async / `fromCallback` subscriptions) or `runSync`
actions; typed errors map to events/`onError` at the seam, never leak into the
machine. Dependency is one-way: machine → `src/domain/`.

**Key adaptation — two boundary flavors** (this VTT is a server-authoritative
rules engine, unlike Sandro's client-only examples):
- **A. Authoritative Effects (dice, paradox, mana, damage) stay server-side in
  Convex** via the existing `runConvexEffect` bridge — a client can't be trusted
  to roll its own dice. The client machine's actor wraps the **Convex mutation**,
  not the domain Effect. (This is what `use-dice-pool.ts` already does
  imperatively.)
- **B. Client-local Effects (pre-validation, canvas geometry)** follow Sandro's
  pattern directly via `Effect.runPromise`. Trivial sync math stays plain
  functions in `assign` — don't wrap it in Effect.
- Services for flavor-B actors go through a module-level `ManagedRuntime` (the
  gap Sandro's intro articles skip).

**Per machine:** `dice-pool` (exists, pure UI) → refactor the imperative roll in
`use-dice-pool.ts` into an invoked flavor-A actor (deletes ROLL_COMPLETE/ERROR
events, fixes a stale-context read; roll Effect stays in Convex). `initiative`
(ADR-0001) → rolls are flavor A; tick/tie-break math is pure `src/domain/
initiative.ts`, machine orchestrates, coin-flip needs seeded `Random`. `canvas`
→ tool state is a plain UI machine; remote sync is a `fromCallback` actor over a
Convex live query; edits are flavor-A mutations.

**Map impact:** no new tickets. Concrete refactor (`use-dice-pool` → invoked
actor) and machine builds are implementation, deferred to `/to-prd` → `/implement`
(guarded by `dice-pool.test.ts` + the 180-test domain suite).

## enforcement-seam: How does the Convex↔Effect server-side enforcement boundary work?

Blocked by: —
Status: resolved
Type: Prototype

### Question

The gating architecture piece flagged by `app-capabilities` + `effect-audit`: the
app is a rules-enforcing engine (server builds pools, rolls, computes
paradox/mana/damage, mutates sheets), but only `convex/rolls.ts` does this today
and it inlines a repeated auth→authorize→run→persist→log "dance." Design the deep
module that captures it — the seam between Convex's runtime and the pure Effect
domain. Explore interface shapes (`design-it-twice`), settle depth/seam placement,
and resolve the build-vs-adopt question against **confect** (the Effect+Convex
library). Output: an interface design + ADR.

### Answer

**RESOLVED.** Design: **[`docs/enforcement-seam.md`](./enforcement-seam.md)**;
decision: **ADR-0004**. Ran `design-it-twice` (four parallel interface designs);
two independently converged on **ctx-as-Effect-service** (which is also confect's
core idea — a strong signal).

Chosen shape: leaf domain rules stay `R = never`; a thin **flow layer**
(`src/domain/flows/*`) carries `R = GameStore | CurrentActor`; **two ports**
(`GameStore` data + domain-specific write helpers; `CurrentActor`/`Authz` with
player/storyteller/**dev** tiers); ports speak **Effect-Schema domain mirrors**
(decoded at the adapter, not Convex `Doc<T>` — owner's call, matches the
brand/Schema-everything ethos); `Clock` for time; **every enforced mutation emits
an activity-log line** (ADR-0003); **two adapters** (`ConvexLive` + `InMemory`) +
a conformance test make the seam real (flows testable with zero Convex);
`Effect.provide` once at the `enforcedMutation` boundary; `runConvexEffect` kept.
Atomicity inherited from Convex's transaction. Benchmark: `castSpell`.

**confect: NOT adopted** — it's an **Effect v3** library; we're **v4** by decision.
Re-evaluate only if it ships a v4 release. Its one unique value (Schema↔validator
unification) is built ourselves — see `schema-bridge`.

**Map impact:** spawned `schema-bridge`. This seam **gates the automated flows**
(spellcasting, combat) — build first. Implementation → `/grill-with-docs` (this
slice) → `/to-prd` → `/implement`.

## schema-bridge: Derive Convex validators from Effect Schema (DIY schema unification)

Blocked by: enforcement-seam
Status: resolved
Type: Research

### Question

confect's one unique value — define schema once in Effect Schema and derive the
Convex `v.*` side (validators for `defineTable` + function args, decode/encode at
the boundary) — but confect is Effect v3 and we're v4. Can we build it ourselves
on v4, and is it worth it? Output: a feasibility + design decision.

### Answer

**RESOLVED — build our own; feasible and bounded.** Decision: **ADR-0005**;
design notes folded into **[`docs/enforcement-seam.md`](./enforcement-seam.md)**
(Scope & non-goals).

It reduces to one function, `schemaToConvexValidator(schema) → Validator`;
everything else (derive `defineTable`, derive `args`, decode/encode at the
`GameStore` adapter) falls out. Confirmed against Effect v4 docs: `SchemaAST` is
walkable and annotations are readable, **and Effect ships a maintained
`Schema → JSON-Schema` compiler** — so the smart build is *Schema → JSON-Schema
(Effect's compiler) → Convex validator* (small, stable last hop; Effect absorbs
the beta-AST churn). Convex-native types (`v.id`, `v.int64`, `v.bytes`) recovered
via a `ConvexId(...)` **annotation convention**. Safety net: a property/conformance
test (Arbitrary from each Schema → passes the derived validator + round-trips).

~One module we own on v4, vs. a v3 framework coupling our deepest layer. Sequenced
**after** `enforcement-seam` — the seam ships with hand-maintained mirrors; the
bridge retrofits them and deletes the mirror-tax. Implementation → `/to-prd` →
`/implement`.
