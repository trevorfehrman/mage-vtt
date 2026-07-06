import { Schema } from "effect"

/**
 * The branded game quantities (issue #35) — one home, the `ids` module's
 * precedent applied to the numbers the game plays with. Each brand carries
 * its range check, so the brand and the validation live together: a Mana
 * value can no longer pass where dots are expected, and the compiler says so.
 *
 * Ranges encode *representability* (ADR-0011), not creation legality — a
 * fudged sheet must never brick on decode. Creation-strict ranges (1–5 dots
 * and kin) stay with the creation rules in `character.ts`. Gnosis as a
 * rules-legal rank already has a vocabulary home (`GnosisRank` in
 * `mana-economy.ts`, sweep ②); on the sheet it is `Dots` like any rating.
 * Dice *counts* stay plain numbers on purpose: they never leave `dice.ts`'s
 * internals, and brands earn their keep at module boundaries.
 */

/** A rated trait as the sheet represents it: 0–10 (Gnosis 6+ raises caps). */
export const Dots = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 0, maximum: 10 }),
).pipe(Schema.brand("Dots"))
export type Dots = typeof Dots.Type

/** Mana points — a sheet's pool box or a cast's cost: never negative; the box is capped by Gnosis at layer 3. */
export const Mana = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
).pipe(Schema.brand("Mana"))
export type Mana = typeof Mana.Type

/** Willpower points in the sheet's pool box: never negative, capped by rating at layer 3. */
export const Willpower = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
).pipe(Schema.brand("Willpower"))
export type Willpower = typeof Willpower.Type

/** One pool component's contribution: a trait's dots or a modifier, penalties negative. */
export const ComponentDots = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: -10, maximum: 10 }),
).pipe(Schema.brand("ComponentDots"))
export type ComponentDots = typeof ComponentDots.Type

/** An assembled pool's size: contributions summed; zero or below rolls a chance die. */
export const PoolSize = Schema.Number.check(Schema.isInt()).pipe(
  Schema.brand("PoolSize"),
)
export type PoolSize = typeof PoolSize.Type

/** Rolled successes: a count, never negative. */
export const Successes = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
).pipe(Schema.brand("Successes"))
export type Successes = typeof Successes.Type

/** Initiative ticks (ADR-0001): time owed on the tick track, never negative. */
export const Ticks = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
).pipe(Schema.brand("Ticks"))
export type Ticks = typeof Ticks.Type
