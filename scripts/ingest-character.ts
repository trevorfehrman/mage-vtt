/**
 * Dev-side character ingestion (PRD #11, issue #16). Usage:
 *
 *   bun scripts/ingest-character.ts <character-file.json>
 *
 * The file carries its own linkage (see data/characters/example-character.json):
 *
 *   { "sessionId": "...", "userId": "...", "character": { ...CharacterData } }
 *
 * Ownership binds to the (user, session) member pair — the user must already be
 * a member of the session. The payload is validated locally twice before upload:
 * against the raw persisted shape (`CharacterData`), then against the
 * `CharacterSheet` representability decode the adapter runs on every read
 * (ADR-0011), so a payload that would brick the sheet mid-session is refused
 * before it reaches the database. The upsert itself is an `internalMutation`
 * invoked through `bunx convex run` (CLI admin auth) — not callable from
 * clients, and idempotent: re-running the same file replaces the character
 * document in place.
 */

import { Effect, Schema } from "effect"
import { CharacterSheet } from "../src/domain/character"
import { formatRotePool } from "../src/domain/rote-pool"
import { CharacterData } from "../src/domain/tables"
import { convexRun, runScript } from "./lib/script-runtime"

const path = process.argv[2]
if (!path) {
  console.error("Usage: bun scripts/ingest-character.ts <character-file.json>")
  console.error("File shape: data/characters/example-character.json")
  process.exit(1)
}

const file = await Bun.file(path).json()
const { sessionId, userId, character } = file as Record<string, unknown>
if (typeof sessionId !== "string" || typeof userId !== "string" || !character) {
  console.error(`${path} must carry { sessionId, userId, character }`)
  process.exit(1)
}
if (sessionId.startsWith("REPLACE_") || userId.startsWith("REPLACE_")) {
  console.error("Fill in sessionId and userId before ingesting (see file header).")
  process.exit(1)
}

function refuse(stage: string, error: unknown): never {
  console.error(`${path} refused (${stage}):`)
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

// Raw persisted shape — also strips any keys the schema doesn't know.
let data: typeof CharacterData.Encoded
try {
  data = Schema.encodeUnknownSync(CharacterData)(
    Schema.decodeUnknownSync(CharacterData)(character),
  )
} catch (error) {
  refuse("persisted shape", error)
}

// Representability pre-flight: the exact decode every adapter read runs.
// Linkage ids are branded strings underneath, so placeholders suffice.
let sheet: CharacterSheet
try {
  sheet = Schema.decodeUnknownSync(CharacterSheet)({
    id: "preflight",
    sessionId,
    userId,
    sessionMemberId: "preflight",
    ...data,
  })
} catch (error) {
  refuse("sheet representability", error)
}

// Reference integrity: each known Rote's business key must resolve into the
// structured Rote data, and the embedded pool must be a faithful copy of it —
// a typo'd spell name or a hand-drifted pool is refused, not ingested.
const spells = (await Bun.file(
  new URL("../data/spells.json", import.meta.url).pathname,
).json()) as Array<{
  name: string
  arcanum: string
  level: number
  rotes?: Array<{ order: string; pool?: unknown }>
}>

for (const rote of sheet.rotes) {
  const spell = spells.find(
    (s) => s.name === rote.spellName && s.arcanum === rote.spellArcanum,
  )
  if (!spell) {
    refuse(
      "rote reference",
      `"${rote.name}": no spell "${rote.spellName}" (${rote.spellArcanum}) in data/spells.json`,
    )
  }
  if (spell.level !== rote.spellLevel) {
    refuse(
      "rote reference",
      `"${rote.name}": ${rote.spellName} is level ${spell.level}, not ${rote.spellLevel}`,
    )
  }
  const source = (spell.rotes ?? []).some(
    (r) =>
      r.order === rote.order &&
      Bun.deepEquals(r.pool, JSON.parse(JSON.stringify(rote.pool))),
  )
  if (!source) {
    refuse(
      "rote reference",
      `"${rote.name}": ${rote.spellName} has no ${rote.order} rote with pool "${formatRotePool(rote.pool)}"`,
    )
  }
}

console.log(
  `Ingesting ${sheet.name} (${sheet.path}, ${sheet.order}) — ` +
    `${sheet.rotes.length} known rote(s) — into session ${sessionId} for user ${userId}`,
)

await runScript(
  Effect.gen(function* () {
    const out = yield* convexRun("ingest:upsertCharacter", { sessionId, userId, data })
    if (out) console.log(out)
    console.log("Done — the character document was created or replaced.")
  }),
)
