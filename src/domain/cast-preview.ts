import { Option } from "effect"
import type { ArcanumName, CharacterSheet, KnownRote } from "./character"
import { factorPenaltyComponents } from "./flows/casting"
import { improvisedManaCost } from "./mana-economy"
import { resolveRotePoolChoice, type ResolvedRotePool } from "./rote-cast"
import {
  applySpellFactors,
  calculateImprovisedPool,
  calculateRotePool,
} from "./spellcasting"
import { WILLPOWER_BONUS_DICE, WILLPOWER_COMPONENT_NAME } from "./willpower-economy"
import type { RawPoolComponent } from "./dice"
import { toGnosisRank, type TidesSnapshot } from "./cast"
import { calculateParadoxPool } from "./paradox"

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

/**
 * Both leaves are plain functions returning `Option` (issue #51, ADR-0014):
 * `None` marks a preview that cannot be computed — a missing "or" pick, or a
 * leaf refusing degenerate input. The panel degrades to no readout either
 * way; the server recomputes and refuses with its typed tag.
 */

// A pure preview (ADR-0014): every leaf it composes is a plain function, so
// the improvised readout is one itself.
export const previewImprovisedCast: (input: {
  sheet: Pick<CharacterSheet, "path" | "gnosis" | "arcana" | "knowsHighSpeech">
  arcanum: ArcanumName
  potency?: number
  targets?: number
  highSpeech?: boolean
  extraManaCost?: number
  spendWillpower?: boolean
}) => Option.Option<CastPreview> = Option.liftThrowable((input) => {
  const dots = input.sheet.arcana[input.arcanum] ?? 0
  // The chant is the Merit's (MAG-59): the preview mirrors the server, which
  // refuses High Speech to a sheet without it, so a Merit-less sheet previews
  // no +2 rather than promising dice the roll will never get.
  const chant = input.highSpeech === true && input.sheet.knowsHighSpeech
  const basePool = calculateImprovisedPool({
    gnosis: input.sheet.gnosis,
    arcanumDots: dots,
    ...(chant ? { highSpeech: true } : {}),
    ...(input.spendWillpower ? { willpower: true } : {}),
  })
  const pool = applySpellFactors(basePool, {
    ...(input.potency !== undefined ? { potency: input.potency } : {}),
    ...(input.targets !== undefined ? { targets: input.targets } : {}),
  })

  const pathCost = improvisedManaCost(input.sheet.path, input.arcanum)

  const components: ReadonlyArray<RawPoolComponent> = [
    { type: "gnosis", name: "Gnosis", dots: input.sheet.gnosis },
    { type: "arcanum", name: capitalize(input.arcanum), dots },
    ...(chant ? [{ type: "modifier", name: "High Speech", dots: 2 }] : []),
    ...(input.spendWillpower
      ? [{ type: "modifier", name: WILLPOWER_COMPONENT_NAME, dots: WILLPOWER_BONUS_DICE }]
      : []),
    ...factorPenaltyComponents(pool),
  ]

  const dice = Math.max(pool.totalDice, 0)
  return {
    components,
    dice,
    isChanceDie: dice === 0,
    manaCost: pathCost + pool.manaCost + (input.extraManaCost ?? 0),
  }
})

type RotePreviewInput = {
  sheet: Pick<CharacterSheet, "attributes" | "skills" | "arcana" | "order" | "knowsHighSpeech">
  rote: KnownRote
  skillChoice?: string
  potency?: number
  targets?: number
  highSpeech?: boolean
  extraManaCost?: number
  spendWillpower?: boolean
}

export const previewRoteCast = (input: RotePreviewInput): Option.Option<CastPreview> =>
  Option.flatMap(
    resolveRotePoolChoice(input.sheet, input.rote, input.skillChoice),
    Option.liftThrowable((resolved: ResolvedRotePool) => rotePreview(input, resolved)),
  )

const rotePreview = (input: RotePreviewInput, resolved: ResolvedRotePool): CastPreview => {
  // The chant is the Merit's (MAG-59), on a Rote as on an improvisation.
  const chant = input.highSpeech === true && input.sheet.knowsHighSpeech
  const basePool = calculateRotePool({
    attributeDots: resolved.attribute.dots,
    skillDots: resolved.skill.dots,
    arcanumDots: resolved.arcanum.dots,
    ...(resolved.specialty.eligible
      ? { specialtyBonus: resolved.specialty.bonus }
      : {}),
    ...(chant ? { highSpeech: true } : {}),
    ...(input.spendWillpower ? { willpower: true } : {}),
  })
  const pool = applySpellFactors(basePool, {
    ...(input.potency !== undefined ? { potency: input.potency } : {}),
    ...(input.targets !== undefined ? { targets: input.targets } : {}),
  })

  const components: ReadonlyArray<RawPoolComponent> = [
    { type: "attribute", name: resolved.attribute.name, dots: resolved.attribute.dots },
    { type: resolved.skill.kind, name: resolved.skill.name, dots: resolved.skill.dots },
    { type: "arcanum", name: resolved.arcanum.name, dots: resolved.arcanum.dots },
    ...(resolved.specialty.eligible
      ? [{ type: "modifier", name: "Rote Specialty", dots: resolved.specialty.bonus }]
      : []),
    ...(chant ? [{ type: "modifier", name: "High Speech", dots: 2 }] : []),
    ...(input.spendWillpower
      ? [{ type: "modifier", name: WILLPOWER_COMPONENT_NAME, dots: WILLPOWER_BONUS_DICE }]
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
}

/**
 * The Paradox pool a vulgar cast would start from (MAG-32): what the sealed
 * trigger's vulgar half names before the caster opens it — the book's base
 * for the caster's Gnosis, the rote and magical-tool discounts, and the
 * Scene's Tides seed (`sceneTides`). The Storyteller's personal adjustments
 * and the caster's Mana mitigation come later, on the Cast card; the fixed
 * seed stamped at the Tides rung stays the authority.
 */
export const previewParadoxDice = (input: {
  sheet: CharacterSheet
  isRote: boolean
  tides: TidesSnapshot
}): number =>
  calculateParadoxPool({
    gnosis: toGnosisRank(input.sheet.gnosis),
    isRote: input.isRote,
    usesMagicalTool: input.sheet.magicalTool,
    witnessCount: input.tides.witnessCount,
    priorParadoxRollsThisScene: input.tides.priorParadoxRolls,
    discretionaryModifiers: input.tides.circumstances,
  }).totalDice
