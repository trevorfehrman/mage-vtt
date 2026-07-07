/**
 * Convex-Effect Bridge (Convex runtime copy)
 *
 * Convex bundles separately from the app — this is a local copy of the bridge
 * from src/domain/convex-effect.ts so Convex mutations can run Effect pipelines.
 */

import { Cause, Effect, Exit } from "effect"
import { ConvexError, type Value } from "convex/values"
import { DocumentNotFound } from "../../src/domain/ports/errors"

// --- Errors ---

// DocumentNotFound is defined once in the domain ports (ADR-0010); re-export for
// Convex-runtime consumers of this bridge copy.
export { DocumentNotFound }

// --- Error mapping ---

/**
 * Runtime check for Convex's `Value` (what a `ConvexError` payload may carry).
 * Objects must be plain records — a `Date`/`RegExp`/class instance has no
 * Convex wire form and must drop at this seam, not explode in the serializer.
 */
function isValue(v: unknown): v is Value {
  if (v === null) return true
  const t = typeof v
  if (t === "string" || t === "number" || t === "boolean" || t === "bigint") return true
  if (v instanceof ArrayBuffer) return true
  if (Array.isArray(v)) return v.every(isValue)
  if (t === "object") {
    const proto = Object.getPrototypeOf(v)
    if (proto !== Object.prototype && proto !== null) return false
    return Object.values(v).every((x) => x === undefined || isValue(x))
  }
  return false
}

export function mapEffectError(error: unknown): Record<string, Value> {
  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>
    const data: Record<string, Value> = {}

    if (typeof obj._tag === "string") {
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
        const val = obj[key]
        if (isValue(val)) {
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
 * away from the client's decode union. Cast-free: `mapEffectError` copies
 * only fields that pass the `isValue` check, so its return *is* a payload.
 */
export const seamRefusal = (error: { readonly _tag: string }) =>
  new ConvexError(mapEffectError(error))

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
        throw new ConvexError(mapEffectError(failReason.error))
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
