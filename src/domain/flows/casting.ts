import { Effect, Schema } from "effect"
import { requireOwnedCharacter } from "../authz"
import { ArcanumName } from "../character"
import { buildPool, rollPool, type RawPoolComponent, type RollVisibility } from "../dice"
import { CharacterId, SessionId } from "../ids"
import { improvisedManaCost, spendMana } from "../mana-economy"
import { DocumentNotFound } from "../ports/errors"
import { GameStore } from "../ports/game-store"
import {
  applySpellFactors,
  calculateImprovisedPool,
  type CastingPool,
} from "../spellcasting"
import type { DiceRollResult } from "../dice"

/**
 * `castSpell` — a Covert improvised cast through the enforcement seam (ADR-0004,
 * ADR-0007 thread #2, ADR-0008).
 *
 * The player declares an Arcanum and the effect's level (its Practice); the
 * server verifies authority over the sheet, checks the Arcanum dots meet the
 * declaration, computes and spends the Mana cost (never client-declared), rolls
 * Gnosis + Arcanum, and writes one sheet patch plus one self-describing Roll
 * entry (ADR-0009/0012 — the feed narrates the cast; no structured spell
 * columns). Atomicity is inherited from the Convex transaction: any failure
 * aborts every write.
 *
 * Sympathetic casting is unrepresentable in the args (it would force Vulgar),
 * and the flow dies if the computed pool reports Vulgar anyway — two layers
 * against silently casting Vulgar with no Paradox (ADR-0008).
 */

export interface CastSpellArgs {
  readonly sessionId: string
  readonly characterId: string
  readonly arcanum: string
  readonly level: number
  /** Spell factor: effect Potency beyond 1 costs dice (book table). */
  readonly potency?: number
  /** Spell factor: targets beyond 1 cost dice (book table). */
  readonly targets?: number
  /** High Speech: +2 dice. */
  readonly highSpeech?: boolean
  /**
   * Declared additional Mana, for improvised effects replicating book spells
   * that list a cost. Whether it applies is table adjudication; once declared,
   * the deduction is mechanical — on top of the server-computed Path cost.
   */
  readonly extraManaCost?: number
  /** Table visibility of the roll (a Hidden roll) — orthogonal to the Covert Aspect. */
  readonly visibility?: RollVisibility
}

// --- Errors (ADR-0010) ---

/** Rules/precondition: the declared effect level exceeds the caster's dots. */
export class ArcanumTooWeak extends Schema.TaggedErrorClass<ArcanumTooWeak>()(
  "ArcanumTooWeak",
  {
    arcanum: Schema.String,
    level: Schema.Number,
    dots: Schema.Number,
  },
) {}

/** Validation: the declaration itself is malformed (unknown Arcanum, level outside 1–5). */
export class InvalidCastDeclaration extends Schema.TaggedErrorClass<InvalidCastDeclaration>()(
  "InvalidCastDeclaration",
  { message: Schema.String },
) {}

/** The declared shape of the effect: Arcanum, level (Practice tier), factors. */
const CastDeclaration = Schema.Struct({
  arcanum: ArcanumName,
  level: Schema.Number.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 5 }),
  ),
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
})

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const outcomeOf = (result: DiceRollResult): string =>
  result.isDramaticFailure
    ? "a dramatic failure!"
    : result.isExceptionalSuccess
      ? `an exceptional success (${result.successes} successes)!`
      : `${result.successes} ${result.successes === 1 ? "success" : "successes"}`

const castSummary = (input: {
  displayName: string
  arcanum: string
  level: number
  factors: ReadonlyArray<string>
  result: DiceRollResult
  manaCost: number
}): string => {
  const dice = input.result.isChanceDie
    ? "a chance die"
    : `${input.result.poolSize} dice`
  const factors = input.factors.length > 0 ? ` with ${input.factors.join(", ")}` : ""
  return (
    `${input.displayName} cast an improvised ${capitalize(input.arcanum)} ${input.level} spell` +
    `${factors} (${dice}, ${input.manaCost} Mana) and got ${outcomeOf(input.result)}`
  )
}

export const castSpell = Effect.fn("Flows.casting.castSpell")(function* (
  args: CastSpellArgs,
) {
  const declaration = yield* Schema.decodeUnknownEffect(CastDeclaration)({
    arcanum: args.arcanum,
    level: args.level,
    ...(args.potency !== undefined ? { potency: args.potency } : {}),
    ...(args.targets !== undefined ? { targets: args.targets } : {}),
    ...(args.highSpeech !== undefined ? { highSpeech: args.highSpeech } : {}),
    ...(args.extraManaCost !== undefined
      ? { extraManaCost: args.extraManaCost }
      : {}),
  }).pipe(
    Effect.mapError(
      () =>
        new InvalidCastDeclaration({
          message: `Not a castable declaration: ${args.arcanum} ${args.level}`,
        }),
    ),
  )

  const store = yield* GameStore
  const characterId = CharacterId.make(args.characterId)
  const sheet = yield* store.getSheet(characterId)

  // Scoped read: a character outside this session isn't there, as far as this
  // session's flows are concerned.
  if (sheet.sessionId !== SessionId.make(args.sessionId)) {
    return yield* new DocumentNotFound({ table: "characters", id: args.characterId })
  }

  // The authority ladder (ADR-0006): owner unmarked, ST/Dev with an Override
  // recorded into request scope, anyone else refused. Deliberately not
  // requireMember — a Dev may cast in a session they aren't a member of.
  yield* requireOwnedCharacter(sheet)

  // Attribution follows the character's owner (ADR-0006): the entry is the
  // owner's action in their visibility scope, whoever invoked it.
  const member = yield* store.getMembership(sheet.sessionId, sheet.userId)

  // Move rule: the sheet's Arcanum dots must meet the declared level (the
  // Practices ladder). Which level an improvised effect *is* stays table
  // adjudication; enforcing the declaration is mechanical.
  const dots = sheet.arcana[declaration.arcanum] ?? 0
  if (dots < declaration.level) {
    return yield* new ArcanumTooWeak({
      arcanum: declaration.arcanum,
      level: declaration.level,
      dots,
    })
  }

  const basePool = yield* calculateImprovisedPool({
    gnosis: sheet.gnosis,
    arcanumDots: dots,
    ...(declaration.highSpeech ? { highSpeech: true } : {}),
  })
  const pool = yield* applySpellFactors(basePool, {
    ...(declaration.potency !== undefined ? { potency: declaration.potency } : {}),
    ...(declaration.targets !== undefined ? { targets: declaration.targets } : {}),
  })
  yield* assertCovert(pool)

  // Mana: improvised cost by Path (Ruling free, otherwise 1 — computed here,
  // never declared) + whatever the pool itself demands + the declared extra.
  const pathCost = yield* improvisedManaCost(sheet.path, declaration.arcanum)
  const manaCost = pathCost + pool.manaCost + (declaration.extraManaCost ?? 0)
  const manaRemaining = yield* spendMana(sheet.manaCurrent, manaCost)

  const components: ReadonlyArray<RawPoolComponent> = [
    { type: "gnosis", name: "Gnosis", dots: sheet.gnosis },
    { type: "arcanum", name: capitalize(declaration.arcanum), dots },
    ...(declaration.highSpeech
      ? [{ type: "modifier", name: "High Speech", dots: 2 }]
      : []),
    ...(pool.factorPenalty !== 0
      ? [{ type: "modifier", name: "Spell factors", dots: pool.factorPenalty }]
      : []),
  ]
  const dicePool = yield* buildPool(components)
  if (dicePool.size !== pool.totalDice) {
    return yield* Effect.die(
      new Error(
        `Invariant violated: cast components sum to ${dicePool.size} dice but the casting pool computed ${pool.totalDice}`,
      ),
    )
  }

  const result = yield* rollPool(dicePool, {
    visibility: args.visibility ?? "public",
  })

  yield* store.patchSheet(sheet.id, { manaCurrent: manaRemaining })
  return yield* store.insertRoll({
    sessionId: member.sessionId,
    member,
    components,
    result,
    summary: castSummary({
      displayName: member.displayName,
      arcanum: declaration.arcanum,
      level: declaration.level,
      factors: [
        ...(declaration.potency && declaration.potency > 1
          ? [`Potency ${declaration.potency}`]
          : []),
        ...(declaration.targets && declaration.targets > 1
          ? [`${declaration.targets} targets`]
          : []),
        ...(declaration.highSpeech ? ["High Speech"] : []),
      ],
      result,
      manaCost,
    }),
  })
})

/**
 * Defect-level invariant (ADR-0008): this flow exists only for Covert casting —
 * a Vulgar pool here means the flow itself is buggy, not that the caller erred,
 * so it dies rather than failing with a client-dispatchable tag.
 */
const assertCovert = (pool: CastingPool) =>
  pool.isVulgar
    ? Effect.die(
        new Error("Invariant violated: Covert improvised cast computed a Vulgar pool"),
      )
    : Effect.void
