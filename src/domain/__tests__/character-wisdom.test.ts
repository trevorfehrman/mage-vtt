import { Schema } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { CharacterSheet, decodeSheet } from "../character"
import { makeAldousSheet } from "../testing/fixtures"
import { STARTING_WISDOM } from "../wisdom"

/**
 * Wisdom on the sheet (MAG-56): the morality trait rides the sheet as a
 * 1–10 rank. Rows stored before the column existed read as the book's
 * starting 7 — a rule (page 69), not a guess — and the rank refuses what the
 * sheet cannot hold.
 */
describe("CharacterSheet.wisdom (MAG-56)", () => {
  it("a stored Wisdom decodes as itself", () => {
    expect(makeAldousSheet({ wisdom: 3 }).wisdom).toBe(3)
  })

  it("a row stored before the column existed reads as a new mage's 7", () => {
    const encoded = Schema.encodeSync(CharacterSheet)(makeAldousSheet())
    const { wisdom: _dropped, ...legacyRow } = encoded
    const sheet = decodeSheet(legacyRow)
    expect(sheet?.wisdom).toBe(STARTING_WISDOM)
    expect(STARTING_WISDOM).toBe(7)
  })

  it("the rank is encoded back onto the row, so a re-saved sheet carries the truth", () => {
    const encoded = Schema.encodeSync(CharacterSheet)(makeAldousSheet({ wisdom: 4 }))
    expect(encoded.wisdom).toBe(4)
  })

  it("Wisdom past 10 or below 1 cannot be represented", () => {
    expect(() => makeAldousSheet({ wisdom: 11 as never })).toThrow()
    expect(() => makeAldousSheet({ wisdom: 0 as never })).toThrow()
  })
})
