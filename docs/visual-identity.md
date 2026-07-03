# Visual Identity — RESOLVED (Pass 4)

Settled spec for the `visual-identity` ticket (`docs/decision-map.md`). Chosen
direction: **Cinzel display · Verdigris accent · dark supernal void**, with
Mage's own iconography used *functionally* as the distinctiveness. Iconography
research: **[`docs/mage-iconography.md`](./mage-iconography.md)**.

Prototype (approved): **`src/routes/prototype/visual-identity-2.tsx`** →
`http://localhost:3000/prototype/visual-identity-2?accent=verdigris&display=cinzel`.
(Pass 3 preserved at `visual-identity.tsx` for comparison.)

## The decision

The gap through Pass 3 was distinctiveness — a "competent but generic dark UI."
Pass 4 closes it not with more ornament (owner: *"we can't go nuts and clutter
the UI"*) but by making **Mage's symbol system load-bearing**: the ten Arcana
are a functional icon language, and the hero moment is drawn from the setting's
own sacred geometry. Atmosphere stays **restrained** and legibility **absolute**.

## Settled spec

**Type**
- **Display: Cinzel** (500/600) — carved Trajan caps. Titles, section headings,
  the Paradox heading, the illuminated drop-cap. (Cormorant retired; Marcellus &
  Fraunces were the runners-up in the switcher.)
- **Body: Manrope** (400–700).
- **Data / mono: JetBrains Mono** — dice, Ticks, resources (MANA/GNOSIS/WILL),
  eyebrows/labels. Gives the "arcane instrument readout" feel.

**Color — dark supernal void** (a hair of indigo so it reads celestial, not
neutral-black). Accent = **Verdigris `#6fae97`** (neutral/default; no neon, no
gradients, ornament never reduces legibility).

| Token | Value | Role |
|-------|-------|------|
| `--bg` | `#08080c` | app void |
| `--panel` | `#0e0d13` | panels |
| `--raise` | `#16141d` | raised controls |
| `--ink` | `#d7d2e0` | primary text |
| `--dim` | `#797488` | secondary text |
| `--accent` | `#6fae97` | Verdigris — accent/active |
| `--line` | `#1e2b27` | verdigris-tinted borders |
| `--glow` | `rgba(111,174,151,.12)` | active bloom / paradox wash |

**Iconography — the distinctiveness**
- **The ten Arcana** as a **hybrid glyph set**: a legible geometric skeleton +
  one calligraphic signature each (inward spiral terminal · barbed point · solid
  "bindi" dot), so they read as Mage brush-runes, not generic sacred-geometry.
  Used **functionally** — on every Roll in the log, each Arcanum in the dice
  pool, spell/rote tags, the Paradox card, and the sheet's Arcana row. Prime is
  the hero glyph (a looped source-staff). Motifs per `mage-iconography.md`.
- **App-mark = the Pentacle** (the five Atlantean orders as a pentagram-in-circle),
  replacing the plain sigil.

**Hero moment — the Supernal compass.** A faint, crisp astrolabe behind the
whiteboard: a degree-ticked wheel with the five Watchtowers bound by a pentagram
(the pentacle-in-circle the research names as *the* on-brand layout device).
Low-opacity, always behind content.

**Atmosphere — considered & restrained.** Etched 1px borders + accent corner-tick
framing on hero panels; one illuminated Cinzel drop-cap on the opening system
line; a sacred-geometry watermark strictly behind panels; soft vignette.
**Emanation lighting** (thin radiating strokes), never neon-bloom / gradient-on-
text / static.

## Path-flair palette (metal-coded — supersedes the earlier TBDs)

Per-Path / per-Watchtower flair, now reconciled to the canonical **metal coding**
(see `mage-iconography.md`). Verdigris stays the neutral default regardless of
Path. Refinement (exact hues, glyph pairing) folds into `component-polish`.

| Path | Metal / realm | Accent (draft) | Hex |
|------|---------------|----------------|-----|
| Acanthus | Lunargent (silver) / Arcadia | Verdigris → cool silver | `#6fae97` |
| Obrimos | Gold / the Aether | Bone Gold | `#cdbd94` |
| Moros | Lead / Stygia | Pewter-violet *(TBD)* | — |
| Mastigos | Iron / Pandemonium | Tarnished Amethyst | `#9a86c4` |
| Thyrsus | Stone / Primal Wild | Oxblood → earthy *(TBD)* | `#b56d60` |

## Applying it (next step, not part of this ticket)

`src/styles.css` still ships the old teal/tropical theme. Migrating it to these
tokens (and threading Cinzel/JetBrains Mono + the Arcana glyph components into
real components) is **implementation** — it belongs to `component-polish` /
`/to-prd`, since it's cross-cutting and needs testing across every route. The
prototype is the source of truth for the tokens above.
