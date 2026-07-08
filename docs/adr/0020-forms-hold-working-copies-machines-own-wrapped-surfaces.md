# Forms hold working copies; machines own the surfaces they wrap

Adopted from the 2026-07-08 forms grilling (handoff from the 2026-07-07
playtest session). The question arrived as "should we adopt TanStack Form?";
the durable decision is a classification. Every stateful UI surface is one of
three kinds, and the kind — not the field count — picks the tool:

1. **Projections of server documents** (the Cast card, the Activity feed).
   No client-held draft exists; the server document is the single owner
   (ADR-0016). Never a form, never a working copy. Nothing changes here.
2. **Machine-wrapped declarations** (`CastPanel` + `src/machines/cast.ts`).
   The machine's context owns the *entire* working copy — every field,
   toggle, and submission path, including ones added later. Guards
   (`canSubmit`) and wire-builders (`buildSubmission`) read context
   directly; arming resets atomically. A form library never enters a
   machine-wrapped surface.
3. **Flat forms** (`HandEditForm`, `SheetlessCastForm`, the session
   dialogs, the future character builder): edit → submit, no temporal
   lifecycle. These get a shared form mechanism instead of per-component
   `useState`.

The mechanism for class 3 is decided but gated: **TanStack Form, if** the
Effect v4-beta → Standard Schema → `useForm` prototype passes the bar below;
**an in-house `useWorkingCopy` hook** (~100 lines around
`Schema.decodeUnknownEffect`) if it fails. Either way the doctrine stands —
one source of type truth (domain Schemas, ADR-0017), working copies for flat
forms, machines own what they wrap.

"Working copy" is now glossary (CONTEXT.md): client-held, unsent edits that
exist nowhere until submitted. The term exists because **Draft** was already
taken — a Draft is a durable server document (a Cast in the wings) other
actors can see and kill; a working copy belongs to one person on one screen.

## The gate

A throwaway prototype (own session) must show, against `@tanstack/react-form`
and the pinned `effect@4.0.0-beta.x`, a ~5-field form where:

1. **Inference** — `useForm` field types flow from the Schema-derived type
   with no manual generics and no re-declared shape.
2. **Brands** — branded fields (`Mana`, …) are writable from `<input>`
   handlers with no `as`-casts in component code; branding happens at the
   decode boundary.
3. **Validation** — a Schema `.check()` failure surfaces as a per-field
   error message.
4. **Seam refusals** — a `Schema.TaggedErrorClass` refusal mapped through
   `seamErrorMessage` lands as a form-level error after submit.

A small owned adapter (a Schema→Standard-Schema shim, a beta-pin bump) is a
**pass** — the schema-bridge (ADR-0005) is precedent for owning that kind of
glue. Per-field casts or duplicated shapes are a **fail** regardless of what
typechecks.

## Why

The pitch for a form library was instant client-side validation and
boilerplate reduction. Examined against the code, validation was the weaker
half: the settled pattern (issue #52, `CastCard` caps) has client and server
sharing one domain leaf, which is *stronger* than validation slots — rules
can't drift. All three refusal round-trips hit in playtesting are
button-gating data-plumbing gaps, not field-validation gaps; no form library
fixes them. So validation *rules* stay in shared domain leaves; a form
mechanism supplies only the plumbing (values, dirty, touched, error slots).
Schema-powered field validation is representability, in ADR-0011's sense —
game legality still gates through the leaves.

The boilerplate half is real but narrow: `HandEditForm` hand-rolls per-field
dirty flags to submit only changed fields; everything else flat is one or two
fields. That alone argued for deferring until the character builder. We chose
to adopt **now, scoped to flat forms**, to de-risk the Schema interop and the
library's ergonomics on small ST-only surfaces before the character builder
arrives needing dozens of fields — the deliberate trade being a retrofit of
working forms that didn't ask for it.

The "XState vs form library" tension dissolved under ownership analysis, not
state-kind analysis. The tempting split — machine keeps temporal state
(armed → declaring → casting), form keeps spatial state (the fields) — fails
at the seams: the machine's guard and submission builder must *read* the
fields, and re-arming must *reset* them, so split ownership means hand-wired
sync. That exact drift already shipped once: issue #66 put `intent` and
`usesMagicalTool` in `useState` beside the machine, and today intent text
typed for spell A silently rides into spell B's draft when the caster
re-arms, because the machine's atomic reset can't reach state it doesn't
own. One owner per surface is the rule the bug was begging for.

Rejected: adopting with hand-written form types beside the domain Schemas
(violates the one-source-of-type-truth requirement that motivated ADR-0017);
a form library inside machine-wrapped surfaces (two owners, above); deferring
everything to the character builder (banks nothing, and the interop question
only gets more expensive to discover late).

## Consequences

- The interop prototype runs in its own session with the pass bar above; its
  verdict picks the mechanism and gets recorded back onto this ADR.
- If it passes: pilot retrofit is `HandEditForm` (the only flat form with
  real dirty-diff needs). The two-field forms convert opportunistically when
  next touched — no sweep. New flat forms use the mechanism from day one.
  `@tanstack/react-form` is not installed until the gate passes.
- The cast machine absorbs its strays (issue filed): `DRAFT_VULGAR` becomes
  a machine event with a `drafting` state; `intent`, `usesMagicalTool`, and
  the draft error move into context; the intent-carryover-on-rearm bug dies
  structurally.
- The three button-gating gaps are filed as their own data-plumbing issue,
  independent of any form mechanism.

## Verdict (2026-07-08): PASS — TanStack Form is the mechanism

Prototyped same-day (`src/routes/prototype/tanstack-form-gate.tsx`, deleted
after this recording) against `@tanstack/react-form@1.33.0` +
`effect@4.0.0-beta.92`. **No adapter was needed at all**: v4 ships
`Schema.toStandardSchemaV1` natively, returning
`StandardSchemaV1<Encoded, Type> & S`.

1. **Inference — PASS.** `useForm({ defaultValues })` with defaults typed
   `typeof FormSchema.Encoded`; every `field.state.value` inferred correctly
   with zero manual generics and zero re-declared shapes.
2. **Brands — PASS.** `Encoded` of a branded quantity is plain (`Mana`'s is
   `number`), so the working copy edits unbranded values and
   `Schema.decodeSync(FormSchema)` brands at the submit boundary. No casts
   anywhere in component code.
3. **Validation — PASS.** `validators: { onChange: toStandardSchemaV1(S) }`
   surfaces `.check()` failures per-field via `field.state.meta.errors`
   ("Expected an integer, got 2.5"), clearing reactively when fixed.
4. **Seam refusals — PASS.** `validators.onSubmitAsync` catching a
   `ConvexError` and returning `{ form: seamErrorMessage(err) }` renders the
   seam's table language as a form-level error ("Not enough Mana: need 6,
   have 3.").

Two ergonomic notes for the pilot (`HandEditForm`), neither gate-relevant:
per-field messages are Effect's defaults — pass a `leafHook` to
`toStandardSchemaV1` for table language; and `errorMap.onSubmit` holds the
whole `{ form, fields }` return of `onSubmitAsync`, so unwrap `.form` when
rendering (a shared helper belongs in the pilot).
