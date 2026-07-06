# Derive Convex validators from Effect Schema (build, don't adopt)

Schemas are defined once in Effect Schema (the domain's source of truth), and the
Convex side — table validators for `defineTable`, arg/return validators for
functions — is **derived** by a small in-house compiler, `schemaToConvexValidator
(schema) → Validator`, rather than hand-written alongside the Schema or delegated
to a framework. Decode/encode between Convex's stored form and rich domain types
happens at the `GameStore` adapter (ADR-0004). Convex-native types that plain
schema can't express (`v.id("table")`, `v.int64`, `v.bytes`) are carried by a
`ConvexId(...)`-style **annotation convention** the compiler reads.

## Why

The enforcement seam (ADR-0004) chose Effect-Schema domain mirrors, whose cost is
triplication: Convex `v.*` schema, the Effect-Schema mirror, and per-mutation
`args` validators. This is exactly what **confect** eliminates — but confect is
Effect v3 and we are v4 (ADR-0004), so it is not adoptable. The unification is
worth building ourselves because it is small and bounded on v4:

- Effect v4 exposes a walkable `SchemaAST` with readable annotations, **and ships
  a maintained `Schema → JSON-Schema` compiler**. So the robust build is
  *Schema → JSON-Schema (Effect's compiler) → Convex validator* — Effect absorbs
  the unstable beta-AST walking; we own only the small, stable last hop
  (string/number/boolean/array/object/union/enum/const/optional → `v.*`).
- Domain Schemas remain the source of truth and keep their richness (brands,
  refinements, `Class`); we project *down* to Convex's poorer types at the edge.

Net: ~one module we own on v4, versus coupling our deepest layer (schema
definition) to a pre-1.0, single-maintainer, wrong-major framework.

## Consequences

- **Sequenced after the enforcement seam.** The seam ships first with hand-
  maintained mirrors; this bridge retrofits them (derive-once) and deletes the
  mirror-tax. It is validated against a real existing consumer.
- **New surface:** one bridge module (e.g. `convex/lib/schema-bridge.ts`), the
  `ConvexId`/annotation helpers, and a property/conformance test — generate an
  `Arbitrary` from each domain Schema and assert every sample passes the derived
  Convex validator and round-trips through decode/encode. That test is the safety
  net that keeps the derive honest.
- **Step 0 at build time:** verify the exact v4-beta export and dependency
  (`JSONSchema` in core `effect` vs `OpenApiJsonSchema` in `@effect/platform`) per
  the project rule to fetch current `@effect/*` docs before writing the code.
- **We own the JSON-Schema → Convex mapping forever** — acceptable because it only
  needs the constructs the domain actually uses; unsupported constructs throw
  loudly (documented restrictions), rather than mis-compiling.
- **Not adopted:** confect's broader surface (HTTP API/OpenAPI, rpc, cluster) is
  out of scope; we take only the schema-derive idea. Revisit confect wholesale
  only if it ships an Effect-v4 release.

## Step 0 findings (resolved — bridge shipped)

- The compiler is **`Schema.toJsonSchemaDocument(schema, options)`** in core
  `effect` (v4-beta.92), returning `{ dialect: "draft-2020-12", schema, definitions }`.
  No `@effect/platform` dependency is needed. Confirmed usable on every construct
  the seam tables use, so the bridge landed (it is **not** deferred).
- The bridge lives at `src/domain/schema-bridge.ts` (shared client/Convex), with
  the `SessionMembersRow`/`DiceRollsRow`/`MessagesRow` mirrors in
  `src/domain/tables.ts`; `convex/schema.ts` derives those three tables' validators.
- Three quirks the compiler must (and does) absorb, discovered empirically:
  - `Schema.Number` emits `number | "NaN" | "Infinity" | "-Infinity"`; the number
    sentinel union is collapsed back to `v.number()`.
  - Optional Convex columns must use **`Schema.optionalKey`** (clean drop from
    `required`); `Schema.optional` adds a `null` branch that would mis-map.
  - `Schema.Class` mirrors emit a top-level `$ref` into `definitions`; the compiler
    resolves refs. Custom annotations only survive via `includeAnnotationKey`, which
    is how `ConvexId`/`ConvexInt64`/`ConvexBytes` reach `v.id`/`v.int64`/`v.bytes`.
- The derived validator is typed from the schema's decoded shape (normalised to
  Convex `Value`s) so a derived table's `Doc<T>` matches a hand-written `v.*` one.

## Extension: function returns (2026-07-05)

The bridge's scope grows from table/args validators to **function `returns`
validators**, first consumer: `activity.list`, whose return is
`Schema.Array(ActivityEntry)` — the Activity-feed union from the Activity-module
design (grilled 2026-07-05). One schema thereby locks the server's output and the
client's decode together: projection drift fails loudly in the query at dev time
instead of surfacing as silently dropped entries in the client's per-entry decode.

Two facts the return shape relies on:

- Returned entries are **projections, not stored docs** — they may carry `_id`
  and a `_tag` discriminator. Convex reserves only `$`-prefixed field names at
  the value layer (verified against `convex/values`); the `_` restriction applies
  to stored documents' system fields, which projections are not.
- The same property/conformance pattern applies: an `Arbitrary` generated from
  the return schema must pass the derived validator and round-trip through
  decode. New bridge surface, same safety net.
