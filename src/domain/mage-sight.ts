import { Schema } from "effect"

// Pure rules leaves (ADR-0014): plain functions — nothing here fails or
// touches the world.

// --- Types ---

export class MageSightActivation extends Schema.Class<MageSightActivation>("MageSightActivation")({
  manaCost: Schema.Number.check(Schema.isInt()),
  primaryArcanum: Schema.String,
  primaryDots: Schema.Number.check(Schema.isInt()),
}) {}

export class MageSightPool extends Schema.Class<MageSightPool>("MageSightPool")({
  totalDice: Schema.Number.check(Schema.isInt()),
  isExtended: Schema.Boolean,
}) {}

// --- Public API ---

export const activateMageSight = (input: {
  arcana: Record<string, number>
}): MageSightActivation => {
  // Highest arcanum wins; ties keep the first seen.
  const [primaryArcanum, primaryDots] = Object.entries(input.arcana).reduce<
    [string, number]
  >(
    ([bestName, bestDots], [name, dots]) =>
      dots > bestDots ? [name, dots] : [bestName, bestDots],
    ["", 0],
  )

  return new MageSightActivation({
    manaCost: 1,
    primaryArcanum,
    primaryDots,
  })
}

export const peripheralMageSightPool = (input: {
  wits: number
  composure: number
}): MageSightPool =>
  new MageSightPool({
    totalDice: input.wits + input.composure,
    isExtended: false,
  })

export const scrutinyPool = (input: {
  intelligence: number
  arcanumDots: number
}): MageSightPool =>
  new MageSightPool({
    totalDice: input.intelligence + input.arcanumDots,
    isExtended: true,
  })
