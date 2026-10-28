import { Effect, Schema } from "effect"
import { tableName } from "../membership"
import { requireMember, requireSessionCharacter } from "../authz"
import {
  buildPool,
  InvalidPoolComponent,
  RawPoolComponent,
  RollVisibility,
  rollPool,
  type DiceRollResult,
} from "../dice"
import { CharacterId, SessionId } from "../ids"
import { GameStore } from "../ports/game-store"
import { spendWillpower, WILLPOWER_BONUS_DICE } from "../willpower-economy"
import { spendDestiny } from "../destiny-economy"
import { Destiny, type Willpower } from "../quantities"

/**
 * `rolls.create` re-implemented through the enforcement seam (ADR-0004, ADR-0007).
 *
 * The tracer bullet: one production flow threading every layer — `requireMember`
 * (auth + authz), the pure `buildPool`/`rollPool` leaves, and one atomic
 * `insertRoll` write (ADR-0009). Only this flow carries `R = GameStore |
 * CurrentActor`; the dice leaves stay `R = never`.
 *
 * A declared Willpower spend (issue #12) funds +3 dice from a character sheet:
 * the shape makes a sheet-less spend unrepresentable, the authority ladder
 * (ADR-0006) guards whose Willpower it is, and the +3 component is
 * server-added — never client-declared.
 */

export const CreateRollArgs = Schema.Struct({
  sessionId: Schema.String,
  components: Schema.Array(RawPoolComponent),
  againThreshold: Schema.optionalKey(Schema.Number),
  roteAction: Schema.optionalKey(Schema.Boolean),
  visibility: Schema.optionalKey(RollVisibility),
  /**
   * The sheet this pool was built from. Anchoring a roll walks the authority
   * ladder over that sheet (ADR-0006: owner unmarked, ST/Dev Override-marked)
   * and attribution follows the sheet's owner, exactly as casting does.
   * Absent = a free pool, the roller's own act.
   */
  characterId: Schema.optionalKey(Schema.String),
  /** Declared Willpower spend: +3 dice, funded by this character's sheet. */
  willpower: Schema.optionalKey(Schema.Struct({ characterId: Schema.String })),
})
export type CreateRollArgs = typeof CreateRollArgs.Type

const rollSummary = (displayName: string, result: DiceRollResult): string => {
  const outcome = result.isDramaticFailure
    ? "a dramatic failure!"
    : result.isExceptionalSuccess
      ? `an exceptional success (${result.successes} successes)!`
      : `${result.successes} ${result.successes === 1 ? "success" : "successes"}`
  const dice = result.isChanceDie ? "a chance die" : `${result.poolSize} dice`
  return `${displayName} rolled ${dice} and got ${outcome}`
}

export const createRoll = Effect.fn("Flows.rolls.create")(function* (
  args: CreateRollArgs,
) {
  const sessionId = SessionId.make(args.sessionId)
  const store = yield* GameStore

  // A sheet-anchored pool is that character's roll: walk the authority ladder
  // over the sheet (owner unmarked, ST/Dev with Override — ADR-0006) and
  // attribute to its owner, whoever invoked it — the same shape as casting.
  // A free pool stays the roller's own act, attributed to their membership.
  let member
  if (args.characterId) {
    const sheet = yield* requireSessionCharacter(
      sessionId,
      CharacterId.make(args.characterId),
    )
    member = yield* store.getMembership(sheet.sessionId, sheet.userId)
  } else {
    member = yield* requireMember(sessionId)
  }

  // No pending-cast lock here (MAG-50, loosening issue #109): a plain pool
  // roll is never held by a live Cast — the Storyteller's hidden spot roll
  // before the Tides, the spot check they call from the caster mid-Paradox.
  // The lock still holds every casting door and initiative.

  // A declared Willpower spend: resolve the funding sheet, walk the authority
  // ladder, and check the pool before anything rolls or writes.
  let willpowerSpend: { characterId: CharacterId; remaining: Willpower } | null = null
  let components = args.components
  if (args.willpower) {
    const sheet = yield* requireSessionCharacter(
      member.sessionId,
      CharacterId.make(args.willpower.characterId),
    )

    const remaining = yield* spendWillpower(sheet.willpowerCurrent)
    willpowerSpend = { characterId: sheet.id, remaining }
    components = [
      ...args.components,
      { type: "modifier", name: "Willpower", dots: WILLPOWER_BONUS_DICE },
    ]
  }

  // Staged Destiny (MAG-67): the purse components' dice leave the anchoring
  // sheet's purse on resolve. A free pool has no purse to fund them.
  const staged = components
    .filter((c) => c.type === "purse")
    .reduce((sum, c) => sum + c.dots, 0)
  let destinySpend: { characterId: CharacterId; remaining: Destiny } | null = null
  if (staged > 0) {
    if (!args.characterId) {
      return yield* new InvalidPoolComponent({
        message: "Destiny is a spend — it needs your sheet to fund it.",
      })
    }
    const sheet = yield* requireSessionCharacter(
      member.sessionId,
      CharacterId.make(args.characterId),
    )
    const remaining = yield* spendDestiny(Destiny.make(sheet.destiny), staged)
    destinySpend = { characterId: sheet.id, remaining }
  }

  const pool = yield* buildPool(components)
  const rollOptions: {
    visibility: RollVisibility
    againThreshold?: number
    roteAction?: boolean
  } = { visibility: args.visibility ?? "public" }
  if (args.againThreshold != null) rollOptions.againThreshold = args.againThreshold
  if (args.roteAction != null) rollOptions.roteAction = args.roteAction

  const result = yield* rollPool(pool, rollOptions)

  if (willpowerSpend) {
    yield* store.patchSheet(willpowerSpend.characterId, {
      willpowerCurrent: willpowerSpend.remaining,
    })
  }
  if (destinySpend) {
    yield* store.patchSheet(destinySpend.characterId, {
      destinyCurrent: destinySpend.remaining,
    })
  }
  return yield* store.insertRoll({
    sessionId: member.sessionId,
    member,
    components,
    result,
    summary: rollSummary(tableName(member), result),
  })
})
