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
import { convexRun, runScript, UsageError } from "./lib/script-runtime"

const SPELLS_PATH = new URL("../data/spells.json", import.meta.url).pathname

interface SpellSource {
  name: string
  arcanum: string
  level: number
  aspect: string
  practice: string
  action: string
  duration: string
  cost: string
  description: string
  rotes?: Array<{ order: string; name: string; pool?: unknown; flavor?: string }>
}

/** What spells.json stamps onto one ingested rote (issues #68, #89). */
interface RoteStamp {
  name: string
  spellAspect: string
  spellPage: {
    practice: string
    action: string
    duration: string
    cost: string
    description: string
    roteFlavor?: string
  }
}

const program = Effect.gen(function* () {
  const path = process.argv[2]
  if (!path) {
    return yield* new UsageError({
      message:
        "Usage: bun scripts/ingest-character.ts <character-file.json>\n" +
        "File shape: data/characters/example-character.json",
    })
  }

  const refuse = (stage: string, error: unknown) =>
    new UsageError({
      message:
        `${path} refused (${stage}):\n` +
        (error instanceof Error ? error.message : String(error)),
    })

  const file = yield* Effect.tryPromise(
    () => Bun.file(path).json() as Promise<unknown>,
  ).pipe(Effect.mapError((e) => refuse("reading file", e)))

  const { sessionId, userId, character } = file as Record<string, unknown>
  if (typeof sessionId !== "string" || typeof userId !== "string" || !character) {
    return yield* new UsageError({
      message: `${path} must carry { sessionId, userId, character }`,
    })
  }
  if (sessionId.startsWith("REPLACE_") || userId.startsWith("REPLACE_")) {
    return yield* new UsageError({
      message: "Fill in sessionId and userId before ingesting (see file header).",
    })
  }

  // Raw persisted shape — also strips any keys the schema doesn't know.
  const data = yield* Effect.try({
    try: () =>
      Schema.encodeUnknownSync(CharacterData)(
        Schema.decodeUnknownSync(CharacterData)(character),
      ),
    catch: (error) => refuse("persisted shape", error),
  })

  // Representability pre-flight: the exact decode every adapter read runs.
  // Linkage ids are branded strings underneath, so placeholders suffice.
  const sheet = yield* Effect.try({
    try: () =>
      Schema.decodeUnknownSync(CharacterSheet)({
        id: "preflight",
        sessionId,
        userId,
        sessionMemberId: "preflight",
        ...data,
      }),
    catch: (error) => refuse("sheet representability", error),
  })

  // Reference integrity: each known Rote's business key must resolve into the
  // structured Rote data, and the embedded pool must be a faithful copy of it —
  // a typo'd spell name or a hand-drifted pool is refused, not ingested.
  const spells = (yield* Effect.tryPromise(
    () => Bun.file(SPELLS_PATH).json() as Promise<unknown>,
  ).pipe(Effect.mapError((e) => refuse("reading spells.json", e)))) as SpellSource[]

  const stamps: RoteStamp[] = []
  for (const rote of sheet.rotes) {
    const spell = spells.find(
      (s) => s.name === rote.spellName && s.arcanum === rote.spellArcanum,
    )
    if (!spell) {
      return yield* refuse(
        "rote reference",
        `"${rote.name}": no spell "${rote.spellName}" (${rote.spellArcanum}) in data/spells.json`,
      )
    }
    if (spell.level !== rote.spellLevel) {
      return yield* refuse(
        "rote reference",
        `"${rote.name}": ${rote.spellName} is level ${spell.level}, not ${rote.spellLevel}`,
      )
    }
    const source = (spell.rotes ?? []).find(
      (r) =>
        r.order === rote.order &&
        Bun.deepEquals(r.pool, JSON.parse(JSON.stringify(rote.pool))),
    )
    if (!source) {
      return yield* refuse(
        "rote reference",
        `"${rote.name}": ${rote.spellName} has no ${rote.order} rote with pool "${formatRotePool(rote.pool)}"`,
      )
    }
    stamps.push({
      name: source.name,
      spellAspect: spell.aspect,
      spellPage: {
        practice: spell.practice,
        action: spell.action,
        duration: spell.duration,
        cost: spell.cost,
        description: spell.description,
        ...(source.flavor !== undefined ? { roteFlavor: source.flavor } : {}),
      },
    })
  }

  // The spells.json stamps: the aspect (issue #68) and the book page + the
  // rote's canonical name (issue #89). The data pipeline is the one source of
  // truth for all of them, so the ingested rows are stamped here — the
  // character file never declares them (and a hand-written aspect, name or
  // page would be silently corrected).
  const stamped = {
    ...data,
    ...(data.knownRotes
      ? {
          knownRotes: data.knownRotes.map((rote, i) => ({
            ...rote,
            ...stamps[i],
          })),
        }
      : {}),
  }

  console.log(
    `Ingesting ${sheet.name} (${sheet.path}, ${sheet.order}) — ` +
      `${sheet.rotes.length} known rote(s) — into session ${sessionId} for user ${userId}`,
  )

  const out = yield* convexRun("ingest:upsertCharacter", { sessionId, userId, data: stamped })
  if (out) console.log(out)
  console.log("Done — the character document was created or replaced.")
})

await runScript(program)
