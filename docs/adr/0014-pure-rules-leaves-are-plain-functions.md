# Effect marks effects: pure rules leaves are plain functions

Domain idiom conventions, adopted for the rules-leaf sweep (2026-07-05
architecture review, candidates №3/№4) and binding for new domain code:

- **A pure computation is a plain function.** `Effect.fn` is reserved for
  functions that can fail with a typed error or touch the world (`Random`,
  `Clock`, a port). A leaf that only computes — a table lookup, a penalty
  formula — returns its value directly, and its tests are plain `it()`.
- **Closed-key tables are total.** A table keyed by a `Literals` vocabulary
  (`PathName`, `ArcanumName`, factor levels) is typed `Record<Key, V>` so the
  compiler proves every key present; `?? fallback` on such lookups is deleted,
  not preserved.
- **`Option` marks genuine absence.** Lookups that can really miss (find-by-name,
  optional slots, free-string keys) return `Option`, decoded at the call site.
  Never synthesize a default object on a miss.
- **Unions dispatch through `Match`.** Tagged unions and closed literal sets are
  handled with `Match.value(...).pipe(Match.tag/when ..., Match.exhaustive)` so
  adding a case is a compile error at every dispatch site, not a runtime gap.

## Why

The 2026-07-05 audit found ~25 domain modules wrapping zero-`yield` pure math in
`Effect.fn` — interface ceremony (yield*, `it.effect`, Exit handling) larger than
the implementations it wrapped, purely for stylistic uniformity with the seam
tier. It also found `Match` used nowhere, `Record<string, …> + ?? default`
lookups that turn typo'd keys into silently wrong answers, and synthetic
"unknown" objects fabricated on lookup misses. The effect-solutions field manual
draws the same line the flows already practice: `Effect.gen`/`Effect.fn` express
*effectful* sequencing; pure helpers (`formatRotePool`, the flows' `outcomeOf`/
`castSummary`) stay plain. The alternative — Effect everywhere for uniformity —
was rejected: it makes the type system unable to distinguish "can fail or
touches the world" from "arithmetic," which is the distinction the whole seam
architecture is built on (leaf rules `R = never`, flows carry requirements).

## Consequences

- The sweep lands in four sequential cluster issues (combat/world belt,
  spell-math belt, character-adjacent, dice-loop internals); call sites in the
  cast flows drop `yield*` where leaves become plain.
- Tests for demoted leaves convert from `it.effect` to plain `it()`.
- An Effect return type in the domain now *means something*: fallible or
  worldly. Reviews should treat a zero-yield `Effect.fn` as a smell.
- Branding of game quantities (Dots, Mana, PoolSize, …) is deliberately **not**
  part of the sweep — it ripples through shared flow signatures and runs as its
  own core-outward campaign afterward (tracked as an issue, blocked by the
  sweep).
- `dice.ts` stays effectful (it consumes `Random`); only its manual loops move
  to `Effect.forEach`/`Effect.iterate`.
