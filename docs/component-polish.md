# Component Polish — component design language (RESOLVED, core loop)

> **Partially superseded (2026-07-16, ADR-0021):** the polish campaign's pilot
> raised the type scale (traits 12→14px) and relaxed the "sheet fits without
> scrolling" density constraint below — legibility beat density on a real
> laptop. The evolving source of truth is ADR-0021 and, once #72 lands,
> `docs/component-standards.md`. The rest of this doc (type roles, state
> colors, glyph functionalism, sheet-as-controller) still stands.

Asset for the `component-polish` ticket (`docs/decision-map.md`). Takes the locked
visual identity (`docs/visual-identity.md`) down to the component level. Settled
against a **working exemplar of the core play loop** — the most coupled, most-used
surface — which fixes the shared language the rest of the app inherits.

Prototype (approved, interactive): **`src/routes/prototype/component-polish.tsx`**
→ `http://localhost:3000/prototype/component-polish`. Toggle sheet traits → they
build the pool → Roll → a result card lands in the Chronicle.

## The shared component language (settled)

- **Type roles:** Cinzel = names/headings only; **JetBrains Mono = all data**
  (dots, dice, successes, resources, pool size, eyebrows/labels); Manrope = prose
  (log messages, concept). Labels are mono uppercase, letter-spaced `.22em`, 9px.
- **State colors:** Verdigris `--accent` carries **both** "active/selected" and
  "success." Selected traits get `--glow` fill + accent border; success dice get a
  solid accent chip (ink-on-accent); failures are dim on `--raise`.
- **Density:** tight rows (`py-1`, 12–13px), 3-column stat grids, sub-pixel dot
  ratings (`size-1.5`). The sheet fits attributes+skills+arcana+vitals without
  scrolling at desktop width.
- **Framing:** `--line` 1px borders; accent **corner-ticks** (`cp-cornered`) mark
  the "important" surfaces only — the sheet header and each roll card. Not on
  every panel (that would clutter).
- **Glyphs are functional, not decorative:** an Arcanum's hybrid glyph appears
  wherever that Arcanum does — the sheet's Arcana rows, the ruling-Arcana pair in
  the header, pool chips, and roll cards. Nowhere else.
- **Resources as instrument readouts:** Mana/Willpower as accent ◆ pip rows,
  Gnosis as a bare accent numeral, all mono.

## Per-component decisions

**CharacterSheet** — the sheet *is* the dice-pool input surface. Every rated
Attribute / Skill / Arcanum is a toggle button; toggling adds/removes it from the
pool (verdigris active-state). Header pairs Path+Order with the two **ruling
Arcana glyphs**. Arcana rows lead with the glyph; ruling ones carry a ◆. Vitals =
health clock (✕ lethal / ╱ bashing), Defense/Init/Speed as mono stats. Skills at 0
are hidden (as today).

**DicePoolBuilder** — lives at the foot of the right rail (per the 4-section
grid). Shows the live pool size big + mono, the assembled components as removable
chips (Arcana chips carry their glyph), a modifier stepper, an again-threshold
segmented control (`10/9/8-ag`), Rote/Hidden toggles, and one accent **Roll N
dice** button. Pool of ≤0 shows a **chance die** (◈). Clears itself after a roll.

**ActivityLog (roll card + messages)** — roll card: ruling glyph(s) + roller, a
big accent successes numeral, the die faces (successes = accent chips; rote
rerolls ringed `--dim2`; explosions/again ringed accent), and a mono component
breakdown. Exceptional (≥5) / Dramatic Failure / Hidden render as bordered mono
tags. System lines get the single illuminated Cinzel drop-cap (first line only);
whispers/other messages are prose. *Covered as pattern; full edge-state matrix
(whispers, hidden-roll redaction, presence joins) is implementation detail.*

## Interaction model (settled)

The core loop is direct-manipulation: **the sheet is the controller, the pool is
the readout, the log is the record.** No separate "add trait" modal. A roll
consumes the pool and resets it. This is the pattern all future roll-driven flows
(spellcasting, combat actions) should reuse.

## Deferred / spawned

- **`whiteboard-tools`** (spawned, open) — the 4th surface named by this ticket.
  The whiteboard is greenfield (only a placeholder exists), so it's design-from-
  scratch, not polish: token model, pen/shape tools, theater-of-mind fidelity.
  See app-capabilities' open "whiteboard fidelity" question.
- **Spellcasting / combat-action triggers** — how casting is invoked in the UI
  (`layout-finalize` deferred this). It reuses the sheet-as-controller model
  above; the concrete flow is a `/to-prd` implementation concern.
- **Applying to real components** — migrating `src/styles.css` + the real
  `CharacterSheet`/`DicePoolBuilder`/`ActivityLog`/`DotRating` off the teal theme
  onto these tokens + glyph components is implementation (`/to-prd` → `/implement`).
