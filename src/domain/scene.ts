import { Schema } from "effect"
import { SceneId, SessionId } from "./ids"

/**
 * The Scene (issue #42, PRD #39): a unit of narrative time within a Session —
 * one location, one event, opened and closed by the Storyteller (WoD Core
 * p. 121). The rules-visible boundary Paradox accumulation lives inside: a
 * caster's Paradox pool grows per prior roll *for that caster* in the same
 * Scene, and accumulated Paradox dies with the Scene when the fiction moves on.
 *
 * At most one Scene is active per Session; no Scene open is a legal state
 * (downtime — play proceeds with nothing accumulating). `sleeperWitnesses` is
 * the Storyteller's table-wide default for the +2 Paradox liability, set on
 * the strip before anyone declares a cast; the negotiation phase (a later
 * slice) reads it as an editable default, never a verdict (ADR-0015).
 */

export const SceneStatus = Schema.Literals(["active", "closed"])
export type SceneStatus = typeof SceneStatus.Type

/**
 * Seam mirror of a `scenes` row (ADR-0004): decoded at the adapter from
 * Convex's `Doc<"scenes">` — the domain never sees `Doc<T>`.
 */
export class Scene extends Schema.Class<Scene>("Scene")({
  id: SceneId,
  sessionId: SessionId,
  name: Schema.String,
  status: SceneStatus,
  sleeperWitnesses: Schema.Boolean,
}) {}
