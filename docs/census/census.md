# Component census — 2026-07-08

Phase 1 of the component-polish campaign (see `/tmp/mage-vtt-handoff-component-polish.md`).
Captured by driving the dev app against the Playtest session
(`kd79g9e96yq6psqr9ctb50ycc5832zx0`) as the Storyteller account. Screenshots live in this
directory, numbered in capture order; open one only when a question needs it. Full-page
shots are ~1316–1365px wide; `-zoom` files are close-ups of a single component.

Viewport: desktop only. Not captured anywhere: focus-visible states, keyboard traversal,
mobile/narrow widths, light-anything (app is dark-only).

## Coverage summary

| Component | States captured | Key files |
|---|---|---|
| Sessions index | default (1 session card) | 000 |
| CreateSessionDialog | open/default | 059 |
| JoinSessionDialog | open, error ("No session found…") | 061, 062 |
| SessionLayout (chrome) | default, top bar zoom | 002, 053 |
| VideoRailPlaceholder | default (only state it has) | 002 |
| Roster | own tab active (◆), other tab | 002, 003 |
| CharacterSheet | own/editable, other/READ-ONLY, damaged health | 002, 003, 054–056 |
| DotRating (attrs/skills) | filled/empty, toggled-for-pool highlight | 004, 055 |
| ArcanaGlyph | Matter/Death/Prime in arcana row + rote rows | 056 |
| DicePoolBuilder | empty, chips, MOD pending, 9-AG + WILLPOWER active | 002, 004, 065, 066 |
| CastPanel | vulgar rote open, manaShort gate, covert w/ DRAFT VULGAR disabled, disabled-hover | 010–012, 032, 033 |
| CastCard (the ladder) | DRAFT → ENGAGED/LIABILITIES → INTENTION → PARADOX (Bet) → CONTAINED → RESOLVED; prior CANCELLED cards | 014–030, 003 |
| SheetlessCastForm | default, HIDDEN toggled, resulting hidden roll | 002, 063 |
| ActivityLog | pre-load blank, narration lines, STORYTELLER badge | 002, 003 |
| MessageItem | public, whisper | 006, 035 |
| RollItem | player roll w/ dice faces, paradox roll, initiative, hidden | 006, 025, 063 |
| ChatInput | public mode, whisper mode | 002, 034 |
| HandEditForm | clean, dirty + revert link, mana capped at 11 | 002, 035, 037 |
| SecondSeatControl | closed, dropdown open | 002, 038 |
| SceneStrip | active scene, paradox pips, SLEEPER WITNESSES toggled | 003, 039, 040 |
| CombatTracker | no-combat bar, empty field, add-combatant form, tiles (unrolled/acting/+N), action bar | 057, 041–052 |
| PresenceIndicator | pips in top bar (state ambiguous — see roughness) | 053 |
| Landing page | **not captured** — redirects to /sessions when authed; from code it's a title + Google sign-in button (`src/routes/index.tsx`) | — |

## Not reached / not captured

- Sessions index empty state (account has one session).
- ActivityLog designed empty state — what renders is a blank void before data lands (002).
- CastCard DECLINE / WITHDRAW / VOID interactions this session (prior cancelled casts visible as CANCELLED cards in 003).
- CastPanel toggles active: HIGH SPEECH, MAGICAL TOOL, ROTE, HIDDEN, 8-AG (9-AG + WILLPOWER +3 captured in 066).
- Hover states beyond rote-row tint (009); no focus states anywhere.
- Any true error state besides join-code error (062).

## Obvious roughness, by component

**Global / mv-* vocabulary**
- Two visual generations coexist: the core loop (CastCard, rail, tracker) speaks the
  mv-* language; the dialogs, seat dropdown, and landing page are stock shadcn/default
  styling (059, 061, 038).
- Presence pips (top bar, next to session name) are dim gray dots with no legend or
  tooltip — can't tell online from offline (053).
- TanStack devtools logo overlaps the "PLAYTEST" wordmark top-left (dev-only, but it's in
  every capture) (053).

**CharacterSheet**
- Attribute/skill labels wrap mid-word with no hyphen: "Intellige nce", "Strengt h",
  "Presenc e", "Academi cs", "Investig ation", "Medicin e", "Persuasi on", "Subterfu ge",
  "Compos ure", "Manipul ation". The single worst legibility defect found (055).
- Large dead whitespace between the attributes block and ARCANA on Corvin (002).
- Sheet header pips (mana/will) are tiny and low-contrast; READ-ONLY badge on another
  player's sheet is very easy to miss (003, 054).
- Roster tabs: own tab carries a ◆ and border, other tab is plain — ownership vs
  selection vs presence all ride on subtle cues (003).

**DicePoolBuilder**
- Solid: chips, live count, toggle highlight on sheet traits all read well (004, 066).
- MOD stepper shows "+2" pending with a separate ADD button — pending-vs-applied is
  ambiguous (066).
- Empty-state hint "toggle traits on the sheet…" is italic mono and dim (002).

**CastPanel**
- Intent placeholder reads "(Vulgar)" even when a covert rote is loaded (032).
- manaShort gate: "Mana 8 · have 7" turns orange, but CAST 7 DICE looks unchanged —
  nothing on the button itself says the click will refuse (011, 012).
- Disabled DRAFT VULGAR on covert rotes shows no tooltip after 2s hover — the gate never
  explains itself (033).

**CastCard (the ladder)**
- The strongest component: ladder stages, live liabilities math, blind-insurance table,
  and the Bet slider all captured well (014–030).
- Ladder stage labels are ~7px uppercase and nearly invisible until active (016).
- Blind-insurance table is dense mono with ragged column alignment (021).
- Chronicle does not auto-scroll when a new card/roll/message lands — every new entry
  required manual scrolling to see, including my own actions (005→006 transition).
- Narration lines (em-dash italics between cards) are very dim and small (003).

**ActivityLog / feed items**
- No designed empty/loading state: right column is a black void until data arrives (002).
- RollItem is good (success count, dice faces with success highlighting, pool breakdown)
  but hierarchy between roll/message/narration/card entries is carried almost entirely by
  size, not structure (006, 063).

**ChatInput**
- Whisper mode: toggle highlights, placeholder swaps to "Whisper…" — decent. Mode stays
  latched on whisper after sending; easy to whisper by accident later (035).

**HandEditForm**
- Dirty state: value turns accent + "revert" link appears — but APPLY OVERRIDE looks
  identical whether clean or dirty (035, 037).
- Mana stepper silently stops at 11; no cue that the cap was hit (037).

**SceneStrip**
- Paradox pips per character are tiny colored dots; SLEEPER WITNESSES toggled state is a
  subtle border change (039, 040).

**CombatTracker**
- Combatant tiles abbreviate to two letters ("TE", "GH") and truncate shadow names
  ("Tessella…") (048).
- Add-combatant row: "Seat a character…" is a **native `<select>`** (invisible popup to
  screenshots, default OS styling) and the NPC row has four unlabeled numeric inputs
  (2/2/2/2) before ADD NPC (042).
- Action bar (ATTACK 3 / CAST 5 / MOVE 3 / Aim / Dodge / ticks… / BILL) is dense mono
  with unclear affordances — clicking ATTACK 3 billed instantly, BILL sat disabled (050,
  051).
- The no-combat bar "No Combat — the Scene breathes" is nearly invisible at the bottom
  (057).

**Dialogs (Create/Join)**
- Stock shadcn dialog on `bg-background` — the one place the app looks like a template.
  Create button renders in a muted half-disabled tone even when actionable (059, 061).
- Join error renders as small red text between input and button (062).
- Flakiness note: opening either dialog via real pointer clicks repeatedly failed to keep
  it open during automation (it opened via JS `.click()`), files 058/060. Possibly an
  automation artifact, but worth a look at the trigger wiring.

**VideoRailPlaceholder**
- Dashed outline boxes + "reserved — video track"; fine as a placeholder, no states (002).

**Landing page** (from code, not captured)
- Minimal: display-title + white Google button, no identity treatment
  (`src/routes/index.tsx`).
