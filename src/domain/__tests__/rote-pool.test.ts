import { Effect, Exit } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { formatRotePool, parseRotePool, RotePool } from "../rote-pool"

const failureTag = (exit: Exit.Exit<unknown, unknown>) => {
  if (!Exit.isFailure(exit)) return null
  const fail = exit.cause.reasons.find((r) => r._tag === "Fail") as
    | { error: { _tag: string } }
    | undefined
  return fail?.error._tag ?? null
}

describe("RotePool.parse (issue #14 grammar)", () => {
  it.effect("a plain Attribute + Skill + Arcanum pool", () =>
    Effect.gen(function* () {
      const pool = yield* parseRotePool("Composure + Occult + Mind")
      expect(pool.attribute).toBe("Composure")
      expect(pool.skills).toEqual(["Occult"])
      expect(pool.arcanum).toBe("Mind")
      expect(pool.vs).toBeUndefined()
    }),
  )

  it.effect("trailing prose junk from extraction is discarded", () =>
    Effect.gen(function* () {
      const pool = yield* parseRotePool("Dexterity + Athletics + Forces The Adamantine Arrow")
      expect(pool.attribute).toBe("Dexterity")
      expect(pool.skills).toEqual(["Athletics"])
      expect(pool.arcanum).toBe("Forces")
    }),
  )

  it.effect("an 'or' alternative on the Skill slot", () =>
    Effect.gen(function* () {
      const pool = yield* parseRotePool("Wits + Athletics or Larceny + Forces")
      expect(pool.attribute).toBe("Wits")
      expect(pool.skills).toEqual(["Athletics", "Larceny"])
      expect(pool.arcanum).toBe("Forces")
    }),
  )

  it.effect("a contested 'vs' pool with a two-trait resistance", () =>
    Effect.gen(function* () {
      const pool = yield* parseRotePool("Presence + Occult + Death vs Resolve + Gnosis")
      expect(pool.vs).toEqual(["Resolve", "Gnosis"])
    }),
  )

  it.effect("a contested 'vs' pool with a single-trait resistance", () =>
    Effect.gen(function* () {
      const pool = yield* parseRotePool("Intelligence + Medicine + Life vs Stamina")
      expect(pool.vs).toEqual(["Stamina"])
    }),
  )

  it.effect("the literal 'Resistance' trait (spirits and ghosts)", () =>
    Effect.gen(function* () {
      const pool = yield* parseRotePool("Presence + Persuasion + Spirit vs Resistance Even the")
      expect(pool.vs).toEqual(["Resistance"])
    }),
  )

  it.effect("'or' and 'vs' combine, with junk after the resistance", () =>
    Effect.gen(function* () {
      const pool = yield* parseRotePool(
        "Intelligence + Occult or Science + Forces vs Stamina + Gnosis The",
      )
      expect(pool.skills).toEqual(["Occult", "Science"])
      expect(pool.vs).toEqual(["Stamina", "Gnosis"])
    }),
  )

  it.effect("two-word skills parse (Animal Ken)", () =>
    Effect.gen(function* () {
      const pool = yield* parseRotePool(
        "Intelligence + Animal Ken or Survival + Life vs Stamina Free Council",
      )
      expect(pool.skills).toEqual(["Animal Ken", "Survival"])
      expect(pool.vs).toEqual(["Stamina"])
    }),
  )

  it.effect("an Attribute may rate the skill slot (perception rotes)", () =>
    Effect.gen(function* () {
      const pool = yield* parseRotePool("Wits + Composure + Forces Few")
      expect(pool.attribute).toBe("Wits")
      expect(pool.skills).toEqual(["Composure"])
      expect(pool.arcanum).toBe("Forces")
    }),
  )

  it.effect("multi-way 'or' with book parentheticals", () =>
    Effect.gen(function* () {
      const pool = yield* parseRotePool(
        "Intelligence + Survival (plants) or Animal Ken (animals) or Medicine (humans) + Life",
      )
      expect(pool.skills).toEqual(["Survival", "Animal Ken", "Medicine"])
    }),
  )

  it.effect("normalization: missing '+' spacing, 'vs.', and the Craft typo", () =>
    Effect.gen(function* () {
      const squished = yield* parseRotePool("Manipulation+Occult+Fate It is not")
      expect(squished.skills).toEqual(["Occult"])

      const craft = yield* parseRotePool("Resolve + Craft or Occult + Prime Just")
      expect(craft.skills).toEqual(["Crafts", "Occult"])

      const dotted = yield* parseRotePool("Wits + Occult + Fate vs. Resolve + Gnosis")
      expect(dotted.vs).toEqual(["Resolve", "Gnosis"])
    }),
  )

  it.effect("spirit Power and spell Potency are resistance traits", () =>
    Effect.gen(function* () {
      const spirit = yield* parseRotePool(
        "Presence + Intimidation + Spirit vs Power + Resistance Often",
      )
      expect(spirit.vs).toEqual(["Power", "Resistance"])

      const potency = yield* parseRotePool("Resolve + Occult + Fate vs Potency")
      expect(potency.vs).toEqual(["Potency"])
    }),
  )

  it.effect("prose that is not a pool fails UnparseableRotePool", () =>
    Effect.gen(function* () {
      for (const bad of [
        "",
        "Occult + Composure + Mind", // skill first — not the grammar
        "Composure + Occult", // no Arcanum
        "Composure + Occult + Kung Fu", // unknown Arcanum
        "Composure + Occult + Mind vs", // dangling contested clause
      ]) {
        const exit = yield* parseRotePool(bad).pipe(Effect.exit)
        expect(failureTag(exit)).toBe("UnparseableRotePool")
      }
    }),
  )
})

describe("RotePool.format (canonical prose)", () => {
  it.effect("round-trips the canonical form", () =>
    Effect.gen(function* () {
      for (const canonical of [
        "Composure + Occult + Mind",
        "Wits + Athletics or Larceny + Forces",
        "Presence + Occult + Death vs Resolve + Gnosis",
        "Intelligence + Occult or Science + Forces vs Stamina + Gnosis",
        "Presence + Persuasion + Spirit vs Resistance",
      ]) {
        const pool = yield* parseRotePool(canonical)
        expect(formatRotePool(pool)).toBe(canonical)
      }
    }),
  )

  it.effect("formatting a parsed junk-tailed pool yields the clean form", () =>
    Effect.gen(function* () {
      const pool = yield* parseRotePool("Composure + Occult + Mind Advancing the")
      expect(formatRotePool(pool)).toBe("Composure + Occult + Mind")
    }),
  )

  it("RotePool constructs from plain JSON (the data-layer artifact)", () => {
    const decoded = new RotePool({
      attribute: "Wits",
      skills: ["Athletics"],
      arcanum: "Forces",
    })
    expect(decoded.arcanum).toBe("Forces")
  })
})
