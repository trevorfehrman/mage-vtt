import { Array as Arr, Option, Schema } from "effect"
import type { CharacterSheet } from "./character"
import type { SessionMemberRow } from "./session"
import { PlayerId, SessionId } from "./ids"
import { SessionRole } from "./roles"

/**
 * Seam mirror of a `sessionMembers` row (ADR-0004, ADR-0007).
 *
 * Decoded at the adapter from Convex's `Doc<"sessionMembers">` — the domain never
 * sees `Doc<T>`. Its identity is the `(userId, sessionId)` compound key
 * (`MembershipKey`), not the surrogate row id: a membership *is* the pairing of a
 * player and a session. Named `Membership` (not `SessionMember`) to avoid colliding
 * with `session.ts`'s roster-view `SessionMember`, which carries no `sessionId` and
 * predates the seam.
 */

export const MembershipKey = Schema.Struct({
  userId: PlayerId,
  sessionId: SessionId,
})
export type MembershipKey = typeof MembershipKey.Type

export class Membership extends Schema.Class<Membership>("Membership")({
  userId: PlayerId,
  sessionId: SessionId,
  role: SessionRole,
  /** the account's own name */
  displayName: Schema.String,
  /** their sheet's headline in this session, when they have one — the
   * adapter reads it off the sheet as it decodes the row */
  sheetName: Schema.optionalKey(Schema.String),
}) {}

/** The name a member goes by at the table (owner, 2026-10-25: the Chronicle
 * names people by character, as the video tiles do): every narrated line and
 * every sender wears it. A member without a sheet — usually the Storyteller —
 * goes by their account name. A function, not a getter: a getter would not
 * survive a spread or an encode. */
export const tableName = (member: Membership): string => member.sheetName ?? member.displayName

/** A sheet's headline: the shadow name when there is one (Mage's magical
 * name, worn at the table), else the given name. */
export const headlineName = (sheet: Pick<CharacterSheet, "name" | "shadowName">): string =>
  sheet.shadowName ?? sheet.name

/** A roster row's table name, off the session's sheets: what `tableName`
 * says for a member the seam hasn't decoded — chat and the Second Seat's
 * announcement name people the way the flows do. */
export const tableNameOf = (
  member: Pick<typeof SessionMemberRow.Encoded, "_id" | "displayName">,
  sheets: ReadonlyArray<Pick<typeof CharacterSheet.Encoded, "sessionMemberId" | "name" | "shadowName">>,
): string =>
  Arr.findFirst(sheets, (s) => s.sessionMemberId === member._id).pipe(
    Option.match({ onNone: () => member.displayName, onSome: headlineName }),
  )
