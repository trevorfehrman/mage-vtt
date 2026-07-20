import { decodeSheet, type CharacterSheet } from "#/domain/character"
import type { Doc } from "../../convex/_generated/dataModel"

/**
 * Decode a raw `characters` row into the domain sheet — the one home of the
 * `_id`/`_creationTime` strip every client-side read was repeating (route
 * memo, roster decode, and the cockpit's caster-sheet lookups).
 */
export const decodeSheetDoc = (doc: Doc<"characters">): CharacterSheet | null => {
  const { _id, _creationTime, ...fields } = doc
  return decodeSheet({ id: _id, ...fields })
}
