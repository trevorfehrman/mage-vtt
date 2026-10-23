# Component standards — the six-axis rubric

The polish campaign's shared checklist (ADR-0021; extracted from the rail-foot
pilot #79 and promoted by #72). Every cluster issue carries these six axes as
its acceptance bar. The vocabulary that satisfies them lives in
`src/styles.css` (the `mv-*` classes), `src/components/ui/` (the restyled
shadcn primitives and the promoted components), and renders in every state at
`/prototype/workbench`.

A component passes when every box on every axis checks.

## 1 · Identity conformance

- [ ] Colors come from the identity tokens only (`docs/visual-identity.md`) —
      no hex literals in components. Status colors go through the semantic
      layer (`--rail-success`, `--rail-danger`, `--mana`, `--turn-*`), never
      raw `--accent`/`--ember`/`--bad` for status.
- [ ] The color grammar holds: verdigris is the world's magic and the trigger;
      ember is the caster's own armed, reversible act — never a submit button.
- [ ] Type speaks in its roles: Cinzel (`mv-h`) for named things, Manrope for
      prose, JetBrains Mono (`mv-data`, `mv-eyebrow`) for data and labels,
      Spectral (`mv-book-text`) only from the Rote book's pages.
- [ ] Where an `mv-*` class exists for the job, the component uses it — no
      local re-derivations of the shared look.
- [ ] Block boundaries are *named* (eyebrow + rule, `mv-rule`); hierarchy is
      never implied by control-shaped geometry (bordered/rounded groups) or
      bare type weight at 14px.
- [ ] Stat/readout lines use the label grammar: dim mono uppercase label +
      ink value, dominant figure by size (`GNOSIS 2 · MANA 11 · WILL 6`).

## 2 · Complete interaction states

- [ ] Every interactive control designs all of: default, hover, active/lit,
      disabled, and keyboard `focus-visible` — the shared focus ring (one
      accent outline, offset 2px; the grouped rule in `styles.css` covers
      `mv-*` controls and the restyled primitives' `data-slot`s).
- [ ] **Gates explain themselves.** A control that refuses for a game reason
      is not silently disabled: it wears the refusing treatment (`mv-refuse` —
      dimmed but pointer events kept) and surfaces its reason at the control,
      via `GateButton` (`src/components/ui/gate-button.tsx`) or an inline
      reason. Silence is a bug.
- [ ] Disabled ≠ gated: plain `disabled` is for mechanically inert moments
      (dice mid-flight); a rule refusing you always says why.

## 3 · Designed lifecycle states

- [ ] Empty is designed, not accidental: the `mv-empty` voice (quiet mono,
      centered in the space the content will occupy) and it says what fills
      the space — "an empty felt rolls a chance die", never bare dim italics.
- [ ] Loading/in-flight is designed: controls dim honestly while work is out
      (the tray's `Rolling…`), and layout never jolts when the state resolves
      (the felt's empty hint floats out of the layout).
- [ ] Errors speak in place, in `--bad`, in words a player understands (the
      seam's refusal under the tray) — never a dead control or a console-only
      failure.

## 4 · Density

- [ ] The settled type scale: 14px primary trait/row names (nowrap, always),
      12–13px secondary, 11px column labels, 10px fittings, 9px eyebrows —
      **nothing below 9px** (marks like 7px dots are marks, not text).
- [ ] Settled tightness: dense as an instrument, but legibility beats density
      when they fight (the sheet's own amendment — it scrolls now).
- [ ] Wide-layout affordances fill their shelf (fittings stretch); narrow
      layouts wrap rather than shrink type below the floor.

## 5 · The animation stance

- [ ] Enter/exit/reorder/stage-change goes through Motion
      (`AnimatePresence`/`layout`); the shared beats are `entranceSpring` and
      `FeedEntry` (`src/components/ui/entrance.tsx`).
- [ ] Hover and state color fades stay one-line CSS transitions — no JS
      wrapper per button.
- [ ] **Nothing animates ambiently without earning it.** Ambient motion is
      rare and earned, not banned (ADR-0021, 2026-10-23); the sanctioned
      exceptions are the ones ADR-0021 names (the Arcana material system
      while lit, the one night-sky canvas, the Paradox holes' breath, the
      burst plate's fog while its roll is fresh); everything else moves only
      when an event moves it.
- [ ] `useReducedMotion` / `prefers-reduced-motion` is respected on every
      animation: entrances render instantly, ambient exceptions hold a static
      frame.

## 6 · The a11y floor

- [ ] Text contrast ≥ 4.5:1 on its surface. The tokens are guarded by
      `src/__tests__/token-contrast.test.ts` (which forced the `--dim`
      amendment to `#807b8f`); component-local color mixes must hold the same
      bar.
- [ ] Full keyboard operability with the visible shared focus ring; anything
      clickable is reachable and operable by keyboard.
- [ ] No native form controls where a styled equivalent exists: `Select` for
      dropdowns, `Input`/`mv-field` for text, the restyled primitives for
      dialogs and tooltips.
- [ ] ARIA/screen-reader completeness is explicitly *not* part of the floor
      (ADR-0021) — don't gold-plate it, don't regress the basics either
      (`aria-expanded` on the tray handle, `aria-disabled` on gates).

## The shared vocabulary index

| Piece | Home | Job |
|---|---|---|
| `mv-panel`, `mv-cornered` | `styles.css` | surfaces; corner-ticks mark important ones |
| `mv-h`, `mv-eyebrow`, `mv-data`, `mv-book-text` | `styles.css` | the type roles |
| `mv-rule` | `styles.css` | the named-boundary rule's line |
| `mv-btn`, `mv-mini`(+`-on`), `mv-chip`, `mv-trait`(+`-on`), `mv-roll`, `mv-handle` | `styles.css` | the control family |
| the focus ring | `styles.css` (one grouped rule) | axis 2's focus-visible plank |
| `mv-refuse` + `GateButton` | `styles.css` + `ui/gate-button.tsx` | gates explain themselves |
| `mv-empty` | `styles.css` | designed empty states |
| `mv-field` + `Input`/`Label` | `styles.css` + `ui/input.tsx`, `ui/label.tsx` | the styled field |
| `entranceSpring`, `FeedEntry` | `ui/entrance.tsx` | the sanctioned entrance beats |
| `Button`, `Select`, `Dialog`, `Tooltip` | `ui/` (restyled #72) | shadcn machinery in the mv voice |

shadcn is **restyled, not banned**: use its behavior machinery (Radix focus
management, portals, keyboard handling) and let the restyled primitives carry
the look. If a primitive still reads stock somewhere, restyle the primitive —
don't fork a local variant.
