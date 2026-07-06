/**
 * Global god-mode allowlist, resolved per call from an env var
 * (`DEV_USER_IDS`, comma-separated). Orthogonal to Session role. One home —
 * the write half (ConvexLive's `CurrentActor.isDev`) and the read half (the
 * Second Seat, ADR-0013) must agree on who a Dev is.
 */
export const isDevUser = (userId: string): boolean => {
  const raw = process.env.DEV_USER_IDS ?? ""
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .includes(userId)
}
