import { Result, Schema } from "effect"
import { ScenePip } from "./cast"
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

// --- Client seam decode (ADR-0005, issue #49) ---

/**
 * The `scenes` row as `api.scenes.getActive` returns it — the same document
 * the server adapter translates into `Scene` (`convexLive.getActiveScene`);
 * this is that translation for the client boundary. Extra columns
 * (`_creationTime`, `openedAt`, `closedAt`) fall away in the decode.
 */
const SceneWire = Schema.Struct({
  _id: Schema.String,
  sessionId: Schema.String,
  name: Schema.String,
  status: SceneStatus,
  sleeperWitnesses: Schema.Boolean,
})

const decodeWire = Schema.decodeUnknownResult(SceneWire)
const decodePips = Schema.decodeUnknownResult(Schema.Array(ScenePip))

/**
 * Decode the active-scene query off the wire. `null` passes through
 * (downtime is an answer); a corrupt row degrades to `null` with a warning
 * rather than taking the strip down (the `decodeFeed` posture).
 */
export const decodeActiveScene = (input: unknown): Scene | null => {
  if (input === null || input === undefined) return null
  const wire = decodeWire(input)
  if (Result.isFailure(wire)) {
    console.warn("Scene: dropped an unreadable active-scene row", wire.failure)
    return null
  }
  const row = wire.success
  return new Scene({
    id: SceneId.make(row._id),
    sessionId: SessionId.make(row.sessionId),
    name: row.name,
    status: row.status,
    sleeperWitnesses: row.sleeperWitnesses,
  })
}

/** Decode the Paradox-pips query; a corrupt payload is an empty strip. */
export const decodeScenePips = (input: unknown): ReadonlyArray<ScenePip> => {
  const result = decodePips(input)
  if (Result.isFailure(result)) {
    console.warn("Scene: dropped an unreadable Paradox-pips payload", result.failure)
    return []
  }
  return result.success
}
