import { Effect } from "effect"
import type { ArcanumName, CharacterSheet, KnownRote } from "./character"
import { factorPenaltyComponents } from "./flows/casting"
import { improvisedManaCost } from "./mana-economy"
import { resolveRotePool } from "./rote-cast"
import {
  applySpellFactors,
  calculateImprovisedPool,
  calculateRotePool,
} from "./spellcasting"
import { WILLPOWER_BONUS_DICE } from "./willpower-economy"
import type { RawPoolComponent } from "./dice"

/**
 * The casting UX's live readout (PRD #11, issue #20): a client-side preview of
 * what the cast flows will compute, built from the same pure leaves the flows
 * use — never a reimplementation. The server stays authoritative (the preview
 * writes nothing and rolls nothing); this exists so the pre-roll panel can show
 * the pool and Mana cost as declarations change, drift-free.
 */

export interface CastPreview {
  /** The pool components exactly as the flow will record them on the entry. */
  readonly components: ReadonlyArray<RawPoolComponent>
  /** Effective dice, floored at 0 — 0 rolls a chance die. */
  readonly dice: number
  readonly isChanceDie: boolean
  /** The full server-computed Mana cost, including the declared extra. */
  readonly manaCost: number
  /** A contested Rote's target traits — the Storyteller's pool to roll. */
  readonly contestedVs?: ReadonlyArray<string>
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const previewImprovisedCast = Effect.fn("CastPreview.improvised")(
  function* (input: {
    sheet: Pick<CharacterSheet, "path" | "gnosis" | "arcana">
    arcanum: ArcanumName
    potency?: number
    targets?: number
    highSpeech?: boolean
    extraManaCost?: number
    spendWillpower?: boolean
  }) {
    const dots = input.sheet.arcana[input.arcanum] ?? 0
    const basePool = yield* calculateImprovisedPool({
      gnosis: input.sheet.gnosis,
      arcanumDots: dots,
      ...(input.highSpeech ? { highSpeech: true } : {}),
      ...(input.spendWillpower ? { willpower: true } : {}),
    })
    const pool = yield* applySpellFactors(basePool, {
      ...(input.potency !== undefined ? { potency: input.potency } : {}),
      ...(input.targets !== undefined ? { targets: input.targets } : {}),
    })

    const pathCost = yield* improvisedManaCost(input.sheet.path, input.arcanum)

    const components: ReadonlyArray<RawPoolComponent> = [
      { type: "gnosis", name: "Gnosis", dots: input.sheet.gnosis },
      { type: "arcanum", name: capitalize(input.arcanum), dots },
      ...(input.highSpeech
        ? [{ type: "modifier", name: "High Speech", dots: 2 }]
        : []),
      ...(input.spendWillpower
        ? [{ type: "modifier", name: "Willpower", dots: WILLPOWER_BONUS_DICE }]
        : []),
      ...factorPenaltyComponents(pool),
    ]

    const dice = Math.max(pool.totalDice, 0)
    return {
      components,
      dice,
      isChanceDie: dice === 0,
      manaCost: pathCost + pool.manaCost + (input.extraManaCost ?? 0),
    } satisfies CastPreview
  },
)

export const previewRoteCast = Effect.fn("CastPreview.rote")(function* (input: {
  sheet: Pick<CharacterSheet, "attributes" | "skills" | "arcana">
  rote: KnownRote
  skillChoice?: string
  potency?: number
  targets?: number
  highSpeech?: boolean
  extraManaCost?: number
  spendWillpower?: boolean
}) {
  const resolved = yield* resolveRotePool(input.sheet, input.rote, input.skillChoice)

  const basePool = yield* calculateRotePool({
    attributeDots: resolved.attribute.dots,
    skillDots: resolved.skill.dots,
    arcanumDots: resolved.arcanum.dots,
    ...(input.highSpeech ? { highSpeech: true } : {}),
    ...(input.spendWillpower ? { willpower: true } : {}),
  })
  const pool = yield* applySpellFactors(basePool, {
    ...(input.potency !== undefined ? { potency: input.potency } : {}),
    ...(input.targets !== undefined ? { targets: input.targets } : {}),
  })

  const components: ReadonlyArray<RawPoolComponent> = [
    { type: "attribute", name: resolved.attribute.name, dots: resolved.attribute.dots },
    { type: resolved.skill.kind, name: resolved.skill.name, dots: resolved.skill.dots },
    { type: "arcanum", name: resolved.arcanum.name, dots: resolved.arcanum.dots },
    ...(input.highSpeech
      ? [{ type: "modifier", name: "High Speech", dots: 2 }]
      : []),
    ...(input.spendWillpower
      ? [{ type: "modifier", name: "Willpower", dots: WILLPOWER_BONUS_DICE }]
      : []),
    ...factorPenaltyComponents(pool),
  ]

  const dice = Math.max(pool.totalDice, 0)
  return {
    components,
    dice,
    isChanceDie: dice === 0,
    // No Path cost for a Rote — the pool's own demand plus the declared extra.
    manaCost: pool.manaCost + (input.extraManaCost ?? 0),
    ...(input.rote.pool.vs ? { contestedVs: input.rote.pool.vs } : {}),
  } satisfies CastPreview
})
