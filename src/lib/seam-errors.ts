import { ConvexError } from "convex/values"
import { Match, Option, Schema } from "effect"
import { MAX_DECLARED_POOL } from "#/domain/flows/sheetless-cast"
import { SeamError, type SeamErrorTag } from "#/domain/seam-errors"

/**
 * One shared mapping from the seam's tagged errors (ADR-0010) to readable
 * messages: the `ConvexError` payload is decoded against the domain's
 * `SeamError` union, then matched exhaustively — so a renamed or newly-added
 * tag is a compile error here, not a silent degradation to the fallback.
 * Decode failure (a defect, a network error, a tag this client predates) still
 * falls through generically, preserving ADR-0010's forward compatibility.
 * `overrides` lets a call site sharpen a message for its context (typed by
 * tag); `fallback` handles non-seam failures.
 */

const decodeSeamError = Schema.decodeUnknownOption(SeamError)

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Table language for each refusal — total over the union by construction. */
const describe = (error: SeamError): string =>
  Match.value(error).pipe(
    Match.tag("ArcanumTooWeak", (e) => `You need ${capitalize(e.arcanum)} ${e.level} — you have ${e.dots}.`),
    Match.tag("InsufficientMana", (e) => `Not enough Mana: need ${e.required}, have ${e.current}.`),
    Match.tag("InsufficientWillpower", () => "No Willpower left to spend."),
    Match.tag("NotYourCharacter", () => "That's not your character."),
    Match.tag("NotAMember", () => "You're not a member of this session."),
    Match.tag("NotStoryteller", () => "Sheet-less casting is the Storyteller's door."),
    Match.tag("DocumentNotFound", () => "Character not found."),
    Match.tag("InvalidCastDeclaration", () => "That declaration isn't castable."),
    Match.tag("InvalidSheetlessCast", () => `That pool isn't castable (0–${MAX_DECLARED_POOL} dice).`),
    Match.tag("InvalidHandEdit", (e) => e.message),
    Match.tag("InvalidPoolComponent", () => "That pool isn't rollable."),
    Match.tag("VulgarCastingNotYetSupported", (e) => `${e.spellName} is Vulgar — Vulgar casting awaits the Paradox phase.`),
    Match.tag("RoteNotKnown", (e) => `Your character hasn't trained the Rote "${e.roteName}".`),
    Match.tag("RoteSkillChoiceRequired", (e) => `Pick one skill for this Rote: ${e.alternatives.join(" or ")}.`),
    Match.exhaustive,
  )

/** A seam refusal the UI can dispatch on: the typed tag plus its table language. */
export interface SeamFailure {
  readonly tag: SeamErrorTag
  readonly message: string
}

/** Decode a thrown value against the seam's contract; null = not a seam refusal. */
export function seamFailure(err: unknown): SeamFailure | null {
  if (!(err instanceof ConvexError)) return null
  const decoded = decodeSeamError(err.data)
  return Option.isSome(decoded)
    ? { tag: decoded.value._tag, message: describe(decoded.value) }
    : null
}

export function seamErrorMessage(
  err: unknown,
  opts: {
    overrides?: Partial<Record<SeamErrorTag, string>>
    fallback?: string | ((err: unknown) => string)
  } = {},
): string {
  const failure = seamFailure(err)
  if (failure) return opts.overrides?.[failure.tag] ?? failure.message
  const fallback = opts.fallback
  return typeof fallback === "function"
    ? fallback(err)
    : (fallback ?? "Something went wrong.")
}
