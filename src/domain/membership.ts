import { Schema } from "effect"
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
}) {
  /** The name they go by at the table (owner, 2026-10-25: the Chronicle
   * names people by character, as the video tiles do): every narrated line
   * and every sender wears it. A member without a sheet — usually the
   * Storyteller — goes by their account name. */
  get tableName(): string {
    return this.sheetName ?? this.displayName
  }
}

/** A sheet's headline: the shadow name when there is one (Mage's magical
 * name, worn at the table), else the given name. */
export const headlineName = (sheet: {
  readonly name: string
  readonly shadowName?: string | undefined
}): string => sheet.shadowName ?? sheet.name

/** A roster row's table name, off the session's sheets: what
 * `Membership.tableName` says for a member the seam hasn't decoded — chat
 * and the Second Seat's announcement name people the way the flows do. */
export const tableNameOf = (
  member: { readonly _id: string; readonly displayName: string },
  sheets: ReadonlyArray<{
    readonly sessionMemberId: string
    readonly name: string
    readonly shadowName?: string | undefined
  }>,
): string => {
  const sheet = sheets.find((s) => s.sessionMemberId === member._id)
  return sheet === undefined ? member.displayName : headlineName(sheet)
}
