import { Effect, Match, Option, Schema } from "effect"
import { MeritValidationError } from "./merits"

// --- Types ---

const RatedPrerequisite = { name: Schema.String, minDots: Schema.Number }

const Prerequisite = Schema.Union([
  Schema.TaggedStruct("attribute", RatedPrerequisite),
  Schema.TaggedStruct("skill", RatedPrerequisite),
  Schema.TaggedStruct("merit", RatedPrerequisite),
])
type Prerequisite = typeof Prerequisite.Type

const FightingStyleTier = Schema.Struct({
  dot: Schema.Number,
  name: Schema.String,
  description: Schema.String,
})

const GeneralMeritDef = Schema.Struct({
  name: Schema.String,
  category: Schema.Literals(["mental", "physical", "social"]),
  minDots: Schema.Number,
  maxDots: Schema.Number,
  prerequisites: Schema.Array(Prerequisite),
  description: Schema.String,
  tiers: Schema.optionalKey(Schema.Array(FightingStyleTier)),
})
type GeneralMeritDef = typeof GeneralMeritDef.Type

// --- WoD Core General Merits (pages 109-117) ---

export const WOD_GENERAL_MERITS: ReadonlyArray<GeneralMeritDef> = [
  // --- Mental ---
  { name: "Common Sense", category: "mental", minDots: 4, maxDots: 4, prerequisites: [], description: "Storyteller can make a reflexive Wits + Composure roll to warn the character when about to do something unwise." },
  { name: "Danger Sense", category: "mental", minDots: 2, maxDots: 2, prerequisites: [], description: "+2 bonus to detect ambushes or other surprises." },
  { name: "Eidetic Memory", category: "mental", minDots: 2, maxDots: 2, prerequisites: [], description: "Perfect recall of observed details. No roll needed for memory." },
  { name: "Encyclopedic Knowledge", category: "mental", minDots: 4, maxDots: 4, prerequisites: [], description: "Vast general knowledge. Roll Intelligence + Wits to know obscure facts." },
  { name: "Holistic Awareness", category: "mental", minDots: 3, maxDots: 3, prerequisites: [], description: "Ability to treat injuries and illnesses with natural remedies." },
  { name: "Language", category: "mental", minDots: 1, maxDots: 3, prerequisites: [], description: "Each dot represents fluency in one additional language." },
  { name: "Meditative Mind", category: "mental", minDots: 1, maxDots: 1, prerequisites: [], description: "No penalty for interruptions during meditation." },
  { name: "Unseen Sense", category: "mental", minDots: 3, maxDots: 3, prerequisites: [{ _tag: "attribute", name: "wits", minDots: 2 }], description: "Sense supernatural activity nearby. Storyteller rolls Wits + Composure reflexively." },

  // --- Physical ---
  { name: "Ambidextrous", category: "physical", minDots: 3, maxDots: 3, prerequisites: [], description: "No off-hand penalty for using either hand." },
  { name: "Brawling Dodge", category: "physical", minDots: 1, maxDots: 1, prerequisites: [{ _tag: "attribute", name: "strength", minDots: 2 }, { _tag: "skill", name: "brawl", minDots: 1 }], description: "Use Brawl dots as Dodge bonus instead of doubling Defense." },
  { name: "Direction Sense", category: "physical", minDots: 1, maxDots: 1, prerequisites: [], description: "Innate sense of direction. +3 to navigate." },
  { name: "Disarm", category: "physical", minDots: 2, maxDots: 2, prerequisites: [{ _tag: "attribute", name: "dexterity", minDots: 3 }, { _tag: "skill", name: "weaponry", minDots: 2 }], description: "Knock weapon from opponent's hand with Dexterity + Weaponry - opponent's Strength." },
  { name: "Fast Reflexes", category: "physical", minDots: 1, maxDots: 2, prerequisites: [{ _tag: "attribute", name: "dexterity", minDots: 3 }], description: "+1 Initiative per dot." },
  { name: "Fighting Finesse", category: "physical", minDots: 2, maxDots: 2, prerequisites: [{ _tag: "attribute", name: "dexterity", minDots: 3 }, { _tag: "skill", name: "weaponry", minDots: 2 }], description: "Use Dexterity instead of Strength for Weaponry attacks with chosen weapon." },
  { name: "Fighting Style: Boxing", category: "physical", minDots: 1, maxDots: 5, prerequisites: [{ _tag: "attribute", name: "strength", minDots: 3 }, { _tag: "attribute", name: "stamina", minDots: 2 }, { _tag: "skill", name: "brawl", minDots: 2 }], description: "Trained boxer with escalating techniques.", tiers: [
    { dot: 1, name: "Body Blow", description: "Inflict Brawl damage as penalty to opponent's next action." },
    { dot: 2, name: "Duck and Weave", description: "Use Brawl + highest of Wits or Dexterity as Dodge." },
    { dot: 3, name: "Combination Blows", description: "Second attack in same turn at -1 instead of -2." },
    { dot: 4, name: "Haymaker", description: "All-out attack inflicts +1 damage on top of +2 dice." },
    { dot: 5, name: "Brutal Blow", description: "Sacrifice Defense for a devastating strike." },
  ]},
  { name: "Fighting Style: Kung Fu", category: "physical", minDots: 1, maxDots: 5, prerequisites: [{ _tag: "attribute", name: "strength", minDots: 2 }, { _tag: "attribute", name: "dexterity", minDots: 2 }, { _tag: "attribute", name: "stamina", minDots: 2 }, { _tag: "skill", name: "brawl", minDots: 2 }], description: "Martial artist with escalating techniques.", tiers: [
    { dot: 1, name: "Focused Attack", description: "Reduce target's Defense by 1 when attacking." },
    { dot: 2, name: "Iron Skin", description: "Spend Willpower to reduce incoming bashing damage by 1." },
    { dot: 3, name: "Defensive Attack", description: "Reduce attack pool to add same number to Defense." },
    { dot: 4, name: "Whirlwind Strike", description: "Attack all adjacent opponents in a single action at -1 each." },
    { dot: 5, name: "Lethal Strike", description: "Unarmed attacks deal lethal damage." },
  ]},
  { name: "Fighting Style: Two Weapons", category: "physical", minDots: 1, maxDots: 4, prerequisites: [{ _tag: "attribute", name: "dexterity", minDots: 3 }, { _tag: "skill", name: "weaponry", minDots: 3 }], description: "Dual wielding combat techniques.", tiers: [
    { dot: 1, name: "Whirling Blades", description: "+1 Defense when wielding two weapons." },
    { dot: 2, name: "Deflect and Thrust", description: "Sacrifice weapon Defense bonus to make immediate counterattack." },
    { dot: 3, name: "Focused Attack", description: "Reduce penalties for attacking same target with both weapons." },
    { dot: 4, name: "Fluid Attack", description: "Attack two different targets in same turn." },
  ]},
  { name: "Fleet of Foot", category: "physical", minDots: 1, maxDots: 3, prerequisites: [{ _tag: "attribute", name: "strength", minDots: 2 }], description: "+1 Speed per dot." },
  { name: "Fresh Start", category: "physical", minDots: 1, maxDots: 1, prerequisites: [{ _tag: "merit", name: "Fast Reflexes", minDots: 2 }], description: "Spend Willpower to re-roll Initiative." },
  { name: "Giant", category: "physical", minDots: 4, maxDots: 4, prerequisites: [], description: "+1 Size (and therefore +1 Health). Character is over 6'6\"." },
  { name: "Gunslinger", category: "physical", minDots: 3, maxDots: 3, prerequisites: [{ _tag: "attribute", name: "dexterity", minDots: 3 }, { _tag: "skill", name: "firearms", minDots: 3 }], description: "Reduce penalties for dual-wielding firearms." },
  { name: "Iron Stamina", category: "physical", minDots: 1, maxDots: 3, prerequisites: [{ _tag: "attribute", name: "stamina", minDots: 3 }], description: "Ignore fatigue penalties. Each dot negates -1 wound penalty." },
  { name: "Iron Stomach", category: "physical", minDots: 2, maxDots: 2, prerequisites: [{ _tag: "attribute", name: "stamina", minDots: 2 }], description: "+2 to resist ingested toxins or poisons." },
  { name: "Natural Immunity", category: "physical", minDots: 1, maxDots: 1, prerequisites: [{ _tag: "attribute", name: "stamina", minDots: 2 }], description: "+2 to resist disease." },
  { name: "Quick Draw", category: "physical", minDots: 1, maxDots: 1, prerequisites: [{ _tag: "attribute", name: "dexterity", minDots: 3 }], description: "Draw weapon and attack in same turn." },
  { name: "Quick Healer", category: "physical", minDots: 4, maxDots: 4, prerequisites: [{ _tag: "attribute", name: "stamina", minDots: 4 }], description: "Heal at double the normal rate." },
  { name: "Strong Back", category: "physical", minDots: 1, maxDots: 1, prerequisites: [{ _tag: "attribute", name: "strength", minDots: 2 }], description: "+1 to lifting/carrying capacity." },
  { name: "Strong Lungs", category: "physical", minDots: 3, maxDots: 3, prerequisites: [{ _tag: "skill", name: "athletics", minDots: 3 }], description: "+2 to hold breath. Can run longer without tiring." },
  { name: "Stunt Driver", category: "physical", minDots: 3, maxDots: 3, prerequisites: [{ _tag: "attribute", name: "dexterity", minDots: 3 }], description: "Reduce penalties for dangerous vehicle maneuvers." },
  { name: "Toxin Resistance", category: "physical", minDots: 2, maxDots: 2, prerequisites: [{ _tag: "attribute", name: "stamina", minDots: 3 }], description: "+2 to resist effects of drugs, poisons, and toxins." },
  { name: "Weaponry Dodge", category: "physical", minDots: 1, maxDots: 1, prerequisites: [{ _tag: "attribute", name: "strength", minDots: 2 }, { _tag: "skill", name: "weaponry", minDots: 1 }], description: "Use Weaponry dots as Dodge bonus instead of doubling Defense." },

  // --- Social ---
  { name: "Allies", category: "social", minDots: 1, maxDots: 5, prerequisites: [], description: "Helpful contacts in a particular sphere (politics, underworld, business, etc.)." },
  { name: "Barfly", category: "social", minDots: 1, maxDots: 1, prerequisites: [], description: "Always welcome at bars and clubs, knows where to find information." },
  { name: "Contacts", category: "social", minDots: 1, maxDots: 5, prerequisites: [], description: "Information network. Each dot is a different area of expertise." },
  { name: "Fame", category: "social", minDots: 1, maxDots: 3, prerequisites: [], description: "Public recognition. Bonus to social rolls with those who recognize you." },
  { name: "Inspiring", category: "social", minDots: 4, maxDots: 4, prerequisites: [{ _tag: "attribute", name: "presence", minDots: 4 }], description: "Once per scene, give allies +1 to a roll through encouragement." },
  { name: "Mentor", category: "social", minDots: 1, maxDots: 5, prerequisites: [], description: "A teacher or patron who provides guidance, resources, or protection." },
  { name: "Resources", category: "social", minDots: 1, maxDots: 5, prerequisites: [], description: "Disposable income and assets. Higher dots = wealthier." },
  { name: "Retainer", category: "social", minDots: 1, maxDots: 5, prerequisites: [], description: "A loyal assistant, employee, or servant." },
  { name: "Status", category: "social", minDots: 1, maxDots: 5, prerequisites: [], description: "Standing within an organization or community." },
  { name: "Striking Looks", category: "social", minDots: 2, maxDots: 4, prerequisites: [], description: "+1 (2 dots) or +2 (4 dots) to Social rolls where appearance matters." },
]

// --- Pure rules leaves (ADR-0014) ---

const CharacterTraits = Schema.Struct({
  attributes: Schema.Record(Schema.String, Schema.Number),
  skills: Schema.Record(Schema.String, Schema.Number),
  currentMerits: Schema.Array(Schema.Struct({ name: Schema.String, dots: Schema.Number })),
})
type CharacterTraits = typeof CharacterTraits.Type

/** An unrated trait is zero dots — genuine WoD semantics, not a lookup fallback. */
const traitDots = (traits: Record<string, number>, name: string): number =>
  traits[name.toLowerCase()] ?? 0

/** One prerequisite checked against the character's traits and held Merits. */
const prerequisiteFailure = (
  merit: GeneralMeritDef,
  prereq: Prerequisite,
  character: CharacterTraits,
): Option.Option<MeritValidationError> =>
  Match.value(prereq).pipe(
    Match.tag("attribute", (p) => ratedFailure(merit, p, traitDots(character.attributes, p.name))),
    Match.tag("skill", (p) => ratedFailure(merit, p, traitDots(character.skills, p.name))),
    Match.tag("merit", (p) => {
      const existing = character.currentMerits.find((m) => m.name === p.name)
      return existing !== undefined && existing.dots >= p.minDots
        ? Option.none()
        : Option.some(
            new MeritValidationError({
              message: `${merit.name} requires ${p.name} ${p.minDots}+`,
            }),
          )
    }),
    Match.exhaustive,
  )

/** Attribute and skill prerequisites share a shape: rated dots vs. a minimum. */
const ratedFailure = (
  merit: GeneralMeritDef,
  prereq: { readonly name: string; readonly minDots: number },
  value: number,
): Option.Option<MeritValidationError> =>
  value < prereq.minDots
    ? Option.some(
        new MeritValidationError({
          message: `${merit.name} requires ${prereq.name} ${prereq.minDots}+, character has ${value}`,
        }),
      )
    : Option.none()

// --- Public API ---

export const validateGeneralMerit = Effect.fn("GeneralMerits.validate")(function* (
  input: { meritName: string; dots: number } & CharacterTraits,
) {
  // Free-string merit name, so the miss is real
  const merit = Option.fromUndefinedOr(
    WOD_GENERAL_MERITS.find((m) => m.name === input.meritName),
  )
  if (Option.isNone(merit)) {
    return yield* new MeritValidationError({
      message: `Unknown general merit: "${input.meritName}"`,
    })
  }

  // Check dots in range
  if (input.dots < merit.value.minDots || input.dots > merit.value.maxDots) {
    return yield* new MeritValidationError({
      message: `${merit.value.name} requires ${merit.value.minDots}-${merit.value.maxDots} dots, got ${input.dots}`,
    })
  }

  // Check prerequisites: the first failure refuses the whole selection.
  const failure = Option.firstSomeOf(
    merit.value.prerequisites.map((prereq) =>
      prerequisiteFailure(merit.value, prereq, input),
    ),
  )
  if (Option.isSome(failure)) {
    return yield* failure.value
  }
})
