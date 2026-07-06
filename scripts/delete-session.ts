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

export {}

const [sessionId] = process.argv.slice(2)
if (!sessionId) {
  console.error("Usage: bun scripts/delete-session.ts <sessionId>")
  process.exit(1)
}

const proc = Bun.spawnSync(
  ["bunx", "convex", "run", "ingest:deleteSession", JSON.stringify({ sessionId })],
  { stdout: "pipe", stderr: "inherit" },
)

if (proc.exitCode !== 0) {
  console.error("Failed to delete session.")
  process.exit(proc.exitCode ?? 1)
}

console.log(proc.stdout.toString().trim())
