/**
 * DIY schema bridge (ADR-0005): derive Convex validators from Effect-Schema
 * mirrors so the Effect Schema is the single source of truth for a table's shape.
 *
 * `schemaToConvexValidator` compiles a Schema into a Convex `v.*` validator by
 * running Effect v4's `Schema.toJsonSchemaDocument` compiler and projecting the
 * resulting JSON Schema (draft-2020-12) onto Convex validators. It covers only the
 * constructs the domain actually uses — string, number, boolean, array, object,
 * union, enum, const, optional — plus a small annotation convention (`ConvexId`,
 * `ConvexInt64`, `ConvexBytes`) for Convex-native types that JSON Schema can't
 * name. Anything outside that projection throws loudly rather than mis-compiling.
 */

import { Schema } from "effect"
import { v, type GenericId, type GenericValidator, type Validator } from "convex/values"

/**
 * Annotation key carrying a request for a Convex-native validator. Emitted into
 * the generated JSON Schema via `includeAnnotationKey` and read back here; the
 * `x-` prefix keeps it out of the standard JSON Schema keyword space.
 */
export const CONVEX_ANNOTATION_KEY = "x-convex"

type ConvexNativeAnnotation =
  | { readonly type: "id"; readonly table: string }
  | { readonly type: "int64" }
  | { readonly type: "bytes" }

const nativeAnnotation = (annotation: ConvexNativeAnnotation) => ({
  [CONVEX_ANNOTATION_KEY]: annotation,
})

/**
 * A string mirror that compiles to `v.id(table)`. At runtime it is an annotated
 * string schema (so JSON-Schema generation, decode, and Arbitrary all treat it as
 * a string); statically it reports Convex's `Id<table>` so a derived table's `Doc`
 * carries the same branded id type a hand-written `v.id(table)` would.
 */
export const ConvexId = <const Table extends string>(table: Table) =>
  Schema.String.pipe(Schema.brand(`ConvexId(${table})`)).annotate(
    nativeAnnotation({ type: "id", table }),
  ) as unknown as Schema.Codec<GenericId<Table>, GenericId<Table>>

/** Mirror that compiles to `v.int64()` (Convex's bigint column). */
export const ConvexInt64 = Schema.BigInt.annotate(nativeAnnotation({ type: "int64" }))

/** Mirror that compiles to `v.bytes()` (Convex's ArrayBuffer column). */
export const ConvexBytes = Schema.Uint8Array.annotate(nativeAnnotation({ type: "bytes" }))

// -----------------------------------------------------------------------------
// Compiler
// -----------------------------------------------------------------------------

type JsonNode = Record<string, unknown>
type Definitions = Record<string, JsonNode>

/**
 * Normalise an Effect *decoded* type into a Convex `Value`-compatible shape: Convex
 * requires mutable arrays and plain objects, while Effect's decoded types are
 * `readonly`. Convex-native brands (`Id`) and literal unions pass through
 * untouched, so a derived table's `Doc<T>` matches a hand-written `v.*` one. We map
 * from `S["Type"]` (not `S["Encoded"]`) to avoid Effect's encoded-side machinery.
 */
type Convexify<T> = T extends GenericId<string>
  ? T
  : T extends ReadonlyArray<infer U>
    ? Array<Convexify<U>>
    : T extends bigint
      ? T
      : T extends ArrayBuffer
        ? T
        : T extends object
          ? { -readonly [K in keyof T]: Convexify<T[K]> }
          : T

/** JSON's stand-ins for the non-finite doubles Effect emits for `Schema.Number`. */
const NUMBER_SENTINELS = new Set(["NaN", "Infinity", "-Infinity"])
const DEF_REF_PREFIX = "#/$defs/"

/**
 * Compile an Effect Schema into a Convex validator.
 *
 * The result is typed from the schema's encoded shape so that `defineTable(...)`
 * derives a precise `Doc<T>` (Convex reads the document type off the validator's
 * `type` phantom). The runtime value is the structurally-compiled validator.
 *
 * @throws if the schema uses a JSON Schema construct outside the supported
 * projection — the bridge refuses to guess.
 */
export function schemaToConvexValidator<S extends Schema.Top>(
  schema: S,
): Validator<Convexify<S["Type"]>, "required", Extract<keyof S["Type"], string>> {
  const document = Schema.toJsonSchemaDocument(schema, {
    includeAnnotationKey: (key) => key === CONVEX_ANNOTATION_KEY,
  })
  const compiled = compileNode(
    document.schema as JsonNode,
    document.definitions as Definitions,
  )
  return compiled as unknown as Validator<
    Convexify<S["Type"]>,
    "required",
    Extract<keyof S["Type"], string>
  >
}

function compileNode(node: JsonNode, definitions: Definitions): GenericValidator {
  // A Convex-native annotation wins over the structural JSON Schema: the JSON form
  // of a bigint/bytes/id is a lossy approximation we deliberately ignore.
  const native = node[CONVEX_ANNOTATION_KEY] as ConvexNativeAnnotation | undefined
  if (native) return compileNative(native)

  const ref = node.$ref
  if (typeof ref === "string") return compileNode(resolveRef(ref, definitions), definitions)

  const anyOf = node.anyOf
  if (Array.isArray(anyOf)) {
    // `Schema.Number` becomes `number | "NaN" | "Infinity" | "-Infinity"` in JSON
    // Schema; recognise that shape and collapse it back to a single number column.
    if (isNumberSentinelUnion(anyOf as Array<JsonNode>)) return v.number()
    return unionOf(
      (anyOf as Array<JsonNode>).map((branch) => compileNode(branch, definitions)),
      node,
    )
  }

  const enumValues = node.enum
  switch (node.type) {
    case "string":
      return Array.isArray(enumValues) ? literalUnion(enumValues) : v.string()
    case "boolean":
      return v.boolean()
    case "number":
    case "integer":
      return v.number()
    case "null":
      return v.null()
    case "array": {
      const items = node.items
      if (!items || typeof items !== "object" || Array.isArray(items)) {
        throw unsupported(node, "array must have a single `items` schema")
      }
      return v.array(compileNode(items as JsonNode, definitions))
    }
    case "object":
      return compileObject(node, definitions)
  }

  // Typeless enum / const nodes still map cleanly onto literals.
  if (Array.isArray(enumValues)) return literalUnion(enumValues)
  if ("const" in node) return v.literal(node.const as string | number | boolean)

  throw unsupported(node)
}

function compileObject(node: JsonNode, definitions: Definitions): GenericValidator {
  const properties = (node.properties ?? {}) as Record<string, JsonNode>
  const required = new Set((node.required as Array<string> | undefined) ?? [])
  const fields: Record<string, GenericValidator> = {}
  for (const [key, propertyNode] of Object.entries(properties)) {
    const compiled = compileNode(propertyNode, definitions)
    // Convex expresses optionality at the field, not the value: a property absent
    // from `required` becomes `v.optional(...)`.
    fields[key] = required.has(key) ? compiled : v.optional(compiled)
  }
  return v.object(fields)
}

function compileNative(annotation: ConvexNativeAnnotation): GenericValidator {
  switch (annotation.type) {
    case "id":
      return v.id(annotation.table)
    case "int64":
      return v.int64()
    case "bytes":
      return v.bytes()
  }
}

function literalUnion(values: ReadonlyArray<unknown>): GenericValidator {
  if (values.length === 0) throw new Error("schemaToConvexValidator: empty enum")
  const literals = values.map((value) => v.literal(value as string | number | boolean))
  return collapseUnion(literals)
}

function unionOf(members: Array<GenericValidator>, node: JsonNode): GenericValidator {
  if (members.length === 0) throw unsupported(node, "empty anyOf")
  return collapseUnion(members)
}

/** A one-member union is just that member; otherwise fold into `v.union`. */
function collapseUnion(members: Array<GenericValidator>): GenericValidator {
  if (members.length === 1) return members[0]
  return v.union(
    ...(members as [GenericValidator, GenericValidator, ...Array<GenericValidator>]),
  )
}

function resolveRef(ref: string, definitions: Definitions): JsonNode {
  if (!ref.startsWith(DEF_REF_PREFIX)) {
    throw new Error(`schemaToConvexValidator: unsupported $ref "${ref}"`)
  }
  const name = ref.slice(DEF_REF_PREFIX.length)
  const target = definitions[name]
  if (!target) throw new Error(`schemaToConvexValidator: unresolved $ref "${ref}"`)
  return target
}

function isNumberSentinelUnion(branches: ReadonlyArray<JsonNode>): boolean {
  let sawNumber = false
  for (const branch of branches) {
    const isNumber =
      (branch.type === "number" || branch.type === "integer") && !("enum" in branch)
    if (isNumber) {
      sawNumber = true
      continue
    }
    const enumValues = branch.enum
    const isSentinel =
      branch.type === "string" &&
      Array.isArray(enumValues) &&
      enumValues.length === 1 &&
      NUMBER_SENTINELS.has(enumValues[0] as string)
    if (isSentinel) continue
    return false
  }
  return sawNumber
}

function unsupported(node: JsonNode, detail?: string): Error {
  const suffix = detail ? ` (${detail})` : ""
  return new Error(
    `schemaToConvexValidator: unsupported JSON Schema construct${suffix}: ${JSON.stringify(node)}`,
  )
}
