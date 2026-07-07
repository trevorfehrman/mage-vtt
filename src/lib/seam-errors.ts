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

/** Table language for the generic not-found (ADR-0010: one tag, many tables). */
const NOT_FOUND_NOUNS: Record<string, string> = {
  characters: "Character",
  casts: "Cast",
  scenes: "Scene",
  sessions: "Session",
  spells: "Spell",
}

/** Table language for each refusal — total over the union by construction
 * (`tagsExhaustive`: a missing or renamed tag is a compile error here). */
const describe = Match.type<SeamError>().pipe(
  Match.tagsExhaustive({
    ArcanumTooWeak: (e) => `You need ${capitalize(e.arcanum)} ${e.level} — you have ${e.dots}.`,
    InsufficientMana: (e) => `Not enough Mana: need ${e.required}, have ${e.current}.`,
    InsufficientWillpower: () => "No Willpower left to spend.",
    NotYourCharacter: () => "That's not your character.",
    NotAMember: () => "You're not a member of this session.",
    NotStoryteller: () => "That door is the Storyteller's.",
    DocumentNotFound: (e) =>
      `${NOT_FOUND_NOUNS[e.table] ?? "That record"} not found.`,
    InvalidCastDeclaration: () => "That declaration isn't castable.",
    InvalidSheetlessCast: () => `That pool isn't castable (0–${MAX_DECLARED_POOL} dice).`,
    InvalidHandEdit: (e) => e.message,
    InvalidPoolComponent: () => "That pool isn't rollable.",
    VulgarCastingNotYetSupported: (e) => `${e.spellName} is Vulgar — draft it into the Cast ladder with "Draft Vulgar".`,
    SpellNotVulgar: (e) => `${e.spellName} is Covert — cast it directly; the ladder is for Vulgar magic.`,
    RoteNotKnown: (e) => `Your character hasn't trained the Rote "${e.roteName}".`,
    RoteSkillChoiceRequired: (e) => `Pick one skill for this Rote: ${e.alternatives.join(" or ")}.`,
    SceneAlreadyOpen: (e) => `"${e.activeSceneName}" is still open — close it first.`,
    NoActiveScene: () => "No Scene is open.",
    InvalidSceneName: (e) => e.message,
    CastOnStage: (e) => `${e.casterName}'s cast is still on stage — resolve, cancel, or void it first.`,
    CastAlreadyPending: () => "This character already has an unresolved Cast.",
    StageOccupied: (e) => `The stage is taken — ${e.casterName}'s cast is still playing out.`,
    CastStatusConflict: () => "The Cast has moved on — that beat is no longer available.",
    InvalidLiability: (e) => e.message,
    InvalidMitigation: (e) => e.message,
    InvalidContainment: (e) => e.message,
  }),
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
