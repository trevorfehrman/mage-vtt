# Mage VTT — Capability Inventory

The full account of **what the app must do** — the target feature set for a
virtual tabletop that runs *Mage: The Awakening (1e)* on the house-ruled,
tick-based Storytelling System. Scoped to *what*, not *how*. Reconciles the
built surface against intent, and records the foundational product decisions
made during the `app-capabilities` grilling.

Asset for the `app-capabilities` ticket in `docs/decision-map.md`. Feeds
`ui-direction` and a later `/to-prd`.

**Status legend:** ✅ built · 🟡 partial (domain modeled, no UI / incomplete) · ⛔ not built

## Foundational decisions (from grilling)

1. **Rules-enforcing engine, not a manual VTT.** The app *drives* play. The
   canonical flow is: click an action → app assembles the pool → rolls →
   auto-computes consequences (paradox, mana, damage) → applies them to the
   sheet. The human confirms targets/choices, not arithmetic. This is why the
   domain layer is modeled so deeply (26 Effect modules).
2. **Three authority tiers: Player / Storyteller / Dev.** See
   [Roles & authority](#roles--authority).
3. **Map = shared whiteboard, theater-of-the-mind primary.** Sketch/draw
   assistance with optional draggable tokens. **Decoupled from the rules** —
   token positions do NOT feed range/cover/LoS. Combat modifiers are entered by
   hand per roll.
4. **AI is an open-ended assist surface.** The four features below are the
   starting set, not a closed list — expect more.
5. This is a **target-state** inventory. Priority (MVP vs later) is called out
   in [Priority](#priority-tiers), but the doc describes the whole target.

## Roles & authority

- **Player** — acts on their own turn; edits/owns their own character sheet;
  sees public activity + their own whispers; uploads their own portrait.
- **Storyteller (ST)** — full control *within their session*: edit any sheet,
  override/undo any roll, apply/remove damage & conditions, run NPCs, drive the
  whiteboard, upload & reveal handouts, see all whispers/hidden rolls.
- **Dev (Trevor)** — **global god-mode across all sessions**: swoop into any
  game, impersonate/fix anything for a confused player, edit any state. A
  superset of ST, not scoped to a single session.

## Capability areas

### 1. Accounts & auth ✅
- Google OAuth sign-in (Better Auth); no email/password.
- Session-cookie auth; protected routes redirect unauthenticated users home.
- **Gap:** no per-user profile/settings surface beyond identity; Dev flag needs
  a home (⛔).

### 2. Sessions & membership ✅
- Create a session (becomes ST); join via 8-char invite code; list mine.
- Lifecycle status: lobby → active → ended.
- Roster of members with role + display name.
- **Open:** multiple *sittings* per session are not modeled (ADR-0002 defers a
  "Chronicle" entity until needed). Scheduling/calendar out of scope.

### 3. Character creation 🟡
- **Target:** guided, **rules-enforced wizard** — concept → path → order →
  attributes → skills → arcana → merits (with prerequisites) → review → commit.
  Enforces dot caps, Gnosis-based maxima, starting Mana/Gnosis, ruling arcana.
  Optional AI creation assistant (see §14).
- **Now:** only a seeded fixture ("Arctus"); validation logic exists in domain
  (`character.ts`, `merits.ts`) but there is **no builder UI**.

### 4. Character sheet & roster 🟡
- **Sheet (✅ display):** attributes (9), skills (24), arcana (10), gnosis,
  health track (bashing/lethal/aggravated), willpower, mana, path/order,
  derived stats (defense/initiative/speed).
- **Live editing during play (⛔):** in a rules-enforcing engine the sheet is
  the mutable game state — auto-updated by actions and hand-editable (spend
  willpower, mark conditions, adjust).
- **Roster / browse all sheets (⛔):** view every PC's sheet in a session
  (players browse each other; ST/Dev browse + edit).
- **Portrait image (⛔):** per §12 blob storage.

### 5. Dice & rolling ✅
- Build a pool from sheet traits; d10 successes (8+), exploding 10s,
  10-again/9-again/8-again, rote rerolls, chance die, dramatic/exceptional.
- Roll persisted with full breakdown; visibility (public/hidden); results in the
  activity log with die faces + component breakdown.
- This is the substrate every automated action rolls through.

### 6. Spellcasting flow 🟡
- **Target:** pick spell/arcanum → app builds the casting pool (improvised
  Gnosis+Arcanum vs rote Attribute+Skill+Arcanum) → applies sympathetic/factor
  penalties → roll → **auto-compute Paradox** (§7 outcome) → **deduct Mana**
  (§8) → apply effects/damage to targets. Covert vs vulgar, counterspelling,
  spell tolerance, combined spells.
- **Now:** domain fully models this (`spellcasting.ts`, `-advanced`,
  `counterspell.ts`, `spell-control.ts`); **no casting UI** — only raw dice.

### 7. Combat & tick initiative 🟡
- **Target:** the house-ruled centerpiece (ADR-0001). Automated **tick-based
  initiative tracker** (FFX-style re-ordering), action costs (attack 3, cast 5,
  aim/dodge 1), turn prompting. Attack → defense/dodge → damage auto-applied to
  health tracks; armor, weapons, ranged range-bands, grapple, cover.
- **Map does NOT drive this** — range/cover chosen by hand per attack (decision 3).
- **Now:** domain modeled (`initiative.ts`, `combat.ts`, `combat-modifiers.ts`,
  `damage.ts`, `health.ts`); **no tracker UI**.

### 8. Paradox 🟡
- **Target:** auto-rolled as a consequence of vulgar/over-reached casting;
  outcomes (havoc/bedlam/anomaly/branding/manifestation), backlash to Resistant
  bashing, Wisdom-to-contain. Surfaced inline in the cast flow + as conditions.
- **Now:** `paradox.ts` / `paradox-effects.ts` modeled; **no UI**.

### 9. Mana, resources & conditions 🟡
- **Target:** Mana economy (per-turn by Gnosis, Pattern Restoration/Scouring,
  Oblation at Hallows); Willpower spend/recovery; Wisdom degeneration; ongoing
  effects/conditions tracking; XP / Arcane XP for advancement. Spends triggered
  by actions and manually.
- **Now:** `mana-economy.ts`, `wisdom.ts`, `resources.ts` modeled; **no
  UI/controls**; no advancement tracking.

### 10. Activity log & chat ✅
- Unified chronological feed (ADR-0003): interleaves rolls + messages, discrim
  on `kind`. Server-side visibility filtering.
- Chat: public messages, whispers (sender/target/ST), system messages.
- **Extends as** the transcript of automated actions (casts, attacks, paradox).

### 11. Whiteboard / map / tokens 🟡→⛔
- **Target:** a **shared whiteboard** — draw/sketch/erase, select, optional
  draggable tokens; theater-of-the-mind. Real-time synced. **Not** a tactical
  grid; positions are illustrative only.
- **Now:** "Map canvas — coming soon" stub; canvas tool state machine planned
  (`select | draw | erase`) but unbuilt.

### 12. Handouts & blob storage ⛔
- **Character portraits:** players (and ST/Dev) upload images stored in blob
  storage, shown on sheets/tokens.
- **Handout system:** ST uploads images to a session library, then **triggers
  reveal** to all players (Roll20-style). Reveal shows up as an activity-log /
  overlay event.
- **Open sub-questions:** text handouts vs image-only; persistent reusable
  library vs one-shot; per-player vs all-players reveal.

### 13. Rules reference, search & reading 🟡
- **Target:** browse and **read any rule** from both rulebooks in-app, plus
  semantic/LLM search over them.
- **Now (retrieval ✅):** 1,627 chunks embedded (1536-dim vector index) +
  structured spells (365) & rotes (372); `searchRules` returns top-5 matches.
- **Gaps:** (⛔) a **reading/browse UI**; (⛔) an **LLM answer layer** that
  synthesizes a cited natural-language answer instead of raw chunks; spell/rote
  browser + "add rote to character".

### 14. AI assist surface (open-ended) ⛔
Starting set — **not a closed list**:
- **Rules RAG Q&A** — cited natural-language answers over the rulebooks.
- **Storyteller improv chatbot** — on-demand NPC dialogue, complications,
  atmosphere (GM assistant during play).
- **Character-creation assistant** — suggestions woven into the wizard (§3).
- **Image generation** — character portraits / scene / handout art feeding §12.
- Infra exists for none yet (Vercel AI SDK planned; RAG data seeded).

### 15. Admin / Dev god-mode ⛔
- Global cross-session override for Dev (Trevor): open any session, edit any
  sheet/state, impersonate/act-for a player, undo/redo, fix stuck games.
- ST equivalent scoped to their own session.
- **Now:** role enum exists (`roles.ts`: storyteller/player) — **no Dev tier, no
  admin surface**.

### 16. NPC / antagonist management ⛔
- ST-run stat blocks needed to actually run encounters: spirits, ghosts,
  abyssal entities, NPC mages; add to initiative; act/roll on their behalf.
- **Now:** some antagonist math in domain (`spirits.ts`, `legacies.ts`); **no
  NPC sheets, bestiary, or ST controls**.

### 17. Presence & real-time ✅
- Live online/offline indicators (`@convex-dev/presence`); heartbeat/disconnect.
- Convex subscriptions give real-time sync across all live state (assumed
  substrate for every collaborative surface above).

### Cross-cutting infrastructure
- **Convex-Effect wrapper (🟡):** for the app to *enforce* rules, domain logic
  must run inside Convex functions. A bridge stub exists (`convex-effect.ts`,
  used by `rolls.ts`); generalizing it is prerequisite plumbing for §§6–9.

## Priority tiers

- **Already usable today:** sessions, sheet display, dice pool + roll, chat +
  whispers, unified activity log, presence, RAG retrieval endpoint.
- **MVP for a live session (owner's must-haves):**
  1. Character creation wizard (§3)
  2. Spellcasting flow (§6)
  3. Combat + tick initiative tracker (§7) — with paradox (§8) & mana (§9) as
     its consequences
  4. Whiteboard + tokens (§11) and NPC management (§16)
  5. Rules browse/read + LLM Q&A (§13)
  6. Roster / browse all sheets (§4)
  7. Admin / Dev god-mode (§15)
  8. Blob storage: portraits + handouts (§12)
- **Later / open-ended:** the broader AI surface (§14) beyond rules Q&A;
  character advancement/XP; advanced antagonist & legacy systems; multiple
  sittings per session.

## Open sub-questions (candidates for follow-up tickets or `/to-prd`)

- **Convex-Effect enforcement plumbing** — how domain logic runs server-side to
  authoritatively enforce rules (gates §§6–9). Likely its own decision/ticket.
- **Handout model** — image-only vs text; reusable library vs one-shot;
  targeted vs all-players reveal (§12).
- **Sheet mutation & undo model** — how automated changes, manual edits, and
  ST/Dev overrides coexist with a clean undo (§§4, 7, 15).
- **Whiteboard interaction fidelity** — token identity, layers, ST-only vs
  shared drawing (§11).
- **Multiple sittings / campaign continuity** — revisit ADR-0002 if long
  campaigns need distinct sittings.
