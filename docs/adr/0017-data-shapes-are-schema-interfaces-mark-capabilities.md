# Data shapes are Schema; interfaces mark capabilities

Adopted from the 2026-07-06 Effect-drift audit discussion. Every pure-data shape
in `src/**` is defined as an Effect Schema (or derived from one via
`typeof X.Type`) — including shapes that are never decoded, where the Schema
serves as a zero-runtime-cost type factory. A manual TS `interface`/`type` is
legal only when a member is not data: a function or JSX. Concretely, the two
sanctioned interface habitats are:

- **Service/port contracts** — `Context.Tag` classes with readonly method
  interfaces (`GameStore`, `CurrentActor`). The interface exists to be
  substitutable by Layer (convexLive in prod, in-memory in tests); a
  `Schema.Class` with methods bakes in one implementation and cannot be
  swapped from the environment.
- **React props carrying callbacks or `ReactNode`.**

## Why

The audit found the same shape hand-declared three times (session member
rows), a machine input duplicating a domain type with its union widened to
`string`, and a Convex validator hand-mirroring a domain Schema. Two
overlapping tools for the same job is what allowed the drift: each new file
chose one by vibe. The line is now mechanical: **all-data ⇒ Schema;
any-function ⇒ interface**. The rejected alternative — Schema for functions —
was checked against the v4 docs: `Schema.declare` can only smuggle a function
behind a type guard (no signature validation, `null` JSON encoding), so it
describes nothing an interface doesn't, with extra ceremony.

## Consequences

- Sweep issue converts the existing data interfaces: leaf reference-data defs
  (`WeaponDef`, `MeritDefinition`, …), flow `*Args` DTOs (whose manual
  `Number.isInteger` guards become `Schema.isInt()` checks), port write-DTOs
  (`RollDraft`, `CastPatch`, …). The port *method* interfaces stay.
- Deliberately-structural shapes (`AccumulatorCast`, `DerivationTraits`) keep
  their intent — TS stays structural over Schema-derived types; their doc
  comments move to the Schema.
- Branding rides along for free wherever a swept shape has a branded field.
