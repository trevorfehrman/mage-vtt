import { Array as Arr, Schema } from "effect"
import { whisperReaches, type ActivityEntry, type MessageEntry } from "./activity"

/**
 * The working slot's news (MAG-53): the message box and the dice tray share
 * one slot at the rail's foot, and while the tray shows, the Chronicle's
 * switch says what arrived since the viewer last had the message box open —
 * a whisper to them on its own count, everything else someone else said as
 * chat. "Since" is the newest message the viewer had when they flipped away,
 * a server timestamp, so the two clocks never meet.
 */
/** Which instrument the slot shows: the dice tray or the message box. */
export const SlotMode = Schema.Literals(["dice", "message"])
export type SlotMode = typeof SlotMode.Type

export const Unread = Schema.Struct({
  chat: Schema.Number,
  whisper: Schema.Number,
})
export type Unread = typeof Unread.Type

export const NOTHING_UNREAD: Unread = { chat: 0, whisper: 0 }

const messages = (entries: ReadonlyArray<ActivityEntry>) =>
  Arr.filter(entries, (e): e is MessageEntry => e._tag === "message")

export const unreadFor = (
  entries: ReadonlyArray<ActivityEntry>,
  viewerId: string,
  seenThrough: number,
): Unread =>
  Arr.reduce(messages(entries), NOTHING_UNREAD, (acc, m) =>
    m.timestamp <= seenThrough || m.senderId === viewerId || m.visibilityType === "system"
      ? acc
      : m.visibilityType === "whisper" && whisperReaches(m, viewerId)
        ? { ...acc, whisper: acc.whisper + 1 }
        : { ...acc, chat: acc.chat + 1 },
  )

/** The newest message's timestamp: what the viewer has seen when they flip away. */
export const newestMessageAt = (entries: ReadonlyArray<ActivityEntry>): number =>
  Arr.reduce(messages(entries), 0, (newest, m) => Math.max(newest, m.timestamp))
