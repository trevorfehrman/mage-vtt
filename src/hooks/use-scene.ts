import { useMemo } from "react"
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { decodeActiveScene, decodeScenePips } from "#/domain/scene"
import type { Id } from "../../convex/_generated/dataModel"

/**
 * The Scene strip's data feed (issue #49): the active-Scene and Paradox-pips
 * queries decoded through their domain mirrors — query, decode, memo, the
 * `useActivity` shape. Each is `undefined` while its query loads; `scene` is
 * `null` in downtime, `pips` is empty when nobody is pushing their luck.
 */
export function useScene(sessionId: Id<"sessions">) {
  const rawScene = useQuery(api.scenes.getActive, { sessionId })
  const rawPips = useQuery(api.casts.paradoxPips, { sessionId })
  const scene = useMemo(
    () => (rawScene === undefined ? undefined : decodeActiveScene(rawScene)),
    [rawScene],
  )
  const pips = useMemo(
    () => (rawPips === undefined ? undefined : decodeScenePips(rawPips)),
    [rawPips],
  )
  return { scene, pips }
}
