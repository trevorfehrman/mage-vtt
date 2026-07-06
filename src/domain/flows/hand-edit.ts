import { Effect, Schema } from "effect"
import { getSessionScopedSheet, requireRepairAuthority } from "../authz"
import { type CharacterSheet } from "../character"
import { HealthTrack, type HealthBox } from "../damage"
import { CharacterId, SessionId } from "../ids"
import { GameStore, type SheetPatch } from "../ports/game-store"

/**
 * `handEditSheet` — the fudge/repair path (PRD #11, issue #19): a direct,
 * free-form change to a Character Sheet's current-state values, made outside
 * any game action.
 *
 * The authority ladder is **inverted** (`requireRepairAuthority`): the owning
 * Player is rejected — players change their sheet only through actions — and
 * only the session's Storyteller or a Dev pass, every accepted edit stamped
 * with a `repair` Override (ADR-0006) and narrated as one system Activity
 * entry (ADR-0003/0009). The editable surface is exactly the narrow
 * `SheetPatch` port admits (ADR-0011's compensating control); its checks
 * encode representability, not game legality — fudging is the point.
 *
 * Capacity is shape (owner call 2026-07-05): a pool's printed size — Mana's
 * Gnosis cap, Willpower's rating, the health track's box count — is the form
 * itself, derived from other stats, so a hand edit fills the form and never
 * resizes it. `current ≤ max` is representability, not a game rule; raising a
 * cap means editing the stat that prints it, when such a door exists. Encoded
 * here as layer-3 move rules per ADR-0011's tightening prescription.
 */

export interface HandEditArgs {
  readonly sessionId: string
  readonly characterId: string
  readonly manaCurrent?: number
  readonly willpowerCurrent?: number
  readonly healthTrack?: ReadonlyArray<string>
}

// --- Errors (ADR-0010) ---

/** Validation: the edit is empty or a value doesn't fit the sheet's boxes. */
export class InvalidHandEdit extends Schema.TaggedErrorClass<InvalidHandEdit>()(
  "InvalidHandEdit",
  { message: Schema.String },
) {}

/** Non-negative integer — what a current-points box can represent. */
const BoxValue = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
)

/** The hand-editable surface: the sheet's current-state values, nothing else. */
const HandEditPatch = Schema.Struct({
  manaCurrent: Schema.optionalKey(BoxValue),
  willpowerCurrent: Schema.optionalKey(BoxValue),
  healthTrack: Schema.optionalKey(HealthTrack),
})

/** "clear" | "1 bashing" | "2 lethal, 1 aggravated" — the track, narrated. */
const describeTrack = (track: ReadonlyArray<HealthBox>): string => {
  const wounds = (["bashing", "lethal", "aggravated"] as const)
    .map((state) => [state, track.filter((box) => box === state).length] as const)
    .filter(([, count]) => count > 0)
    .map(([state, count]) => `${count} ${state}`)
  return wounds.length > 0 ? wounds.join(", ") : "clear"
}

const describeChanges = (
  sheet: CharacterSheet,
  patch: typeof HandEditPatch.Type,
): string =>
  [
    ...(patch.manaCurrent !== undefined
      ? [`Mana ${sheet.manaCurrent} → ${patch.manaCurrent}`]
      : []),
    ...(patch.willpowerCurrent !== undefined
      ? [`Willpower ${sheet.willpowerCurrent} → ${patch.willpowerCurrent}`]
      : []),
    ...(patch.healthTrack !== undefined
      ? [`Health ${describeTrack(sheet.healthTrack)} → ${describeTrack(patch.healthTrack)}`]
      : []),
  ].join(", ")

export const handEditSheet = Effect.fn("Flows.handEdit.handEditSheet")(function* (
  args: HandEditArgs,
) {
  const patch: SheetPatch = yield* Schema.decodeUnknownEffect(HandEditPatch)({
    ...(args.manaCurrent !== undefined ? { manaCurrent: args.manaCurrent } : {}),
    ...(args.willpowerCurrent !== undefined
      ? { willpowerCurrent: args.willpowerCurrent }
      : {}),
    ...(args.healthTrack !== undefined ? { healthTrack: args.healthTrack } : {}),
  }).pipe(
    Effect.mapError(
      () => new InvalidHandEdit({ message: "That value doesn't fit the sheet." }),
    ),
  )

  if (
    patch.manaCurrent === undefined &&
    patch.willpowerCurrent === undefined &&
    patch.healthTrack === undefined
  ) {
    return yield* new InvalidHandEdit({ message: "Nothing to edit." })
  }

  const store = yield* GameStore

  const sheet = yield* getSessionScopedSheet(
    SessionId.make(args.sessionId),
    CharacterId.make(args.characterId),
  )

  // The inverted ladder: owner rejected, ST/Dev pass, repair Override recorded.
  const editor = yield* requireRepairAuthority(SessionId.make(args.sessionId))

  // Capacity is shape: pools fill to their printed size, the track keeps its
  // box count — a hand edit fills the form, it doesn't resize it.
  if (patch.manaCurrent !== undefined && patch.manaCurrent > sheet.maxMana) {
    return yield* new InvalidHandEdit({
      message: `Mana holds at most ${sheet.maxMana} at Gnosis ${sheet.gnosis}.`,
    })
  }
  if (
    patch.willpowerCurrent !== undefined &&
    patch.willpowerCurrent > sheet.willpower
  ) {
    return yield* new InvalidHandEdit({
      message: `Willpower holds at most ${sheet.willpower}.`,
    })
  }
  if (
    patch.healthTrack !== undefined &&
    patch.healthTrack.length !== sheet.healthTrack.length
  ) {
    return yield* new InvalidHandEdit({
      message: `The health track has ${sheet.healthTrack.length} boxes.`,
    })
  }

  const changes = describeChanges(sheet, patch)
  yield* store.patchSheet(sheet.id, patch)

  // One system Activity entry, attributed to the editor — the write helper
  // stamps the recorded Override structurally (ADR-0006).
  return yield* store.insertMessage({
    sessionId: sheet.sessionId,
    sender: { userId: editor.userId, displayName: editor.displayName },
    text: `${editor.displayName} hand-edited ${sheet.name}: ${changes}`,
    visibility: "system",
  })
})
