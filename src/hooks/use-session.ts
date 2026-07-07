import { useMemo } from "react"
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { decodeSessionSnapshot } from "#/domain/session"
import type { Id } from "../../convex/_generated/dataModel"

/**
 * The session page's data feed (issue #49): `api.sessions.get` decoded
 * through the domain's `SessionSnapshot` mirror — query, decode, memo, the
 * `useActivity` shape. `undefined` while the query loads (matching
 * `useQuery`); `null` for no such session or an unreadable payload.
 */
export function useSession(sessionId: Id<"sessions">) {
  const raw = useQuery(api.sessions.get, { sessionId })
  return useMemo(
    () => (raw === undefined ? undefined : decodeSessionSnapshot(raw)),
    [raw],
  )
}
