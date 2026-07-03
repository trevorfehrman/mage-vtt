# Whiteboard Tools — interaction/visual spec (RESOLVED)

Asset for the `whiteboard-tools` ticket (`docs/decision-map.md`). Designs the
shared whiteboard in the locked identity (`visual-identity.md` +
`component-polish.md`). Resolves the open "whiteboard fidelity" question from
`app-capabilities.md` §11.

Prototype (approved, interactive): **`src/routes/prototype/whiteboard.tsx`** →
`http://localhost:3000/prototype/whiteboard`. Pick a tool, draw, drag tokens,
erase.

## The two decisions

- **Authority = FULLY COLLABORATIVE.** Anyone at the table draws, erases, and
  moves *any* token — not ST-only, not "move only your own PC." Closest to a real
  shared napkin. (Owner's call; overrides the tentative ST-directed default.)
- **Fidelity = LIGHT-MAP.** A faint dot / ley-grid gives loose spatial sense;
  tokens carry a portrait/initial + a ring; ink is freeform on top. More "board"
  than napkin, but still **theater-of-the-mind — NOT a tactical grid**: no
  snapping, no measured distance, positions illustrative, **decoupled from rules**
  (never feeds range/cover/LoS — ADR context + app-capabilities §11).

## Tool palette (settled)

A horizontal palette in the locked skin (mono labels, verdigris active tool):

| Tool | Behavior |
|------|----------|
| **Select** | Drag any token to reposition (grab cursor). The default. |
| **Pen** | Click-drag → freehand verdigris ink stroke. |
| **Line** | Click-drag → straight ward-line (rubber-band preview). |
| **Text** | Click → drop an editable label. |
| **PC token** | Click → place a PC token (verdigris ring). |
| **NPC token** | Click → place an NPC token (oxblood ring; palette btn tints oxblood). |
| **Erase** | Click any stroke, label, or token to remove it (fat invisible hit-area on strokes). |
| **Clear ink** | Wipes strokes + labels, keeps tokens. |

## Token model

- **PC** = verdigris ring + soft outer ring; short initial (mono) inside + name
  below. **NPC** = oxblood ring (reads as "other/threat," matching the initiative
  band's NPC coding). Both are **draggable by anyone**.
- **Path-flair tint reserved:** a PC ring can later take its Path's metal tint
  (`visual-identity.md` palette) instead of the default verdigris — deferred to
  when Path-flair lands.
- Portraits (blob-stored, app-capabilities §12) drop into the token disc when
  that system exists; the initial is the fallback.

## Layers (bottom → top)

1. **Backdrop** — the dot-grid; and (future) a revealed **handout image** sits
   here beneath the ink (see the handout seam below).
2. **Ink** — pen/line strokes + text labels.
3. **Tokens.**
4. **Remote cursors** — live, per-collaborator (pointer-events: none).

No user-facing z-order controls in v1 (theater-of-mind doesn't need them).

## Collaboration & sync

- Real-time via Convex; every stroke / token move / label is a synced element.
- **Presence:** an "At the board" avatar cluster + **live remote cursors** with
  name tags (the prototype fakes two — Vera/ST, Mara) — this is the visible cue
  that it's collaborative.
- **Conflict model:** last-write-wins per element (fine — positions are
  illustrative, nothing rules-bearing rides on them).
- Even in the collaborative model, a future **ST "lock canvas" toggle** is a
  natural escape hatch if a table wants it — noted, not built.

## Seams / deferred (fold into `/to-prd`, not new map tickets)

- **Handout model** (§12) — image reveal, reusable library vs one-shot,
  targeted vs all-players. The whiteboard just renders a revealed image as the
  backdrop layer; the *model* stays that ticket's open question.
- **Token ↔ character binding + portraits** — needs blob storage (§12).
- **Undo model** — app-capabilities open sub-question; applies here too.
- **Text editing** — the prototype drops a placeholder label; inline-edit vs a
  small popover is an implementation choice.
- **Applying to the real app** — building the actual canvas component (the
  planned `select | draw | erase` machine → extend to this palette) is
  implementation (`/to-prd` → `/implement`).
