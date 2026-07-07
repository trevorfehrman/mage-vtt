# Pure code uses the pure toolbox

Adopted from the 2026-07-06 Effect-drift audit discussion; clarifies ADR-0014.
"A pure computation is a plain function" means the `Effect` **type** is absent
— not that Effect's data tools are. Inside `src/domain` and `src/machines`,
pure code still reaches for the pure half of the Effect toolbox: `Match`,
`Option`, `Data`, and the `Array`/`Record`/`Iterable`/`Order`/`HashMap`
modules — in preference to `for`/`while` loops, `new Map`/`new Set`, and
nested ternaries. Effectful code composes with the effectful half
(`Effect.forEach`, `Effect.fn`, services) as ADR-0014 already requires.

## Why

ADR-0014's "plain function" was being read as "plain JavaScript," so leaves
and even `Effect.fn` bodies grew imperative accumulator loops, vanilla Maps,
and hand-rolled ternary chains — three idioms where one exists. None of the
pure modules wrap values in `Effect`, so this costs no ceremony, no
`it.effect`, and preserves the `R = never` signal ADR-0014 protects; it buys
the single-vocabulary consistency the codebase is built around. The
alternative — wrapping pure math back into `Effect` for uniformity — was
re-examined and re-rejected: it erases the fallible/worldly distinction the
seam architecture reads from the types.

## Consequences

- Sweep issue converts the audited sites (imperative loops in
  `flows/vulgar-cast.ts`, `character.ts` validators via `Effect.forEach`,
  the `cast.ts` name-resolution `Map`, closed-vocab `Record<string, …>`
  tables tightened to total `Record<PathName/OrderName, …>` per ADR-0014's
  closed-key rule).
- Adapter glue (`convex/lib/*`, the schema bridge's reflective walking) and
  the exempted text-munging pipeline scripts stay imperative — their job is
  the messy edge.
- Not fully lintable (loops are legal JS); enforced by convention, review,
  and this ADR.
