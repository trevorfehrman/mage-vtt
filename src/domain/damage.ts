import { Schema } from "effect"

// World of Darkness three-stage damage system
export class Bashing extends Schema.TaggedClass<Bashing>()("Bashing", {}) {}
export class Lethal extends Schema.TaggedClass<Lethal>()("Lethal", {}) {}
export class Aggravated extends Schema.TaggedClass<Aggravated>()(
  "Aggravated",
  {},
) {}

export const DamageType = Schema.Union([Bashing, Lethal, Aggravated])
export type DamageType = typeof DamageType.Type

// A single box on the health track
export const HealthBox = Schema.Literals(["empty", "bashing", "lethal", "aggravated"])
export type HealthBox = typeof HealthBox.Type

// The full health track is an array of boxes (length = Stamina + Size)
export const HealthTrack = Schema.Array(HealthBox)
export type HealthTrack = typeof HealthTrack.Type
