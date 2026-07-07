import { useMemo } from "react"
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { decodeActiveCombat } from "#/domain/combat-tracker"
import type { Id } from "../../convex/_generated/dataModel"

/**
 * The Combat tracker's data feed (issue #60): the active-Combat query decoded
 * through its domain mirror — query, decode, memo, the `useScene` shape.
 * `undefined` while the query loads; `null` when no Combat runs (a legal
 * state, not an error); the tracker rehydrates mid-fight from this one
 * subscription on any reload.
 */
export function useCombat(sessionId: Id<"sessions">) {
  const raw = useQuery(api.combats.getActive, { sessionId })
  return useMemo(
    () => (raw === undefined ? undefined : decodeActiveCombat(raw)),
    [raw],
  )
}
