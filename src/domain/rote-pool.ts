import { Effect, Schema } from "effect"

/**
 * Structured Rote dice pools (PRD #11, issue #14).
 *
 * Every Rote in the book declares its pool as prose — "Wits + Athletics or
 * Larceny + Forces", "Presence + Occult + Death vs Resolve + Gnosis". The
 * domain consumes structure only, never prose: parsing happens at the data
 * layer (scripts/apply-corrections.ts), which stores the structured `RotePool`
 * beside a canonical prose form. "Or" alternatives are the ≥1 entries of
 * `skills` (the caster picks one at cast time); a contested pool records the
 * target's traits in `vs` for the Storyteller to roll or adjudicate.
 */

export const ROTE_ATTRIBUTES = [
  "Strength", "Dexterity", "Stamina",
  "Intelligence", "Wits", "Resolve",
  "Presence", "Manipulation", "Composure",
] as const

export const ROTE_SKILLS = [
  "Academics", "Computer", "Crafts", "Investigation", "Medicine",
  "Occult", "Politics", "Science",
  "Athletics", "Brawl", "Drive", "Firearms", "Larceny",
  "Stealth", "Survival", "Weaponry",
  "Animal Ken", "Empathy", "Expression", "Intimidation",
  "Persuasion", "Socialize", "Streetwise", "Subterfuge",
] as const

export const ROTE_ARCANA = [
  "Death", "Fate", "Forces", "Life", "Matter",
  "Mind", "Prime", "Space", "Spirit", "Time",
] as const

/** The skill slot is usually a Skill, but a handful of book rotes rate a
 * second Attribute there ("Wits + Composure + Forces"). Names never collide
 * across the two vocabularies, so consumers resolve dots by name. */
export const SKILL_SLOT_TRAITS = [...ROTE_SKILLS, ...ROTE_ATTRIBUTES] as const

/** What a contested pool may resist with: an Attribute, Gnosis, a spirit's
 * Power/Resistance, or a bound spell's Potency. */
export const RESISTANCE_TRAITS = [
  ...ROTE_ATTRIBUTES,
  "Gnosis",
  "Resistance",
  "Power",
  "Potency",
] as const

export const RoteAttributeName = Schema.Literals(ROTE_ATTRIBUTES)
export const SkillSlotTraitName = Schema.Literals(SKILL_SLOT_TRAITS)
export const RoteArcanumName = Schema.Literals(ROTE_ARCANA)
export const ResistanceTraitName = Schema.Literals(RESISTANCE_TRAITS)

export class RotePool extends Schema.Class<RotePool>("RotePool")({
  attribute: RoteAttributeName,
  /** ≥1; more than one means the book offered "or" alternatives. */
  skills: Schema.NonEmptyArray(SkillSlotTraitName),
  arcanum: RoteArcanumName,
  /** Present on contested pools: the target's resistance traits. `optionalKey`
   * (absent, never `undefined`/`null`) so the derived Convex column is exactly
   * `v.optional(v.array(...))` — the persisted shape (issue #54). */
  vs: Schema.optionalKey(Schema.NonEmptyArray(ResistanceTraitName)),
}) {}

// --- Errors (ADR-0010) ---

/** Validation: the prose does not scan as `Attribute + Skill[ or Skill] +
 * Arcanum[ vs Trait[ + Trait]]`. Raised at the data layer, never at play. */
export class UnparseableRotePool extends Schema.TaggedErrorClass<UnparseableRotePool>()(
  "UnparseableRotePool",
  {
    pool: Schema.String,
    reason: Schema.String,
  },
) {}

// --- Parsing ---

/** Longest-first prefix match of a vocabulary word at a word boundary. */
const matchOne = <T extends string>(
  input: string,
  vocab: readonly T[],
): { value: T; rest: string } | null => {
  for (const word of [...vocab].sort((a, b) => b.length - a.length)) {
    if (input === word) return { value: word, rest: "" }
    if (input.startsWith(`${word} `)) {
      return { value: word, rest: input.slice(word.length + 1) }
    }
  }
  return null
}

const consume = (input: string, token: string): string | null =>
  input === token
    ? ""
    : input.startsWith(`${token} `)
      ? input.slice(token.length + 1)
      : null

/**
 * Parse a Rote pool's prose into structure. Tolerates the extraction
 * artifact of trailing sentence junk ("… + Forces The Adamantine Arrow"):
 * anything after the grammar completes is discarded.
 */
export const parseRotePool = Effect.fn("RotePool.parse")(function* (prose: string) {
  const fail = (reason: string) =>
    new UnparseableRotePool({ pool: prose, reason })

  // Normalize extraction artifacts: book parentheticals ("(plants)"), squeezed
  // "+", the "vs." period, and the recurring "Craft" typo for Crafts.
  let s = prose
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s*\+\s*/g, " + ")
    .replace(/\bvs\./g, "vs")
    .replace(/\bCraft\b/g, "Crafts")
    .trim()
    .replace(/\s+/g, " ")

  const attribute = matchOne(s, ROTE_ATTRIBUTES)
  if (!attribute) return yield* fail("expected an Attribute first")
  s = attribute.rest

  const afterAttr = consume(s, "+")
  if (afterAttr === null) return yield* fail("expected '+' after the Attribute")
  s = afterAttr

  const firstSkill = matchOne(s, SKILL_SLOT_TRAITS)
  if (!firstSkill) return yield* fail("expected a Skill (or Attribute) second")
  s = firstSkill.rest
  const skills: [
    (typeof SKILL_SLOT_TRAITS)[number],
    ...Array<(typeof SKILL_SLOT_TRAITS)[number]>,
  ] = [firstSkill.value]

  for (let afterOr = consume(s, "or"); afterOr !== null; afterOr = consume(s, "or")) {
    const alternative = matchOne(afterOr, SKILL_SLOT_TRAITS)
    if (!alternative) return yield* fail("expected a Skill after 'or'")
    skills.push(alternative.value)
    s = alternative.rest
  }

  const afterSkills = consume(s, "+")
  if (afterSkills === null) return yield* fail("expected '+' before the Arcanum")
  s = afterSkills

  const arcanum = matchOne(s, ROTE_ARCANA)
  if (!arcanum) return yield* fail("expected an Arcanum third")
  s = arcanum.rest

  let vs:
    | [
        (typeof RESISTANCE_TRAITS)[number],
        ...Array<(typeof RESISTANCE_TRAITS)[number]>,
      ]
    | undefined
  const afterVs = consume(s, "vs")
  if (afterVs !== null) {
    const firstTrait = matchOne(afterVs, RESISTANCE_TRAITS)
    if (!firstTrait) return yield* fail("expected a resistance trait after 'vs'")
    vs = [firstTrait.value]
    s = firstTrait.rest
    for (let next = consume(s, "+"); next !== null; next = consume(s, "+")) {
      const trait = matchOne(next, RESISTANCE_TRAITS)
      if (!trait) return yield* fail("expected a resistance trait after '+'")
      vs.push(trait.value)
      s = trait.rest
    }
  }

  // Whatever remains is extraction junk (the sentence that followed the pool
  // in the book column) — dropped by design.

  return new RotePool({
    attribute: attribute.value,
    skills,
    ...(vs ? { vs } : {}),
    arcanum: arcanum.value,
  })
})

/** The canonical prose for a structured pool — what the data layer stores in
 * `dicePool` and what the UI displays. */
export const formatRotePool = (pool: RotePool): string => {
  const cast = `${pool.attribute} + ${pool.skills.join(" or ")} + ${pool.arcanum}`
  return pool.vs ? `${cast} vs ${pool.vs.join(" + ")}` : cast
}
