import { Effect, Option, Schema } from "effect"
import type { CharacterSheet, KnownRote, OrderName } from "./character"
import {
  ROTE_ATTRIBUTES,
  ROTE_SKILLS,
  RoteArcanumName,
  SkillSlotTraitName,
  type RotePool,
} from "./rote-pool"

/** A spell is Covert or Vulgar — nothing else survives the data pipeline
 * (issue #14's cleanup; the conformance test is the tripwire). */
export const SpellAspect = Schema.Literals(["Covert", "Vulgar"])
export type SpellAspect = typeof SpellAspect.Type

/**
 * The spell reference row as the domain reads it (issue #18): the business key
 * a `KnownRote` names (spell name + Arcanum) plus what casting consults — the
 * Aspect for the phase gate, the level for the narrative. Decoded from the
 * `spells` table at the adapter; a row that fails this decode is corrupt data.
 */
export class SpellRef extends Schema.Class<SpellRef>("SpellRef")({
  name: Schema.String,
  arcanum: RoteArcanumName,
  level: Schema.Number.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 5 }),
  ),
  aspect: SpellAspect,
}) {}

/**
 * Pure leaves of Rote casting (PRD #11, issue #18): a Rote's structured pool
 * names Traits ("Presence + Occult + Death"); casting resolves those names
 * against the caster's own sheet. The vocabulary bridge lives here — the
 * capitalized book names of `RotePool` map onto the sheet's lowercase nested
 * ratings once, in one place.
 */

type SheetRatings = Pick<CharacterSheet, "attributes" | "skills" | "arcana">

/**
 * The three Rote Specialty skills each Order codes its Rotes with (see
 * CONTEXT.md "Rote Specialty"; chunk-0741) — the one table, total over the
 * closed Order vocabulary (ADR-0014). Creation validation and the casting
 * bonus both read it here.
 */
export const ORDER_ROTE_SKILLS: Record<OrderName, ReadonlyArray<string>> = {
  "Adamantine Arrow": ["Athletics", "Intimidation", "Medicine"],
  "Free Council": ["Crafts", "Persuasion", "Science"],
  "Guardians of the Veil": ["Investigation", "Stealth", "Subterfuge"],
  "Mysterium": ["Investigation", "Occult", "Survival"],
  "Silver Ladder": ["Expression", "Persuasion", "Subterfuge"],
}

const ATTRIBUTE_DOTS: Record<
  (typeof ROTE_ATTRIBUTES)[number],
  (sheet: SheetRatings) => number
> = {
  Strength: (s) => s.attributes.physical.strength,
  Dexterity: (s) => s.attributes.physical.dexterity,
  Stamina: (s) => s.attributes.physical.stamina,
  Intelligence: (s) => s.attributes.mental.intelligence,
  Wits: (s) => s.attributes.mental.wits,
  Resolve: (s) => s.attributes.mental.resolve,
  Presence: (s) => s.attributes.social.presence,
  Manipulation: (s) => s.attributes.social.manipulation,
  Composure: (s) => s.attributes.social.composure,
}

const SKILL_DOTS: Record<
  (typeof ROTE_SKILLS)[number],
  (sheet: SheetRatings) => number
> = {
  Academics: (s) => s.skills.mental.academics,
  Computer: (s) => s.skills.mental.computer,
  Crafts: (s) => s.skills.mental.crafts,
  Investigation: (s) => s.skills.mental.investigation,
  Medicine: (s) => s.skills.mental.medicine,
  Occult: (s) => s.skills.mental.occult,
  Politics: (s) => s.skills.mental.politics,
  Science: (s) => s.skills.mental.science,
  Athletics: (s) => s.skills.physical.athletics,
  Brawl: (s) => s.skills.physical.brawl,
  Drive: (s) => s.skills.physical.drive,
  Firearms: (s) => s.skills.physical.firearms,
  Larceny: (s) => s.skills.physical.larceny,
  Stealth: (s) => s.skills.physical.stealth,
  Survival: (s) => s.skills.physical.survival,
  Weaponry: (s) => s.skills.physical.weaponry,
  "Animal Ken": (s) => s.skills.social.animalKen,
  Empathy: (s) => s.skills.social.empathy,
  Expression: (s) => s.skills.social.expression,
  Intimidation: (s) => s.skills.social.intimidation,
  Persuasion: (s) => s.skills.social.persuasion,
  Socialize: (s) => s.skills.social.socialize,
  Streetwise: (s) => s.skills.social.streetwise,
  Subterfuge: (s) => s.skills.social.subterfuge,
}

/** Skill-slot lookup across both vocabularies: a handful of book pools rate a
 * second Attribute in the skill slot; names never collide. */
const skillSlotDots = (
  sheet: SheetRatings,
  name: (typeof ROTE_SKILLS)[number] | (typeof ROTE_ATTRIBUTES)[number],
): { dots: number; kind: "skill" | "attribute" } =>
  name in SKILL_DOTS
    ? { dots: SKILL_DOTS[name as (typeof ROTE_SKILLS)[number]](sheet), kind: "skill" }
    : {
        dots: ATTRIBUTE_DOTS[name as (typeof ROTE_ATTRIBUTES)[number]](sheet),
        kind: "attribute",
      }

// --- Errors (ADR-0010) ---

/**
 * Rules/precondition: the spell is Vulgar-aspected, and the atomic covert
 * flows must not silently skip Paradox — Vulgar casting routes through the
 * Cast ladder instead (`draftCast`'s rote lane, issue #47). Aspect gates;
 * method does not: this is the same refusal for a Rote or an improvised
 * effect of the spell. The tag's name outlived its "not yet" (it predates
 * the ladder); it stays because renaming a wire vocabulary is its own issue.
 */
export class VulgarCastingNotYetSupported extends Schema.TaggedErrorClass<VulgarCastingNotYetSupported>()(
  "VulgarCastingNotYetSupported",
  {
    spellName: Schema.String,
    arcanum: RoteArcanumName,
  },
) {}

/**
 * Rules/precondition: the Rote's pool offers "or" alternatives and the cast
 * declared no pick (or picked something the book never offered). The caster
 * chooses one alternative at cast time.
 */
export class RoteSkillChoiceRequired extends Schema.TaggedErrorClass<RoteSkillChoiceRequired>()(
  "RoteSkillChoiceRequired",
  {
    roteName: Schema.String,
    alternatives: Schema.Array(SkillSlotTraitName),
  },
) {}

/** The Covert-tier gate (PRD #11): every cast flow consults the spell's Aspect
 * and refuses Vulgar with the phase's typed error. */
export const requireCovertSpell = Effect.fn("RoteCast.requireCovertSpell")(function* (
  spell: SpellRef,
) {
  if (spell.aspect === "Vulgar") {
    return yield* new VulgarCastingNotYetSupported({
      spellName: spell.name,
      arcanum: spell.arcanum,
    })
  }
})

/**
 * Rules/precondition: the spell is Covert-aspected — it casts atomically,
 * never through the Vulgar ladder's Paradox handshake. The mirror of
 * `VulgarCastingNotYetSupported`: together the two gates keep the lanes
 * disjoint (issue #47).
 */
export class SpellNotVulgar extends Schema.TaggedErrorClass<SpellNotVulgar>()(
  "SpellNotVulgar",
  {
    spellName: Schema.String,
    arcanum: RoteArcanumName,
  },
) {}

/** The Vulgar-ladder gate (issue #47): the draft's rote lane consults the
 * spell's Aspect — reference data, never client input (PRD #11) — and
 * refuses Covert: covert magic faces no Paradox. */
export const requireVulgarSpell = Effect.fn("RoteCast.requireVulgarSpell")(function* (
  spell: SpellRef,
) {
  if (spell.aspect === "Covert") {
    return yield* new SpellNotVulgar({
      spellName: spell.name,
      arcanum: spell.arcanum,
    })
  }
})

/** The resolved casting traits: names straight off the Rote, dots off the sheet. */
export const ResolvedRotePool = Schema.Struct({
  attribute: Schema.Struct({ name: Schema.String, dots: Schema.Number }),
  /** The skill slot may hold a second Attribute ("Wits + Composure + Forces"). */
  skill: Schema.Struct({
    name: Schema.String,
    dots: Schema.Number,
    kind: Schema.Literals(["skill", "attribute"]),
  }),
  arcanum: Schema.Struct({ name: Schema.String, dots: Schema.Number }),
})
export type ResolvedRotePool = typeof ResolvedRotePool.Type

/**
 * The plain core (ADR-0014, issue #51): resolve the pool, `None` when the
 * "or" choice is missing or one the book never offered. The Effect door below
 * names that absence `RoteSkillChoiceRequired` for the flows; the cast
 * preview consumes the Option directly.
 */
export const resolveRotePoolChoice = (
  sheet: SheetRatings,
  rote: KnownRote,
  skillChoice?: string,
): Option.Option<ResolvedRotePool> => {
  const pool: RotePool = rote.pool

  // The skill slot: a declared choice must be one the book offered; an "or"
  // pool with no declaration is unpickable by the engine — the caster decides.
  const offeredChoice = (choice: string) =>
    Option.fromUndefinedOr(pool.skills.find((s) => s === choice))
  const soleSkill = () =>
    Option.filter(Option.some(pool.skills[0]), () => pool.skills.length === 1)
  const skillName = skillChoice !== undefined ? offeredChoice(skillChoice) : soleSkill()

  return Option.map(skillName, (name) => ({
    attribute: {
      name: pool.attribute,
      dots: ATTRIBUTE_DOTS[pool.attribute](sheet),
    },
    skill: {
      name,
      ...skillSlotDots(sheet, name),
    },
    arcanum: {
      name: pool.arcanum,
      dots: sheet.arcana[pool.arcanum.toLowerCase() as keyof typeof sheet.arcana] ?? 0,
    },
  }))
}

export const resolveRotePool = Effect.fn("RoteCast.resolveRotePool")(function* (
  sheet: SheetRatings,
  rote: KnownRote,
  skillChoice?: string,
) {
  const resolved = resolveRotePoolChoice(sheet, rote, skillChoice)
  if (Option.isNone(resolved)) {
    return yield* new RoteSkillChoiceRequired({
      roteName: rote.name,
      alternatives: rote.pool.skills,
    })
  }
  return resolved.value
})
