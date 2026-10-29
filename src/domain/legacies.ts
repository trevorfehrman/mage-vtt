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
  /** The rider as the book prints it. */
  text: Schema.String,
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
  /** The attainment's mechanics in one line, the catalog's own gloss. */
  effect: Schema.String,
  /** The attainment as the book prints it (owner, 2026-10-28: the gloss was "so confusing" — the page's words stand). */
  text: Schema.String,
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
        text: "The mage gains the ability to regenerate wounds to her body, similar to the Life 2 “Self-Healing” spell (p. 183), by sloughing off her damaged skin and replacing it with a freshly grown one. An instant action is required and Stamina + Athletics + Life is rolled. Each success heals one bashing or lethal point of damage. This action can be made reflexive in turn by spending one Willpower point. The user can also communicate with animals in their own language of behaviors, growls, grunts, cues and/or markings. A Presence + Animal Ken roll and instant action is required to communicate simple concepts. She can communicate only the kind of information that another animal of that type could convey to one of its fellow species.",
      },
      {
        name: "Beast Gift", gnosis: 5,
        arcana: [arc("life", 3)], skills: [],
        mirrors: 'Life 3 "Transform Self"',
        effect: "Instant action, no roll: grow one fixed animal or plant feature for up to an hour — a natural weapon adds two dice and deals lethal, a protective feature gives two armor. Snake Skin now heals aggravated for one Mana.",
        text: "The mage can transform a portion of her body with a single, specific animal or plant feature, such as bear claws, cat eyes or tree-bark skin, similar to the Life 3 “Transform Self” spell (p. 187). Doing so requires an instant action, during which she can move up to her Speed, but no roll is needed. She must choose her unique feature upon gaining this attainment, and cannot change it thereafter. The shift lasts for up to one hour per activation. Any natural weapon (claws, fangs) she gains adds two dice to attack rolls (and damage is lethal), while a protective feature (fur, tree bark) provides two armor points. The character can also now heal aggravated wounds using Snake Skin, but it also requires the expenditure of one Mana.",
        synergy: { arcanum: "matter", dots: 3, effect: "The feature may be mineral: stone fists or feet add four dice (bashing), stone skin gives three armor.", text: "If the mage also knows Matter 3, her unique transformative feature could be mineral rather than organic. She might shift her fists or feet into stone, or cover her epidermis with a layer of thin, flexible shale “scales.” Stone fists or feet add four dice to punches or kicks, but the damage is bashing instead of lethal. Stone skin provides three points of armor." },
      },
      {
        name: "Beast Form", gnosis: 7,
        arcana: [arc("life", 4)], skills: [],
        mirrors: 'Life 4 "Shapechanging"',
        effect: "Reflexive shapeshift at will into one fixed animal or plant for up to an hour, without losing herself in its mind; a plant form speaks with plant spirits without the Spirit Arcanum.",
        text: "The mage can now reflexively shapeshift at will into a single, specific creature or plant, similar to the Life 4 “Shapechanging” spell (p. 190). The shift lasts for up to one hour per activation. She does not suffer the problems of losing herself in a form’s mindset. If she chooses a plant form instead of an animal, she is inanimate but can communicate with any nearby plant-based spirits without needing the Spirit Arcanum, or if she journeys through Astral Space while her body is in plant form, she can interact with the ancient plant spirits of the Dreamtime.",
        synergy: { arcanum: "matter", dots: 4, effect: "Stone may be the form: immobile but perceiving, speaking with mineral spirits without the Spirit Arcanum.", text: "If the mage also knows Matter 4, she could choose stone as her shapeshifting form, changing herself into a rock. She cannot move, although she can perceive her surroundings. The obvious use for this version of the attainment is camouflage, but it provides another unique benefit. The mage can communicate with any nearby mineral-based spirits without needing the Spirit Arcanum, or if she journeys through Astral Space while her body is in rock form, she can interact with the ancient mineral spirits of the Dreamtime." },
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
        text: "The mage can consciously control his normally autonomous bodily functions, similar to the Life 2 “Body Control” spell (p. 182). This attainment is always active and of indefinite Duration. Use the Adept’s Life dots as successes to determine exact effects; see the spell description. He also gains a sense of his own subtle energy, what has been called chi or prana, and can see such energy in other life forms. Basically, he gains the Prime 1 “Supernal Vision” spell effect (p. 221) with an indefinite Duration, although it applies only to analyzing living creatures. In other words, he can take an extended action (one turn per roll) to view auras and scrutinize people to discern the strength of their chi (that is, how many Mana points they currently have in their pool), but can’t analyze place-based Resonance. Use the rules for scrutinizing beings (p. 278), with a target number equal to the being’s Mana points to be able to determine the target’s total current points.",
      },
      {
        name: "Chi Force", gnosis: 5,
        arcana: [arc("life", 3)], skills: [skill("brawl", 3)],
        mirrors: 'Life 3 "Honing the Form"',
        effect: "Instant action: Mind dots added to one Physical Attribute chosen for good when the attainment is gained, for up to an hour. Stacks with a Honing the Form spell, whose Duration then becomes one turn.",
        text: "The mage controls the flow of his chi, boosting one specific Physical Attribute, similar to the Life 3 “Honing the Form” spell (p. 186). When this attainment is gained, the mage must choose a single Attribute (Strength, Dexterity or Stamina) that he wishes to concentrate upon in the perfection of his body. He cannot later choose a different Attribute. To gain the boost thereafter, the mage performs an instant action to channel his chi, and his Mind dots are added to the chosen Attribute. The effect lasts for up to one hour per activation. Since this is not a spell, the mage could use this attainment at the same time that he casts a Honing the Form spell to gain a truly phenomenal Attribute rating. The one limitation, however, is that the default Duration of any spell that boosts the same Physical Attribute becomes transitory (one turn), even if it is normally prolonged.",
        synergy: { arcanum: "forces", dots: 3, effect: "A chi strike at a distance: Resolve + Brawl + Forces, each success one bashing, aimed.", text: "If your character also has Forces 3, he can use his chi to strike at a distance, similar to the Forces 3 “Telekinetic Strike” spell (pp. 170-171). An instant action is performed and a Resolve + Brawl + Forces roll is made. Each success inflicts one bashing point of damage. As with the spell, this effect is aimed, so anything that would normally protect the target from a ranged attack applies against the mage’s chi strike." },
      },
      {
        name: "Perfect Body", gnosis: 7,
        arcana: [arc("life", 4)], skills: [],
        mirrors: 'Life 3 "Honing the Form", twice',
        effect: "A second Physical Attribute boosted as Chi Force, both at once for separate instant actions.",
        text: "As with Chi Force, above, but the mage can now choose a second Physical Attribute to boost. He can even use both of these attainments at the same time, as long as he spends separate instant actions to activate the powers.",
        synergy: { arcanum: "forces", dots: 4, effect: "The chi strike deals lethal, and Dexterity + Brawl + Forces turns aside a projectile before the mage's own turn comes.", text: "If he also has Forces 4, his Telekinetic Strike now delivers lethal damage. In addition, he can use his chi to turn aside bullets and other projectiles, similar to the Forces 4 “Control Velocity” spell (p. 172). An instant action is performed and a Dexterity + Brawl + Forces roll is made. The number of successes determines the degree to which he can turn the projectile (as per the spell description). He can take this action at any point in the initiative roster, even before he is normally allowed to act, as long as he has not yet acted the turn." },
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
        text: "The mage walks unnoticed by others, blending perfectly into their expectations. While doing so, she reads from her special vantage clues in the artifacts of human culture — advertising, fashion — and the unconscious behavior of others. These clues hint at opportunities and openings for effecting major changes in society through minor deeds. This attainment is similar to a combination of the Mind 2 “Incognito Presence” spell (p. 208, allowing her to walk openly but unnoticed by others) and the Fate 1 “The Sybil’s Sight” spell (p. 149, allowing her to detect momentous events). To activate this attainment, the mage merely performs an instant action; no roll is required. The effect lasts for up to an hour.",
      },
      {
        name: "False Presence", gnosis: 5,
        arcana: [arc("mind", 3)], skills: [],
        mirrors: 'Mind 3 "Imposter"',
        effect: "Instant action, no roll: a false persona and image across Mind dots' worth of senses for up to an hour, with an altered aura whose Potency is Mind dots.",
        text: "The mage can assume a false persona and even image, using an effect similar to the Mind 3 “Imposter” spell (p. 211). He performs an instant action (no roll required) and affects a number of senses (sight, sound, smell, touch and even taste) equal to his Mind dots. The effect lasts for up to an hour. In addition, he can alter the appearance of his own aura, changing its mental or emotional state (similar to the Mind 2 “Alter Aura” spell, p. 207), or even its nature (similar to the Prime 2 “Transform Aura” spell, p. 223). Use the mage’s Mind dots for Potency when comparing this effect against anyone trying to see past it.",
        synergy: { arcanum: "space", dots: 3, effect: "Forge sympathetic connections between people and things observed during the Subtle Dance, one degree per Space dot, Intimate at best, lasting.", text: "If she also knows Space 3, the mage can create sympathetic connections between people, places and things she observes during the Subtle Dance, similar to the Space 3 “New Threads” spell (p. 237). She performs an instant action and improves the degree of sympathy by one degree per dot of Space, although she cannot make a Sensory connection if the targets are not in sensory contact (direct sight, hearing or touch). An Intimate connection is the best possible in that situation. (The Storyteller determines the base degree of connection.) These threads are of lasting Duration, unless the natural course of events alters them (such as if two people’s relations become strained, decreasing their connection)." },
      },
      {
        name: "Occlude the Mind", gnosis: 7,
        arcana: [arc("mind", 4)], skills: [],
        mirrors: 'Mind 4 "Breach the Vault of Memory"',
        effect: "Instant action, Manipulation + Subterfuge + Mind: cloud and rewrite another's memories.",
        text: "The mage can literally cloud others’ minds by altering their very memories, similar to the Mind 4 “Breach the Vault of Memory” spell (p. 214). An instant action is required and Manipulation + Subterfuge + Mind is rolled.",
        synergy: { arcanum: "space", dots: 4, effect: "Co-locate one False Presence per Mind dot in different places at once, multitasking between them.", text: "If she also knows Space 4, the mage can co-locate a number of False Presences in different places at the same time (similar to the Space 4 “Co-Location” spell, p. 239). She performs an instant action (no roll required) and can create one persona per dot of Mind that she has. She can multitask (as per the Mind 3 “Multi-Tasking” spell, p. 211) up to a total of two mental and/or social instant actions or three mental and/or social extended actions between herself and her false personas." },
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
        text: "The mage has a “Mental Shield” (p. 208) of indefinite duration that provides protection equal to her Mind dots. In addition, she may study any product of her practice of the Matter Arcanum, such as an altered or transformed object, and see in it a mirror of her own soul. She can perceive her own aura, similar to the “Aura Perception” spell, p. 205. No roll is involved; just an instant action spent examining the object to read what it tells about herself. Following this action, she gains a +2 dice modifier on any Mind Arcanum Augmentation spells that boost her Mental and/or Social Attributes, as long as they are cast within the same scene as her examination.",
      },
      {
        name: "Albedo", gnosis: 5,
        arcana: [arc("mind", 3)], skills: [],
        mirrors: 'Mind 3 "Augment the Mind"',
        effect: "After studying his soul in his work, Mind dots added to one Mental or Social Attribute chosen for good, for up to an hour. Stacks with an Augment the Mind spell, whose Duration then becomes one turn.",
        text: "The mage can boost one specific Mental or Social Attribute, similar to the “Augment the Mind” spell (p. 210). When this attainment is first gained, the mage must choose a single Attribute (such as Intelligence or Composure) that he wishes to concentrate on in the Great Work of soulcrafting. He cannot later choose a different Attribute. To gain the boost, he must first study his soul in the same manner as he does one of the products of his Matter magic, as described for Nigredo. Following this action, his Mind dots are added to the chosen Attribute. The effect lasts for up to one hour when invoked. Since this is not a spell, the mage could use this attainment at the same time that he casts an “Augment the Mind” spell to gain a truly phenomenal Attribute rating. The one limitation, however, is that the default Duration of any spell that boosts the same Mental or Social Attribute becomes transitory (one turn), even if it is normally prolonged.",
        synergy: { arcanum: "prime", dots: 3, effect: 'The Nigredo shield also carries Prime 3 "Armor of the Soul".', text: "If the mage also knows Prime 3, he gains the benefit of the “Armor of the Soul” (p. 223) effect as part of his Nigredo shield." },
      },
      {
        name: "Rubedo", gnosis: 7,
        arcana: [arc("mind", 4)], skills: [],
        mirrors: 'Mind 3 "Augment the Mind", twice',
        effect: "A second Mental or Social Attribute boosted as Albedo, both at once for separate instant actions.",
        text: "As Albedo, above, but the mage can now choose a second Mental or Social Attribute to boost. He can even use both of these attainments at the same time, as long as he spends separate instant actions studying his soul through the auspices of his work to activate the powers.",
        synergy: { arcanum: "prime", dots: 4, effect: "Siphon Mana from an object of his own Matter work once a day: Resolve + Occult + Prime, one Mana per success, two Structure to the item each.", text: "If he also knows Prime 4, he can siphon Mana from objects he has worked his Matter magic upon, similar to the “Siphon Integrity” spell (p. 229). The object must have been created or modified by the mage himself using the Matter Arcanum, and only one such object can be siphoned per day. An instant action is performed and Resolve + Occult + Prime is rolled. Each success siphons one Mana, but inflicts two points of Structure damage to the item (bypassing Durability)." },
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
        text: "The mage peers into the Mists, the continuum of Nature that lies hidden behind the mundane world, hidden even from the Mage Sight. Doing so allows him to scry into distant places as if he were using the “Scrying” spell, p. 235. He must scry through the medium of plant life — trees, flowers, bushes or even grass. As long as there is some form of plant life in the place he wishes to scry, the mage can see there. To peer into the Mists and spy the desired location (i.e., to open a scrying window), an instant action is performed and Wits + Survival + Space is rolled, modified by the sympathetic distance (see pp. 114-115). After he has established the window, a reflexive action is required to view through it.",
        synergy: { arcanum: "time", dots: 2, effect: "Peer into the past of the place scried, as Postcognition: the plants present then tell what they saw.", text: "If the mage also has Time 2, he can peer into the past at the location he is scrying, similar to the “Postcognition” spell, p. 260. He literally speaks to plants to get their memory of events viewed. He can view the past only if the plants currently present at the location were there during the time the mage wishes to view." },
      },
      {
        name: "Mist Haven", gnosis: 5,
        arcana: [arc("space", 3)], skills: [],
        mirrors: 'Space 2 "Ward" and Space 3 "Ban"',
        effect: "Instant action, no roll, wherever one green shoot grows (or a Willpower point summons the Mists): a ward with a Ban of his choice over a radius set by Space dots.",
        text: "By cloaking himself (and others if desired) in the Mists, the mage can create a ward with a Ban of his choice (as long as he has the necessary Arcana knowledge), similar to the “Ward” (p. 236) and “Ban” (p. 237) spells. He can do this only amidst nature, where at least one green shoot grows from the earth. One Willpower point must be spent to summon the Mists if green space is lacking. To create the ward/Ban, he performs an instant action (no roll required) and affects an area based on his Space dots: a 4-yard radius or 20 square yards at Space 3, 8 yards or 40 square yards at Space 4, 16 yards or 80 square yards at Space 5. If he has Space 4, you can resort to the advanced area-affecting chart (see p. 118), using dots instead of dice penalties.",
        synergy: { arcanum: "time", dots: 3, effect: "Peer into the Mists divines the future: one question per Time dot, once a day per target.", text: "If the mage also has Time 3, he can use Peer into the Mists to divine the future, similar to the “Divination” spell (p. 263). The mage performs an instant action and can ask one question about the target’s future per Time dot. The Mists can sometimes reveal the weave of Creation before it’s made manifest. This power can be used in regard to the same target only once every 24 hours." },
      },
      {
        name: "Paths Through the Mists", gnosis: 7,
        arcana: [arc("space", 4)], skills: [],
        mirrors: 'Space 4 "Portal"',
        effect: "Instant action, Composure + Survival + Space by sympathetic distance: a path through the Mists to any place with plant life, open the turn after unless held by concentration, one Size 5 traveler a turn.",
        text: "The mage steps into the Mists, traveling wherever he desires as if he had created a Space portal. This ability is like the “Portal” spell, p. 238, although it is an instant action. The effect’s duration, however, is only for the turn in which it is activated and the subsequent turn (in which the mage and/or his friends presumably step onto the Mist path and step out at their destination). To keep it open longer, the mage must concentrate (as with any concentration-based spell; see p. 119). He can only open a path at and travel to a place with some form of plant life (even a small patch of grass is acceptable). Others can join him on his journey through the Mists: One person of Size 5 or less can pass through the portal per turn; larger people can spend two turns squeezing through. An instant action is performed to activate this power, and Composure + Survival + Space is rolled to determine success (modified by the sympathetic distance of the destination).",
        synergy: { arcanum: "time", dots: 4, effect: "Prophecy from within the Mist Haven: one question per Time dot about what might happen, once a day per target.", text: "If the mage also has Time 4, he can read prophecies from within his Mist Haven, similar to the “Prophecy” spell (p. 264). He performs an instant action and can ask one question about a subject’s possible future (what might happen rather than what will happen) per Time dot. This power can be used concerning the same target only once every 24 hours." },
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
        text: "The mage can physically interact with Twilight spirits (but not ghosts), similar to the “Gossamer Touch” spell (p. 247). He must first create a “magic circle,” and can affect spirits only while he is within the circle (although he can affect them with magic at a distance while he is standing in his circle). Creating the circle requires an instant action (no roll required), and its radius can equal the mage’s Space dots.",
        synergy: { arcanum: "death", dots: 2, effect: "Ghosts are affected from the circle as spirits are.", text: "If the mage also has Death 2, he can affect ghosts in the same manner that he affects spirits." },
      },
      {
        name: "Abyssal Command", gnosis: 5,
        arcana: [arc("spirit", 3)], skills: [],
        mirrors: 'Spirit 3 "Control Spirit"',
        effect: "Within the circle, Presence + Intimidation + Spirit against the spirit's Resistance: one command of rising complexity per success, one command per spirit at a time.",
        text: "Within his magic circle, the Accursed can issue commands to spirits that they must heed, similar to the “Control Spirit” spell (p. 248). An instant action is performed and Presence + Intimidation + Spirit is rolled, contested by a Resistance roll for the spirit. Each success allows the mage to issue a command of increasing complexity. He can repeatedly use this attainment while the circle is operative, but he can issue only one command to a spirit at a time. He cannot command the same spirit again until his first command is completed.",
        synergy: { arcanum: "time", dots: 3, effect: "A commanded spirit speaks of the future as a mouthpiece: one question per Time dot, once a day per target.", text: "If the mage also has Time 3, he can command a spirit to speak of the future. The spirit itself does not know the future, but becomes a mouthpiece by which the mage can ask questions of what is to come. This is similar to the Time 3 “Divination” spell (p. 263). The mage performs an instant action and can ask one question about a specified target’s future per Time dot. This power can be used concerning the same target only once every 24 hours." },
      },
      {
        name: "Shadow Circle", gnosis: 7,
        arcana: [arc("spirit", 4)], skills: [],
        mirrors: 'Spirit 4 "Road Master"',
        effect: "From within the circle, Presence + Occult + Spirit against the Gauntlet's Strength: step sideways across it and back as often as the circle stands.",
        text: "From within his magic circle, the mage can “step sideways” across the Gauntlet, similar to the Spirit 4 “Road Master” spell (p. 254). To step across, an instant action is performed and Presence + Occult + Spirit is rolled, modified by the Gauntlet’s Strength (p. 282). The mage can do this as many times as he likes, stepping back and forth, as long as his magic circle is operative. He can leave the circle, but must return (or create a new circle) to step over again.",
        synergy: { arcanum: "time", dots: 4, effect: "A spirit becomes the mouthpiece of Prophecy: one question per Time dot about what might happen, once a day per target.", text: "If the mage also has Time 4, he can use a spirit as the mouthpiece of a greater prophecy, similar to the Time 4 “Prophecy” spell (p. 264). He performs an instant action and can ask one question about a specified target’s possible future (what might happen rather than what will happen) per Time dot. This power can be used concerning the same target only once every 24 hours." },
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
        text: "The mage can steal souls from Sleepers, similar to the Death 3 “Sever the Sleeping Soul” spell (p. 141), although he does not need to spend Mana. An extended action with a Presence + Intimidation + Death roll is required, contested by the victim’s Resolve. See the spell description for complete rules. Unlike normal uses of this spell, this attainment allows a mage to extend his life unnaturally, without any signs of aging (until the soul begins to desiccate; see “Soul Nourishment”). Additionally, the user can fashion a soul jar, like the Death 2 “Soul Jar” spell (p. 137), in which to store a soul until it can be attached to him. The process is an extended action that calls for Presence + Crafts + Death rolls, with one roll allowed per hour. Finally, the mage can view the health of a soul before he severs it, similar to the Death 1 “Soul Marks” spell (p. 135). He merely spends an instant action (no roll required) gazing at the subject.",
      },
      {
        name: "Wicked Claim", gnosis: 5,
        arcana: [arc("death", 3)], skills: [],
        mirrors: 'Death 4 "Soul Binding" and Death 3 "Devouring the Slain"',
        effect: "Bind a stolen soul to himself by extended Presence + Empathy + Death; drain Willpower or Mana from the injured and dying with an instant Manipulation + Intimidation + Death less the victim's Stamina.",
        text: "The mage can bind a stolen soul to himself, similar to the Death 4 “Soul Binding” spell (p. 144). The process is an extended action involving Presence + Empathy + Death rolls, with one roll allowed per hour; see the rules described above for stealing Sleeping souls. Until the mage gains this attainment or learns Death 4, he must rely on another Tremere with this power to attach a soul for him. Additionally, the mage can steal Willpower and/or Mana from injured or dying victims, similar to the Death 3 “Devouring the Slain” spell. An instant action is performed and Manipulation + Intimidation + Death is rolled, subtracting the victim’s Stamina from the dice pool. See the spell’s description for complete effects.",
        synergy: { arcanum: "prime", dots: 3, effect: "Distill a soul into tass holding its owner's Mana (or Willpower dots, for a Sleeper), lasting until dissolved.", text: "If the mage has Prime 3, he can distill a soul into tass instead of attaching it or storing it in a soul jar, similar to the Prime 3 “Create Tass” spell (p. 224). The tass automatically has an amount of Mana equal to its original owner’s Mana (for a mage) or Willpower dots (for a Sleeper). This effect is lasting until the mage chooses to dissolve the tass, sending the soul back into a Twilight state, in which disembodied souls normally exist. Note that souls in tass form can still be affected by any magic that affects souls." },
      },
      {
        name: "Supernal Theft", gnosis: 7,
        arcana: [arc("death", 4)], skills: [],
        mirrors: 'Death 4 "Enervation"',
        effect: "Take an Awakened soul as Hideous Stipend takes a Sleeper's, against Resolve + Gnosis; drain an enemy's strength with an instant Presence + Occult + Death.",
        text: "The mage can now take an Awakened soul, as he did a Sleeper soul with the first attainment. The victim contests with Resolve + Gnosis. In addition, the mage can drain his enemies of their strength, similar to the Death 4 “Enervation” spell (p. 143), with an instant action and a Presence + Occult + Death roll. See the spell description for complete rules.",
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
