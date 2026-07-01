/**
 * Effect-Schema mirrors of the enforcement-seam tables (ADR-0005).
 *
 * These are the single source of truth for the stored shape of `sessionMembers`,
 * `diceRolls`, and `messages`. `convex/schema.ts` derives each table's Convex
 * validator from the mirror here via `schemaToConvexValidator`, so the `v.*`
 * column list is never hand-maintained alongside the domain shape.
 *
 * They describe the *persisted row* — raw primitives as written by the adapter,
 * not the branded/checked domain values `dice.ts` decodes into. Convex adds `_id`
 * and `_creationTime`, so they are deliberately absent. `sessionId` uses
 * `ConvexId("sessions")` to compile to `v.id("sessions")`; user/sender ids are
 * Better-Auth strings, so they stay `Schema.String` (compiling to `v.string()`).
 */

import { Schema } from "effect"
import { ConvexId } from "./schema-bridge"
import { OverrideKind } from "./override"

export const SessionMembersRow = Schema.Struct({
  sessionId: ConvexId("sessions"),
  userId: Schema.String,
  role: Schema.Literals(["storyteller", "player"]),
  displayName: Schema.String,
})

/** One entry of a `diceRolls` pool — the raw `RawPoolComponent` triple. */
const DiceRollComponentRow = Schema.Struct({
  type: Schema.String,
  name: Schema.String,
  dots: Schema.Number,
})

/**
 * Stored shape of the `Override` provenance marker (ADR-0006). A plain struct
 * (not the domain `OverrideMarker` class) so the derived column type stays a
 * flat Convex object; reuses `OverrideKind` so the marker kinds have one home.
 */
const OverrideMarkerRow = Schema.Struct({
  invokedByUserId: Schema.String,
  invokedByName: Schema.String,
  kind: OverrideKind,
})

export const DiceRollsRow = Schema.Struct({
  sessionId: ConvexId("sessions"),
  userId: Schema.String,
  displayName: Schema.String,
  components: Schema.Array(DiceRollComponentRow),
  poolSize: Schema.Number,
  rolls: Schema.Array(Schema.Number),
  explosions: Schema.Array(Schema.Number),
  roteRerolls: Schema.Array(Schema.Number),
  successes: Schema.Number,
  isChanceDie: Schema.Boolean,
  isDramaticFailure: Schema.Boolean,
  isExceptionalSuccess: Schema.Boolean,
  visibility: Schema.Literals(["public", "hidden"]),
  againThreshold: Schema.Number,
  isRoteAction: Schema.Boolean,
  // Self-describing narrative for the atomic Activity entry (ADR-0009).
  summary: Schema.String,
  // Override provenance (ADR-0006): present only when a rule was bent.
  override: Schema.optionalKey(OverrideMarkerRow),
  timestamp: Schema.Number,
})

export const MessagesRow = Schema.Struct({
  sessionId: ConvexId("sessions"),
  senderId: Schema.String,
  senderName: Schema.String,
  text: Schema.String,
  visibilityType: Schema.Literals(["public", "whisper", "system"]),
  whisperTargetId: Schema.optionalKey(Schema.String),
  timestamp: Schema.Number,
})
