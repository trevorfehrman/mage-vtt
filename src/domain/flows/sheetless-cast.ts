import { Effect, Schema } from "effect"
import { requireStoryteller } from "../authz"
import { buildPool, RollVisibility, rollPool, type RawPoolComponent } from "../dice"
import { SessionId } from "../ids"
import { GameStore } from "../ports/game-store"
import { outcomeOf } from "./casting"

/**
 * `castSheetless` — NPC and spirit opposition through the enforcement seam
 * (PRD #11, issue #15). The Storyteller (or Dev) casts with no Character
 * Sheet behind it: a hand-declared dice pool rolled through the same pure
 * dice leaves as ordinary casts, landing in the Activity Log as a Hidden
 * roll by default (NPC spells are usually Hidden regardless of Aspect).
 *
 * Sheet-less means sheet-less: the flow never touches `getSheet`/`patchSheet`,
 * and strictly nothing about the cast persists beyond the one Activity entry —
 * no saved pools, no quick-NPCs, no bestiary (the combat phase's territory).
 */

/** The book never asks for more; anything bigger is a typo, not a titan. */
export const MAX_DECLARED_POOL = 30

export const SheetlessCastArgs = Schema.Struct({
  sessionId: Schema.String,
  /** The hand-declared final pool — the ST did the math. */
  poolSize: Schema.Number,
  /** Table visibility; a sheet-less cast is Hidden unless declared otherwise. */
  visibility: Schema.optionalKey(RollVisibility),
})
export type SheetlessCastArgs = typeof SheetlessCastArgs.Type

// --- Errors (ADR-0010) ---

/** Validation: the declared pool is not a castable size. */
export class InvalidSheetlessCast extends Schema.TaggedErrorClass<InvalidSheetlessCast>()(
  "InvalidSheetlessCast",
  { message: Schema.String },
) {}

const DeclaredPool = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 0, maximum: MAX_DECLARED_POOL }),
)

export const castSheetless = Effect.fn("Flows.sheetlessCast.castSheetless")(
  function* (args: SheetlessCastArgs) {
    const poolSize = yield* Schema.decodeUnknownEffect(DeclaredPool)(
      args.poolSize,
    ).pipe(
      Effect.mapError(
        () =>
          new InvalidSheetlessCast({
            message: `Not a castable pool: ${args.poolSize} (0–${MAX_DECLARED_POOL} dice)`,
          }),
      ),
    )

    const member = yield* requireStoryteller(SessionId.make(args.sessionId))

    // The declared pool, chunked to fit a component's dots range so the
    // breakdown stays representable in the Activity entry.
    const components: Array<RawPoolComponent> = []
    let rest = poolSize
    for (; rest > 10; rest -= 10) {
      components.push({ type: "modifier", name: "Declared pool", dots: 10 })
    }
    components.push({ type: "modifier", name: "Declared pool", dots: rest })

    const pool = yield* buildPool(components)
    const result = yield* rollPool(pool, {
      visibility: args.visibility ?? "hidden",
    })

    const dice = result.isChanceDie ? "a chance die" : `${result.poolSize} dice`
    const store = yield* GameStore
    return yield* store.insertRoll({
      sessionId: member.sessionId,
      member,
      components,
      result,
      summary: `${member.displayName} cast a sheet-less spell (${dice}) and got ${outcomeOf(result)}`,
    })
  },
)
