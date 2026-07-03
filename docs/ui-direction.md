# UI Direction — decision record

Prototype asset + verdict for the `ui-direction` ticket in `docs/decision-map.md`.

## Prototype

Throwaway route: **`src/routes/prototype/ui-direction.tsx`** — three switchable
session-UI directions (`?variant=A|B|C`, floating switcher, ← / → keys), mock
data, no Convex. Run `bun run dev` → `http://localhost:3000/prototype/ui-direction`.
All three share the agreed spine: a **center tabbed workspace** (Whiteboard
default · Character · Rules-with-LLM-answer). They differ in surrounding chrome
and occult identity. Keep as the iterating base for `layout-finalize` and
`visual-identity`; delete once those conclude.

- **A — Grimoire:** warm oxblood + gold, Fraunces serif; video left rail,
  activity/dice/chat right rail. 3-column.
- **B — Astral Console:** violet/cyan HUD; video ribbon top, stat-chip rail left,
  feed right, dice command bar bottom. **5-section**.
- **C — Round Table:** slate + brass, minimal chrome, stage maximized; floating
  video, log in a slide-over drawer.

## Verdict (owner) — two axes, decided separately

**Layout paradigm = the 5-section grid (B's structure).** Top + left + center +
right + bottom is the direction to build toward — but with corrections, because
B's horizontal bands didn't earn their space as drawn:

- **Video → left rail** (not a top ribbon).
- **Left stat-chip rail — cut.** Redundant with the Character sheet tab.
- **Top band — needs a real job** once video moves to the rail. Open question.
- **Bottom dice bar — too thin** to justify a dedicated horizontal band as drawn.
- **Center** stays the tabbed workspace (Whiteboard default); **log** in the
  right rail.

**Palette / visual identity = undecided.** None of the three occult skins nails
the identity the owner wants. This needs its own dedicated exploration (color,
type, texture, motifs) — it is *not* Grimoire-by-default.

**Components need substantial refinement** regardless of palette/layout.

## The horizontal-band question — RESOLVED by `layout-finalize`

The 5-section exploration answered its own question by collapsing to **four**
sections. Prototype: `src/routes/prototype/layout-5section.tsx` (Exploration ⇄
Combat toggle). Outcome:

- **Bottom band = a collapsible, FFX-style tick initiative tracker** — portraits
  of PCs *and* NPCs ordered by tick (ADR-0001), shown in combat, collapsed out
  of it. The owner's favorite element.
- **Top band = dropped.** No content earned it; "call it four sections for now."
  (The earlier initiative-*top* idea is retired in favor of initiative-*bottom*.)
- **Action/rote hotbar = rejected** — no action-combos worth shortcutting.
- **Dice pool** lives in the **right rail** (below the log, above chat), not the
  bottom.

## Settled for downstream work

- **Layout = 4-section grid:** video **left rail** · **tabbed-whiteboard center**
  (Whiteboard default · Character · Rules+LLM answer) · activity log **+ dice
  pool + chat right rail** · **collapsible FFX initiative tracker bottom**
  (combat-only). No top band; no action hotbar.
- **Palette is NOT settled** — do not assume Grimoire (`visual-identity`).
- **Deferred (flow, not layout):** how casting/attacks are triggered in the UI
  (likely from the sheet / spell list) → `component-polish` + spellcasting flow.

## Follow-up tickets spawned

- **`layout-finalize`** (Prototype) — solve the horizontal-band content question;
  settle the final 5-section grid (sizes, collapse, combat-only bands).
- **`visual-identity`** (Prototype) — explore the occult palette/type/texture
  from scratch; none of the three prototypes nailed it.
- **`component-polish`** (Prototype) — refine the individual components once the
  palette and grid are settled.
