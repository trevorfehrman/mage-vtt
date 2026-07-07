/**
 * Convex-Effect Bridge (Convex runtime copy)
 *
 * Convex bundles separately from the app — this is a local copy of the bridge
 * from src/domain/convex-effect.ts so Convex mutations can run Effect pipelines.
 */

import { Cause, Effect, Exit } from "effect"
import { ConvexError } from "convex/values"
import { DocumentNotFound } from "../../src/domain/ports/errors"

// --- Errors ---

// DocumentNotFound is defined once in the domain ports (ADR-0010); re-export for
// Convex-runtime consumers of this bridge copy.
export { DocumentNotFound }

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

/**
 * A typed refusal on the wire (ADR-0010), built from a domain tagged error:
 * the payload shape has one owner, so a renamed field can't silently drift
 * away from the client's decode union. The cast is the seam's one honest lie —
 * `mapEffectError` copies unknown-typed fields, `ConvexError` wants `Value`;
 * every field crossing here is Schema-defined and Convex-serializable.
 */
export const seamRefusal = (error: { readonly _tag: string }) =>
  new ConvexError(mapEffectError(error) as Record<string, string>)

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
