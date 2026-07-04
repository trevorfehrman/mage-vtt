import { Effect, Exit, Schema } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { KnownRote } from "../character"
import { RotePool } from "../rote-pool"
import { requireCovertSpell, resolveRotePool, SpellRef } from "../rote-cast"
import { failureTag, makeAldousSheet } from "../testing/fixtures"

/**
 * Pure leaves of Rote casting (PRD #11, issue #18): resolving a Rote's
 * structured pool against the caster's Character Sheet. External behavior
 * only — trait names in, dots out, typed refusals for unpickable pools.
 */

const roteOf = (pool: ConstructorParameters<typeof RotePool>[0]) =>
  new KnownRote({
    name: "Grave Mien",
    spellName: "Speak with the Dead",
    spellArcanum: "Death",
    spellLevel: 2,
    order: "Mysterium",
    pool: new RotePool(pool),
  })

describe("RoteCast.resolveRotePool", () => {
  it.effect("resolves Attribute + Skill + Arcanum dots from the caster's sheet", () =>
    Effect.gen(function* () {
      // Aldous: Presence 2, Occult 4, Death 3.
      const resolved = yield* resolveRotePool(
        makeAldousSheet(),
        roteOf({ attribute: "Presence", skills: ["Occult"], arcanum: "Death" }),
      )

      expect(resolved).toEqual({
        attribute: { name: "Presence", dots: 2 },
        skill: { name: "Occult", dots: 4, kind: "skill" },
        arcanum: { name: "Death", dots: 3 },
      })
    }),
  )

  it.effect("resolves every skill by its book name, two-word names included", () =>
    Effect.gen(function* () {
      // A sheet with distinctive dots in each category: Animal Ken 5 proves
      // the two-word bridge; Larceny 2 a physical skill; Matter 2 the Arcanum.
      const sheet = makeAldousSheet({
        skills: {
          ...makeAldousSheet().skills,
          social: { ...makeAldousSheet().skills.social, animalKen: 5 },
        },
      })

      const animalKen = yield* resolveRotePool(
        sheet,
        roteOf({ attribute: "Wits", skills: ["Animal Ken"], arcanum: "Matter" }),
      )
      expect(animalKen.skill).toEqual({ name: "Animal Ken", dots: 5, kind: "skill" })
      expect(animalKen.attribute).toEqual({ name: "Wits", dots: 2 })
      expect(animalKen.arcanum).toEqual({ name: "Matter", dots: 2 })

      const larceny = yield* resolveRotePool(
        sheet,
        roteOf({ attribute: "Dexterity", skills: ["Larceny"], arcanum: "Death" }),
      )
      expect(larceny.skill).toEqual({ name: "Larceny", dots: 2, kind: "skill" })
    }),
  )

  it.effect("an unrated Arcanum resolves to 0 dots (absent from the sheet's map)", () =>
    Effect.gen(function* () {
      const resolved = yield* resolveRotePool(
        makeAldousSheet(),
        roteOf({ attribute: "Presence", skills: ["Occult"], arcanum: "Forces" }),
      )
      expect(resolved.arcanum).toEqual({ name: "Forces", dots: 0 })
    }),
  )

  it.effect("a second Attribute in the skill slot resolves as an attribute", () =>
    Effect.gen(function* () {
      // "Wits + Composure + Forces" — Aldous: Composure 3.
      const resolved = yield* resolveRotePool(
        makeAldousSheet(),
        roteOf({ attribute: "Wits", skills: ["Composure"], arcanum: "Forces" }),
      )
      expect(resolved.skill).toEqual({ name: "Composure", dots: 3, kind: "attribute" })
    }),
  )

  it.effect("an 'or' pool casts with the chosen alternative", () =>
    Effect.gen(function* () {
      // Aldous: Athletics 1, Larceny 2.
      const orPool = roteOf({
        attribute: "Dexterity",
        skills: ["Athletics", "Larceny"],
        arcanum: "Death",
      })

      const larceny = yield* resolveRotePool(makeAldousSheet(), orPool, "Larceny")
      expect(larceny.skill).toEqual({ name: "Larceny", dots: 2, kind: "skill" })

      const athletics = yield* resolveRotePool(makeAldousSheet(), orPool, "Athletics")
      expect(athletics.skill).toEqual({ name: "Athletics", dots: 1, kind: "skill" })
    }),
  )

  it.effect("an 'or' pool without a choice is refused RoteSkillChoiceRequired", () =>
    Effect.gen(function* () {
      const exit = yield* resolveRotePool(
        makeAldousSheet(),
        roteOf({
          attribute: "Dexterity",
          skills: ["Athletics", "Larceny"],
          arcanum: "Death",
        }),
      ).pipe(Effect.exit)

      expect(failureTag(exit)).toBe("RoteSkillChoiceRequired")
      if (Exit.isFailure(exit)) {
        const fail = exit.cause.reasons.find((r) => r._tag === "Fail") as {
          error: { alternatives: ReadonlyArray<string> }
        }
        expect(fail.error.alternatives).toEqual(["Athletics", "Larceny"])
      }
    }),
  )

  it.effect("a choice outside the offered alternatives is refused the same way", () =>
    Effect.gen(function* () {
      const exit = yield* resolveRotePool(
        makeAldousSheet(),
        roteOf({
          attribute: "Dexterity",
          skills: ["Athletics", "Larceny"],
          arcanum: "Death",
        }),
        "Occult",
      ).pipe(Effect.exit)

      expect(failureTag(exit)).toBe("RoteSkillChoiceRequired")
    }),
  )

  it.effect("a single-skill pool needs no choice, and tolerates naming the one skill", () =>
    Effect.gen(function* () {
      const pool = roteOf({ attribute: "Presence", skills: ["Occult"], arcanum: "Death" })

      const named = yield* resolveRotePool(makeAldousSheet(), pool, "Occult")
      expect(named.skill.name).toBe("Occult")

      const offListChoice = yield* resolveRotePool(
        makeAldousSheet(),
        pool,
        "Athletics",
      ).pipe(Effect.exit)
      expect(failureTag(offListChoice)).toBe("RoteSkillChoiceRequired")
    }),
  )
})

describe("SpellRef and the aspect gate", () => {
  it("decodes a clean spell reference row and rejects a dirty Aspect", () => {
    const decoded = Schema.decodeUnknownSync(SpellRef)({
      name: "Speak with the Dead",
      arcanum: "Death",
      level: 2,
      aspect: "Covert",
    })
    expect(decoded.aspect).toBe("Covert")

    expect(() =>
      Schema.decodeUnknownSync(SpellRef)({
        name: "Corrupt Row",
        arcanum: "Death",
        level: 1,
        aspect: "Covert (see description)",
      }),
    ).toThrow()
  })

  it.effect("a Covert spell passes the gate; a Vulgar one is refused with the phase's tag", () =>
    Effect.gen(function* () {
      const covert = new SpellRef({
        name: "Speak with the Dead",
        arcanum: "Death",
        level: 2,
        aspect: "Covert",
      })
      yield* requireCovertSpell(covert)

      const vulgar = new SpellRef({
        name: "Ectoplasmic Shaping",
        arcanum: "Death",
        level: 1,
        aspect: "Vulgar",
      })
      const exit = yield* requireCovertSpell(vulgar).pipe(Effect.exit)
      expect(failureTag(exit)).toBe("VulgarCastingNotYetSupported")
      if (Exit.isFailure(exit)) {
        const fail = exit.cause.reasons.find((r) => r._tag === "Fail") as {
          error: { spellName: string }
        }
        expect(fail.error.spellName).toBe("Ectoplasmic Shaping")
      }
    }),
  )
})
