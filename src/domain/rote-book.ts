import { Array as Arr, Schema } from "effect"
import type { CharacterSheet, KnownRote } from "./character"
import { resolveRoteAlternatives } from "./rote-cast"
import { calculateRotePool } from "./spellcasting"

/**
 * The Rote book's numbers (issue #89): pure leaves the book's table of
 * contents, pages and recitation trigger all read. Every figure resolves
 * through the deepened rote-cast leaf (issue #87) and the same pool math the
 * cast flows use — the row, the page, the CastPanel and the log can never
 * disagree, and the UI does no arithmetic of its own.
 */

type SheetRatings = Pick<CharacterSheet, "attributes" | "skills" | "arcana" | "order">

/**
 * One numbered alternative on a Rote's page: the resolved traits in the
 * sheet's language, the specialty verdict in the open, and the total the
 * cast will roll before any declared factors.
 */
export const RotePageAlternative = Schema.Struct({
  attribute: Schema.Struct({ name: Schema.String, dots: Schema.Number }),
  /** The skill slot — a handful of book pools rate a second Attribute here. */
  slot: Schema.Struct({
    name: Schema.String,
    dots: Schema.Number,
    kind: Schema.Literals(["skill", "attribute"]),
  }),
  arcanum: Schema.Struct({ name: Schema.String, dots: Schema.Number }),
  specialty: Schema.Struct({ eligible: Schema.Boolean, bonus: Schema.Number }),
  total: Schema.Number,
})
export type RotePageAlternative = typeof RotePageAlternative.Type

/** Every alternative the Rote offers, numbered — one entry per "or" skill. */
export const resolveRotePage = (
  sheet: SheetRatings,
  rote: KnownRote,
): ReadonlyArray<RotePageAlternative> =>
  resolveRoteAlternatives(sheet, rote).map((resolved) => ({
    attribute: resolved.attribute,
    slot: resolved.skill,
    arcanum: resolved.arcanum,
    specialty: resolved.specialty,
    total: calculateRotePool({
      attributeDots: resolved.attribute.dots,
      skillDots: resolved.skill.dots,
      arcanumDots: resolved.arcanum.dots,
      ...(resolved.specialty.eligible
        ? { specialtyBonus: resolved.specialty.bonus }
        : {}),
    }).totalDice,
  }))

/**
 * The contents row's right-hand column — unmistakably dice, never a page
 * number: "8 dice"; an "or" pool names each alternative's skill with its own
 * total, "9 Investigation or 9 Science dice".
 */
export const tocDicePhrase = (
  alternatives: ReadonlyArray<RotePageAlternative>,
): string =>
  alternatives.length === 1
    ? `${alternatives[0]?.total} dice`
    : `${alternatives.map((a) => `${a.total} ${a.slot.name}`).join(" or ")} dice`

/** The recitation trigger's count: alternatives sharing a total collapse to
 * one number ("9 dice"), differing totals each speak once ("9 or 7 dice"). */
export const reciteDiceLabel = (
  alternatives: ReadonlyArray<RotePageAlternative>,
): string =>
  `${Arr.dedupe(alternatives.map((a) => a.total)).join(" or ")} dice`
