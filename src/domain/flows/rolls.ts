import { Effect } from "effect"
import { requireMember } from "../authz"
import {
  buildPool,
  rollPool,
  type DiceRollResult,
  type RawPoolComponent,
  type RollVisibility,
} from "../dice"
import { SessionId } from "../ids"
import { GameStore } from "../ports/game-store"

/**
 * `rolls.create` re-implemented through the enforcement seam (ADR-0004, ADR-0007).
 *
 * The tracer bullet: one production flow threading every layer — `requireMember`
 * (auth + authz), the pure `buildPool`/`rollPool` leaves, and one atomic
 * `insertRoll` write (ADR-0009). Only this flow carries `R = GameStore |
 * CurrentActor`; the dice leaves stay `R = never`.
 */

export interface CreateRollArgs {
  readonly sessionId: string
  readonly components: ReadonlyArray<RawPoolComponent>
  readonly againThreshold?: number
  readonly roteAction?: boolean
  readonly visibility?: RollVisibility
}

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
  const member = yield* requireMember(SessionId.make(args.sessionId))

  const pool = yield* buildPool(args.components)
  const rollOptions: {
    visibility: RollVisibility
    againThreshold?: number
    roteAction?: boolean
  } = { visibility: args.visibility ?? "public" }
  if (args.againThreshold != null) rollOptions.againThreshold = args.againThreshold
  if (args.roteAction != null) rollOptions.roteAction = args.roteAction

  const result = yield* rollPool(pool, rollOptions)

  const store = yield* GameStore
  return yield* store.insertRoll({
    sessionId: member.sessionId,
    member,
    components: args.components,
    result,
    summary: rollSummary(member.displayName, result),
  })
})
