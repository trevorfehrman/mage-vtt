import { readFileSync } from "node:fs"
import { Effect, Schema } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { formatRotePool, parseRotePool, RotePool } from "../rote-pool"

/**
 * Data conformance over the full ingested dataset (PRD #11, issue #14): the
 * domain consumes structure only, so the committed data/spells.json must hold
 * a clean Covert/Vulgar Aspect on every spell and a decodable structured pool
 * on every Rote. A regression here is a pipeline bug (scripts/), not a domain
 * bug — these tests are the tripwire.
 */

interface RawRote {
  order: string
  name: string
  dicePool: string
  pool?: unknown
}

interface RawSpell {
  name: string
  arcanum: string
  level: number
  aspect: string
  rotes: RawRote[]
}

const spells: RawSpell[] = JSON.parse(
  readFileSync(new URL("../../../data/spells.json", import.meta.url), "utf-8"),
)

const allRotes = spells.flatMap((spell) =>
  spell.rotes.map((rote) => ({ spell, rote })),
)

describe("spells.json conformance (issue #14)", () => {
  it("covers the full dataset", () => {
    expect(spells.length).toBeGreaterThanOrEqual(365)
    expect(allRotes.length).toBeGreaterThanOrEqual(372)
  })

  it("every spell's Aspect resolves to Covert or Vulgar", () => {
    const dirty = spells.filter(
      (s) => s.aspect !== "Covert" && s.aspect !== "Vulgar",
    )
    expect(
      dirty.map((s) => `${s.name} (${s.arcanum} ${s.level}): "${s.aspect}"`),
    ).toEqual([])
  })

  it("every Rote carries a structured pool that decodes as RotePool", () => {
    const failures: string[] = []
    for (const { spell, rote } of allRotes) {
      try {
        Schema.decodeUnknownSync(RotePool)(rote.pool)
      } catch {
        failures.push(`${spell.name} [${rote.order}]: ${JSON.stringify(rote.pool)}`)
      }
    }
    expect(failures).toEqual([])
  })

  it.effect("every Rote's prose is the canonical form of its structure", () =>
    Effect.gen(function* () {
      for (const { spell, rote } of allRotes) {
        const pool = Schema.decodeUnknownSync(RotePool)(rote.pool)
        expect(
          `${spell.name} [${rote.order}]: ${rote.dicePool}`,
        ).toBe(`${spell.name} [${rote.order}]: ${formatRotePool(pool)}`)

        // And the prose round-trips through the parser to the same structure.
        const reparsed = yield* parseRotePool(rote.dicePool)
        expect(reparsed).toEqual(pool)
      }
    }),
  )

  it("'or' alternatives and contested 'vs' pools are represented in the data", () => {
    const pools = allRotes.map(
      ({ rote }) => Schema.decodeUnknownSync(RotePool)(rote.pool),
    )
    expect(pools.some((p) => p.skills.length > 1)).toBe(true)
    expect(pools.some((p) => p.vs !== undefined)).toBe(true)
  })
})
