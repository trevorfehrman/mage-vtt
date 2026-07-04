import { describe, expect, it } from "@effect/vitest"
import { v } from "convex/values"
import { schemaToConvexValidator } from "../schema-bridge"
import { CharacterDoc } from "../tables"

/**
 * Equivalence guard for the `characters` table migration to a derived validator
 * (ADR-0005, PRD #4 slice #6). Real character documents already exist under the
 * hand-written `v.*` definition this replaces, so the validator derived from the
 * `CharacterDoc` mirror must compile to the *identical* shape — this test holds
 * the previous hand-written definition verbatim and diffs the two validators'
 * structural JSON. If the mirror ever drifts (a renamed column, a lost
 * `v.optional`, a widened type), existing stored characters would stop
 * validating; this fails first.
 */

// The `characters` definition exactly as it was hand-written in convex/schema.ts
// before derivation. Frozen here as the shape contract for existing documents —
// never edited; columns added since are declared separately below so this block
// keeps guarding the pre-existing stored shape.
const handWritten = v.object({
  sessionMemberId: v.id("sessionMembers"),
  sessionId: v.id("sessions"),
  userId: v.string(),
  name: v.string(),
  shadowName: v.optional(v.string()),
  concept: v.string(),
  virtue: v.string(),
  vice: v.string(),
  path: v.string(),
  order: v.string(),
  gnosis: v.number(),
  attributes: v.object({
    mental: v.object({
      intelligence: v.number(),
      wits: v.number(),
      resolve: v.number(),
    }),
    physical: v.object({
      strength: v.number(),
      dexterity: v.number(),
      stamina: v.number(),
    }),
    social: v.object({
      presence: v.number(),
      manipulation: v.number(),
      composure: v.number(),
    }),
  }),
  skills: v.object({
    mental: v.object({
      academics: v.number(),
      computer: v.number(),
      crafts: v.number(),
      investigation: v.number(),
      medicine: v.number(),
      occult: v.number(),
      politics: v.number(),
      science: v.number(),
    }),
    physical: v.object({
      athletics: v.number(),
      brawl: v.number(),
      drive: v.number(),
      firearms: v.number(),
      larceny: v.number(),
      stealth: v.number(),
      survival: v.number(),
      weaponry: v.number(),
    }),
    social: v.object({
      animalKen: v.number(),
      empathy: v.number(),
      expression: v.number(),
      intimidation: v.number(),
      persuasion: v.number(),
      socialize: v.number(),
      streetwise: v.number(),
      subterfuge: v.number(),
    }),
  }),
  arcana: v.object({
    death: v.optional(v.number()),
    fate: v.optional(v.number()),
    forces: v.optional(v.number()),
    life: v.optional(v.number()),
    matter: v.optional(v.number()),
    mind: v.optional(v.number()),
    prime: v.optional(v.number()),
    space: v.optional(v.number()),
    spirit: v.optional(v.number()),
    time: v.optional(v.number()),
  }),
  healthTrack: v.array(v.string()),
  willpowerCurrent: v.number(),
  manaCurrent: v.number(),
})

// Columns added after the migration, each *optional* so every document stored
// under the frozen shape above still validates. `knownRotes`: issue #16.
const addedColumns = {
  knownRotes: v.optional(
    v.array(
      v.object({
        name: v.string(),
        spellName: v.string(),
        spellArcanum: v.string(),
        spellLevel: v.number(),
        order: v.string(),
        pool: v.object({
          attribute: v.string(),
          skills: v.array(v.string()),
          arcanum: v.string(),
          vs: v.optional(v.array(v.string())),
        }),
      }),
    ),
  ),
}

const structuralJson = (validator: unknown): unknown =>
  JSON.parse(JSON.stringify((validator as { json: unknown }).json))

describe("characters table: derived validator equals the hand-written shape", () => {
  it("schemaToConvexValidator(CharacterDoc) compiles to the frozen definition plus the optional added columns", () => {
    const derived = schemaToConvexValidator(CharacterDoc)
    const expected = v.object({ ...handWritten.fields, ...addedColumns })
    expect(structuralJson(derived)).toEqual(structuralJson(expected))
  })
})
