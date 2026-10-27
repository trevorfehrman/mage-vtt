import { Schema } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { CharacterSheet, decodeSheet } from "../character"
import { makeAldousSheet } from "../testing/fixtures"
import { actsOfHubris, STARTING_WISDOM, WisdomBand, wisdomBand, wisdomBandWords } from "../wisdom"

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

  it("every rank names the mildest act of hubris that threatens it (pages 79-80)", () => {
    expect(actsOfHubris(10)).toContain("magic where the mundane would do")
    expect(actsOfHubris(7)).toContain("laying a curse")
    expect(actsOfHubris(1)).toContain("stealing a soul")
  })
})

describe("wisdomBand (MAG-56: the drama of the number)", () => {
  it("10 is serene, 8–9 clear, 6–7 steady, 4–5 faltering, 2–3 blind, 1 lost", () => {
    expect(wisdomBand(10)).toBe("serene")
    expect(wisdomBand(9)).toBe("clear")
    expect(wisdomBand(8)).toBe("clear")
    expect(wisdomBand(7)).toBe("steady")
    expect(wisdomBand(6)).toBe("steady")
    expect(wisdomBand(5)).toBe("faltering")
    expect(wisdomBand(4)).toBe("faltering")
    expect(wisdomBand(3)).toBe("blind")
    expect(wisdomBand(2)).toBe("blind")
    expect(wisdomBand(1)).toBe("lost")
  })

  it("every band has its word", () => {
    for (const band of WisdomBand.literals) {
      expect(wisdomBandWords(band)).toMatch(/^[A-Z]/)
    }
  })
})
