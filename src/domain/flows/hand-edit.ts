import { Clock, Effect, Match, Option, Schema } from "effect"
import {
  getSessionScopedSheet,
  requireRepairAuthority,
  requireSessionCharacter,
} from "../authz"
import { type CharacterSheet } from "../character"
import {
  DamageType,
  HealthTrack,
  normalizeHealthTrack,
  type HealthBox,
} from "../damage"
import {
  bedlamHold,
  DerangementName,
  derangement as derangementDef,
  hangingFromDot,
  holdWords,
  lostDotHold,
  shedBoughtBack,
  standingDerangements,
  type HeldDerangement,
} from "../derangements"
import { CharacterId, PlayerId, SessionId } from "../ids"
import { tableName } from "../membership"
import { CurrentActor } from "../ports/current-actor"
import { GameStore, type SheetPatch } from "../ports/game-store"
import { Destiny, Experience, Mana, Willpower } from "../quantities"
import { WisdomRank } from "../wisdom"

/**
 * The sheet's three doors outside any game action: `handEditSheet`, the
 * Storyteller's repair; `markSheet`, the player's own mark (MAG-63); and
 * `setMagicalTool`, the standing tool fact. The first two share one body
 * (`recordSheetChange`) and differ in their ladder and their verb.
 *
 * `handEditSheet` — the fudge/repair path (PRD #11, issue #19): a direct,
 * free-form change to a Character Sheet's current-state values, made outside
 * any game action.
 *
 * The authority ladder is **inverted** (`requireRepairAuthority`): the owning
 * Player is rejected — a player's own marks go through `markSheet`, their
 * other changes through actions — and
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

export const HandEditArgs = Schema.Struct({
  sessionId: Schema.String,
  characterId: Schema.String,
  manaCurrent: Schema.optionalKey(Schema.Number),
  willpowerCurrent: Schema.optionalKey(Schema.Number),
  /** Boxes arrive as (severity, resistant) pairs (issue #41). Legacy bare
   * strings live only in stored documents, normalized at the sheet decode —
   * the wire speaks the pair. */
  healthTrack: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({ severity: Schema.String, resistant: Schema.Boolean }),
    ),
  ),
  /** Wisdom (MAG-56): degeneration and recovery, the Storyteller's to record
   * here; the owner marks their own through `markSheet`. */
  wisdom: Schema.optionalKey(Schema.Number),
  /** Unspent experience (MAG-57): the Storyteller's record of what the mage
   * has to spend. */
  experienceUnspent: Schema.optionalKey(Schema.Number),
})
export type HandEditArgs = typeof HandEditArgs.Type

// --- Errors (ADR-0010) ---

/** Validation: the edit is empty or a value doesn't fit the sheet's boxes. */
export class InvalidHandEdit extends Schema.TaggedError<InvalidHandEdit>()(
  "InvalidHandEdit",
  { message: Schema.String },
) {}

/**
 * The hand-editable surface: the sheet's current-state values, nothing else.
 * The point boxes decode straight to the branded quantities (issue #35) —
 * their non-negative-integer checks are exactly what a box can represent.
 */
const HandEditPatch = Schema.Struct({
  manaCurrent: Schema.optionalKey(Mana),
  willpowerCurrent: Schema.optionalKey(Willpower),
  destinyCurrent: Schema.optionalKey(Destiny),
  healthTrack: Schema.optionalKey(HealthTrack),
  wisdom: Schema.optionalKey(WisdomRank),
  experienceUnspent: Schema.optionalKey(Experience),
})

/** "clear" | "1 bashing" | "2 lethal (1 resistant), 1 aggravated" — the
 * track, narrated; resistant dots (issue #41) counted per severity. */
const describeTrack = (track: ReadonlyArray<HealthBox>): string => {
  const wounds = DamageType.literals
    .map((severity) => {
      const marked = track.filter((box) => box.severity === severity)
      const resistant = marked.filter((box) => box.resistant).length
      return [severity, marked.length, resistant] as const
    })
    .filter(([, count]) => count > 0)
    .map(([severity, count, resistant]) =>
      resistant > 0
        ? `${count} ${severity} (${resistant} resistant)`
        : `${count} ${severity}`,
    )
  return wounds.length > 0 ? wounds.join(", ") : "clear"
}

const describeChanges = (sheet: CharacterSheet, patch: SheetPatch): string =>
  [
    ...(patch.manaCurrent !== undefined
      ? [`Mana ${sheet.manaCurrent} → ${patch.manaCurrent}`]
      : []),
    ...(patch.willpowerCurrent !== undefined
      ? [`Willpower ${sheet.willpowerCurrent} → ${patch.willpowerCurrent}`]
      : []),
    ...(patch.destinyCurrent !== undefined
      ? [`Destiny ${sheet.destiny} → ${patch.destinyCurrent}`]
      : []),
    ...(patch.healthTrack !== undefined
      ? [`Health ${describeTrack(sheet.healthTrack)} → ${describeTrack(patch.healthTrack)}`]
      : []),
    ...(patch.wisdom !== undefined ? [`Wisdom ${sheet.wisdom} → ${patch.wisdom}`] : []),
    ...(patch.experienceUnspent !== undefined
      ? [`Experience ${sheet.experience} → ${patch.experienceUnspent}`]
      : []),
    ...(patch.derangements !== undefined
      ? [describeDerangements(sheet, patch.derangements)]
      : []),
  ].join(", ")

/** "Derangements none → Phobia (dot 7)" — the held list, each with what it
 * hangs from; the Bedlam clock is named by the sheet's Wisdom at the mark. */
const describeDerangements = (
  sheet: CharacterSheet,
  next: ReadonlyArray<HeldDerangement>,
): string => {
  const words = (held: ReadonlyArray<HeldDerangement>) =>
    held.length === 0
      ? "none"
      : held.map((d) => `${d.name} (${holdWords(d, sheet.wisdom)})`).join(", ")
  return `Derangements ${words(sheet.derangementsHeld)} → ${words(next)}`
}

/** Who made the change, as the Activity entry names them. */
interface SheetChangeBy {
  readonly userId: PlayerId
  readonly tableName: string
}

/**
 * The body both doors share once their ladder has passed: the track keeps
 * its box count (capacity is shape), the patch lands, and one system
 * Activity entry narrates it in the actor's name with the door's verb — the
 * write helper stamps any recorded Override structurally (ADR-0006).
 */
const recordSheetChange = Effect.fn("Flows.handEdit.recordSheetChange")(function* (
  sheet: CharacterSheet,
  by: SheetChangeBy,
  verb: string,
  patch: SheetPatch,
) {
  if (
    patch.healthTrack !== undefined &&
    patch.healthTrack.length !== sheet.healthTrack.length
  ) {
    return yield* new InvalidHandEdit({
      message: `The health track has ${sheet.healthTrack.length} boxes.`,
    })
  }
  // A bought-back dot takes its derangement with it (MAG-60): the patch that
  // raises Wisdom also sheds whatever hung from the dots now held again, so
  // the next loss of the same dot starts clean.
  const shed =
    patch.wisdom !== undefined && patch.derangements === undefined
      ? shedBoughtBack(sheet.derangementsHeld, patch.wisdom)
      : undefined
  const settled: SheetPatch =
    shed !== undefined && shed.length !== sheet.derangementsHeld.length
      ? { ...patch, derangements: shed }
      : patch
  const store = yield* GameStore
  const changes = describeChanges(sheet, settled)
  yield* store.patchSheet(sheet.id, settled)
  return yield* store.insertMessage({
    sessionId: sheet.sessionId,
    sender: { userId: by.userId, displayName: by.tableName },
    text: `${by.tableName} ${verb} ${sheet.name}: ${changes}`,
    visibility: "system",
  })
})

export const handEditSheet = Effect.fn("Flows.handEdit.handEditSheet")(function* (
  args: HandEditArgs,
) {
  const decoded = yield* Schema.decodeUnknownEffect(HandEditPatch)({
    ...(args.manaCurrent !== undefined ? { manaCurrent: args.manaCurrent } : {}),
    ...(args.willpowerCurrent !== undefined
      ? { willpowerCurrent: args.willpowerCurrent }
      : {}),
    ...(args.healthTrack !== undefined ? { healthTrack: args.healthTrack } : {}),
    ...(args.wisdom !== undefined ? { wisdom: args.wisdom } : {}),
    ...(args.experienceUnspent !== undefined
      ? { experienceUnspent: args.experienceUnspent }
      : {}),
  }).pipe(
    Effect.mapError(
      () => new InvalidHandEdit({ message: "That value doesn't fit the sheet." }),
    ),
  )
  // The box invariant (#118): a door that admits an arbitrary
  // track, so an orphaned Resistant dot under an empty box collapses here —
  // the stored document can never carry the meaningless state again.
  const patch: SheetPatch =
    decoded.healthTrack !== undefined
      ? { ...decoded, healthTrack: normalizeHealthTrack(decoded.healthTrack) }
      : decoded

  if (
    patch.manaCurrent === undefined &&
    patch.willpowerCurrent === undefined &&
    patch.healthTrack === undefined &&
    patch.wisdom === undefined &&
    patch.experienceUnspent === undefined
  ) {
    return yield* new InvalidHandEdit({ message: "Nothing to edit." })
  }

  const sheet = yield* getSessionScopedSheet(
    SessionId.make(args.sessionId),
    CharacterId.make(args.characterId),
  )

  // The inverted ladder: owner rejected, ST/Dev pass, repair Override recorded.
  const editor = yield* requireRepairAuthority(SessionId.make(args.sessionId))

  // Capacity is shape: pools fill to their printed size — a hand edit fills
  // the form, it doesn't resize it (the track's box count is checked by the
  // shared body).
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

  return yield* recordSheetChange(sheet, editor, "hand-edited", patch)
})

// --- The mark-sheet door (MAG-63) ---

export const MarkSheetArgs = Schema.Struct({
  sessionId: Schema.String,
  characterId: Schema.String,
  /** The whole track as the sheet will show it (the pair encoding, #41). */
  healthTrack: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({ severity: Schema.String, resistant: Schema.Boolean }),
    ),
  ),
  wisdom: Schema.optionalKey(Schema.Number),
  /** The purse mark (MAG-67): the player refills Destiny, Willpower and
   * Mana by their own hand (and spends Destiny's bane the same way). */
  destinyCurrent: Schema.optionalKey(Schema.Number),
  willpowerCurrent: Schema.optionalKey(Schema.Number),
  manaCurrent: Schema.optionalKey(Schema.Number),
  /** A derangement taken (MAG-60): its name and, for a permanent one, the
   * lost Wisdom dot it hangs on; no dot means a Bedlam one, and the flow
   * works out its clock. */
  derangement: Schema.optionalKey(
    Schema.Struct({ name: Schema.String, dot: Schema.optionalKey(Schema.Number) }),
  ),
  /** A derangement put down by name — the mark in reverse. */
  shedDerangement: Schema.optionalKey(Schema.String),
})
export type MarkSheetArgs = typeof MarkSheetArgs.Type

/** A mark as the sheet makes it: the track as shown, the new Wisdom rank, or
 * a purse's new level (MAG-67). */
export const SheetMark = Schema.Struct({
  healthTrack: Schema.optionalKey(HealthTrack),
  wisdom: Schema.optionalKey(WisdomRank),
  destinyCurrent: Schema.optionalKey(Destiny),
  willpowerCurrent: Schema.optionalKey(Willpower),
  manaCurrent: Schema.optionalKey(Mana),
  derangement: Schema.optionalKey(
    Schema.Struct({ name: DerangementName, dot: Schema.optionalKey(WisdomRank) }),
  ),
  shedDerangement: Schema.optionalKey(DerangementName),
})
export type SheetMark = typeof SheetMark.Type

/**
 * `markSheet` — the paper-sheet gesture (MAG-63; owner's call 2026-10-27):
 * the Storyteller says "take two lethal" or "you lose a dot of Wisdom" and
 * the player marks their own sheet. The track and Wisdom are two marks
 * (healing and degeneration stay manual for now, by the same call); the
 * purses are the others (MAG-67): the player refills Destiny at the
 * chapter, Willpower at the scene, Mana by oblation, by the same gesture —
 * and pays Destiny's bane by it in reverse. Capacity is shape here as in
 * the repair: a purse fills to its printed size and no further. It
 * walks the *normal* authority ladder, like `setMagicalTool`: the owner
 * passes plainly, an ST or Dev marking in their stead is Override-recorded
 * by the seam — the inverse of `handEditSheet`, whose point is that the
 * owner may not. The same representability checks as the hand edit (the
 * track keeps its box count, Wisdom is a rank), and the same one system
 * Activity entry, so the Chronicle shows the mark as it shows a repair.
 */
export const markSheet = Effect.fn("Flows.handEdit.markSheet")(function* (
  args: MarkSheetArgs,
) {
  const decoded = yield* Schema.decodeUnknownEffect(SheetMark)({
    ...(args.healthTrack !== undefined ? { healthTrack: args.healthTrack } : {}),
    ...(args.wisdom !== undefined ? { wisdom: args.wisdom } : {}),
    ...(args.destinyCurrent !== undefined ? { destinyCurrent: args.destinyCurrent } : {}),
    ...(args.willpowerCurrent !== undefined ? { willpowerCurrent: args.willpowerCurrent } : {}),
    ...(args.manaCurrent !== undefined ? { manaCurrent: args.manaCurrent } : {}),
    ...(args.derangement !== undefined ? { derangement: args.derangement } : {}),
    ...(args.shedDerangement !== undefined ? { shedDerangement: args.shedDerangement } : {}),
  }).pipe(
    Effect.mapError(
      () => new InvalidHandEdit({ message: "That mark doesn't fit the sheet." }),
    ),
  )
  const { derangement, shedDerangement, ...values } = decoded
  const patch: SheetPatch =
    values.healthTrack !== undefined
      ? { ...values, healthTrack: normalizeHealthTrack(values.healthTrack) }
      : values

  if (
    patch.healthTrack === undefined &&
    patch.wisdom === undefined &&
    patch.destinyCurrent === undefined &&
    patch.willpowerCurrent === undefined &&
    patch.manaCurrent === undefined &&
    derangement === undefined &&
    shedDerangement === undefined
  ) {
    return yield* new InvalidHandEdit({ message: "Nothing to mark." })
  }

  const sessionId = SessionId.make(args.sessionId)

  // The normal ladder: the owner, or an ST/Dev in their stead (Override-recorded).
  const sheet = yield* requireSessionCharacter(
    sessionId,
    CharacterId.make(args.characterId),
  )

  // Capacity is shape: a purse fills to its printed size — Destiny's twice
  // the Merit's dots (none without the Merit), Willpower's rating, Mana's
  // Gnosis cap.
  if (patch.destinyCurrent !== undefined && patch.destinyCurrent > sheet.destinyCapacity) {
    return yield* new InvalidHandEdit({ message: `Destiny holds at most ${sheet.destinyCapacity}.` })
  }
  if (patch.willpowerCurrent !== undefined && patch.willpowerCurrent > sheet.willpower) {
    return yield* new InvalidHandEdit({ message: `Willpower holds at most ${sheet.willpower}.` })
  }
  if (patch.manaCurrent !== undefined && patch.manaCurrent > sheet.maxMana) {
    return yield* new InvalidHandEdit({ message: `Mana holds at most ${sheet.maxMana}.` })
  }

  // The derangement marks (MAG-60): a permanent one hangs on the lost dot
  // the player pointed at; a Bedlam one on the clock the flow works out
  // (the Scene open now at Wisdom 5+, an expiry stamped below). The list is
  // written whole: the same name re-marked replaces its old hold, and
  // anything no longer standing at this moment leaves the row with it.
  const marked: SheetPatch =
    derangement === undefined && shedDerangement === undefined
      ? patch
      : { ...patch, derangements: yield* nextDerangements(sheet, derangement, shedDerangement) }

  // The entry's name: the actor's table name, or — for a Dev who is no
  // member at all, whom the ladder admits — their id, as the repair door does.
  const actor = yield* CurrentActor
  const store = yield* GameStore
  const membership = yield* store.getMembership(sessionId, actor.userId).pipe(Effect.option)
  const by: SheetChangeBy = {
    userId: actor.userId,
    tableName: Option.match(membership, {
      onNone: () => actor.userId,
      onSome: tableName,
    }),
  }

  return yield* recordSheetChange(sheet, by, "marked", marked)
})

/** The held list after a derangement mark: the standing ones, less the one
 * shed, plus the one taken on its hold. */
const nextDerangements = Effect.fn("Flows.handEdit.nextDerangements")(function* (
  sheet: CharacterSheet,
  taken: SheetMark["derangement"],
  shed: SheetMark["shedDerangement"],
) {
  const store = yield* GameStore
  const scene = yield* store.getActiveScene(sheet.sessionId)
  const at = yield* Clock.currentTimeMillis
  const sceneId = Option.map(scene, (s) => s.id)
  const standing = standingDerangements(sheet.derangementsHeld, { wisdom: sheet.wisdom, sceneId, at })

  if (shed !== undefined && !standing.some((d) => d.name === shed)) {
    return yield* new InvalidHandEdit({ message: `${shed} isn't on the sheet.` })
  }
  if (taken === undefined) return standing.filter((d) => d.name !== shed)
  const kept = standing.filter((d) => d.name !== shed && d.name !== taken.name)

  const [hold, why] =
    taken.dot !== undefined
      ? ([lostDotHold(sheet.wisdom, taken.dot), `Wisdom dot ${taken.dot} is held, not lost.`] as const)
      : ([bedlamHold(sheet.wisdom, sceneId, at), "No scene is open to bind it to."] as const)
  if (Option.isNone(hold)) return yield* new InvalidHandEdit({ message: why })
  // One dot carries one derangement (Mage p. 79).
  const already = Match.value(hold.value).pipe(
    Match.tag("lostDot", (h) => hangingFromDot(kept, h.rank)),
    Match.tag("scene", "until", () => Option.none()),
    Match.exhaustive,
  )
  if (Option.isSome(already)) {
    return yield* new InvalidHandEdit({ message: `That dot already carries ${already.value.name}.` })
  }
  const held: HeldDerangement = { name: derangementDef(taken.name).name, hold: hold.value }
  return [...kept, held]
})

export const SetMagicalToolArgs = Schema.Struct({
  sessionId: Schema.String,
  characterId: Schema.String,
  hasMagicalTool: Schema.Boolean,
})
export type SetMagicalToolArgs = typeof SetMagicalToolArgs.Type

/**
 * The standing tool fact (issue #107): a magical tool in hand is −1 Paradox
 * die on every vulgar cast, and it lives on the sheet — the bench merely
 * reports it. Unlike `handEditSheet` this walks the *normal* authority ladder
 * (`requireSessionCharacter`): the fact is the owner's to maintain, plainly;
 * an ST or Dev flipping it in their stead is Override-recorded by the seam.
 * A quiet write, like the Tides edit — a sheet fact, not a reveal.
 */
export const setMagicalTool = Effect.fn("Flows.handEdit.setMagicalTool")(
  function* (args: SetMagicalToolArgs) {
    const store = yield* GameStore

    const sheet = yield* requireSessionCharacter(
      SessionId.make(args.sessionId),
      CharacterId.make(args.characterId),
    )

    yield* store.patchSheet(sheet.id, { hasMagicalTool: args.hasMagicalTool })

    return sheet.id
  },
)
