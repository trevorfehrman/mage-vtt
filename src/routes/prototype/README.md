# Prototype routes — quarantined reference assets

These six routes are **not shipping surfaces**. They are the throwaway
prototypes that settled the design decisions recorded in `docs/decision-map.md`
(tickets `ui-direction`, `layout-finalize`, `visual-identity`,
`component-polish`, `whiteboard-tools`), committed as-is because the decision
map links to them as reference assets (PRD #11, issue #13).

- `ui-direction.tsx` — three session-UI directions (A/B/C); settled the grid axis
- `layout-5section.tsx` — the 5→4-section collapse; FFX tick tracker bottom band
- `visual-identity.tsx` — identity Pass 3 (kept for comparison)
- `visual-identity-2.tsx` — **approved** identity Pass 4: tokens, type, Arcana glyphs
- `component-polish.tsx` — **approved** component language: the core play loop exemplar
- `whiteboard.tsx` — whiteboard tooling exploration (track is unscheduled)

Rules: never link these from shipping navigation; never import app code into
them or them into app code; mock data only. The live implementations of the
settled decisions live in `src/styles.css` and `src/components/game/`.

## Workbench rigs — the other kind of prototype route

- `cast-dressing-room.tsx` — the ladder dressing room (issue #96, map #95):
  the REAL SessionLayout / feed neighbors / CastCard fed fake Cast documents,
  with `?rung=` and `?seat=` knobs. Unlike the census-era routes above, a rig
  imports app code **on purpose** — it exists to audition real components in
  every state (ADR-0021's workbench decision). Still mock data, still never
  linked from shipping navigation. Delete when map #95 clears.
