import { describe, expect, it } from "@effect/vitest"
import { v, type GenericValidator } from "convex/values"
import { schemaToConvexValidator } from "../schema-bridge"
import {
  RESISTANCE_TRAITS,
  ROTE_ARCANA,
  ROTE_ATTRIBUTES,
  RotePool,
  SKILL_SLOT_TRAITS,
} from "../rote-pool"

/**
 * Equivalence guard for the `rotes` table's `pool` column migration to a
 * derived validator (ADR-0005, issue #54). Real rote documents already exist
 * under the hand-written `rotePoolValidator` this replaces, so the validator
 * derived from the domain `RotePool` must compile to the same *field* shape —
 * frozen verbatim below — tightened only where the domain schema is stricter:
 * the open `v.string()` columns become the closed trait vocabularies. That
 * narrowing is safe for stored rows because every persisted pool was emitted
 * by `parseRotePool`, which only speaks those vocabularies — pinned dataset-
 * wide by spell-data.conformance.test.ts decoding every pool through
 * `RotePool`.
 */

// The pool definition exactly as it was hand-written in convex/schema.ts
// before derivation — the shape contract for existing rote documents.
const handWritten = v.object({
  attribute: v.string(),
  skills: v.array(v.string()),
  arcanum: v.string(),
  vs: v.optional(v.array(v.string())),
})

/** The domain's closed vocabulary where the hand validator said `v.string()`. */
const oneOf = (values: ReadonlyArray<string>): GenericValidator =>
  v.union(
    ...(values.map((value) => v.literal(value)) as [
      GenericValidator,
      GenericValidator,
      ...Array<GenericValidator>,
    ]),
  )

const tightened = v.object({
  attribute: oneOf(ROTE_ATTRIBUTES),
  skills: v.array(oneOf(SKILL_SLOT_TRAITS)),
  arcanum: oneOf(ROTE_ARCANA),
  vs: v.optional(v.array(oneOf(RESISTANCE_TRAITS))),
})

const structuralJson = (validator: unknown): unknown =>
  JSON.parse(JSON.stringify((validator as { json: unknown }).json))

describe("rotes.pool: derived validator equals the hand-written shape, tightened", () => {
  it("keeps the frozen hand-written field layout (same keys, same optionality)", () => {
    expect(Object.keys(tightened.fields)).toEqual(Object.keys(handWritten.fields))
    expect(tightened.fields.vs.isOptional).toBe(handWritten.fields.vs.isOptional)
  })

  it("schemaToConvexValidator(RotePool) compiles to the frozen definition with the closed trait vocabularies", () => {
    const derived = schemaToConvexValidator(RotePool)
    expect(structuralJson(derived)).toEqual(structuralJson(tightened))
  })
})
