import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import { CharacterSheet } from "../character"
import { CharacterData } from "../tables"

/**
 * Data conformance for the character-ingestion path (issue #16): the committed
 * example file must pass the exact validation `scripts/ingest-character.ts`
 * runs pre-upload — the raw persisted shape, then the representability decode
 * every adapter read performs (ADR-0011). If either mirror drifts, the shipped
 * template fails here before a Dev hits it at the terminal.
 */

const example = JSON.parse(
  readFileSync(
    join(__dirname, "../../../data/characters/example-character.json"),
    "utf8",
  ),
) as { sessionId: string; userId: string; character: unknown }

describe("character ingestion example file", () => {
  it("decodes through the raw CharacterData mirror", () => {
    const data = Schema.decodeUnknownSync(CharacterData)(example.character)
    expect(data.name).toBe("Corvin Ashe")
    expect(data.knownRotes).toHaveLength(3)
  })

  it("survives the CharacterSheet representability decode with linkage attached", () => {
    const data = Schema.encodeUnknownSync(CharacterData)(
      Schema.decodeUnknownSync(CharacterData)(example.character),
    )
    const sheet = Schema.decodeUnknownSync(CharacterSheet)({
      id: "preflight",
      sessionId: "preflight-session",
      userId: "preflight-user",
      sessionMemberId: "preflight-member",
      ...data,
    })
    expect(sheet.rotes.map((r) => r.spellName)).toEqual([
      "Speak with the Dead",
      "Ectoplasmic Shaping",
      "Craftsman's Eye",
    ])
    // The example's current state is coherent with its Traits.
    expect(sheet.healthTrack).toHaveLength(sheet.health)
    expect(sheet.willpowerCurrent).toBe(sheet.willpower)
    expect(sheet.manaCurrent).toBe(sheet.maxMana)
  })

  it("every known Rote's business key resolves into the structured Rote data", () => {
    const spells = JSON.parse(
      readFileSync(join(__dirname, "../../../data/spells.json"), "utf8"),
    ) as Array<{
      name: string
      arcanum: string
      level: number
      rotes?: Array<{ order: string; pool?: unknown }>
    }>
    const data = Schema.decodeUnknownSync(CharacterData)(example.character)
    for (const rote of data.knownRotes ?? []) {
      const spell = spells.find(
        (s) => s.name === rote.spellName && s.arcanum === rote.spellArcanum,
      )
      expect(spell, `${rote.spellName} (${rote.spellArcanum})`).toBeDefined()
      expect(spell!.level).toBe(rote.spellLevel)
      const pools = (spell!.rotes ?? [])
        .filter((r) => r.order === rote.order)
        .map((r) => r.pool)
      expect(pools, `${rote.spellName}: ${rote.order} rote pool`).toContainEqual(
        JSON.parse(JSON.stringify(rote.pool)),
      )
    }
  })
})
