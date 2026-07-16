# Component polish runs shared-first, on Motion, against an amended identity

Context: the component-polish campaign (2026-07-08 grilling; census in
`docs/census/census.md`) touches every component in the app. Four decisions
shape how all of its issues execute, and each had a real alternative.

**Shared-first foundation.** One foundation issue — the polish rubric as
`docs/component-standards.md`, the missing mv-* state vocabulary (focus ring,
disabled-with-reason/gate tooltip, empty state, styled select, feed-entry
entrance), and a restyle of the shadcn primitives onto the mv language — lands
before the 8 component-cluster issues. Rejected: per-component fending, which
would have produced 17 dialects of the same fixes. Cost accepted: the
foundation is the critical path; nothing else starts until it merges.

*Amended (2026-07-08, same day):* the foundation is **extracted, not authored
a priori**. One pilot component — the rail foot — is perfected first, inventing
the vocabulary it needs locally; the foundation issue then promotes what
survived into the shared layer. Same pattern as ADR-0020 (HandEditForm piloted
the forms doctrine before it spread). The shared-first goal is unchanged — the
other clusters still inherit one language and remain blocked on the foundation.
This also settles *how* the shadcn question gets answered: the pilot uses
shadcn/Radix behavior machinery where it needs it and reskins it to mv on the
spot; whether that feels distinctive enough is learned on one component before
seventeen commit to it.

*Amended (2026-07-16):* in practice the pilot landed on the **sheet family**
first (commit e0fffdc): it settled the type scale (14px primary, nowrap trait
names), the named-boundary rule (section headers, never control-shaped
geometry or bare type weight), the stat-line label grammar, glyph optical
normalization plus the Path/Order glyph sets, and the first in-game shadcn
reuse (Separator). It also amended two of this ADR's own calls: the settled
density rises (the "sheet fits without scrolling" constraint from
`docs/component-polish.md` is relaxed — legibility beat density), and
at-a-glance resources moved out of the sheet header into the rail's
ResourceStrip. The rail foot keeps the remaining vocabulary-pilot role: gate
tooltip, refusing-button treatment, designed empty state, first Motion use.

**Animation is Motion + CSS, split by job.** The `motion` package
(framer-motion) is the sanctioned animation layer: anything that enters,
exits, reorders, or changes stage goes through Motion
(`AnimatePresence`/layout); simple hover/state color fades stay one-line CSS
transitions; nothing animates ambiently; reduced motion respected via
`useReducedMotion`. Rejected: hand-rolled CSS keyframes for list/stage
animation (fragile), and routing hovers through Motion (a JS wrapper per
button for no gain).

**The a11y floor amends the locked identity.** Three planks: text contrast
≥ 4.5:1, full keyboard operability with visible focus-visible styles, and no
native form controls where a styled equivalent exists. `--dim` (#797488)
measures ~4.3:1 on `--panel` and gets nudged lighter until it clears —a
deliberate amendment to the Pass-4 identity in `docs/visual-identity.md`,
chosen over exempting `--dim` because the census independently flagged
dim-text legibility. ARIA/screen-reader completeness is explicitly *not* part
of the floor. Related: a hard 9px minimum type size, and the rule that a
disabled or refusing control must explain itself (tooltip or inline reason).

**The workbench is a cheap hybrid, not a Storybook.** One
`/prototype/workbench` route renders the mv-* vocabulary sheet in every state
plus the prop-driven components under mock data. The 9 Convex-hook-wired
components (CastCard, CombatTracker, SceneStrip, ChatInput, …) are verified by
driving the live app — we explicitly do **not** add prop-seams to them for the
gallery's sake. That refactor was rejected as scope creep inside a polish
campaign; revisit only if a real need for isolated rendering appears.
