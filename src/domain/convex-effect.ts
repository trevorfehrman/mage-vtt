/**
 * Convex-Effect Bridge
 *
 * Connects Effect domain logic to Convex's runtime.
 *
 * 1. runConvexEffect: Effect<A, E> → Promise<A>
 *    Typed errors → ConvexError with structured data (preserving _tag).
 *    Defects → thrown Error.
 *
 * 2. mapEffectError: Extract structured error data for serialization.
 *
 * 3. wrapNullable: Convex null → Effect<T, DocumentNotFound>.
 *
 * Effect.fn spans are preserved for OpenTelemetry.
 */

import { Cause, Effect, Exit, Schema } from "effect"
import { ConvexError } from "convex/values"

// --- Errors ---

export class DocumentNotFound extends Schema.TaggedErrorClass<DocumentNotFound>()(
  "DocumentNotFound",
  {
    table: Schema.String,
    id: Schema.String,
  },
) {}

// --- Error mapping ---

/**
 * Extract structured error data for serialization to the client.
 * Handles both Schema.TaggedErrorClass instances and plain objects with _tag.
 */
export function mapEffectError(error: unknown): Record<string, unknown> {
  if (error && typeof error === "object") {
    // For Schema.TaggedErrorClass, properties may be on the prototype
    // or defined via Object.defineProperty. Use a manual approach.
    const obj = error as Record<string, unknown>
    const data: Record<string, unknown> = {}

    // Get _tag first
    if ("_tag" in obj) {
      data._tag = obj._tag
    }

    // Get all own and prototype properties (Schema.Class uses getters)
    const proto = Object.getPrototypeOf(obj)
    const allKeys = new Set([
      ...Object.getOwnPropertyNames(obj),
      ...(proto ? Object.getOwnPropertyNames(proto) : []),
    ])

    for (const key of allKeys) {
      if (key.startsWith("_") && key !== "_tag") continue
      if (key === "constructor" || key === "toString" || key === "toJSON") continue
      try {
        const val = (obj as any)[key]
        if (typeof val !== "function") {
          data[key] = val
        }
      } catch {
        // Skip inaccessible properties
      }
    }

    if (data._tag) return data

    // No _tag — wrap as unknown
    if (error instanceof Error) {
      return { _tag: "UnknownError", message: error.message }
    }
  }

  return { _tag: "UnknownError", message: String(error) }
}

// --- Bridge ---

export async function runConvexEffect<A>(
  effect: Effect.Effect<A, unknown, never>,
): Promise<A> {
  const exit = await Effect.runPromiseExit(effect)

  return Exit.match(exit, {
    onSuccess: (value) => value,
    onFailure: (cause) => {
      // v4: cause.reasons is a flat array of Reason values
      const reasons = cause.reasons

      // Find first typed error (Fail reason)
      const failReason = reasons.find(Cause.isFailReason)
      if (failReason) {
        throw new ConvexError(mapEffectError(failReason.error))
      }

      // Find first defect (Die reason)
      const dieReason = reasons.find(Cause.isDieReason)
      if (dieReason) {
        const defect = dieReason.defect
        if (defect instanceof Error) throw defect
        throw new Error(String(defect))
      }

      throw new Error("Effect failed with unknown cause")
    },
  })
}

// --- Nullable wrapping ---

export function wrapNullable<T>(
  value: T | null | undefined,
  table: string,
  id: string,
): Effect.Effect<T, DocumentNotFound> {
  if (value == null) {
    return Effect.fail(new DocumentNotFound({ table, id }))
  }
  return Effect.succeed(value)
}
