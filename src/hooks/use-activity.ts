import { useMemo } from "react"
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { decodeFeed } from "#/domain/activity"
import type { Id } from "../../convex/_generated/dataModel"

/**
 * The Activity Log's data feed: the Activity query decoded through the
 * domain's entry schema (`decodeFeed`, issue #22 PRD). A logic-free adapter —
 * query, decode, memo. `undefined` while the query loads, matching `useQuery`.
 */
export function useActivity(
  sessionId: Id<"sessions">,
  seat?: Id<"sessionMembers">,
) {
  const raw = useQuery(api.activity.list, {
    sessionId,
    ...(seat ? { seat } : {}),
  })
  return useMemo(() => (raw === undefined ? undefined : decodeFeed(raw)), [raw])
}
