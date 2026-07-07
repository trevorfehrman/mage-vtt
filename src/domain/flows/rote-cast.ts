import { Effect, Schema } from "effect"
import { requireSessionCharacter } from "../authz"
import { buildPool, RollVisibility, rollPool, type RawPoolComponent } from "../dice"
import { CharacterId, SessionId } from "../ids"
import { spendMana } from "../mana-economy"
import { GameStore } from "../ports/game-store"
import { Mana } from "../quantities"
import { requireCovertSpell, resolveRotePool, type SpellRef } from "../rote-cast"
import { applySpellFactors, calculateRotePool } from "../spellcasting"
import { spendWillpower, WILLPOWER_BONUS_DICE } from "../willpower-economy"
import type { CharacterSheet, KnownRote } from "../character"
import type { DiceRollResult } from "../dice"
import { factorPenaltyComponents, InvalidCastDeclaration, outcomeOf } from "./casting"

/**
 * `castRote` — a Player casts a Rote their character trained, through the
 * enforcement seam (PRD #11, issue #18).
 *
 * The Rote lives on the sheet (`knownRotes`, issue #16); the flow resolves its
 * structured pool against the caster's own ratings — Attribute + Skill +
 * Arcanum — reads the spell's reference row for the Aspect gate (Vulgar is
 * refused until the Paradox phase; aspect gates, method does not), and lands
 * one sheet patch plus one self-describing Roll entry (ADR-0009). Casting a
 * Rote does NOT grant the rote-quality reroll — the glossary namespace trap:
 * "Rote" the trained spell and "rote action" the dice quality are different
 * things. A contested pool's target traits are recorded in the entry summary
 * for the Storyteller to roll (sheet-less) or adjudicate; there is no
 * contested resolution this phase.
 *
 * Mana: a Rote skips the improvised Path cost — its server-computed cost is
 * what the pool itself demands plus any declared extra (a book-listed cost is
 * table adjudication, same convention as the improvised flow).
 */

export const CastRoteArgs = Schema.Struct({
  sessionId: Schema.String,
  characterId: Schema.String,
  /** The Rote's name as the sheet's `knownRotes` carries it. */
  roteName: Schema.String,
  /** Required when the Rote's pool offers "or" alternatives. */
  skillChoice: Schema.optionalKey(Schema.String),
  /** Spell factor: effect Potency beyond 1 costs dice (book table). */
  potency: Schema.optionalKey(Schema.Number),
  /** Spell factor: targets beyond 1 cost dice (book table). */
  targets: Schema.optionalKey(Schema.Number),
  /** High Speech: +2 dice. */
  highSpeech: Schema.optionalKey(Schema.Boolean),
  /** Declared additional Mana for spells listing a cost — table adjudication,
   * mechanical deduction once declared. */
  extraManaCost: Schema.optionalKey(Schema.Number),
  /** Willpower spend: +3 dice, one point off the sheet (issue #12). */
  spendWillpower: Schema.optionalKey(Schema.Boolean),
  /** Table visibility of the roll — orthogonal to the Covert Aspect. */
  visibility: Schema.optionalKey(RollVisibility),
})
export type CastRoteArgs = typeof CastRoteArgs.Type

// --- Errors (ADR-0010) ---

/** Rules/precondition: the character never trained this Rote. */
export class RoteNotKnown extends Schema.TaggedErrorClass<RoteNotKnown>()(
  "RoteNotKnown",
  {
    characterId: CharacterId,
    roteName: Schema.String,
  },
) {}

/**
 * The move rule shared by every rote lane (here and the vulgar draft's,
 * issue #47): the character casts the Rotes they trained — the sheet's
 * knownRotes list is the qualification, not a dot check (ADR-0011: a fudged
 * sheet still casts).
 */
export const requireKnownRote = Effect.fn("Flows.roteCast.requireKnownRote")(
  function* (sheet: CharacterSheet, roteName: string) {
    const rote = sheet.rotes.find((r) => r.name === roteName)
    if (!rote) {
      return yield* new RoteNotKnown({ characterId: sheet.id, roteName })
    }
    return rote
  },
)

/** The declared shape of the cast: which Rote, the pick, the factors. */
const RoteDeclaration = Schema.Struct({
  roteName: Schema.String,
  skillChoice: Schema.optional(Schema.String),
  potency: Schema.optional(
    Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)),
  ),
  targets: Schema.optional(
    Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)),
  ),
  highSpeech: Schema.optional(Schema.Boolean),
  extraManaCost: Schema.optional(
    Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  ),
  spendWillpower: Schema.optional(Schema.Boolean),
})

const roteSummary = (input: {
  displayName: string
  rote: KnownRote
  /** The reference row narrates the spell — not the sheet's denormalized copy,
   * which can drift from the book data. */
  spell: SpellRef
  factors: ReadonlyArray<string>
  result: DiceRollResult
  manaCost: number
}): string => {
  const dice = input.result.isChanceDie
    ? "a chance die"
    : `${input.result.poolSize} dice`
  const factors = input.factors.length > 0 ? ` with ${input.factors.join(", ")}` : ""
  const contested = input.rote.pool.vs
    ? ` — contested vs ${input.rote.pool.vs.join(" + ")}, the target's pool is the Storyteller's to roll`
    : ""
  return (
    `${input.displayName} cast the Rote "${input.rote.name}" ` +
    `(${input.spell.name}, ${input.spell.arcanum} ${input.spell.level})` +
    `${factors} (${dice}, ${input.manaCost} Mana) and got ${outcomeOf(input.result)}` +
    contested
  )
}

export const castRote = Effect.fn("Flows.roteCast.castRote")(function* (
  args: CastRoteArgs,
) {
  const declaration = yield* Schema.decodeUnknownEffect(RoteDeclaration)({
    roteName: args.roteName,
    ...(args.skillChoice !== undefined ? { skillChoice: args.skillChoice } : {}),
    ...(args.potency !== undefined ? { potency: args.potency } : {}),
    ...(args.targets !== undefined ? { targets: args.targets } : {}),
    ...(args.highSpeech !== undefined ? { highSpeech: args.highSpeech } : {}),
    ...(args.extraManaCost !== undefined
      ? { extraManaCost: args.extraManaCost }
      : {}),
    ...(args.spendWillpower !== undefined
      ? { spendWillpower: args.spendWillpower }
      : {}),
  }).pipe(
    Effect.mapError(
      () =>
        new InvalidCastDeclaration({
          message: `Not a castable declaration: the Rote "${args.roteName}"`,
        }),
    ),
  )

  const store = yield* GameStore

  // Scoped read + the authority ladder (ADR-0006), same door as every
  // sheet-funded action.
  const sheet = yield* requireSessionCharacter(
    SessionId.make(args.sessionId),
    CharacterId.make(args.characterId),
  )

  const rote = yield* requireKnownRote(sheet, declaration.roteName)

  // Attribution follows the character's owner (ADR-0006).
  const member = yield* store.getMembership(sheet.sessionId, sheet.userId)

  // The spell reference row, by the Rote's business key: the Aspect gate reads
  // reference data, never client input (PRD #11 — aspect gates, method does not).
  const spell = yield* store.getSpell(rote.spellName, rote.spellArcanum)
  yield* requireCovertSpell(spell)

  const resolved = yield* resolveRotePool(sheet, rote, declaration.skillChoice)

  const basePool = calculateRotePool({
    attributeDots: resolved.attribute.dots,
    skillDots: resolved.skill.dots,
    arcanumDots: resolved.arcanum.dots,
    ...(declaration.highSpeech ? { highSpeech: true } : {}),
    ...(declaration.spendWillpower ? { willpower: true } : {}),
  })
  const pool = applySpellFactors(basePool, {
    ...(declaration.potency !== undefined ? { potency: declaration.potency } : {}),
    ...(declaration.targets !== undefined ? { targets: declaration.targets } : {}),
  })

  // Mana: no Path cost for a Rote — the pool's own demand plus the declared
  // extra, computed here and never client-totalled.
  const manaCost = Mana.make(pool.manaCost + (declaration.extraManaCost ?? 0))
  const manaRemaining = yield* spendMana(sheet.manaCurrent, manaCost)

  // Willpower: declared, checked before anything rolls or writes (issue #12).
  const willpowerRemaining = declaration.spendWillpower
    ? yield* spendWillpower(sheet.willpowerCurrent)
    : null

  const penaltyComponents = factorPenaltyComponents(pool)

  const components: ReadonlyArray<RawPoolComponent> = [
    { type: "attribute", name: resolved.attribute.name, dots: resolved.attribute.dots },
    { type: resolved.skill.kind, name: resolved.skill.name, dots: resolved.skill.dots },
    { type: "arcanum", name: resolved.arcanum.name, dots: resolved.arcanum.dots },
    ...(declaration.highSpeech
      ? [{ type: "modifier", name: "High Speech", dots: 2 }]
      : []),
    ...(declaration.spendWillpower
      ? [{ type: "modifier", name: "Willpower", dots: WILLPOWER_BONUS_DICE }]
      : []),
    ...penaltyComponents,
  ]
  const dicePool = yield* buildPool(components)
  const expectedDice = Math.max(pool.totalDice, 0)
  if (dicePool.size !== expectedDice) {
    return yield* Effect.die(
      new Error(
        `Invariant violated: rote components sum to ${dicePool.size} dice but the casting pool computed ${expectedDice}`,
      ),
    )
  }

  // Deliberately no `roteAction` option: the trained Rote is not the
  // rote-quality dice reroll (the glossary namespace trap).
  const result = yield* rollPool(dicePool, {
    visibility: args.visibility ?? "public",
  })

  yield* store.patchSheet(sheet.id, {
    manaCurrent: manaRemaining,
    ...(willpowerRemaining !== null ? { willpowerCurrent: willpowerRemaining } : {}),
  })
  return yield* store.insertRoll({
    sessionId: member.sessionId,
    member,
    components,
    result,
    summary: roteSummary({
      displayName: member.displayName,
      rote,
      spell,
      factors: [
        `${resolved.attribute.name} + ${resolved.skill.name} + ${resolved.arcanum.name}`,
        ...(declaration.potency && declaration.potency > 1
          ? [`Potency ${declaration.potency}`]
          : []),
        ...(declaration.targets && declaration.targets > 1
          ? [`${declaration.targets} targets`]
          : []),
        ...(declaration.highSpeech ? ["High Speech"] : []),
        ...(declaration.spendWillpower ? ["Willpower"] : []),
      ],
      result,
      manaCost,
    }),
  })
})
