import { Option } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { KnownRote } from "../character"
import { previewRoteCast } from "../cast-preview"
import { reciteDiceLabel, resolveRotePage, tocDicePhrase } from "../rote-book"
import { RotePool } from "../rote-pool"
import { makeCorvinSheet } from "../testing/fixtures"

/**
 * The Rote book's numbers (issue #89): the table of contents' dice phrasing
 * and the page's per-alternative breakdown, both resolved through the
 * deepened rote-cast leaf (issue #87) — the row, the page, the CastPanel and
 * the log can never disagree, and the UI does no arithmetic of its own.
 */

// Corvin's three known Rotes (data/characters/example-character.json), the
// playtest book the acceptance criteria read: Wits 2 / Presence 2 / Occult 3,
// Intelligence 3 / Investigation 2 / Science 3, Death 2 / Matter 3.
const clamor = new KnownRote({
  name: "Clamor of the Departed",
  spellName: "Speak with the Dead",
  spellArcanum: "Death",
  spellLevel: 1,
  order: "Mysterium",
  pool: new RotePool({ attribute: "Wits", skills: ["Occult"], arcanum: "Death" }),
})

const seal = new KnownRote({
  name: "The Seal of Harafax",
  spellName: "Ectoplasmic Shaping",
  spellArcanum: "Death",
  spellLevel: 1,
  order: "Mysterium",
  pool: new RotePool({
    attribute: "Presence",
    skills: ["Occult"],
    arcanum: "Death",
    vs: ["Resolve", "Gnosis"],
  }),
})

const rubeGoldberg = new KnownRote({
  name: "Rube Goldberg's Brain",
  spellName: "Craftsman's Eye",
  spellArcanum: "Matter",
  spellLevel: 1,
  order: "Mysterium",
  pool: new RotePool({
    attribute: "Intelligence",
    skills: ["Investigation", "Science"],
    arcanum: "Matter",
  }),
})

describe("RoteBook.resolveRotePage", () => {
  it("a single-skill pool resolves to one numbered alternative with its specialty", () => {
    const page = resolveRotePage(makeCorvinSheet(), clamor)

    expect(page).toEqual([
      {
        attribute: { name: "Wits", dots: 2 },
        slot: { name: "Occult", dots: 3, kind: "skill" },
        arcanum: { name: "Death", dots: 2 },
        specialty: { eligible: true, bonus: 1 },
        total: 8,
      },
    ])
  })

  it("an 'or' pool resolves one alternative per offered skill, each with its own eligibility", () => {
    const page = resolveRotePage(makeCorvinSheet(), rubeGoldberg)

    expect(page).toEqual([
      {
        attribute: { name: "Intelligence", dots: 3 },
        slot: { name: "Investigation", dots: 2, kind: "skill" },
        arcanum: { name: "Matter", dots: 3 },
        // Investigation is a Mysterium Rote Specialty; Corvin is Mysterium.
        specialty: { eligible: true, bonus: 1 },
        total: 9,
      },
      {
        attribute: { name: "Intelligence", dots: 3 },
        slot: { name: "Science", dots: 3, kind: "skill" },
        arcanum: { name: "Matter", dots: 3 },
        // Science is not among the Mysterium's three — no specialty die.
        specialty: { eligible: false, bonus: 0 },
        total: 9,
      },
    ])
  })

  it("a borrowed Order's rote earns no specialty die and its total drops", () => {
    const borrowed = new KnownRote({ ...clamor, order: "Silver Ladder" })
    const page = resolveRotePage(makeCorvinSheet(), borrowed)

    expect(page[0]?.specialty).toEqual({ eligible: false, bonus: 0 })
    expect(page[0]?.total).toBe(7)
  })

  it("every page total agrees with the CastPanel's preview for the same declaration", () => {
    const sheet = makeCorvinSheet()
    for (const rote of [clamor, seal, rubeGoldberg]) {
      for (const alternative of resolveRotePage(sheet, rote)) {
        const preview = previewRoteCast({
          sheet,
          rote,
          skillChoice: alternative.slot.name,
        })
        expect(Option.getOrThrow(preview).dice).toBe(alternative.total)
      }
    }
  })
})

describe("RoteBook.tocDicePhrase", () => {
  it("a single pool reads as a count of dice", () => {
    expect(tocDicePhrase(resolveRotePage(makeCorvinSheet(), clamor))).toBe("8 dice")
    expect(tocDicePhrase(resolveRotePage(makeCorvinSheet(), seal))).toBe("8 dice")
  })

  it("an 'or' pool names each alternative's skill with its own total", () => {
    expect(tocDicePhrase(resolveRotePage(makeCorvinSheet(), rubeGoldberg))).toBe(
      "9 Investigation or 9 Science dice",
    )
  })
})

describe("RoteBook.reciteDiceLabel", () => {
  it("a single pool recites its total", () => {
    expect(reciteDiceLabel(resolveRotePage(makeCorvinSheet(), clamor))).toBe("8 dice")
  })

  it("alternatives sharing a total collapse to one number", () => {
    expect(reciteDiceLabel(resolveRotePage(makeCorvinSheet(), rubeGoldberg))).toBe("9 dice")
  })

  it("alternatives with different totals name each once", () => {
    // Drop Science to 1: Investigation stays 9, Science falls to 7.
    const sheet = makeCorvinSheet()
    const weaker = makeCorvinSheet({
      skills: {
        ...sheet.skills,
        mental: { ...sheet.skills.mental, science: 1 },
      },
    })
    expect(reciteDiceLabel(resolveRotePage(weaker, rubeGoldberg))).toBe("9 or 7 dice")
  })
})
