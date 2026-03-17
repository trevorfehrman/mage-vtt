/**
 * Convex-Effect Bridge (Convex runtime copy)
 *
 * Convex bundles separately from the app — this is a local copy of the bridge
 * from src/domain/convex-effect.ts so Convex mutations can run Effect pipelines.
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

export function mapEffectError(error: unknown): Record<string, unknown> {
  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>
    const data: Record<string, unknown> = {}

    if ("_tag" in obj) {
      data._tag = obj._tag
    }

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
      const reasons = cause.reasons

      const failReason = reasons.find(Cause.isFailReason)
      if (failReason) {
        throw new ConvexError(mapEffectError(failReason.error) as Record<string, string>)
      }

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
