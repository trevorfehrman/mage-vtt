# Effect v4 beta bump (33 → 92) — GO

Go/no-go asset for the `effect-v4-bump` ticket (`docs/decision-map.md`).

## Verdict: **GO** — bump is clean, applied to the working tree.

Bumped the coordinated Effect toolchain and verified empirically (the most
reliable "what breaks" test for a 59-beta jump — let the compiler + suite judge):

| Package | Was | Now |
|---------|-----|-----|
| `effect` | `^4.0.0-beta.33` | `^4.0.0-beta.92` |
| `@effect/vitest` | `4.0.0-beta.33` | `4.0.0-beta.92` |
| `@effect/language-service` | `^0.80.0` | `^0.86.2` |

### Evidence (beta.33 baseline → beta.92)

- **Tests: 180/180 pass, unchanged** (`bunx vitest run`, 26 files). No behavioral
  regression anywhere in `src/domain/` (24 modules) or the XState `dice-pool` machine.
- **Typecheck: 54 → 54 diagnostics, identical set.** A line-by-line diff shows
  **zero new type errors**. The only delta is cosmetic: `@effect/language-service`
  reworded its `missingReturnYieldStar` advisory text (same 31 sites, same code).
- Our whole Effect surface compiles unchanged across 59 betas — `Schema` /
  `Schema.TaggedErrorClass` / `Effect.fn` / `Effect.gen` / `Layer` / `Context.Tag`
  / `Random`, plus the convex-effect glue. **No code changes were required.**

### Context that matters

- **v4 is still beta.** npm dist-tags today: `beta = 4.0.0-beta.92`, `latest =
  3.21.4` (the v3 line). There is **no v4.0.0 stable yet** — so we remain on the
  beta line; the "point bump vs migration" framing holds (this was never a v3→v4
  migration; we've been on v4 beta the whole time).
- **Re-evaluate when v4.0.0 stable lands** — that will be the next real decision.

### Not run

- Full SSR build (`vite build` / Nitro) — out of scope for the Effect surface,
  which is exercised by the domain tests + typecheck. Worth a smoke build at
  `/to-prd` time regardless.

## Downstream

- **The two Effect tickets now target beta.92** (the version we'll run):
  `effect-audit` and `effect-xstate-bridge` are unblocked.
- **Hand to `effect-audit`:** the 31 `missingReturnYieldStar` advisories are
  live best-practice nudges from the LSP — exactly the kind of thing the audit
  catalogs and fixes (`return yield*` on never-succeeding Effects). Also the
  couple of pre-existing non-Effect nits surfaced in the baseline (`findLast`
  needs `lib: es2023`; a `Record<string,unknown>`→`Value` cast in
  `convex-effect.ts`) — not bump-caused, but audit-adjacent.

## Repo state

The bump is **applied but uncommitted** (`package.json` + `bun.lock`), so the
audit tickets build against beta.92. Commit it with the audit work, or revert to
defer: `git checkout package.json bun.lock && bun install`.
