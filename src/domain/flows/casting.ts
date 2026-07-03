import { Effect, Schema } from "effect"
import { requireMember, requireOwnedCharacter } from "../authz"
import { ArcanumName } from "../character"
import { buildPool, rollPool, type RawPoolComponent } from "../dice"
import { CharacterId, SessionId } from "../ids"
import { improvisedManaCost, spendMana } from "../mana-economy"
import { DocumentNotFound } from "../ports/errors"
import { GameStore } from "../ports/game-store"
import { calculateImprovisedPool, type CastingPool } from "../spellcasting"
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

/** The declared shape of the effect: which Arcanum, at what level (Practice tier). */
const CastDeclaration = Schema.Struct({
  arcanum: ArcanumName,
  level: Schema.Number.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 5 }),
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
  result: DiceRollResult
  manaCost: number
}): string => {
  const dice = input.result.isChanceDie
    ? "a chance die"
    : `${input.result.poolSize} dice`
  return (
    `${input.displayName} cast an improvised ${capitalize(input.arcanum)} ${input.level} spell ` +
    `(${dice}, ${input.manaCost} Mana) and got ${outcomeOf(input.result)}`
  )
}

export const castSpell = Effect.fn("Flows.casting.castSpell")(function* (
  args: CastSpellArgs,
) {
  const member = yield* requireMember(SessionId.make(args.sessionId))

  const declaration = yield* Schema.decodeUnknownEffect(CastDeclaration)({
    arcanum: args.arcanum,
    level: args.level,
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
  if (sheet.sessionId !== member.sessionId) {
    return yield* new DocumentNotFound({ table: "characters", id: args.characterId })
  }

  yield* requireOwnedCharacter(sheet)

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

  const pool = yield* calculateImprovisedPool({
    gnosis: sheet.gnosis,
    arcanumDots: dots,
  })
  yield* assertCovert(pool)

  // Mana: improvised cost by Path (Ruling free, otherwise 1 — computed here,
  // never declared) + whatever the pool itself demands.
  const pathCost = yield* improvisedManaCost(sheet.path, declaration.arcanum)
  const manaCost = pathCost + pool.manaCost
  const manaRemaining = yield* spendMana(sheet.manaCurrent, manaCost)

  const components: ReadonlyArray<RawPoolComponent> = [
    { type: "gnosis", name: "Gnosis", dots: sheet.gnosis },
    { type: "arcanum", name: capitalize(declaration.arcanum), dots },
  ]
  const dicePool = yield* buildPool(components)
  if (dicePool.size !== pool.totalDice) {
    return yield* Effect.die(
      new Error(
        `Invariant violated: cast components sum to ${dicePool.size} dice but the casting pool computed ${pool.totalDice}`,
      ),
    )
  }

  const result = yield* rollPool(dicePool, { visibility: "public" })

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
