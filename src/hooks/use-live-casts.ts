import { useMemo } from "react"
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { decodeLiveCasts } from "#/domain/activity"
import type { Id } from "../../convex/_generated/dataModel"

/**
 * The table's live casts (MAG-46), oldest first: the live zone (MAG-48)
 * reads these, never the Chronicle. A logic-free adapter — query,
 * decode, memo. `undefined` while the query loads, matching `useQuery`.
 */
export function useLiveCasts(sessionId: Id<"sessions">, seat?: Id<"sessionMembers">) {
  const raw = useQuery(api.casts.live, { sessionId, ...(seat ? { seat } : {}) })
  return useMemo(() => (raw === undefined ? undefined : decodeLiveCasts(raw)), [raw])
}
