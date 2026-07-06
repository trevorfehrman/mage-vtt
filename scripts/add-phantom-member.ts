/**
 * Dev-side phantom member (solo playtesting). Usage:
 *
 *   bun scripts/add-phantom-member.ts <sessionId> <display name...>
 *
 * Inserts a sessionMembers row with a fabricated "dev:" userId — no sign-in
 * exists behind it — so a second PC can live in the Session for roster
 * browsing (issue #17) without a second account. Ingest the phantom's
 * character next, using the printed userId in the character file's linkage:
 *
 *   bun scripts/ingest-character.ts <character-file.json>
 *
 * Idempotent: re-running with the same display name returns the existing
 * member. Same authority story as ingestion: `bunx convex run` (CLI admin
 * auth) into an internalMutation — no UI, no public endpoint.
 */

import { Effect } from "effect"
import { convexRun, runScript, UsageError } from "./lib/script-runtime"

const program = Effect.gen(function* () {
  const [sessionId, ...nameParts] = process.argv.slice(2)
  const displayName = nameParts.join(" ")
  if (!sessionId || !displayName) {
    return yield* new UsageError({
      message: "Usage: bun scripts/add-phantom-member.ts <sessionId> <display name...>",
    })
  }

  const out = yield* convexRun("ingest:addPhantomMember", { sessionId, displayName })
  console.log(out)

  const userId = /"userId":\s*"([^"]+)"/.exec(out)?.[1]
  if (userId) {
    console.log(
      `\nPhantom in place. Put this in the character file's linkage:\n` +
        `  { "sessionId": "${sessionId}", "userId": "${userId}", ... }`,
    )
  }
})

await runScript(program)
