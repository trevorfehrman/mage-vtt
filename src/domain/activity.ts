import { Match, Result, Schema } from "effect"
import { SessionRole } from "./roles"
import { ConvexId } from "./schema-bridge"
import { CastDoc, DiceRollDoc, MessageDoc, OverrideMarkerDoc } from "./tables"

/**
 * The Activity domain module (issue #22 PRD): the one home of the Activity
 * feed's definition. An Activity entry is a Message or a Roll — atomic and
 * self-describing (ADR-0009) — projected from the persisted Doc mirrors: the
 * document id joins, the session id drops, and the wire discriminator is
 * `_tag` so both server and client dispatch the union exhaustively. Raw
 * primitives throughout (ADR-0011): these are projections of persisted shapes,
 * and the log is narrative, not a system of record (ADR-0012).
 *
 * The feed query derives its `returns` validator from `ActivityFeed` via the
 * schema bridge (ADR-0005's function-return extension), and the client decodes
 * through `decodeFeed` — one schema locks both ends of the wire.
 */

const { sessionId: _messageSessionId, ...messageFields } = MessageDoc.fields
const { sessionId: _rollSessionId, ...rollFields } = DiceRollDoc.fields
const { sessionId: _castSessionId, ...castFields } = CastDoc.fields

export const MessageEntry = Schema.TaggedStruct("message", {
  _id: ConvexId("messages"),
  ...messageFields,
})
export type MessageEntry = typeof MessageEntry.Type

export const RollEntry = Schema.TaggedStruct("roll", {
  _id: ConvexId("diceRolls"),
  ...rollFields,
})
export type RollEntry = typeof RollEntry.Type

/**
 * The live Cast card's entry (issue #43, ADR-0016): a projection of the whole
 * Cast document — the card is a *live* feed item that climbs the ladder in
 * place, unlike the immutable beats accruing around it. `timestamp` is the
 * document's `updatedAt`, so the card rides at the action's edge of the feed.
 */
export const CastEntry = Schema.TaggedStruct("cast", {
  _id: ConvexId("casts"),
  timestamp: Schema.Number,
  ...castFields,
})
export type CastEntry = typeof CastEntry.Type

export const ActivityEntry = Schema.Union([MessageEntry, RollEntry, CastEntry])
export type ActivityEntry = typeof ActivityEntry.Type

export const ActivityFeed = Schema.Array(ActivityEntry)

/** The rule-was-bent badge's shape (ADR-0006), as entries carry it. */
export type OverrideMark = typeof OverrideMarkerDoc.Type

/**
 * The effective viewer of the feed: user id + Session role, or null for a
 * non-member (who sees nothing, never an empty result they could mistake for
 * a real one). The policy is Second-Seat-agnostic: seat resolution (ADR-0013)
 * produces the Reader *before* filtering, so replacement semantics fall out
 * with no seat knowledge here.
 */
export type Reader = {
  readonly userId: string
  readonly role: SessionRole
} | null

/**
 * The visibility policy — the one home of who sees what (issue #22 PRD).
 * Public and system Messages are visible to all members; a Whisper to its
 * sender, its target, and the Storyteller; a public Roll to all members; a
 * Hidden roll to its roller and the Storyteller; a non-member sees nothing.
 */
export const visibleTo =
  (reader: Reader) =>
  (entry: ActivityEntry): boolean => {
    if (reader === null) return false
    if (reader.role === "storyteller") return true
    return Match.value(entry).pipe(
      Match.tag("message", (m) =>
        Match.value(m.visibilityType).pipe(
          Match.when("public", () => true),
          Match.when("system", () => true),
          Match.when(
            "whisper",
            () => m.senderId === reader.userId || m.whisperTargetId === reader.userId,
          ),
          Match.exhaustive,
        ),
      ),
      Match.tag(
        "roll",
        (r) => r.visibility === "public" || r.userId === reader.userId,
      ),
      // All Casts are public in this slice (issue #43): the handshake is a
      // contested spectacle, and the whole table watches the ladder climb.
      Match.tag("cast", () => true),
      Match.exhaustive,
    )
  }

/**
 * The list-level composition of `visibleTo`: the feed a Reader may see.
 * Generic over the entry projection so the feed query's freshly-projected
 * (mutable) entries flow through without widening to the schema's readonly Type.
 */
export const visibleEntries = <E extends ActivityEntry>(
  reader: Reader,
  entries: ReadonlyArray<E>,
): Array<E> => entries.filter(visibleTo(reader))

/** The Activity Log's length: how many entries a merged feed keeps. */
export const FEED_CAP = 100

/**
 * The chronological merge: interleave by timestamp descending (ties keep input
 * order) and cap the feed. Database fetch caps stay in the query — they are
 * storage concerns; this cap is the feed's.
 */
export const mergeFeed = <E extends { readonly timestamp: number }>(
  entries: ReadonlyArray<E>,
): Array<E> =>
  [...entries].sort((a, b) => b.timestamp - a.timestamp).slice(0, FEED_CAP)

const decodeEntry = Schema.decodeUnknownResult(ActivityEntry)

/**
 * Decode a feed off the wire, one entry at a time. Entries are atomic
 * (ADR-0009), so failure isolation is atom-level: an entry a stale client
 * can't recognize drops with a warning instead of blanking the Activity Log.
 */
export const decodeFeed = (input: ReadonlyArray<unknown>): Array<ActivityEntry> =>
  input.flatMap((raw) => {
    const result = decodeEntry(raw)
    if (Result.isFailure(result)) {
      console.warn("Activity: dropped an unrecognizable feed entry", result.failure)
      return []
    }
    return [result.success]
  })
