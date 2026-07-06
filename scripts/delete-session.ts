/**
 * Dev-side session deletion (stale test rooms). Usage:
 *
 *   bun scripts/delete-session.ts <sessionId>
 *
 * Cascade-deletes the Session and everything scoped to it: members,
 * characters, messages, dice rolls. Same authority story as ingestion:
 * `bunx convex run` (CLI admin auth) into an internalMutation — no UI,
 * no public endpoint. Irreversible; check the id against
 * `bunx convex data sessions` first.
 */

import { Effect } from "effect"
import { convexRun, runScript, UsageError } from "./lib/script-runtime"

const program = Effect.gen(function* () {
  const [sessionId] = process.argv.slice(2)
  if (!sessionId) {
    return yield* new UsageError({
      message: "Usage: bun scripts/delete-session.ts <sessionId>",
    })
  }

  const out = yield* convexRun("ingest:deleteSession", { sessionId })
  console.log(out)
})

await runScript(program)
