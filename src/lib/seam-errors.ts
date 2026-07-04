import { ConvexError } from "convex/values"
import { MAX_DECLARED_POOL } from "#/domain/flows/sheetless-cast"

/**
 * One shared mapping from the seam's tagged errors (ADR-0010) to readable
 * messages, so every form speaks the same language and new tags get one home.
 * `overrides` lets a call site sharpen a message for its context (e.g. the
 * dice pool's Willpower spend); `fallback` handles non-seam failures.
 */

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function seamErrorMessage(
  err: unknown,
  opts: {
    overrides?: Record<string, string>
    fallback?: string | ((err: unknown) => string)
  } = {},
): string {
  if (err instanceof ConvexError && typeof err.data === "object" && err.data !== null) {
    const data = err.data as Record<string, unknown>
    const tag = String(data._tag ?? "")
    const override = opts.overrides?.[tag]
    if (override) return override
    switch (tag) {
      case "ArcanumTooWeak":
        return `You need ${capitalize(String(data.arcanum))} ${data.level} — you have ${data.dots}.`
      case "InsufficientMana":
        return `Not enough Mana: need ${data.required}, have ${data.current}.`
      case "InsufficientWillpower":
        return "No Willpower left to spend."
      case "NotYourCharacter":
        return "That's not your character."
      case "NotAMember":
        return "You're not a member of this session."
      case "NotStoryteller":
        return "Sheet-less casting is the Storyteller's door."
      case "DocumentNotFound":
        return "Character not found."
      case "InvalidCastDeclaration":
        return "That declaration isn't castable."
      case "InvalidSheetlessCast":
        return `That pool isn't castable (0–${MAX_DECLARED_POOL} dice).`
    }
  }
  const fallback = opts.fallback
  return typeof fallback === "function"
    ? fallback(err)
    : (fallback ?? "Something went wrong.")
}
