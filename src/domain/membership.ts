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
  displayName: Schema.String,
}) {}
