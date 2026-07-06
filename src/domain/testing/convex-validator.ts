import type { Schema } from "effect"
import { schemaToConvexValidator } from "../schema-bridge"

/**
 * Structural conformance checker for bridge-derived Convex validators (ADR-0005),
 * shared by the property tests that keep the derive honest: the table mirrors
 * (tables.property.test.ts) and the Activity feed's returns validator
 * (activity.test.ts). Reads the validator's runtime `.json` form and answers
 * whether a value would be accepted by Convex.
 */

/** Convex validator's structural JSON, as produced by `.json` at runtime. */
export type ValidatorJson =
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

export const validatorJson = (schema: Schema.Top): ValidatorJson =>
  (schemaToConvexValidator(schema) as unknown as { readonly json: ValidatorJson }).json

/** Does `value` conform to a Convex validator, read from its `.json` form? */
export function matchesConvexValidator(value: unknown, node: ValidatorJson): boolean {
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
