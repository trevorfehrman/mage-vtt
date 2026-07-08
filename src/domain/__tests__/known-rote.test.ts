import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import { CharacterSheet, KnownRote } from "../character"
import { formatRotePool } from "../rote-pool"

/**
 * Known Rotes on the Character Sheet (issue #16): the doc's raw `knownRotes`
 * entries decode into typed `KnownRote`s, the column is optional (pre-#16 rows
 * have no `knownRotes`), and representability rejects vocabulary the casting
 * flow could never resolve (an unknown Arcanum, an out-of-range spell level).
 */

const baseDoc = {
  id: "char1",
  sessionId: "sess1",
  userId: "user1",
  sessionMemberId: "member1",
  name: "Test Mage",
  concept: "Test",
  virtue: "Hope",
  vice: "Pride",
  path: "Moros",
  order: "Mysterium",
  gnosis: 2,
  attributes: {
    mental: { intelligence: 3, wits: 2, resolve: 2 },
    physical: { strength: 2, dexterity: 2, stamina: 2 },
    social: { presence: 2, manipulation: 2, composure: 3 },
  },
  skills: {
    mental: {
      academics: 2, computer: 0, crafts: 0, investigation: 2,
      medicine: 0, occult: 3, politics: 0, science: 0,
    },
    physical: {
      athletics: 1, brawl: 0, drive: 0, firearms: 0,
      larceny: 1, stealth: 2, survival: 0, weaponry: 0,
    },
    social: {
      animalKen: 0, empathy: 1, expression: 0, intimidation: 0,
      persuasion: 1, socialize: 1, streetwise: 0, subterfuge: 1,
    },
  },
  arcana: { death: 2, matter: 3, prime: 1 },
  healthTrack: ["empty", "empty", "empty", "empty", "empty", "empty", "empty"],
  willpowerCurrent: 5,
  manaCurrent: 11,
}

const contestedRote = {
  name: "The Seal of",
  spellName: "Ectoplasmic Shaping",
  spellArcanum: "Death",
  spellLevel: 1,
  order: "Mysterium",
  pool: {
    attribute: "Presence",
    skills: ["Occult"],
    arcanum: "Death",
    vs: ["Resolve", "Gnosis"],
  },
}

const uncontestedRote = {
  name: "Alchemist's Touch",
  spellName: "Transubstantiation",
  spellArcanum: "Matter",
  spellLevel: 3,
  order: "Mysterium",
  pool: {
    attribute: "Intelligence",
    skills: ["Crafts", "Science"],
    arcanum: "Matter",
  },
}

const decode = Schema.decodeUnknownSync(CharacterSheet)

describe("KnownRote on the Character Sheet", () => {
  it("decodes knownRotes into typed entries, contested and uncontested", () => {
    const sheet = decode({ ...baseDoc, knownRotes: [contestedRote, uncontestedRote] })
    expect(sheet.rotes).toHaveLength(2)
    const [contested, uncontested] = sheet.rotes
    expect(contested).toBeInstanceOf(KnownRote)
    expect(contested.pool.vs).toEqual(["Resolve", "Gnosis"])
    expect(formatRotePool(contested.pool)).toBe(
      "Presence + Occult + Death vs Resolve + Gnosis",
    )
    expect(uncontested.pool.vs).toBeUndefined()
    expect(formatRotePool(uncontested.pool)).toBe(
      "Intelligence + Crafts or Science + Matter",
    )
  })

  it("treats an absent knownRotes column as an empty rote list (pre-#16 rows)", () => {
    const sheet = decode(baseDoc)
    expect(sheet.rotes).toEqual([])
  })

  it("carries the spell's aspect when stamped, stays decodable without it (pre-#68 rows)", () => {
    // The aspect gates the Draft Vulgar / Cast buttons client-side (issue
    // #68); absent means unknown — the gate stays open, the server refuses.
    const stamped = decode({
      ...baseDoc,
      knownRotes: [{ ...contestedRote, spellAspect: "Covert" }],
    })
    expect(stamped.rotes[0].spellAspect).toBe("Covert")

    const unstamped = decode({ ...baseDoc, knownRotes: [contestedRote] })
    expect(unstamped.rotes[0].spellAspect).toBeUndefined()
  })

  it("rejects an aspect outside the vocabulary", () => {
    const bad = { ...contestedRote, spellAspect: "covert" }
    expect(() => decode({ ...baseDoc, knownRotes: [bad] })).toThrow()
  })

  it("rejects a rote whose Arcanum is outside the vocabulary", () => {
    const bad = { ...contestedRote, spellArcanum: "death" }
    expect(() => decode({ ...baseDoc, knownRotes: [bad] })).toThrow()
  })

  it("rejects a spell level outside 1–5", () => {
    const bad = { ...contestedRote, spellLevel: 6 }
    expect(() => decode({ ...baseDoc, knownRotes: [bad] })).toThrow()
  })

  it("rejects an empty skill slot list — a pool must offer at least one skill", () => {
    const bad = { ...contestedRote, pool: { ...contestedRote.pool, skills: [] } }
    expect(() => decode({ ...baseDoc, knownRotes: [bad] })).toThrow()
  })
})
