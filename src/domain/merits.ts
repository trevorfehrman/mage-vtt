import { Array as Arr, Effect, Match, Option, Schema } from "effect"
import { AttributeKey, SkillKey } from "./trait-keys"

// The Merit catalog (MAG-59): every Merit the two core books offer a mage,
// taken from the page — Mage: The Awakening pp. 80–89 for the Awakened ones,
// the World of Darkness Rulebook pp. 108–117 for the general ones. Pure rules
// leaves (ADR-0014): the catalog is a Record total over the closed name
// vocabulary (the compiler refuses a missing entry), the rating rules are
// plain functions dispatched with Match, and the one open-input lookup
// (`findMerit`, for a name typed by a person) returns Option.
//
// A Merit is a name, a rating and a paragraph the Storyteller applies by
// judgment (WoD p. 108: "special capabilities or knacks that add
// individuality to your character"). The catalog records the paragraph's
// mechanical sentence as `effect` and leaves the application to the table;
// the few Merits the app enforces (High Speech's gate, the derived-number
// bumps) dispatch on `MeritName` where they are enforced, not here.

// --- Vocabulary ---

/**
 * The families: the Rulebook's three (p. 108, "Physical, Mental and
 * Social") and the Mage book's own section, "available to only willworkers"
 * (p. 80) — a fourth family rather than a prerequisite on each.
 */
export const MeritFamily = Schema.Literals(["mental", "physical", "social", "awakened"])
export type MeritFamily = typeof MeritFamily.Type

export const MERIT_NAMES = [
  // Mental (WoD pp. 108–110). Unseen Sense is omitted: "Only mortal, mundane
  // characters can possess this Merit" (p. 110), and the sheet is a mage's.
  "Common Sense", "Danger Sense", "Eidetic Memory", "Encyclopedic Knowledge",
  "Holistic Awareness", "Language", "Meditative Mind",
  // Physical (WoD pp. 110–114)
  "Ambidextrous", "Brawling Dodge", "Direction Sense", "Disarm", "Fast Reflexes",
  "Fighting Finesse", "Fighting Style: Boxing", "Fighting Style: Kung Fu",
  "Fighting Style: Two Weapons", "Fleet of Foot", "Fresh Start", "Giant", "Gunslinger",
  "Iron Stamina", "Iron Stomach", "Natural Immunity", "Quick Draw", "Quick Healer",
  "Strong Back", "Strong Lungs", "Stunt Driver", "Toxin Resistance", "Weaponry Dodge",
  // Social (WoD pp. 114–117; Status also Mage pp. 88–89)
  "Allies", "Barfly", "Contacts", "Fame", "Inspiring", "Mentor", "Resources", "Retainer",
  "Status", "Striking Looks",
  // Awakened (Mage pp. 80–89)
  "Artifact", "Destiny", "Dream", "Enhanced Item", "Familiar", "Hallow", "High Speech",
  "Imbued Item", "Library", "Occultation", "Sanctum", "Sleepwalker Retainer", "Thrall",
] as const

export const MeritName = Schema.Literals([...MERIT_NAMES])
export type MeritName = typeof MeritName.Type

/**
 * How many dots a Merit may be held at, as the book writes it beside the
 * name: "(••)", "(• to •••)", "(•• or ••••)", "(••• or higher)".
 */
export const MeritRating = Schema.Union([
  Schema.TaggedStruct("fixed", { dots: Schema.Number }),
  Schema.TaggedStruct("range", { min: Schema.Number, max: Schema.Number }),
  Schema.TaggedStruct("either", { low: Schema.Number, high: Schema.Number }),
  Schema.TaggedStruct("atLeast", { min: Schema.Number }),
])
export type MeritRating = typeof MeritRating.Type

const fixed = (dots: number): MeritRating => ({ _tag: "fixed", dots })
const range = (min: number, max: number): MeritRating => ({ _tag: "range", min, max })
const either = (low: number, high: number): MeritRating => ({ _tag: "either", low, high })
const atLeast = (min: number): MeritRating => ({ _tag: "atLeast", min })

/** What must already be true of the character to take the Merit. */
export const MeritPrerequisite = Schema.Union([
  Schema.TaggedStruct("attribute", { key: AttributeKey, dots: Schema.Number }),
  /** "Stamina ••• or Resolve •••": any one of the keys at the dots. */
  Schema.TaggedStruct("anyAttribute", { keys: Schema.Array(AttributeKey), dots: Schema.Number }),
  Schema.TaggedStruct("skill", { key: SkillKey, dots: Schema.Number }),
  Schema.TaggedStruct("merit", { name: MeritName, dots: Schema.Number }),
  Schema.TaggedStruct("noMerit", { name: MeritName }),
])
export type MeritPrerequisite = typeof MeritPrerequisite.Type

const attr = (key: AttributeKey, dots: number): MeritPrerequisite => ({ _tag: "attribute", key, dots })
const skill = (key: SkillKey, dots: number): MeritPrerequisite => ({ _tag: "skill", key, dots })

/**
 * Whether the sheet holds the Merit once, or once per thing it names —
 * "Allies (Police) ••, Allies (Criminals) •••" (WoD p. 114), a Language, a
 * Fighting Finesse weapon, Status in a Consilium or an order. A `named`
 * Merit's sheet entry carries that label.
 */
export const MeritInstance = Schema.Literals(["single", "named"])
export type MeritInstance = typeof MeritInstance.Type

/** One rung of a Fighting Style: the maneuver its dot unlocks. */
export const MeritTier = Schema.Struct({
  dots: Schema.Number,
  name: Schema.String,
  effect: Schema.String,
})
export type MeritTier = typeof MeritTier.Type

const MeritBody = Schema.Struct({
  family: MeritFamily,
  rating: MeritRating,
  prerequisites: Schema.Array(MeritPrerequisite),
  instance: MeritInstance,
  /** "Available at character creation only" (WoD p. 108). */
  creationOnly: Schema.Boolean,
  /** The book's mechanical sentence, in one line. */
  effect: Schema.String,
  /** Fighting Styles: the maneuver each dot unlocks, each a prerequisite for the next. */
  tiers: Schema.optionalKey(Schema.Array(MeritTier)),
  /** Where the paragraph is: the book and its page. */
  page: Schema.Struct({ book: Schema.Literals(["mage", "wod"]), page: Schema.Number }),
})
type MeritBody = typeof MeritBody.Type

export const MeritDef = Schema.Struct({ name: MeritName, ...MeritBody.fields })
export type MeritDef = typeof MeritDef.Type

const mage = (page: number) => ({ book: "mage" as const, page })
const wod = (page: number) => ({ book: "wod" as const, page })

// --- The catalog, total over MeritName ---

const CATALOG: Record<MeritName, MeritBody> = {
  // ---- Mental (WoD pp. 108–110) ----
  "Common Sense": {
    family: "mental", rating: fixed(4), prerequisites: [], instance: "single", creationOnly: true,
    effect: "Once a chapter the Storyteller may make a reflexive Wits + Composure roll to warn the character off a disastrous course.",
    page: wod(108),
  },
  "Danger Sense": {
    family: "mental", rating: fixed(2), prerequisites: [], instance: "single", creationOnly: false,
    effect: "+2 on reflexive Wits + Composure rolls to detect an impending ambush.",
    page: wod(108),
  },
  "Eidetic Memory": {
    family: "mental", rating: fixed(2), prerequisites: [], instance: "single", creationOnly: true,
    effect: "No roll to recall a fact or past experience; under stress, +2 to memory-recall rolls.",
    page: wod(108),
  },
  "Encyclopedic Knowledge": {
    family: "mental", rating: fixed(4), prerequisites: [], instance: "single", creationOnly: true,
    effect: "Intelligence + Wits to recall a factoid about any situation outside the character's experience.",
    page: wod(109),
  },
  "Holistic Awareness": {
    family: "mental", rating: fixed(3), prerequisites: [], instance: "single", creationOnly: false,
    effect: "An hour's treatment and an Intelligence + Medicine roll once a day: a success halves the patient's healing times that day (bashing and lethal only).",
    page: wod(109),
  },
  "Language": {
    family: "mental", rating: range(1, 3), prerequisites: [], instance: "named", creationOnly: false,
    effect: "An extra language: minimal fluency at one dot, literate and conversational at two, like a native at three.",
    page: wod(109),
  },
  "Meditative Mind": {
    family: "mental", rating: fixed(1), prerequisites: [], instance: "single", creationOnly: false,
    effect: "Environmental and wound penalties to Wits + Composure rolls to meditate are ignored.",
    page: wod(109),
  },

  // ---- Physical (WoD pp. 110–114) ----
  "Ambidextrous": {
    family: "physical", rating: fixed(3), prerequisites: [], instance: "single", creationOnly: true,
    effect: "No −2 penalty for the off hand.",
    page: wod(110),
  },
  "Brawling Dodge": {
    family: "physical", rating: fixed(1), prerequisites: [attr("strength", 2), skill("brawl", 1)], instance: "single", creationOnly: false,
    effect: "On a dodge, add Brawl dots to Defense instead of doubling it.",
    page: wod(110),
  },
  "Direction Sense": {
    family: "physical", rating: fixed(1), prerequisites: [], instance: "single", creationOnly: false,
    effect: "Always oriented: retrace any route and face any compass point without references.",
    page: wod(110),
  },
  "Disarm": {
    family: "physical", rating: fixed(2), prerequisites: [attr("dexterity", 3), skill("weaponry", 2)], instance: "single", creationOnly: false,
    effect: "A close-combat attack whose successes equal or exceed the opponent's Dexterity may disarm instead of wound; the weapon lands successes yards away.",
    page: wod(110),
  },
  "Fast Reflexes": {
    family: "physical", rating: range(1, 2), prerequisites: [attr("dexterity", 3)], instance: "single", creationOnly: false,
    effect: "+1 Initiative per dot.",
    page: wod(110),
  },
  "Fighting Finesse": {
    family: "physical", rating: fixed(2), prerequisites: [attr("dexterity", 3), skill("weaponry", 2)], instance: "named", creationOnly: false,
    effect: "With one chosen weapon, substitute Dexterity for Strength on attack rolls; bought once per weapon.",
    page: wod(110),
  },
  "Fighting Style: Boxing": {
    family: "physical", rating: range(1, 5),
    prerequisites: [attr("strength", 3), attr("stamina", 2), skill("brawl", 2)], instance: "single", creationOnly: false,
    effect: "Trained boxing; each dot unlocks the next maneuver.",
    tiers: [
      { dots: 1, name: "Body Blow", effect: "A Brawl attack whose successes equal or exceed the target's Size costs him his next action." },
      { dots: 2, name: "Duck and Weave", effect: "Defense against Brawl attacks uses the higher of Dexterity or Wits." },
      { dots: 3, name: "Combination Blows", effect: "Two Brawl attacks on one target in a single action, the second at −1; no Defense that turn." },
      { dots: 4, name: "Haymaker", effect: "A Brawl attack whose damage equals or exceeds the target's Size may knock him out: a failed Stamina roll means unconscious for turns equal to the damage; no Defense that turn." },
      { dots: 5, name: "Brutal Blow", effect: "Punches inflict lethal damage; one Willpower per attack, which adds no dice." },
    ],
    page: wod(110),
  },
  "Fighting Style: Kung Fu": {
    family: "physical", rating: range(1, 5),
    prerequisites: [attr("strength", 2), attr("dexterity", 2), attr("stamina", 2), skill("brawl", 2)], instance: "single", creationOnly: false,
    effect: "Trained kung fu; each dot unlocks the next maneuver.",
    tiers: [
      { dots: 1, name: "Focused Attack", effect: "Specified-target penalties and armor penalties to Brawl attacks are reduced by one." },
      { dots: 2, name: "Iron Skin", effect: "An effective armor of 1 against bashing attacks." },
      { dots: 3, name: "Defensive Attack", effect: "+2 Defense for the turn and −2 to the character's own attacks; move no more than Speed." },
      { dots: 4, name: "Whirlwind Strike", effect: "One extra Brawl attack on the same target per point of Dexterity above 2, each at a cumulative −1; no Defense that turn." },
      { dots: 5, name: "Lethal Strike", effect: "Strikes inflict lethal damage; one Willpower per attack, which adds no dice." },
    ],
    page: wod(111),
  },
  "Fighting Style: Two Weapons": {
    family: "physical", rating: range(1, 4),
    prerequisites: [attr("dexterity", 3), skill("weaponry", 3)], instance: "single", creationOnly: false,
    effect: "A weapon in each hand; each dot unlocks the next maneuver. The off hand still takes −2 without Ambidextrous.",
    tiers: [
      { dots: 1, name: "Whirling Blades", effect: "The Dodge is not reduced by multiple attackers until their number exceeds Weaponry dots." },
      { dots: 2, name: "Deflect and Thrust", effect: "+2 Defense for the turn and −2 to the character's own attacks; move no more than Speed." },
      { dots: 3, name: "Focused Attack", effect: "Two attacks on one target in a turn, the second at −1; no Defense that turn." },
      { dots: 4, name: "Fluid Attack", effect: "One attack on two targets no farther apart than Speed, the second at −1; no Defense that turn." },
    ],
    page: wod(112),
  },
  "Fleet of Foot": {
    family: "physical", rating: range(1, 3), prerequisites: [attr("strength", 2)], instance: "single", creationOnly: false,
    effect: "+1 Speed per dot.",
    page: wod(112),
  },
  "Fresh Start": {
    family: "physical", rating: fixed(1), prerequisites: [{ _tag: "merit", name: "Fast Reflexes", dots: 2 }], instance: "single", creationOnly: false,
    effect: "Spend an action to re-enter the Initiative roster at any point from the next turn on.",
    page: wod(112),
  },
  "Giant": {
    family: "physical", rating: fixed(4), prerequisites: [], instance: "single", creationOnly: true,
    effect: "+1 Size, and so +1 Health.",
    page: wod(112),
  },
  "Gunslinger": {
    family: "physical", rating: fixed(3), prerequisites: [attr("dexterity", 3), skill("firearms", 3)], instance: "single", creationOnly: false,
    effect: "Fire two pistols as a single action, the second at −1 and the off hand at −2; two different targets costs Defense for the turn.",
    page: wod(112),
  },
  "Iron Stamina": {
    family: "physical", rating: range(1, 3),
    prerequisites: [{ _tag: "anyAttribute", keys: ["stamina", "resolve"], dots: 3 }], instance: "single", creationOnly: false,
    effect: "Each dot cancels one point of fatigue or wound penalty.",
    page: wod(113),
  },
  "Iron Stomach": {
    family: "physical", rating: fixed(2), prerequisites: [attr("stamina", 2)], instance: "single", creationOnly: false,
    effect: "+2 to Survival rolls to eat whatever is at hand; +3 to Stamina to resist deprivation.",
    page: wod(113),
  },
  "Natural Immunity": {
    family: "physical", rating: fixed(1), prerequisites: [attr("stamina", 2)], instance: "single", creationOnly: false,
    effect: "+2 on Stamina rolls to resist infection, sickness and disease.",
    page: wod(113),
  },
  "Quick Draw": {
    family: "physical", rating: fixed(1), prerequisites: [attr("dexterity", 3)], instance: "named", creationOnly: false,
    effect: "Draw and attack as one action without penalty, a hidden weapon costing no Defense; bought separately for firearms and for melee weapons.",
    page: wod(113),
  },
  "Quick Healer": {
    family: "physical", rating: fixed(4), prerequisites: [attr("stamina", 4)], instance: "single", creationOnly: false,
    effect: "Heals in half the time: bashing in eight minutes, lethal in a day, aggravated in four days.",
    page: wod(113),
  },
  "Strong Back": {
    family: "physical", rating: fixed(1), prerequisites: [attr("strength", 2)], instance: "single", creationOnly: false,
    effect: "+1 to lift or carry heavy weights.",
    page: wod(113),
  },
  "Strong Lungs": {
    family: "physical", rating: fixed(3), prerequisites: [skill("athletics", 3)], instance: "single", creationOnly: false,
    effect: "+2 to Stamina when reading the holding-breath chart.",
    page: wod(113),
  },
  "Stunt Driver": {
    family: "physical", rating: fixed(3), prerequisites: [attr("dexterity", 3)], instance: "single", creationOnly: false,
    effect: "Drive and take an unrelated action in the same turn.",
    page: wod(113),
  },
  "Toxin Resistance": {
    family: "physical", rating: fixed(2), prerequisites: [attr("stamina", 3)], instance: "single", creationOnly: false,
    effect: "+2 on Stamina rolls to resist drugs, poisons and toxins; hard to intoxicate, and painkillers work half as well.",
    page: wod(113),
  },
  "Weaponry Dodge": {
    family: "physical", rating: fixed(1), prerequisites: [attr("strength", 2), skill("weaponry", 1)], instance: "single", creationOnly: false,
    effect: "On a dodge, add Weaponry dots to Defense instead of doubling it.",
    page: wod(114),
  },

  // ---- Social (WoD pp. 114–117) ----
  "Allies": {
    family: "social", rating: range(1, 5), prerequisites: [], instance: "named", creationOnly: false,
    effect: "Favors from one group, deeper per dot; a doubtful ask is Manipulation + Persuasion with a bonus equal to the dots.",
    page: wod(114),
  },
  "Barfly": {
    family: "social", rating: fixed(1), prerequisites: [], instance: "single", creationOnly: false,
    effect: "Into any nightspot with a few quick words and a timely bribe.",
    page: wod(114),
  },
  "Contacts": {
    family: "social", rating: range(1, 5), prerequisites: [], instance: "single", creationOnly: false,
    effect: "One circle of informants per dot; information takes a Manipulation + Persuasion or Socialize roll.",
    page: wod(114),
  },
  "Fame": {
    family: "social", rating: range(1, 3), prerequisites: [], instance: "single", creationOnly: false,
    effect: "+1 per dot to Socialize (or Persuasion) rolls among the impressed — and the same bonus to be recognized on the street.",
    page: wod(115),
  },
  "Inspiring": {
    family: "social", rating: fixed(4), prerequisites: [attr("presence", 4)], instance: "single", creationOnly: false,
    effect: "Once a session, a Presence + Persuasion roll: those who actively assist and are in earshot regain one spent Willpower.",
    page: wod(115),
  },
  "Mentor": {
    family: "social", rating: range(1, 5), prerequisites: [], instance: "single", creationOnly: false,
    effect: "A teacher and patron who acts on the character's behalf, power and reach growing with the dots.",
    page: wod(115),
  },
  "Resources": {
    family: "social", rating: range(1, 5), prerequisites: [], instance: "single", creationOnly: false,
    effect: "Disposable income, from $500 a month at one dot to $50,000 at five; an item costing no more dots than this is affordable.",
    page: wod(115),
  },
  "Retainer": {
    family: "social", rating: range(1, 5), prerequisites: [], instance: "named", creationOnly: false,
    effect: "One loyal follower per acquisition, the dots measuring his capability; no roll to get results.",
    page: wod(116),
  },
  "Status": {
    family: "social", rating: range(1, 5), prerequisites: [], instance: "named", creationOnly: false,
    effect: "Standing in one group — a Sleeper body, or among the Awakened a Consilium or an order: bonus dice equal to the dots on mundane Social rolls through official channels. One dot of Order Status is needed to learn the order's rotes past the starting six.",
    page: wod(116),
  },
  "Striking Looks": {
    family: "social", rating: either(2, 4), prerequisites: [], instance: "single", creationOnly: false,
    effect: "+1 at two dots, +2 at four, to Presence or Manipulation rolls that trade on looks; harder to go unnoticed.",
    page: wod(117),
  },

  // ---- Awakened (Mage pp. 80–89) ----
  "Artifact": {
    family: "awakened", rating: atLeast(3), prerequisites: [], instance: "named", creationOnly: false,
    effect: "A Supernal item whose powers mimic spells, rolling Gnosis + the mimicked Arcanum when triggered; costs 2 + the highest Arcanum dots, +1 per further power, +1 if persistent.",
    page: mage(80),
  },
  "Destiny": {
    family: "awakened", rating: range(1, 5), prerequisites: [], instance: "single", creationOnly: false,
    effect: "A pool of destiny dice each chapter equal to twice the dots, added to any rolls; a bane the Storyteller approves costs one die per dot whenever it comes into play.",
    page: mage(81),
  },
  "Dream": {
    family: "awakened", rating: range(1, 5), prerequisites: [], instance: "single", creationOnly: false,
    effect: "Once a session, an hour's reverie and a secret Wits + Composure roll yield one clue per dot, veiled in symbol.",
    page: mage(82),
  },
  "Enhanced Item": {
    family: "awakened", rating: range(1, 5), prerequisites: [], instance: "named", creationOnly: false,
    effect: "An object altered with Matter: 1 dot per +2 Durability, Structure or Size, per +1 equipment bonus, or per Arcanum dot of a special property. Persistent, and no Paradox.",
    page: mage(82),
  },
  "Familiar": {
    family: "awakened", rating: either(3, 4), prerequisites: [], instance: "single", creationOnly: false,
    effect: "A bonded rank 1 spirit — three dots in Twilight, four embodied — whose Essence the mage may spend as Mana and whose senses serve as a scrying window.",
    page: mage(82),
  },
  "Hallow": {
    family: "awakened", rating: range(1, 5), prerequisites: [{ _tag: "merit", name: "Sanctum", dots: 1 }], instance: "single", creationOnly: false,
    effect: "Mana equal to the dots each day, drawn by oblation or Prime 3; within five yards per dot, the first Mana point a spell costs is free.",
    page: mage(83),
  },
  "High Speech": {
    family: "awakened", rating: fixed(1), prerequisites: [], instance: "single", creationOnly: false,
    effect: "The Atlantean tongue: an instant action of chanting gives +2 to the next turn's spellcasting (p. 117), and its runes extend a spell's Duration (p. 119). Free to a mage who begins play in an order.",
    page: mage(84),
  },
  "Imbued Item": {
    family: "awakened", rating: atLeast(2), prerequisites: [], instance: "named", creationOnly: false,
    effect: "An item holding a spell imbued with Prime, rolling Gnosis + the Arcanum when triggered; costs 1 + the highest Arcanum dots, +1 per further power, +1 if persistent, +1 for a Mana pool of its own.",
    page: mage(84),
  },
  "Library": {
    family: "awakened", rating: range(1, 5), prerequisites: [{ _tag: "merit", name: "Sanctum", dots: 1 }], instance: "single", creationOnly: false,
    effect: "One field of study per dot; research rolls from it take ten minutes each rather than thirty. Shareable within a sanctum.",
    page: mage(85),
  },
  "Occultation": {
    family: "awakened", rating: range(1, 3), prerequisites: [{ _tag: "noMerit", name: "Fame" }], instance: "single", creationOnly: false,
    effect: "The dots are subtracted from rolls to read the mage's resonance, from sympathetic spells cast at him and from mundane rolls to gather information about him. Lost while he is publicly known.",
    page: mage(86),
  },
  "Sanctum": {
    family: "awakened", rating: range(1, 10), prerequisites: [], instance: "single", creationOnly: false,
    effect: "The mage's stronghold, its dots split between Size (rooms) and Security (−1 die per dot to intrude, +1 Initiative per dot to those inside); each aspect caps at five.",
    page: mage(86),
  },
  "Sleepwalker Retainer": {
    family: "awakened", rating: range(1, 5), prerequisites: [], instance: "named", creationOnly: false,
    effect: "A Retainer who is a Sleepwalker: magic may be worked openly before him.",
    page: mage(88),
  },
  "Thrall": {
    family: "awakened", rating: fixed(3), prerequisites: [], instance: "named", creationOnly: false,
    effect: "The mage holds another willworker's soul stone: three favors owed, an Intimate connection, and once a day Gnosis + Presence − the owner's Resolve to draw one Mana per success.",
    page: mage(89),
  },
}

/** Every Merit, in the catalog's order: the four families, each alphabetical. */
export const MERITS: ReadonlyArray<MeritDef> = MERIT_NAMES.map((name) => ({ name, ...CATALOG[name] }))

/** The catalog entry for a name — total, since the name is closed. */
export const merit = (name: MeritName): MeritDef => ({ name, ...CATALOG[name] })

/** Find-by-name over an open string (a name a person typed): a miss is a value. */
export const findMerit = (name: string): Option.Option<MeritDef> =>
  Schema.is(MeritName)(name) ? Option.some(merit(name)) : Option.none()

/** The Merits of one family, alphabetical as the book lists them. */
export const meritsOf = (family: MeritFamily): ReadonlyArray<MeritDef> =>
  MERITS.filter((m) => m.family === family)

// --- Rating rules ---

/** Whether a Merit may be held at these dots. */
export const ratingAllows = (rating: MeritRating, dots: number): boolean =>
  Match.value(rating).pipe(
    Match.tag("fixed", (r) => dots === r.dots),
    Match.tag("range", (r) => dots >= r.min && dots <= r.max),
    Match.tag("either", (r) => dots === r.low || dots === r.high),
    Match.tag("atLeast", (r) => dots >= r.min),
    Match.exhaustive,
  )

const bullets = (n: number): string => "•".repeat(n)

/** The rating as the book prints it beside the name: "•", "• to •••", "•• or ••••", "••• or higher". */
export const ratingText = (rating: MeritRating): string =>
  Match.value(rating).pipe(
    Match.tag("fixed", (r) => bullets(r.dots)),
    Match.tag("range", (r) => `${bullets(r.min)} to ${bullets(r.max)}`),
    Match.tag("either", (r) => `${bullets(r.low)} or ${bullets(r.high)}`),
    Match.tag("atLeast", (r) => `${bullets(r.min)} or higher`),
    Match.exhaustive,
  )

/**
 * What a Merit at these dots costs from the creation budget: a dot a dot,
 * and the fifth dot two (Mage p. 81, in the Artifact example: "the fifth dot
 * costs two dots"). Experience later is 2 XP a dot (`XP_COSTS` in wisdom.ts).
 */
export const creationCost = (dots: number): number => dots + (dots >= 5 ? 1 : 0)

// --- Creation validation ---

/**
 * One Merit as a sheet holds it (MAG-59): the name, the dots (one to ten —
 * Sanctum's two aspects at five each are the widest, Mage p. 87), and the
 * label a `named` Merit carries, written beside it as the book does:
 * "Allies (Police) ••". Also the shape of a creation selection.
 */
export const HeldMerit = Schema.Struct({
  name: MeritName,
  dots: Schema.Number.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 10 })),
  label: Schema.optionalKey(Schema.String),
})
export type HeldMerit = typeof HeldMerit.Type

export class MeritValidationError extends Schema.TaggedError<MeritValidationError>()(
  "MeritValidationError",
  { message: Schema.String },
) {}

/**
 * The traits a prerequisite may read: every Attribute and Skill, as the
 * sheet carries them (a Skill at zero is unrated, and fails any dots asked).
 */
export const MeritTraits = Schema.Struct({
  attributes: Schema.Record(AttributeKey, Schema.Number),
  skills: Schema.Record(SkillKey, Schema.Number),
})
export type MeritTraits = typeof MeritTraits.Type

const needs = (name: MeritName, what: string): MeritValidationError =>
  new MeritValidationError({ message: `${name} requires ${what}` })

/**
 * One prerequisite checked against the character's traits and the Merits
 * they would hold after the selection (`holds` covers current and selected).
 */
const prerequisiteFailure = (
  name: MeritName,
  prereq: MeritPrerequisite,
  traits: MeritTraits,
  dotsHeld: (m: MeritName) => number,
): Option.Option<MeritValidationError> =>
  Match.value(prereq).pipe(
    Match.tag("attribute", (p) =>
      traits.attributes[p.key] >= p.dots ? Option.none() : Option.some(needs(name, `${p.key} ${p.dots}`)),
    ),
    Match.tag("anyAttribute", (p) =>
      p.keys.some((k) => traits.attributes[k] >= p.dots)
        ? Option.none()
        : Option.some(needs(name, `${p.keys.join(" or ")} ${p.dots}`)),
    ),
    Match.tag("skill", (p) =>
      traits.skills[p.key] >= p.dots ? Option.none() : Option.some(needs(name, `${p.key} ${p.dots}`)),
    ),
    Match.tag("merit", (p) =>
      dotsHeld(p.name) >= p.dots ? Option.none() : Option.some(needs(name, `${p.name} ${p.dots}`)),
    ),
    Match.tag("noMerit", (p) =>
      dotsHeld(p.name) > 0
        ? Option.some(new MeritValidationError({ message: `${name} cannot be taken with ${p.name}` }))
        : Option.none(),
    ),
    Match.exhaustive,
  )

/**
 * Creation-rules validation of a Merit selection: the budget (seven dots,
 * Mage p. 69, the fifth dot costing two), each Merit's rating, and its
 * prerequisites read against the sheet's traits and the Merits held with it.
 * The first failure refuses the whole selection.
 */
export const validateMeritSelections = Effect.fn("Merits.validate")(function* (input: {
  selections: ReadonlyArray<HeldMerit>
  maxDots: number
  currentMerits: ReadonlyArray<HeldMerit>
  traits: MeritTraits
}) {
  const { selections, maxDots, currentMerits, traits } = input

  const spent = selections.reduce((sum, s) => sum + creationCost(s.dots), 0)
  if (spent > maxDots) {
    return yield* new MeritValidationError({
      message: `Merit selection costs ${spent} dots, over the ${maxDots} allowed`,
    })
  }

  const all = [...currentMerits, ...selections]
  const dotsHeld = (name: MeritName): number =>
    Option.getOrElse(
      Arr.findFirst(all, (m) => m.name === name),
      () => ({ dots: 0 }),
    ).dots

  yield* Effect.forEach(selections, (selection) =>
    Effect.gen(function* () {
      const def = merit(selection.name)
      if (!ratingAllows(def.rating, selection.dots)) {
        return yield* new MeritValidationError({
          message: `${def.name} is rated ${ratingText(def.rating)}, not ${bullets(selection.dots)}`,
        })
      }
      const failure = Option.firstSomeOf(
        def.prerequisites.map((p) => prerequisiteFailure(def.name, p, traits, dotsHeld)),
      )
      if (Option.isSome(failure)) {
        return yield* failure.value
      }
    }),
  )
})
