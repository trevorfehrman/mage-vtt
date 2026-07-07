import { Effect, Schema } from "effect"
import { HealthTrack, healthBox, type HealthBox } from "./damage"
import { CharacterId, PlayerId, SessionId, SessionMemberId } from "./ids"
import { Dots, Mana, Willpower } from "./quantities"
import { RoteArcanumName, RotePool } from "./rote-pool"

// --- Constrained number types ---
//
// Two families, two layers (ADR-0011): the `Dots*` schemas below are *creation*
// strictness — what the book allows a starting character — used only by
// `CharacterInput` and the creation-rules validation. `SheetDots` further down
// is *representability* — what fits in a sheet's boxes — used by
// `CharacterSheet`, which every adapter read decodes through.

const Dots1to5 = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 1, maximum: 5 }),
)

const Dots0to5 = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 0, maximum: 5 }),
)

const Dots0to10 = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 0, maximum: 10 }),
)

// --- Attribute categories ---

const MentalAttributes = Schema.Struct({
  intelligence: Dots1to5,
  wits: Dots1to5,
  resolve: Dots1to5,
})

const PhysicalAttributes = Schema.Struct({
  strength: Dots1to5,
  dexterity: Dots1to5,
  stamina: Dots1to5,
})

const SocialAttributes = Schema.Struct({
  presence: Dots1to5,
  manipulation: Dots1to5,
  composure: Dots1to5,
})

const Attributes = Schema.Struct({
  mental: MentalAttributes,
  physical: PhysicalAttributes,
  social: SocialAttributes,
})

// --- Skill categories ---

const MentalSkills = Schema.Struct({
  academics: Dots0to5,
  computer: Dots0to5,
  crafts: Dots0to5,
  investigation: Dots0to5,
  medicine: Dots0to5,
  occult: Dots0to5,
  politics: Dots0to5,
  science: Dots0to5,
})

const PhysicalSkills = Schema.Struct({
  athletics: Dots0to5,
  brawl: Dots0to5,
  drive: Dots0to5,
  firearms: Dots0to5,
  larceny: Dots0to5,
  stealth: Dots0to5,
  survival: Dots0to5,
  weaponry: Dots0to5,
})

const SocialSkills = Schema.Struct({
  animalKen: Dots0to5,
  empathy: Dots0to5,
  expression: Dots0to5,
  intimidation: Dots0to5,
  persuasion: Dots0to5,
  socialize: Dots0to5,
  streetwise: Dots0to5,
  subterfuge: Dots0to5,
})

const Skills = Schema.Struct({
  mental: MentalSkills,
  physical: PhysicalSkills,
  social: SocialSkills,
})

// --- Mage-specific ---

export const PathName = Schema.Literals(["Acanthus", "Mastigos", "Moros", "Obrimos", "Thyrsus"])
export type PathName = typeof PathName.Type

const OrderName = Schema.Literals([
  "Adamantine Arrow", "Free Council", "Guardians of the Veil", "Mysterium", "Silver Ladder",
])

const Virtue = Schema.Literals([
  "Charity", "Faith", "Fortitude", "Hope", "Justice", "Prudence", "Temperance",
])

const Vice = Schema.Literals([
  "Envy", "Gluttony", "Greed", "Lust", "Pride", "Sloth", "Wrath",
])

/** The ten Arcana, lowercase — the canonical key set for arcana maps. */
export const ARCANA = [
  "death", "fate", "forces", "life", "matter",
  "mind", "prime", "space", "spirit", "time",
] as const

export const ArcanumName = Schema.Literals([...ARCANA])
export type ArcanumName = typeof ArcanumName.Type

const ArcanaMap = Schema.Struct({
  death: Schema.optional(Dots0to5),
  fate: Schema.optional(Dots0to5),
  forces: Schema.optional(Dots0to5),
  life: Schema.optional(Dots0to5),
  matter: Schema.optional(Dots0to5),
  mind: Schema.optional(Dots0to5),
  prime: Schema.optional(Dots0to5),
  space: Schema.optional(Dots0to5),
  spirit: Schema.optional(Dots0to5),
  time: Schema.optional(Dots0to5),
})

// --- Character Schema ---

const CharacterInput = Schema.Struct({
  name: Schema.String,
  shadowName: Schema.optional(Schema.String),
  concept: Schema.String,
  virtue: Virtue,
  vice: Vice,
  path: PathName,
  order: OrderName,
  attributes: Attributes,
  skills: Skills,
  arcana: ArcanaMap,
  gnosis: Dots0to10,
})

// Gnosis table: maxMana by gnosis level (index 0 = gnosis 1)
const GNOSIS_MAX_MANA = [10, 11, 12, 13, 14, 15, 20, 30, 50, 100] as const
const DEFAULT_SIZE = 5

// Path resistance bonuses
const PATH_RESISTANCE: Record<string, { attribute: "composure" | "resolve"; bonus: number }> = {
  Acanthus: { attribute: "composure", bonus: 1 },
  Mastigos: { attribute: "resolve", bonus: 1 },
  Moros: { attribute: "composure", bonus: 1 },
  Obrimos: { attribute: "resolve", bonus: 1 },
  Thyrsus: { attribute: "composure", bonus: 1 },
}

// Path ruling arcana
const PATH_RULING_ARCANA: Record<string, readonly string[]> = {
  Acanthus: ["time", "fate"],
  Mastigos: ["space", "mind"],
  Moros: ["matter", "death"],
  Obrimos: ["forces", "prime"],
  Thyrsus: ["life", "spirit"],
}

/** The Path's two ruling Arcana; a path outside the book rules nothing. */
export const rulingArcanaOf = (path: string): ReadonlyArray<string> =>
  PATH_RULING_ARCANA[path] ?? []

// --- Derived-stat formulas (issue #27) ---
//
// One home for the sheet math: the `CharacterSheet` getters below and the dev
// seed mutation both derive through these, so neither carries its own copy of
// the tables above. They read only the traits the formulas need, which any
// decoded character shape satisfies structurally.

const DerivationTraits = Schema.Struct({
  path: Schema.String,
  gnosis: Schema.Number,
  attributes: Schema.Struct({
    mental: Schema.Struct({ resolve: Schema.Number }),
    physical: Schema.Struct({ stamina: Schema.Number }),
    social: Schema.Struct({ composure: Schema.Number }),
  }),
})
type DerivationTraits = typeof DerivationTraits.Type

const resistanceBonusOf = (path: string) =>
  PATH_RESISTANCE[path] ?? { attribute: "composure" as const, bonus: 0 }

const effectiveResolveOf = (traits: DerivationTraits): number => {
  const resistance = resistanceBonusOf(traits.path)
  return traits.attributes.mental.resolve +
    (resistance.attribute === "resolve" ? resistance.bonus : 0)
}

const effectiveComposureOf = (traits: DerivationTraits): number => {
  const resistance = resistanceBonusOf(traits.path)
  return traits.attributes.social.composure +
    (resistance.attribute === "composure" ? resistance.bonus : 0)
}

const healthOf = (traits: DerivationTraits): number =>
  traits.attributes.physical.stamina + DEFAULT_SIZE

const willpowerOf = (traits: DerivationTraits): number =>
  effectiveResolveOf(traits) + effectiveComposureOf(traits)

const maxManaOf = (traits: DerivationTraits): number =>
  GNOSIS_MAX_MANA[traits.gnosis - 1] ?? 10

/** A fresh character's mutable state: an empty track, full Willpower and Mana. */
export const initialCurrentState = (
  traits: DerivationTraits,
): {
  healthTrack: Array<HealthBox>
  willpowerCurrent: number
  manaCurrent: number
} => ({
  healthTrack: Array.from({ length: healthOf(traits) }, () => healthBox("empty")),
  willpowerCurrent: willpowerOf(traits),
  manaCurrent: maxManaOf(traits),
})

// --- The Character Sheet (ADR-0011) ---
//
// Checks below encode representability — what fits in the sheet's boxes — not
// game legality. These run on every adapter read, so a wrong check bricks a
// sheet mid-session: dots go to 10 (Gnosis 6+ raises trait caps, and fudging is
// a first-class feature), while game rules like allocation totals stay in the
// creation-rules move validation.

/** What fits in a dot rating's boxes: the branded 0–10 `Dots` quantity (issue #35). */
const SheetDots = Dots

const SheetAttributes = Schema.Struct({
  mental: Schema.Struct({ intelligence: SheetDots, wits: SheetDots, resolve: SheetDots }),
  physical: Schema.Struct({ strength: SheetDots, dexterity: SheetDots, stamina: SheetDots }),
  social: Schema.Struct({ presence: SheetDots, manipulation: SheetDots, composure: SheetDots }),
})

const SheetSkills = Schema.Struct({
  mental: Schema.Struct({
    academics: SheetDots, computer: SheetDots, crafts: SheetDots,
    investigation: SheetDots, medicine: SheetDots, occult: SheetDots,
    politics: SheetDots, science: SheetDots,
  }),
  physical: Schema.Struct({
    athletics: SheetDots, brawl: SheetDots, drive: SheetDots,
    firearms: SheetDots, larceny: SheetDots, stealth: SheetDots,
    survival: SheetDots, weaponry: SheetDots,
  }),
  social: Schema.Struct({
    animalKen: SheetDots, empathy: SheetDots, expression: SheetDots,
    intimidation: SheetDots, persuasion: SheetDots, socialize: SheetDots,
    streetwise: SheetDots, subterfuge: SheetDots,
  }),
})

const SheetArcana = Schema.Struct({
  death: Schema.optionalKey(SheetDots),
  fate: Schema.optionalKey(SheetDots),
  forces: Schema.optionalKey(SheetDots),
  life: Schema.optionalKey(SheetDots),
  matter: Schema.optionalKey(SheetDots),
  mind: Schema.optionalKey(SheetDots),
  prime: Schema.optionalKey(SheetDots),
  space: Schema.optionalKey(SheetDots),
  spirit: Schema.optionalKey(SheetDots),
  time: Schema.optionalKey(SheetDots),
})


/**
 * A Rote the character trained (issue #16): the sheet-side mirror of
 * `KnownRoteDoc` — spell business key, source Order, and the structured pool
 * whose trait names the cast flow resolves against the caster's ratings.
 * Casting a Rote does NOT grant the rote quality (glossary namespace trap).
 */
export class KnownRote extends Schema.Class<KnownRote>("KnownRote")({
  name: Schema.String,
  spellName: Schema.String,
  spellArcanum: RoteArcanumName,
  spellLevel: Dots1to5,
  order: OrderName,
  pool: RotePool,
}) {}

/**
 * The game artifact all sheet-touching flows and UI speak (see CONTEXT.md
 * "Character Sheet"): identity, rated Traits, current state — plus its linkage
 * (whose character this is *is* domain data). Decoded from `CharacterDoc` at
 * the adapter; the game speaks Sheet, the database speaks Doc.
 *
 * Absorbs the old strict `Character` class (ADR-0011): the derived getters
 * carry over, the dot checks loosen to representability, and creation
 * strictness lives solely in `validateCreationRules`.
 */
export class CharacterSheet extends Schema.Class<CharacterSheet>("CharacterSheet")({
  id: CharacterId,
  sessionId: SessionId,
  userId: PlayerId,
  sessionMemberId: SessionMemberId,
  name: Schema.String,
  shadowName: Schema.optionalKey(Schema.String),
  concept: Schema.String,
  virtue: Virtue,
  vice: Vice,
  path: PathName,
  order: OrderName,
  gnosis: SheetDots,
  attributes: SheetAttributes,
  skills: SheetSkills,
  arcana: SheetArcana,
  healthTrack: HealthTrack,
  willpowerCurrent: Willpower,
  manaCurrent: Mana,
  knownRotes: Schema.optionalKey(Schema.Array(KnownRote)),
}) {
  /** Known Rotes, absent-column-safe: rows stored before issue #16 have none. */
  get rotes(): ReadonlyArray<KnownRote> {
    return this.knownRotes ?? []
  }

  get resistanceBonus() {
    return resistanceBonusOf(this.path)
  }

  get effectiveResolve(): number {
    return effectiveResolveOf(this)
  }

  get effectiveComposure(): number {
    return effectiveComposureOf(this)
  }

  get health(): number {
    return healthOf(this)
  }

  get willpower(): number {
    return willpowerOf(this)
  }

  get defense(): number {
    const lower = Math.min(
      this.attributes.physical.dexterity,
      this.attributes.mental.wits,
    )
    return lower + this.skills.physical.athletics
  }

  get initiative(): number {
    return this.attributes.physical.dexterity + this.effectiveComposure
  }

  get speed(): number {
    return this.attributes.physical.strength + this.attributes.physical.dexterity + 5
  }

  get maxMana(): number {
    return maxManaOf(this)
  }
}

// --- Errors ---

export class CharacterValidationError extends Schema.TaggedErrorClass<CharacterValidationError>()(
  "CharacterValidationError",
  { message: Schema.String },
) {}

export class CreationRuleViolation extends Schema.TaggedErrorClass<CreationRuleViolation>()(
  "CreationRuleViolation",
  { message: Schema.String },
) {}

// --- Public API ---

/**
 * Decode strict creation input — the first half of the "create a character"
 * move rule (the other half is `validateCreationRules`). Deliberately stricter
 * than `CharacterSheet` (ADR-0011): 1–5 attribute dots, 0–5 skills, book
 * literals. Returns the parsed input; the sheet artifact is only born once the
 * character is persisted with its linkage and current state.
 */
export const createCharacter = Effect.fn("Character.create")(function* (
  input: unknown,
) {
  return yield* Schema.decodeUnknownEffect(CharacterInput)(input).pipe(
    Effect.mapError(
      (e) => new CharacterValidationError({ message: `Invalid character data: ${e.message}` }),
    ),
  )
})

/** The traits the creation-rules move inspects — structural, so both the strict
 * creation input and a decoded `CharacterSheet` satisfy it. */
const RatedCategory = Schema.Record(Schema.String, Schema.Number)

const CreationTraits = Schema.Struct({
  path: Schema.String,
  attributes: Schema.Struct({
    mental: RatedCategory,
    physical: RatedCategory,
    social: RatedCategory,
  }),
  skills: Schema.Struct({
    mental: RatedCategory,
    physical: RatedCategory,
    social: RatedCategory,
  }),
  arcana: Schema.Record(Schema.String, Schema.UndefinedOr(Schema.Number)),
})
type CreationTraits = typeof CreationTraits.Type

export const validateCreationRules = Effect.fn("Character.validateCreationRules")(function* (
  character: CreationTraits,
) {
  // --- Attribute allocation: must be 5/4/3 across categories ---
  const attrCategories = [
    character.attributes.mental,
    character.attributes.physical,
    character.attributes.social,
  ]

  const attrAllocated = attrCategories
    .map((cat) => Object.values(cat).reduce((sum, v) => sum + (v as number), 0) - 3) // subtract 3 base dots (1 per attribute)
    .sort((a, b) => b - a) // descending

  if (attrAllocated[0] !== 5 || attrAllocated[1] !== 4 || attrAllocated[2] !== 3) {
    yield* new CreationRuleViolation({
      message: `Attribute allocation must be 5/4/3, got ${attrAllocated.join("/")}`,
    })
  }

  // --- Skill allocation: must be 11/7/4 across categories ---
  const skillCategories = [
    character.skills.mental,
    character.skills.physical,
    character.skills.social,
  ]

  const skillAllocated = skillCategories
    .map((cat) => Object.values(cat).reduce((sum, v) => sum + (v as number), 0))
    .sort((a, b) => b - a)

  if (skillAllocated[0] !== 11 || skillAllocated[1] !== 7 || skillAllocated[2] !== 4) {
    yield* new CreationRuleViolation({
      message: `Skill allocation must be 11/7/4, got ${skillAllocated.join("/")}`,
    })
  }

  // --- Arcana: 6 total dots, 2 of first 3 must be ruling ---
  const arcanaEntries = Object.entries(character.arcana)
    .filter(([_, dots]) => dots !== undefined && dots > 0)
    .sort(([, a], [, b]) => (b as number) - (a as number)) as Array<[string, number]>

  const totalArcanaDots = arcanaEntries.reduce((sum, [_, dots]) => sum + dots, 0)
  if (totalArcanaDots !== 6) {
    yield* new CreationRuleViolation({
      message: `Starting arcana must total 6 dots, got ${totalArcanaDots}`,
    })
  }

  if (arcanaEntries.length < 2) {
    yield* new CreationRuleViolation({
      message: `Must have at least 2 arcana, got ${arcanaEntries.length}`,
    })
  }

  // Check ruling requirement: 2 of the first 3 arcana must be ruling for the path
  const ruling = rulingArcanaOf(character.path)
  const topThree = arcanaEntries.slice(0, 3).map(([name]) => name)
  const rulingInTopThree = topThree.filter((name) => ruling.includes(name)).length

  if (rulingInTopThree < 2) {
    yield* new CreationRuleViolation({
      message: `2 of first 3 arcana must be Path ruling arcana (${ruling.join(", ")}), only ${rulingInTopThree} found`,
    })
  }
})

// --- Order rote skills reference ---

const ORDER_ROTE_SKILLS: Record<string, readonly string[]> = {
  "Adamantine Arrow": ["Athletics", "Intimidation", "Medicine"],
  "Free Council": ["Crafts", "Persuasion", "Science"],
  "Guardians of the Veil": ["Investigation", "Stealth", "Subterfuge"],
  "Mysterium": ["Investigation", "Occult", "Survival"],
  "Silver Ladder": ["Expression", "Persuasion", "Subterfuge"],
}

export const validateRoteSpecialties = Effect.fn("Character.validateRoteSpecialties")(function* (
  order: string,
  specialties: ReadonlyArray<{ skill: string; specialty: string }>,
) {
  const allowedSkills = ORDER_ROTE_SKILLS[order]
  if (!allowedSkills) {
    yield* new CreationRuleViolation({ message: `Unknown order: ${order}` })
    return
  }

  if (specialties.length !== 3) {
    yield* new CreationRuleViolation({
      message: `Must choose exactly 3 rote specialties, got ${specialties.length}`,
    })
  }

  for (const spec of specialties) {
    if (!allowedSkills.includes(spec.skill)) {
      yield* new CreationRuleViolation({
        message: `"${spec.skill}" is not a rote skill for ${order}. Valid: ${allowedSkills.join(", ")}`,
      })
    }
  }
})

export const validateSkillSpecialties = Effect.fn("Character.validateSkillSpecialties")(function* (
  specialties: ReadonlyArray<{ skill: string; specialty: string }>,
  skillDots: Record<string, number>,
) {
  if (specialties.length !== 3) {
    yield* new CreationRuleViolation({
      message: `Must choose exactly 3 skill specialties, got ${specialties.length}`,
    })
  }

  for (const spec of specialties) {
    const dots = skillDots[spec.skill.toLowerCase()] ?? 0
    if (dots === 0) {
      yield* new CreationRuleViolation({
        message: `Cannot specialize in ${spec.skill} — character has 0 dots`,
      })
    }
  }
})

export const applyWisdomTradeoff = Effect.fn("Character.applyWisdomTradeoff")(function* (
  startingWisdom: number,
  dotsToSacrifice: number,
) {
  const MIN_WISDOM = 5
  const XP_PER_DOT = 5

  const newWisdom = startingWisdom - dotsToSacrifice
  if (newWisdom < MIN_WISDOM) {
    yield* new CreationRuleViolation({
      message: `Wisdom cannot go below ${MIN_WISDOM}. Starting ${startingWisdom} - ${dotsToSacrifice} = ${newWisdom}`,
    })
  }

  return { wisdom: newWisdom, bonusXP: dotsToSacrifice * XP_PER_DOT }
})

export const activeSpellPenalty = Effect.fn("Character.activeSpellPenalty")(function* (
  gnosis: number,
  activeSpells: number,
) {
  const freeSpells = gnosis
  const excess = Math.max(0, activeSpells - freeSpells)
  return excess === 0 ? 0 : excess * -2
})
