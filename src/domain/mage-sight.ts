import { Effect, Schema } from "effect"

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

export const activateMageSight = Effect.fn("MageSight.activate")(function* (input: {
  arcana: Record<string, number>
}) {
  // Find highest arcanum
  let primaryArcanum = ""
  let primaryDots = 0

  for (const [name, dots] of Object.entries(input.arcana)) {
    if (dots > primaryDots) {
      primaryArcanum = name
      primaryDots = dots
    }
  }

  return new MageSightActivation({
    manaCost: 1,
    primaryArcanum,
    primaryDots,
  })
})

export const peripheralMageSightPool = Effect.fn("MageSight.peripheralPool")(function* (input: {
  wits: number
  composure: number
}) {
  return new MageSightPool({
    totalDice: input.wits + input.composure,
    isExtended: false,
  })
})

export const scrutinyPool = Effect.fn("MageSight.scrutinyPool")(function* (input: {
  intelligence: number
  arcanumDots: number
}) {
  return new MageSightPool({
    totalDice: input.intelligence + input.arcanumDots,
    isExtended: true,
  })
})
