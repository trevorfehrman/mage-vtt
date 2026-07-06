import { Schema } from "effect"

// Pure rules leaves (ADR-0014): plain functions — nothing here fails or
// touches the world.

// --- Types ---

export class CounterspellCheck extends Schema.Class<CounterspellCheck>("CounterspellCheck")({
  canCounter: Schema.Boolean,
  arcanumUsed: Schema.optional(Schema.String),
}) {}

export class CounterspellPool extends Schema.Class<CounterspellPool>("CounterspellPool")({
  totalDice: Schema.Number.check(Schema.isInt()),
}) {}

export class DispelResult extends Schema.Class<DispelResult>("DispelResult")({
  dispelled: Schema.Boolean,
  dispelSuccesses: Schema.Number.check(Schema.isInt()),
  targetPotency: Schema.Number.check(Schema.isInt()),
}) {}

// --- Public API ---

export const canCounterspell = (input: {
  casterArcana: Record<string, number>
  targetSpellArcanum: string
}): CounterspellCheck => {
  // Can counter with matching arcanum (at least 1 dot)
  const matchingDots = input.casterArcana[input.targetSpellArcanum.toLowerCase()]
  if (matchingDots && matchingDots >= 1) {
    return new CounterspellCheck({
      canCounter: true,
      arcanumUsed: input.targetSpellArcanum.toLowerCase(),
    })
  }

  // Can counter any spell with Prime (at least 1 dot)
  const primeDots = input.casterArcana["prime"]
  if (primeDots && primeDots >= 1) {
    return new CounterspellCheck({
      canCounter: true,
      arcanumUsed: "prime",
    })
  }

  return new CounterspellCheck({ canCounter: false })
}

export const calculateCounterspellPool = (input: {
  gnosis: number
  arcanumDots: number
}): CounterspellPool =>
  new CounterspellPool({
    totalDice: input.gnosis + input.arcanumDots,
  })

export const resolveDispel = (input: {
  dispelSuccesses: number
  targetPotency: number
}): DispelResult =>
  new DispelResult({
    dispelled: input.dispelSuccesses >= input.targetPotency,
    dispelSuccesses: input.dispelSuccesses,
    targetPotency: input.targetPotency,
  })
