import { Schema, SchemaGetter } from "effect"

// World of Darkness three-stage damage system — the one health-box vocabulary
// (ADR-0014). Every module that speaks about wounds imports these; parallel
// copies of the literals are the bug this file exists to prevent.

/** The three kinds of damage a wound can inflict, mildest first. */
export const DamageType = Schema.Literals(["bashing", "lethal", "aggravated"])
export type DamageType = typeof DamageType.Type

/** The mark in a single box's square: unmarked, or one of the three wounds. */
export const BoxSeverity = Schema.Literals(["empty", "bashing", "lethal", "aggravated"])
export type BoxSeverity = typeof BoxSeverity.Type

/**
 * One box on the health track (issue #41): the mark in the square and the dot
 * beneath it. `resistant` is Resistant damage — a property of the individual
 * wound (Paradox Backlash inflicts it), orthogonal to severity, travelling
 * with the wound as the track re-sorts. Recorded and displayed for now; the
 * healing rules that consume it arrive with Life magic.
 */
export const HealthBox = Schema.Struct({
  severity: BoxSeverity,
  resistant: Schema.Boolean,
})
export type HealthBox = typeof HealthBox.Type

/** Box constructor — the pair is two fields; call sites needn't spell both. */
export const healthBox = (severity: BoxSeverity, resistant = false): HealthBox => ({
  severity,
  resistant,
})

/**
 * A box as documents stored before issue #41 hold it: the bare severity
 * string, decoding to a non-resistant box.
 */
const LegacyHealthBox = BoxSeverity.pipe(
  Schema.decodeTo(HealthBox, {
    decode: SchemaGetter.transform((severity) => ({ severity, resistant: false })),
    encode: SchemaGetter.transform((box: HealthBox) => box.severity),
  }),
)

// The full health track is an array of boxes (length = Stamina + Size). The
// decode side admits both stored generations — pairs, and legacy strings as
// all-non-resistant — so pre-#41 character documents keep loading.
export const HealthTrack = Schema.Array(Schema.Union([HealthBox, LegacyHealthBox]))
export type HealthTrack = typeof HealthTrack.Type
