import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import { schemaToConvexValidator } from "../schema-bridge"
import { CharacterDoc, DiceRollDoc, MessageDoc, SessionMemberDoc } from "../tables"

/**
 * Round-trip safety net for the schema bridge (ADR-0005): for each seam table,
 * generate arbitrary rows from the Effect-Schema mirror and assert every sample
 * (a) satisfies the *derived* Convex validator and (b) survives decode → encode.
 * If the bridge ever mis-compiles a construct these tables use, a generated
 * counterexample fails here rather than silently accepting bad rows in production.
 */

/** Convex validator's structural JSON, as produced by `.json` at runtime. */
type ValidatorJson =
  | { readonly type: "string" | "boolean" | "number" | "float64" | "null" | "bytes" }
  | { readonly type: "bigint" }
  | { readonly type: "id"; readonly tableName: string }
  | { readonly type: "literal"; readonly value: unknown }
  | { readonly type: "array"; readonly value: ValidatorJson }
  | { readonly type: "union"; readonly value: ReadonlyArray<ValidatorJson> }
  | {
      readonly type: "object"
      readonly value: Record<
        string,
        { readonly fieldType: ValidatorJson; readonly optional: boolean }
      >
    }

const validatorJson = (schema: Schema.Top): ValidatorJson =>
  (schemaToConvexValidator(schema) as unknown as { readonly json: ValidatorJson }).json

/** Does `value` conform to a Convex validator, read from its `.json` form? */
function matchesConvexValidator(value: unknown, node: ValidatorJson): boolean {
  switch (node.type) {
    case "string":
    case "id":
      return typeof value === "string"
    case "number":
    case "float64":
      return typeof value === "number"
    case "boolean":
      return typeof value === "boolean"
    case "bigint":
      return typeof value === "bigint"
    case "null":
      return value === null
    case "bytes":
      return value instanceof ArrayBuffer
    case "literal":
      return value === node.value
    case "array":
      return Array.isArray(value) && value.every((item) => matchesConvexValidator(item, node.value))
    case "union":
      return node.value.some((member) => matchesConvexValidator(value, member))
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return false
      const record = value as Record<string, unknown>
      // Every present key must be a declared field of the right type...
      for (const key of Object.keys(record)) {
        const field = node.value[key]
        if (!field) return false
        if (!matchesConvexValidator(record[key], field.fieldType)) return false
      }
      // ...and every required field must be present.
      for (const [key, field] of Object.entries(node.value)) {
        if (!field.optional && !(key in record)) return false
      }
      return true
    }
  }
}

const tables = {
  sessionMembers: SessionMemberDoc,
  diceRolls: DiceRollDoc,
  messages: MessageDoc,
  characters: CharacterDoc,
} as const

describe("schema bridge: derived validators accept their mirror's rows", () => {
  for (const [name, schema] of Object.entries(tables)) {
    const node = validatorJson(schema)
    const decode = Schema.decodeUnknownSync(schema)
    const encode = Schema.encodeUnknownSync(schema)

    it.prop(
      `${name}: arbitrary rows pass the derived validator and round-trip`,
      [Schema.toArbitrary(schema)],
      ([sample]) => {
        expect(matchesConvexValidator(sample, node)).toBe(true)
        // decode ∘ encode is identity for these persistence mirrors.
        expect(decode(encode(sample))).toEqual(sample)
      },
    )
  }
})
