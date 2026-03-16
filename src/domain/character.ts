import { Effect, Schema } from "effect"

// --- Constrained number types ---

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

const PathName = Schema.Literals(["Acanthus", "Mastigos", "Moros", "Obrimos", "Thyrsus"])

const OrderName = Schema.Literals([
  "Adamantine Arrow", "Free Council", "Guardians of the Veil", "Mysterium", "Silver Ladder",
])

const Virtue = Schema.Literals([
  "Charity", "Faith", "Fortitude", "Hope", "Justice", "Prudence", "Temperance",
])

const Vice = Schema.Literals([
  "Envy", "Gluttony", "Greed", "Lust", "Pride", "Sloth", "Wrath",
])

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

export class Character extends Schema.Class<Character>("Character")({
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
}) {
  get resistanceBonus() {
    return PATH_RESISTANCE[this.path] ?? { attribute: "composure" as const, bonus: 0 }
  }

  get effectiveResolve(): number {
    return this.attributes.mental.resolve +
      (this.resistanceBonus.attribute === "resolve" ? this.resistanceBonus.bonus : 0)
  }

  get effectiveComposure(): number {
    return this.attributes.social.composure +
      (this.resistanceBonus.attribute === "composure" ? this.resistanceBonus.bonus : 0)
  }

  get health(): number {
    return this.attributes.physical.stamina + DEFAULT_SIZE
  }

  get willpower(): number {
    return this.effectiveResolve + this.effectiveComposure
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
    return GNOSIS_MAX_MANA[this.gnosis - 1] ?? 10
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

export const createCharacter = Effect.fn("Character.create")(function* (
  input: unknown,
) {
  const parsed = yield* Schema.decodeUnknownEffect(CharacterInput)(input).pipe(
    Effect.mapError(
      (e) => new CharacterValidationError({ message: `Invalid character data: ${e.message}` }),
    ),
  )

  return new Character(parsed)
})

export const validateCreationRules = Effect.fn("Character.validateCreationRules")(function* (
  character: Character,
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
  const ruling = PATH_RULING_ARCANA[character.path] ?? []
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
