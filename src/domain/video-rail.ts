import { Array as Arr, Option, Order, Result, Schema } from "effect"
import { CharacterSheet } from "./character"
import { SessionRole } from "./roles"
import { SessionMemberRow } from "./session"

/**
 * The video rail's seats (MAG-51): one tile per member, the Storyteller's
 * first and then the players' in the order they joined, each player wearing
 * their own sheet's depletables. A member whose sheet hasn't arrived (or
 * doesn't exist yet) still has a seat — the tile names them and shows no
 * stats, rather than the table losing a face. The Storyteller usually has
 * no sheet; one who does (a playtest table) wears it like anyone else.
 */
export const VideoSeat = Schema.Struct({
  memberId: Schema.String,
  /** Whom a whisper from this tile reaches (MAG-53). */
  userId: Schema.String,
  displayName: Schema.String,
  role: SessionRole,
  sheet: Schema.NullOr(CharacterSheet),
})
export type VideoSeat = typeof VideoSeat.Type

const byRoleThenJoined: Order.Order<SessionMemberRow> = Order.combine(
  Order.mapInput(Order.Boolean, (m: SessionMemberRow) => m.role !== "storyteller"),
  Order.mapInput(Order.Number, (m: SessionMemberRow) => m._creationTime),
)

export const videoSeats = (
  members: ReadonlyArray<SessionMemberRow>,
  sheets: ReadonlyArray<CharacterSheet>,
): ReadonlyArray<VideoSeat> =>
  Arr.sort(members, byRoleThenJoined).map((m) => ({
    memberId: m._id,
    userId: m.userId,
    displayName: m.displayName,
    role: m.role,
    sheet: Option.getOrNull(Arr.findFirst(sheets, (s) => String(s.sessionMemberId) === String(m._id))),
  }))

/** The name a seat goes by at the table: its sheet's headline (the shadow
 * name when there is one), else the member's own. The tile wears it, and
 * the message box names a whisper's people by it (MAG-53). */
export const seatName = (seat: VideoSeat): string =>
  seat.sheet?.shadowName ?? seat.sheet?.name ?? seat.displayName

/** Someone a whisper can reach, named as their tile is (MAG-53). */
export const WhisperPerson = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
})
export type WhisperPerson = typeof WhisperPerson.Type

/** Everyone at the table the viewer could whisper: every seat but their own. */
export const whisperable = (seats: ReadonlyArray<VideoSeat>, selfId: string): ReadonlyArray<WhisperPerson> =>
  Arr.filterMap(seats, (s) => (s.userId === selfId ? Result.failVoid : Result.succeed({ id: s.userId, name: seatName(s) })))
