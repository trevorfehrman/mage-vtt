import { Match, type Schema } from "effect"
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
  return Match.value(node).pipe(
    Match.whenOr({ type: "string" }, { type: "id" }, () => typeof value === "string"),
    Match.whenOr({ type: "number" }, { type: "float64" }, () => typeof value === "number"),
    Match.when({ type: "boolean" }, () => typeof value === "boolean"),
    Match.when({ type: "bigint" }, () => typeof value === "bigint"),
    Match.when({ type: "null" }, () => value === null),
    Match.when({ type: "bytes" }, () => value instanceof ArrayBuffer),
    Match.when({ type: "literal" }, (literal) => value === literal.value),
    Match.when(
      { type: "array" },
      (array) =>
        Array.isArray(value) && value.every((item) => matchesConvexValidator(item, array.value)),
    ),
    Match.when({ type: "union" }, (union) =>
      union.value.some((member) => matchesConvexValidator(value, member)),
    ),
    Match.when({ type: "object" }, (object) => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return false
      const record = value as Record<string, unknown>
      // Every present key must be a declared field of the right type...
      const declared = Object.keys(record).every((key) => {
        const field = object.value[key]
        return field !== undefined && matchesConvexValidator(record[key], field.fieldType)
      })
      // ...and every required field must be present.
      const required = Object.entries(object.value).every(
        ([key, field]) => field.optional || key in record,
      )
      return declared && required
    }),
    Match.exhaustive,
  )
}
