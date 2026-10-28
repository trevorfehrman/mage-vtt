import { Option } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { previewImprovisedCast, previewParadoxDice, previewRoteCast } from "../cast-preview"
import { KnownRote } from "../character"
import { RotePool } from "../rote-pool"
import { makeAldousSheet as makeSheet } from "../testing/fixtures"

/**
 * The casting UX's live readout (PRD #11, issue #20) — the client-side mirror
 * of the cast flows' pool and Mana math. These tests pin the preview to the
 * numbers the server will compute: same leaves, same components, same cost.
 * Both leaves are plain functions returning Option (issue #51, ADR-0014): a
 * preview that cannot be computed is None, never a throw or an Effect.
 * Aldous: Moros (ruling matter/death), Gnosis 1, Death 3, Prime 1.
 */

describe("CastPreview.improvised", () => {
  it("the preview without the Merit adds no High Speech dice — it mirrors the server's refusal (MAG-59)", () => {
    const preview = Option.getOrThrow(
      previewImprovisedCast({ sheet: makeSheet(), arcanum: "death", highSpeech: true }),
    )
    expect(preview.dice).toBe(4) // Gnosis 1 + Death 3, no +2
    expect(preview.components.some((c) => c.name === "High Speech")).toBe(false)
  })


  it("base pool is Gnosis + Arcanum; a ruling Arcanum costs no Mana", () => {
    const preview = Option.getOrThrow(
      previewImprovisedCast({
        sheet: makeSheet(),
        arcanum: "death",
      }),
    )

    expect(preview.dice).toBe(4) // Gnosis 1 + Death 3
    expect(preview.isChanceDie).toBe(false)
    expect(preview.manaCost).toBe(0) // death is ruling for Moros
    expect(preview.components).toEqual([
      { type: "gnosis", name: "Gnosis", dots: 1 },
      { type: "arcanum", name: "Death", dots: 3 },
    ])
  })

  it("High Speech and Willpower add dice; non-ruling and extra Mana add cost", () => {
    const preview = Option.getOrThrow(
      previewImprovisedCast({
        // the chant needs the Merit (MAG-59)
        sheet: makeSheet({ merits: [{ name: "High Speech", dots: 1 }] }),
        arcanum: "prime", // not ruling for Moros → 1 Mana
        highSpeech: true,
        spendWillpower: true,
        extraManaCost: 2,
      }),
    )

    expect(preview.dice).toBe(7) // Gnosis 1 + Prime 1 + 2 + 3
    expect(preview.manaCost).toBe(3) // 1 Path + 2 declared
    expect(preview.components).toEqual([
      { type: "gnosis", name: "Gnosis", dots: 1 },
      { type: "arcanum", name: "Prime", dots: 1 },
      { type: "modifier", name: "High Speech", dots: 2 },
      { type: "modifier", name: "Willpower", dots: 3 },
    ])
  })

  it("factor penalties floor the pool at a chance die, recording only the effective portion", () => {
    const preview = Option.getOrThrow(
      previewImprovisedCast({
        sheet: makeSheet(),
        arcanum: "death",
        potency: 5, // -8
        targets: 4, // -4
      }),
    )

    expect(preview.dice).toBe(0)
    expect(preview.isChanceDie).toBe(true)
    // Pool was 4 positive dice, so only -4 of the -12 penalty is real —
    // the same effective chunking the flow records on the entry.
    expect(preview.components).toEqual([
      { type: "gnosis", name: "Gnosis", dots: 1 },
      { type: "arcanum", name: "Death", dots: 3 },
      { type: "modifier", name: "Spell factors", dots: -4 },
    ])
  })
})

// Presence 2 + Occult 4 + Death 3 + Rote Specialty 1 = 10 dice on Aldous's
// sheet: he is Mysterium and Occult is one of the Order's three (issue #87).
const graveMien = new KnownRote({
  name: "Grave Mien",
  spellName: "Speak with the Dead",
  spellArcanum: "Death",
  spellLevel: 2,
  order: "Mysterium",
  pool: new RotePool({ attribute: "Presence", skills: ["Occult"], arcanum: "Death" }),
})

// An "or" pool contested by Resolve + Gnosis.
const witnessedWard = new KnownRote({
  name: "Witnessed Ward",
  spellName: "Ectoplasmic Shaping",
  spellArcanum: "Death",
  spellLevel: 1,
  order: "Mysterium",
  pool: new RotePool({
    attribute: "Wits",
    skills: ["Investigation", "Occult"],
    arcanum: "Death",
    vs: ["Resolve", "Gnosis"],
  }),
})

describe("CastPreview.rote", () => {
  it("resolves the Rote's pool against the caster's own ratings", () => {
    const preview = Option.getOrThrow(
      previewRoteCast({
        sheet: makeSheet(),
        rote: graveMien,
      }),
    )

    expect(preview.dice).toBe(10) // Presence 2 + Occult 4 + Death 3 + Rote Specialty 1
    expect(preview.manaCost).toBe(0) // no Path cost for a Rote
    expect(preview.components).toEqual([
      { type: "attribute", name: "Presence", dots: 2 },
      { type: "skill", name: "Occult", dots: 4 },
      { type: "arcanum", name: "Death", dots: 3 },
      { type: "modifier", name: "Rote Specialty", dots: 1 },
    ])
    expect(preview.contestedVs).toBeUndefined()
  })

  it("an 'or' pool with no pick has no preview — None, not a throw", () => {
    // The typed refusal (RoteSkillChoiceRequired) is the Effect door's contract,
    // pinned in rote-cast.test.ts; the preview only marks the absence.
    expect(Option.isNone(previewRoteCast({ sheet: makeSheet(), rote: witnessedWard }))).toBe(
      true,
    )
  })

  it("a picked alternative resolves, and a contested pool surfaces its vs traits", () => {
    const preview = Option.getOrThrow(
      previewRoteCast({
        sheet: makeSheet(),
        rote: witnessedWard,
        skillChoice: "Investigation",
      }),
    )

    expect(preview.dice).toBe(9) // Wits 2 + Investigation 3 + Death 3 + Rote Specialty 1
    expect(preview.components).toEqual([
      { type: "attribute", name: "Wits", dots: 2 },
      { type: "skill", name: "Investigation", dots: 3 },
      { type: "arcanum", name: "Death", dots: 3 },
      { type: "modifier", name: "Rote Specialty", dots: 1 },
    ])
    expect(preview.contestedVs).toEqual(["Resolve", "Gnosis"])
  })
})

/**
 * MAG-32: the vulgar half of the sealed trigger names the Paradox pool the
 * cast would start from before the caster opens it — the book's base for
 * the caster's Gnosis, the rote and tool discounts, and the Scene's Tides
 * seed. The Storyteller's own adjustments and Mana mitigation come later.
 */
describe("previewParadoxDice", () => {
  const calm = { witnessCount: 0, circumstances: [], priorParadoxRolls: 0 }

  it("starts from the book's base for the caster's Gnosis", () => {
    expect(previewParadoxDice({ sheet: makeSheet({ gnosis: 1 }), isRote: false, tides: calm })).toBe(1)
    expect(previewParadoxDice({ sheet: makeSheet({ gnosis: 3 }), isRote: false, tides: calm })).toBe(2)
  })

  it("adds the Scene's Tides: Sleepers watching, prior rolls, circumstances", () => {
    expect(
      previewParadoxDice({
        sheet: makeSheet({ gnosis: 1 }),
        isRote: false,
        tides: {
          witnessCount: 3,
          circumstances: [{ source: "Ley line nexus", dice: 1 }],
          priorParadoxRolls: 2,
        },
      }),
    ).toBe(1 + 2 + 2 + 1)
  })

  it("takes a die off for a rote and for a magical tool in hand", () => {
    const tides = { ...calm, witnessCount: 1 }
    expect(previewParadoxDice({ sheet: makeSheet({ gnosis: 1 }), isRote: true, tides })).toBe(2)
    expect(
      previewParadoxDice({ sheet: makeSheet({ gnosis: 1, hasMagicalTool: true }), isRote: true, tides }),
    ).toBe(1)
  })

  it("never goes below none", () => {
    expect(
      previewParadoxDice({
        sheet: makeSheet({ gnosis: 1, hasMagicalTool: true }),
        isRote: true,
        tides: { ...calm, circumstances: [{ source: "Hallowed ground", dice: -2 }] },
      }),
    ).toBe(0)
  })
})
