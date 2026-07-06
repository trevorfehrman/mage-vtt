import { Result, Schema } from "effect"
import { ConvexId } from "./schema-bridge"
import { DiceRollDoc, MessageDoc, OverrideMarkerDoc } from "./tables"

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

export const ActivityEntry = Schema.Union([MessageEntry, RollEntry])
export type ActivityEntry = typeof ActivityEntry.Type

export const ActivityFeed = Schema.Array(ActivityEntry)

/** The rule-was-bent badge's shape (ADR-0006), as entries carry it. */
export type OverrideMark = typeof OverrideMarkerDoc.Type

const decodeEntry = Schema.decodeUnknownResult(ActivityEntry)

/**
 * Decode a feed off the wire, one entry at a time. Entries are atomic
 * (ADR-0009), so failure isolation is atom-level: an entry a stale client
 * can't recognize drops with a warning instead of blanking the Chronicle.
 */
export const decodeFeed = (input: ReadonlyArray<unknown>): Array<ActivityEntry> => {
  const entries: Array<ActivityEntry> = []
  for (const raw of input) {
    const result = decodeEntry(raw)
    if (Result.isSuccess(result)) {
      entries.push(result.success)
    } else {
      console.warn("Activity: dropped an unrecognizable feed entry", result.failure)
    }
  }
  return entries
}
