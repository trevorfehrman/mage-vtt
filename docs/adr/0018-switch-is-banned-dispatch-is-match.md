# switch is banned; dispatch is Match

Adopted from the 2026-07-06 Effect-drift audit discussion; sharpens ADR-0014's
fourth rule from "unions dispatch through Match" to an absolute: **no `switch`
statement anywhere in `src/`, `convex/`, or `scripts/` — zero exceptions.**
Closed unions and literal sets dispatch through
`Match.value(...).pipe(Match.tag/when ..., Match.exhaustive)`; genuinely open
spaces (external wire formats like JSON-Schema node types) use `Match.when`
per known case with an explicit `Match.orElse` that names the unsupported
input.

## Why

ADR-0014 left infra/open-space switches to judgment, and the audit showed what
judgment produces: two `CastStatus` switches whose `default:` arms silently
absorb new ladder rungs — the exact runtime gap the rule exists to prevent —
sitting beside "sanctioned" bridge switches that teach every reader that
switch is sometimes fine. An exception list decays under agent iteration; one
absolute rule is lintable, teachable, and never re-adjudicated. `switch` also
offers nothing Match lacks: Match is an expression, exhaustive by
construction, and `Match.orElse` states the open-space fallthrough honestly
instead of implying it with a `default`.

## Consequences

- Enforced mechanically: `no-restricted-syntax` bans `SwitchStatement`
  repo-wide (guardrails issue #56); the last holdouts convert first (#48) so
  the rule lands green.
- The bridge/test-infra switches (`schema-bridge.ts`,
  `testing/convex-validator.ts`) convert despite being individually
  defensible — uniformity is the point.
- Prototype files marked for deletion are skipped, not converted.
