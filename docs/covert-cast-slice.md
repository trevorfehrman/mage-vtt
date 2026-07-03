# Covert `castSpell` — slice design

The second tracer-bullet thread (ADR-0007): a player casts a **Covert improvised
spell** through the enforcement seam, introducing the `CharacterSheet` mirror and
the `spendMana` leaf. Produced by a `/grill-with-docs` session; feeds `/to-prd`.

## Decisions

### The mirror (two artifacts, not one)

- **`CharacterDoc`** (`src/domain/tables.ts`) — the raw persisted shape of the
  `characters` table; derives the Convex validator via `schemaToConvexValidator`
  (ADR-0005), retiring the **last hand-written table** in `convex/schema.ts`.
  Necessarily full-width. Pure infra: written once, then never thought about.
  The existing `*Row` exports rename to `*Doc` (Convex's own vocabulary;
  "Row" collided with rows *on* the sheet).
- **`CharacterSheet`** (`src/domain/character.ts`) — the game artifact flows and
  UI speak (see CONTEXT.md "Character Sheet"). `GameStore.getSheet` returns it
  **whole** (no per-flow projections; Convex reads whole docs anyway; flows
  destructure narrowly). Checks encode **representability, not game legality**
  (ADR-0011). It **absorbs** the old strict `Character` class — field structs and
  derived getters (`maxMana`, `willpower`, `defense`, …) carry over; creation
  strictness lives in `validateCreationRules` (a layer-3 move rule). Carries its
  linkage (`sessionId`, `userId`, `sessionMemberId`, branded) — whose character
  this is *is* domain data.
- The adapter decodes Doc → Sheet; mental model: **the game speaks Sheet, the
  database speaks Doc, the adapter translates once.**

### Authority

`requireOwnedCharacter(member, characterId)` ladder (ownership = the
(user, session) pair, per CONTEXT.md):

1. Owner → pass, unmarked.
2. Storyteller of that session → pass + `storyteller-action` Override (ADR-0006).
3. Dev → pass + `godmode-action` Override.
4. Otherwise → `NotYourCharacter`.

No special invocation UX: the server detects actor ≠ owner and stamps. Pulls part
of ADR-0007's step 3 (Override exercised) forward into this thread.

### The cast

- **Improvised only; Covert only** (ADR-0008). Args:
  `{ sessionId, characterId, arcanum, level, potency?, targets?, highSpeech?,
  extraManaCost?, visibility? }`.
- **`level` is the declared effect level (1–5)**; move rule
  `sheet.arcana[arcanum] >= level` else `ArcanumTooWeak` (the Practices ladder —
  see CONTEXT.md "Practice"). Which level an improvised effect *is* remains ST
  adjudication; enforcement of the declaration is mechanical.
- **Sympathetic casting is unrepresentable** in the args (it forces Vulgar), and
  the flow asserts `castingPool.isVulgar === false` as a defect-level invariant —
  two layers against silently casting Vulgar with no Paradox.
- **Mana**: cost = `improvisedManaCost(sheet.path, arcanum)` (non-ruling = 1,
  ruling = 0; computed server-side, never declared) + pool `manaCost` (0 in this
  slice) + `extraManaCost` (declared, ST-adjudicated — the "Cost: 1 Mana" spell
  analog). New pure leaf `spendMana(current, cost) → remaining | InsufficientMana`
  in `mana-economy.ts` (the ADR-0008 gap). Non-ruling casts exercise the sheet
  write in ordinary play.
- **Writes**: `patchSheet(id, { manaCurrent })` + one ordinary Roll entry
  (ADR-0009 summary narrates the cast, mana included; ADR-0012 — no structured
  spell columns). `SheetPatch` admits only `{ manaCurrent?, willpowerCurrent?,
  healthTrack? }` (ADR-0011 — the narrow port is the compensating control).
  Atomicity inherited from the Convex transaction (ADR-0004).
- Errors follow ADR-0010: `NotYourCharacter`, `ArcanumTooWeak`,
  `InsufficientMana`, `DocumentNotFound` as distinct client-dispatchable tags.

### UI — minimal cast form (scaffolding, by design)

A deliberately minimal "Improvised Cast" form on the character sheet: Arcanum
picker (showing dots), level, optional factors, Cast → result in the Activity
Log (already renders Rolls). **This is seam-proving scaffolding, not the casting
UX.** The real casting experience (spell browser, rote cards, XState pool
builder) is its own MVP line item (§6, `app-capabilities.md`) and design pass;
replacing the form touches zero server code. Owner has explicitly flagged it as
disposable — treat any urge to polish it as scope creep.

## Deferred (named follow-ups, in rough order)

1. **Willpower spend (+3 dice)** — same declared-input pattern; writes
   `willpowerCurrent` (already in `SheetPatch`); applies to plain rolls too, so
   it lands as a small pass over both flows.
2. **ST sheet-less cast** (NPC spells, Hidden roll by default) — sibling of
   `rolls.create`, shares the pure leaves, touches no mirror surface. Precedes
   NPC stat blocks (§16), which it doesn't depend on.
3. **Rote casting** — needs a rote reference + the spells/rotes data model
   (spell browser adjacency). NB: casting a Rote does **not** grant the rote
   quality (see CONTEXT.md "Rote" — namespace trap).
4. **Vulgar casting + Paradox** — the interactive subsystem, own design pass
   (ADR-0008); Scene-scoped Paradox accumulation needs a Scene state model,
   not feed queries (ADR-0012).
