import { Array as Arr, Option, Schema } from "effect"
import { OrderName, PathName, rulingArcanaOf, type Legacy as SheetLegacy } from "./character"
import { ArcanumName, SkillKey } from "./trait-keys"

// The Legacy catalog (MAG-64): the seven Legacies Mage: The Awakening stats
// in Appendix One (pp. 344–367), taken from the page. Pure rules leaves
// (ADR-0014): the catalog is a Record total over the closed name vocabulary
// (the compiler refuses a missing entry), the gate and prerequisite rules
// are plain functions, and the one open-input lookup (`findLegacy`, for a
// name written on a sheet) returns Option.
//
// A Legacy is "a mystical teaching about the crafting of the Awakened soul"
// (p. 18), taught tutor to student and chosen once: "Once a mage learns a
// Legacy, he cannot learn another" (p. 344). It grants three attainments as
// Gnosis climbs — 3, 5, 7 — each the shadow of a spell made a mundane-looking
// ability: no Paradox, no Disbelief, no Mana, no Mage Sight signature, and
// usually an instant action with no roll (p. 345). The Legacy's primary
// Arcanum is learned as if Ruling (p. 345).
//
// The owner's call (2026-10-28): these seven are the framework. A sheet may
// still carry a Legacy the catalog does not know — one shopped from a
// supplement or founded at the table (p. 344: "At Gnosis 4, he can instead
// create his own Legacy") — as a free name with its own attainment names;
// that shape is `Legacy` in character.ts, and `toSheetLegacy` writes a
// catalog entry into it. New Legacies are added here when a player takes one.

// --- Vocabulary ---

/** The seven, in the book's order (pp. 346–367). */
export const LEGACY_NAMES = [
  "Orphans of Proteus",
  "Perfected Adept",
  "Subtle Ones",
  "Uncrowned Kings",
  "Walkers in Mists",
  "Scelesti",
  "Tremere Lich",
] as const

export const LegacyName = Schema.Literals([...LEGACY_NAMES])
export type LegacyName = typeof LegacyName.Type

/** The Gnosis each attainment opens at (p. 344): the first at 3, then 5, then 7. */
export const ATTAINMENT_GATES = [3, 5, 7] as const
export type AttainmentGate = (typeof ATTAINMENT_GATES)[number]

const Dots = Schema.Number.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 5 }))

/** An Arcanum at so many dots, as a prerequisite or a synergy. */
export const ArcanumDots = Schema.Struct({ arcanum: ArcanumName, dots: Dots })
export type ArcanumDots = typeof ArcanumDots.Type

/**
 * A Skill prerequisite: one Skill, or a choice between several ("Animal
 * Ken 2 or Survival 2", p. 348).
 */
export const SkillRequirement = Schema.Union([
  Schema.TaggedStruct("skill", { skill: SkillKey, dots: Dots }),
  Schema.TaggedStruct("anyOf", { options: Schema.Array(Schema.Struct({ skill: SkillKey, dots: Dots })) }),
])
export type SkillRequirement = typeof SkillRequirement.Type

const arc = (arcanum: ArcanumName, dots: number): ArcanumDots => ({ arcanum, dots })
const skill = (skill: SkillKey, dots: number): SkillRequirement => ({ _tag: "skill", skill, dots })
const anyOf = (...options: ReadonlyArray<readonly [SkillKey, number]>): SkillRequirement => ({
  _tag: "anyOf",
  options: options.map(([skill, dots]) => ({ skill, dots })),
})

/**
 * The "Optional Arcanum" rider most second and third attainments carry: a
 * further ability if the mage also knows the Legacy's synergistic Arcanum at
 * the named dots (p. 366, "C. Choose a Synergistic Arcanum").
 */
export const Synergy = Schema.Struct({
  arcanum: ArcanumName,
  dots: Dots,
  /** The rider's mechanical sentence, in one line. */
  effect: Schema.String,
})
export type Synergy = typeof Synergy.Type

export const Attainment = Schema.Struct({
  name: Schema.String,
  gnosis: Schema.Literals([...ATTAINMENT_GATES]),
  /** The Arcana dots required, the primary first. */
  arcana: Schema.Array(ArcanumDots),
  skills: Schema.Array(SkillRequirement),
  /** The spell the attainment mirrors, as the book cites it. */
  mirrors: Schema.String,
  /** The book's mechanical sentence, in one line. */
  effect: Schema.String,
  synergy: Schema.optionalKey(Synergy),
})
export type Attainment = typeof Attainment.Type

const LegacyBody = Schema.Struct({
  /** The Path whose mages the Legacy calls; "any" for the Scelesti (p. 361). */
  path: Schema.Union([PathName, Schema.Literal("any")]),
  /** The order that may also teach it to members not of that Path (p. 344). */
  order: Schema.optionalKey(OrderName),
  /** What other mages call its members. */
  nickname: Schema.String,
  /** The Arcanum the attainments draw on, learned as if Ruling (p. 345). */
  primary: ArcanumName,
  /** Three attainments, one per gate, in order. */
  attainments: Schema.Tuple([Attainment, Attainment, Attainment]),
  /** The book's suggested oblations, which need no Hallow (p. 345). */
  oblations: Schema.String,
  /** "Left-Handed" (p. 361): a dread teaching, antagonist fare. */
  leftHanded: Schema.Boolean,
  /** Where the entry begins in Mage: The Awakening. */
  page: Schema.Number,
})
type LegacyBody = typeof LegacyBody.Type

export const LegacyDef = Schema.Struct({ name: LegacyName, ...LegacyBody.fields })
export type LegacyDef = typeof LegacyDef.Type

// --- The catalog, total over LegacyName (Appendix One, pp. 346–367) ---

const CATALOG: Record<LegacyName, LegacyBody> = {
  "Orphans of Proteus": {
    path: "Thyrsus", nickname: "Orphans", primary: "life", leftHanded: false, page: 346,
    oblations: "A sacred hunt; the ritual acting out of an animal's behavior; the ceremonial offering of food to animals; the ritual arrangement of rocks and stones; sacred gardening.",
    attainments: [
      {
        name: "Snake Skin", gnosis: 3,
        arcana: [arc("life", 2), arc("mind", 1)], skills: [anyOf(["animalKen", 2], ["survival", 2])],
        mirrors: 'Life 2 "Self-Healing"',
        effect: "Instant action, Stamina + Athletics + Life: each success heals one bashing or lethal, by sloughing the damaged skin; reflexive for a Willpower point. Presence + Animal Ken to speak with animals in their own behaviors.",
      },
      {
        name: "Beast Gift", gnosis: 5,
        arcana: [arc("life", 3)], skills: [],
        mirrors: 'Life 3 "Transform Self"',
        effect: "Instant action, no roll: grow one fixed animal or plant feature for up to an hour — a natural weapon adds two dice and deals lethal, a protective feature gives two armor. Snake Skin now heals aggravated for one Mana.",
        synergy: { arcanum: "matter", dots: 3, effect: "The feature may be mineral: stone fists or feet add four dice (bashing), stone skin gives three armor." },
      },
      {
        name: "Beast Form", gnosis: 7,
        arcana: [arc("life", 4)], skills: [],
        mirrors: 'Life 4 "Shapechanging"',
        effect: "Reflexive shapeshift at will into one fixed animal or plant for up to an hour, without losing herself in its mind; a plant form speaks with plant spirits without the Spirit Arcanum.",
        synergy: { arcanum: "matter", dots: 4, effect: "Stone may be the form: immobile but perceiving, speaking with mineral spirits without the Spirit Arcanum." },
      },
    ],
  },
  "Perfected Adept": {
    path: "Obrimos", order: "Adamantine Arrow", nickname: "Monks", primary: "life", leftHanded: false, page: 349,
    oblations: "Rigorous martial arts practice, including sparring with other Perfected Adepts; feats of endurance — long-distance running, holding weights, exposure to the elements.",
    attainments: [
      {
        name: "Body Temple", gnosis: 3,
        arcana: [arc("life", 2), arc("prime", 1)], skills: [skill("athletics", 3)],
        mirrors: 'Life 2 "Body Control" and Prime 1 "Supernal Vision"',
        effect: "Always on: control of the body's autonomous functions, Life dots as successes; and the sight of chi in living things — an extended scrutiny reads a target's current Mana.",
      },
      {
        name: "Chi Force", gnosis: 5,
        arcana: [arc("life", 3)], skills: [skill("brawl", 3)],
        mirrors: 'Life 3 "Honing the Form"',
        effect: "Instant action: Mind dots added to one Physical Attribute chosen for good when the attainment is gained, for up to an hour. Stacks with a Honing the Form spell, whose Duration then becomes one turn.",
        synergy: { arcanum: "forces", dots: 3, effect: "A chi strike at a distance: Resolve + Brawl + Forces, each success one bashing, aimed." },
      },
      {
        name: "Perfect Body", gnosis: 7,
        arcana: [arc("life", 4)], skills: [],
        mirrors: 'Life 3 "Honing the Form", twice',
        effect: "A second Physical Attribute boosted as Chi Force, both at once for separate instant actions.",
        synergy: { arcanum: "forces", dots: 4, effect: "The chi strike deals lethal, and Dexterity + Brawl + Forces turns aside a projectile before the mage's own turn comes." },
      },
    ],
  },
  "Subtle Ones": {
    path: "Mastigos", order: "Guardians of the Veil", nickname: "Invisible Man", primary: "mind", leftHanded: false, page: 352,
    oblations: "Impersonating others; mastering disguise; moving through a crowd unremarked.",
    attainments: [
      {
        name: "The Subtle Dance", gnosis: 3,
        arcana: [arc("mind", 2), arc("fate", 1)], skills: [skill("subterfuge", 2)],
        mirrors: 'Mind 2 "Incognito Presence" and Fate 1 "The Sybil\'s Sight"',
        effect: "Instant action, no roll: walk openly but unnoticed for up to an hour, reading in fashion and unconscious behavior the openings for momentous change.",
      },
      {
        name: "False Presence", gnosis: 5,
        arcana: [arc("mind", 3)], skills: [],
        mirrors: 'Mind 3 "Imposter"',
        effect: "Instant action, no roll: a false persona and image across Mind dots' worth of senses for up to an hour, with an altered aura whose Potency is Mind dots.",
        synergy: { arcanum: "space", dots: 3, effect: "Forge sympathetic connections between people and things observed during the Subtle Dance, one degree per Space dot, Intimate at best, lasting." },
      },
      {
        name: "Occlude the Mind", gnosis: 7,
        arcana: [arc("mind", 4)], skills: [],
        mirrors: 'Mind 4 "Breach the Vault of Memory"',
        effect: "Instant action, Manipulation + Subterfuge + Mind: cloud and rewrite another's memories.",
        synergy: { arcanum: "space", dots: 4, effect: "Co-locate one False Presence per Mind dot in different places at once, multitasking between them." },
      },
    ],
  },
  "Uncrowned Kings": {
    path: "Moros", order: "Free Council", nickname: "Coal-burners", primary: "mind", leftHanded: false, page: 355,
    oblations: "Physical labor; meaningful work other than the calling the mage practices for his attainments.",
    attainments: [
      {
        name: "Nigredo", gnosis: 3,
        arcana: [arc("mind", 2), arc("matter", 1)], skills: [skill("crafts", 2), skill("occult", 1)],
        mirrors: 'Mind 2 "Mental Shield" and Mind 1 "Aura Perception"',
        effect: "A permanent Mental Shield of Mind dots. An instant action studying a product of her Matter magic reads her own aura and gives +2 to Mind Augmentation spells on her Mental or Social Attributes that scene.",
      },
      {
        name: "Albedo", gnosis: 5,
        arcana: [arc("mind", 3)], skills: [],
        mirrors: 'Mind 3 "Augment the Mind"',
        effect: "After studying his soul in his work, Mind dots added to one Mental or Social Attribute chosen for good, for up to an hour. Stacks with an Augment the Mind spell, whose Duration then becomes one turn.",
        synergy: { arcanum: "prime", dots: 3, effect: 'The Nigredo shield also carries Prime 3 "Armor of the Soul".' },
      },
      {
        name: "Rubedo", gnosis: 7,
        arcana: [arc("mind", 4)], skills: [],
        mirrors: 'Mind 3 "Augment the Mind", twice',
        effect: "A second Mental or Social Attribute boosted as Albedo, both at once for separate instant actions.",
        synergy: { arcanum: "prime", dots: 4, effect: "Siphon Mana from an object of his own Matter work once a day: Resolve + Occult + Prime, one Mana per success, two Structure to the item each." },
      },
    ],
  },
  "Walkers in Mists": {
    path: "Acanthus", order: "Mysterium", nickname: "Druid", primary: "space", leftHanded: false, page: 358,
    oblations: "Trailblazing — following a path through park, woods or wilderness; the pooling of provisions and the singing-games of the Walkers' meetings.",
    attainments: [
      {
        name: "Peer into the Mists", gnosis: 3,
        arcana: [arc("space", 2), arc("life", 1)], skills: [],
        mirrors: 'Space 2 "Scrying"',
        effect: "Instant action, Wits + Survival + Space by sympathetic distance: a scrying window into any place with plant life — trees, flowers, even grass — hidden even from Mage Sight.",
        synergy: { arcanum: "time", dots: 2, effect: "Peer into the past of the place scried, as Postcognition: the plants present then tell what they saw." },
      },
      {
        name: "Mist Haven", gnosis: 5,
        arcana: [arc("space", 3)], skills: [],
        mirrors: 'Space 2 "Ward" and Space 3 "Ban"',
        effect: "Instant action, no roll, wherever one green shoot grows (or a Willpower point summons the Mists): a ward with a Ban of his choice over a radius set by Space dots.",
        synergy: { arcanum: "time", dots: 3, effect: "Peer into the Mists divines the future: one question per Time dot, once a day per target." },
      },
      {
        name: "Paths Through the Mists", gnosis: 7,
        arcana: [arc("space", 4)], skills: [],
        mirrors: 'Space 4 "Portal"',
        effect: "Instant action, Composure + Survival + Space by sympathetic distance: a path through the Mists to any place with plant life, open the turn after unless held by concentration, one Size 5 traveler a turn.",
        synergy: { arcanum: "time", dots: 4, effect: "Prophecy from within the Mist Haven: one question per Time dot about what might happen, once a day per target." },
      },
    ],
  },
  "Scelesti": {
    path: "any", nickname: "The Wicked", primary: "spirit", leftHanded: true, page: 361,
    oblations: "Terrorizing innocents; destroying property; goading others to harm or destroy; cannibalism; a ritual killing.",
    attainments: [
      {
        name: "Magic Circle", gnosis: 3,
        arcana: [arc("spirit", 2), arc("space", 1)], skills: [skill("occult", 2)],
        mirrors: 'Spirit 2 "Gossamer Touch"',
        effect: "Instant action, no roll: a magic circle of radius Space dots; within it the mage touches Twilight spirits (not ghosts) and may work magic on them at a distance.",
        synergy: { arcanum: "death", dots: 2, effect: "Ghosts are affected from the circle as spirits are." },
      },
      {
        name: "Abyssal Command", gnosis: 5,
        arcana: [arc("spirit", 3)], skills: [],
        mirrors: 'Spirit 3 "Control Spirit"',
        effect: "Within the circle, Presence + Intimidation + Spirit against the spirit's Resistance: one command of rising complexity per success, one command per spirit at a time.",
        synergy: { arcanum: "time", dots: 3, effect: "A commanded spirit speaks of the future as a mouthpiece: one question per Time dot, once a day per target." },
      },
      {
        name: "Shadow Circle", gnosis: 7,
        arcana: [arc("spirit", 4)], skills: [],
        mirrors: 'Spirit 4 "Road Master"',
        effect: "From within the circle, Presence + Occult + Spirit against the Gauntlet's Strength: step sideways across it and back as often as the circle stands.",
        synergy: { arcanum: "time", dots: 4, effect: "A spirit becomes the mouthpiece of Prophecy: one question per Time dot about what might happen, once a day per target." },
      },
    ],
  },
  "Tremere Lich": {
    path: "Moros", nickname: "The Embalmed", primary: "death", leftHanded: true, page: 364,
    oblations: "An hour of utter stillness without magic or sleep; embalming a corpse; a sincere rite of mourning for the newly dead.",
    attainments: [
      {
        name: "Hideous Stipend", gnosis: 3,
        arcana: [arc("death", 2)], skills: [],
        mirrors: 'Death 3 "Sever the Sleeping Soul", Death 2 "Soul Jar" and Death 1 "Soul Marks"',
        effect: "Steal a Sleeper's soul with an extended Presence + Intimidation + Death against Resolve, no Mana, to live on unaging; fashion a soul jar by extended Presence + Crafts + Death; read a soul's health at a glance.",
      },
      {
        name: "Wicked Claim", gnosis: 5,
        arcana: [arc("death", 3)], skills: [],
        mirrors: 'Death 4 "Soul Binding" and Death 3 "Devouring the Slain"',
        effect: "Bind a stolen soul to himself by extended Presence + Empathy + Death; drain Willpower or Mana from the injured and dying with an instant Manipulation + Intimidation + Death less the victim's Stamina.",
        synergy: { arcanum: "prime", dots: 3, effect: "Distill a soul into tass holding its owner's Mana (or Willpower dots, for a Sleeper), lasting until dissolved." },
      },
      {
        name: "Supernal Theft", gnosis: 7,
        arcana: [arc("death", 4)], skills: [],
        mirrors: 'Death 4 "Enervation"',
        effect: "Take an Awakened soul as Hideous Stipend takes a Sleeper's, against Resolve + Gnosis; drain an enemy's strength with an instant Presence + Occult + Death.",
      },
    ],
  },
}

/** The seven, in the book's order. */
export const LEGACIES: ReadonlyArray<LegacyDef> = LEGACY_NAMES.map((name) => ({ name, ...CATALOG[name] }))

/** One Legacy by its closed name — total, so no miss. */
export const legacy = (name: LegacyName): LegacyDef => ({ name, ...CATALOG[name] })

/** A sheet's Legacy name is a free string, so a miss is real: a shopped or founded Legacy. */
export const findLegacy = (name: string): Option.Option<LegacyDef> =>
  Schema.is(LegacyName)(name) ? Option.some(legacy(name)) : Option.none()

/** The Legacies a Path's mages are called to, with those an order teaches across Paths. */
export const legaciesOpenTo = (path: PathName, order: OrderName): ReadonlyArray<LegacyDef> =>
  LEGACIES.filter((l) => l.path === "any" || l.path === path || l.order === order)

// --- The gates ---

/** The attainments a Gnosis has opened (p. 344): the gates alone, prerequisites aside. */
export const attainmentsReached = (def: LegacyDef, gnosis: number): ReadonlyArray<Attainment> =>
  def.attainments.filter((a) => gnosis >= a.gnosis)

/** The traits a prerequisite reads off a sheet. */
export type LegacyTraits = {
  readonly gnosis: number
  readonly arcana: Partial<Record<ArcanumName, number>>
  readonly skills: Partial<Record<SkillKey, number>>
}

/** An unrated Arcanum or Skill is zero dots — WoD semantics, not a lookup fallback. */
const dotsOf = (dots: number | undefined): number => dots ?? 0

const skillMet = (traits: LegacyTraits, req: SkillRequirement): boolean =>
  req._tag === "skill"
    ? dotsOf(traits.skills[req.skill]) >= req.dots
    : req.options.some((o) => dotsOf(traits.skills[o.skill]) >= o.dots)

const skillWords = (req: SkillRequirement): string =>
  req._tag === "skill"
    ? `${req.skill} ${req.dots}`
    : req.options.map((o) => `${o.skill} ${o.dots}`).join(" or ")

/**
 * The first prerequisite of an attainment a sheet falls short of, in words
 * (p. 344: attainments "are granted as he achieves the required Gnosis,
 * assuming ... the prerequisite Arcana and/or Skills"). None means met.
 */
export const shortfall = (att: Attainment, traits: LegacyTraits): Option.Option<string> =>
  traits.gnosis < att.gnosis
    ? Option.some(`Gnosis ${att.gnosis}, currently ${traits.gnosis}`)
    : Arr.findFirst(att.arcana, (a) => dotsOf(traits.arcana[a.arcanum]) < a.dots).pipe(
        Option.map((a) => `${a.arcanum} ${a.dots}, currently ${dotsOf(traits.arcana[a.arcanum])}`),
        Option.orElse(() =>
          Arr.findFirst(att.skills, (s) => !skillMet(traits, s)).pipe(Option.map(skillWords)),
        ),
      )

/** The attainments a sheet holds in full: gate and prerequisites both. */
export const attainmentsHeld = (def: LegacyDef, traits: LegacyTraits): ReadonlyArray<Attainment> =>
  def.attainments.filter((a) => Option.isNone(shortfall(a, traits)))

/** Why a sheet cannot yet be initiated — the first attainment's shortfall — or None. */
export const joinRefusal = (def: LegacyDef, traits: LegacyTraits): Option.Option<string> =>
  shortfall(def.attainments[0], traits)

// --- The Legacy on the sheet ---

/**
 * The Legacy's primary Arcanum "can be learned as if it were a Ruling
 * Arcanum" (p. 345): the Path's two, and the Legacy's one if it is new.
 */
export const rulingArcanaWith = (def: LegacyDef, path: PathName): ReadonlyArray<ArcanumName> =>
  Arr.dedupe([...rulingArcanaOf(path), def.primary])

/** A catalog Legacy written as the sheet carries one: the name and the three attainment names. */
export const toSheetLegacy = (def: LegacyDef): SheetLegacy => ({
  name: def.name,
  attainments: def.attainments.map((a) => a.name),
})
