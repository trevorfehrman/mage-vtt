import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import { matchesConvexValidator, validatorJson } from "../testing/convex-validator"
import {
  CharacterDoc,
  CombatDoc,
  DiceRollDoc,
  MessageDoc,
  SessionMemberDoc,
} from "../tables"

/**
 * Round-trip safety net for the schema bridge (ADR-0005): for each seam table,
 * generate arbitrary rows from the Effect-Schema mirror and assert every sample
 * (a) satisfies the *derived* Convex validator and (b) survives decode → encode.
 * If the bridge ever mis-compiles a construct these tables use, a generated
 * counterexample fails here rather than silently accepting bad rows in production.
 */

const tables = {
  sessionMembers: SessionMemberDoc,
  diceRolls: DiceRollDoc,
  messages: MessageDoc,
  characters: CharacterDoc,
  combats: CombatDoc,
} as const

describe("schema bridge: derived validators accept their mirror's rows", () => {
  for (const [name, schema] of Object.entries(tables)) {
    const node = validatorJson(schema)
    const decode = Schema.decodeUnknownSync(schema)
    const encode = Schema.encodeUnknownSync(schema)

    it.prop(
      `${name}: arbitrary rows pass the derived validator and round-trip`,
      [Schema.toArbitrary(schema)],
      ([sample]) => {
        expect(matchesConvexValidator(sample, node)).toBe(true)
        // decode ∘ encode is identity for these persistence mirrors.
        expect(decode(encode(sample))).toEqual(sample)
      },
    )
  }
})
