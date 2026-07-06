import { Schema } from "effect"

// World of Darkness three-stage damage system — the one health-box vocabulary
// (ADR-0014). Every module that speaks about wounds imports these; parallel
// copies of the literals are the bug this file exists to prevent.

/** The three kinds of damage a wound can inflict, mildest first. */
export const DamageType = Schema.Literals(["bashing", "lethal", "aggravated"])
export type DamageType = typeof DamageType.Type

/** The four states a single box on the health track can hold. */
export const HealthBox = Schema.Literals(["empty", "bashing", "lethal", "aggravated"])
export type HealthBox = typeof HealthBox.Type

// The full health track is an array of boxes (length = Stamina + Size)
export const HealthTrack = Schema.Array(HealthBox)
export type HealthTrack = typeof HealthTrack.Type
