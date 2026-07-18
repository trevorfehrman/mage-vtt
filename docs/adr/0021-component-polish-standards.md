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

*Amended (2026-07-16):* one sanctioned exception to "nothing ambient" — the
Arcana dashboard's **material behaviors** (owner call): precious metals
carry a slow specular drift, stone breathes, iron and lead thrum. Slow,
low-alpha, `prefers-reduced-motion`-gated, and confined to the Arcana
material system; this is not a general license for ambient motion.

*Amended (2026-07-16, later the same day):* the material system gained a
**substance layer** (owner-auditioned per Arcanum, all ten locked; #84): a
WebGL shader per Arcanum — `@paper-design/shaders-react` for eight, custom
GLSL via its `ShaderMount` for Fate and Space — mounted **only while that
tile is armed**, so concurrent WebGL contexts stay far under the browser cap
(Chromium: 16 desktop / 8 Android; survey in
`docs/research/2026-07-16-arcana-shine-library-survey.md`). Under reduced
motion a substance renders one static frame (`speed 0` cancels the rAF
loop). Caption legibility over substances is structural, not per-shader
tuning: a dark drop-shadow halo hugs the caption's shapes while lit, and
lit tiles brighten empty dot rings via `--mv-dot-ring`. The same rules
apply: event-driven (armed), never ambient elsewhere.

*Amended (2026-07-17):* the **first-Motion crown moves from the rail foot
(#79) to the Rote book (#89)** — the book's page turn (`AnimatePresence`;
forward slips left, back slips right, contents rises) is the app's first
sanctioned Motion use. Owner call during the rote-look grilling: opening a
grimoire is a more thematic coronation, and its art direction may inform the
combat tracker. The rail foot keeps its remaining vocabulary-pilot roles
(gate tooltip, refusing-button treatment, designed empty state). The event-
driven rule is unchanged — the book's smoulder/scramble/watermark-lift
behaviors are all armed-state-driven, never ambient.

*Amended (2026-07-18):* the **night sky is the app's one ambient canvas**
(owner verdict, #84; two prototype rounds preserved on
`prototype/trait-matrix-skies`). A GLSL galaxy (`SheetSky`) fills the
center panel behind the sheet, on the same `ShaderMount` the Arcana
substances use: the firmament runs everywhere a container isn't, and every
made object — title card, Arcana tiles, Rote book, all solid `--panel`
surfaces — occludes it. Attributes & Skills is the sheet's one
containerless section, so only there does the void show through
unobstructed. Budget
holds: it is a single always-on WebGL context (substances still mount only
while armed, so concurrency stays far under the 16/8 cap), `maxPixelCount`
caps its GPU cost, the mount pauses offscreen, and reduced motion renders
one static frame (`speed 0`). Its meteor stays event-driven — it marks the
roll (the pool machine's building → rolling transition), never the
selection. Row legibility over the galaxy is structural, same as the Arcana
captions: a dark halo hugs each row's shapes and empty dot rings brighten
(`--mv-dot-ring`); the field itself never dims during pool-building. This
is a license for exactly one sky — the chronicle rail and feed are the
crunch zone and stay still; ambient motion anywhere else remains banned.

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
