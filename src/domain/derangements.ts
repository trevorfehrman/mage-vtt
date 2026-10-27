import { Array as Arr, Option, Schema } from "effect"
import { ArcanumName } from "./trait-keys"

// The Derangement catalog (MAG-60): the nine mild/severe pairs of the World
// of Darkness Rulebook pp. 96–100 and their Bedlam forms from Mage: The
// Awakening pp. 269–271, taken from the page. Pure rules leaves (ADR-0014):
// the catalog is a Record total over the closed name vocabulary, the pairing
// is a plain function the compiler keeps total, and the one open-input
// lookup (`findDerangement`) returns Option.
//
// Two ways a mage gets one (MAG-60): permanently, when a Wisdom degeneration
// roll fails and the follow-up roll fails too (Mage p. 79), tied to the lost
// dot until it is bought back; or temporarily, from a Bedlam Paradox (Mage
// p. 268), for the Paradox's duration. The Bedlam form adds a weakness to a
// kind of magic, recorded here as `bedlam`.

// --- Vocabulary ---

/** The nine pairs, mild beside severe, in the book's order (WoD p. 97). */
export const DERANGEMENT_PAIRS = [
  ["Depression", "Melancholia"],
  ["Phobia", "Hysteria"],
  ["Narcissism", "Megalomania"],
  ["Fixation", "Obsessive Compulsion"],
  ["Suspicion", "Paranoia"],
  ["Inferiority Complex", "Anxiety"],
  ["Vocalization", "Schizophrenia"],
  ["Irrationality", "Multiple Personality"],
  ["Avoidance", "Fugue"],
] as const

export const MILD_DERANGEMENTS = DERANGEMENT_PAIRS.map(([mild]) => mild)
export const SEVERE_DERANGEMENTS = DERANGEMENT_PAIRS.map(([, severe]) => severe)

export const DerangementName = Schema.Literals([
  ...DERANGEMENT_PAIRS.map(([mild]) => mild),
  ...DERANGEMENT_PAIRS.map(([, severe]) => severe),
])
export type DerangementName = typeof DerangementName.Type

export const DerangementSeverity = Schema.Literals(["mild", "severe"])
export type DerangementSeverity = typeof DerangementSeverity.Type

/**
 * The Bedlam form's weakness (Mage p. 269: "a Bedlam derangement makes the
 * mage especially susceptible to certain types of magic"): the penalty in
 * dice when contesting or countering it, and the same number of dots off the
 * Resistance Attribute, against an Arcanum, the powers of what the mage
 * fears, or — for the pairs the book treats otherwise — a different debt.
 */
export const BedlamWeakness = Schema.Union([
  Schema.TaggedStruct("arcanum", { arcanum: ArcanumName, penalty: Schema.Number }),
  /** Phobia / Hysteria: powers from the object of the fear. */
  Schema.TaggedStruct("fearedSource", { penalty: Schema.Number }),
  /** Narcissism / Megalomania: Wisdom rolls to resist gaining a derangement. */
  Schema.TaggedStruct("wisdomRolls", { penalty: Schema.Number }),
  /** Fixation / Obsessive Compulsion: spellcasting not about the fixation. */
  Schema.TaggedStruct("spellcastingElsewhere", { penalty: Schema.Number }),
  /** Irrationality / Multiple Personality: covert spells read as Improbable to Sleepers. */
  Schema.TaggedStruct("covertImprobable", {}),
  /** Avoidance: the avoided thing cannot be targeted with magic. */
  Schema.TaggedStruct("cannotTargetAvoided", {}),
  /** Fugue: nothing beyond the fugue itself; the mage may even cast while in it. */
  Schema.TaggedStruct("none", {}),
])
export type BedlamWeakness = typeof BedlamWeakness.Type

const DerangementBody = Schema.Struct({
  severity: DerangementSeverity,
  /**
   * The three starred severe ones (WoD p. 97): "life-altering trauma or
   * supernatural tragedy" to acquire, never a plain failed Morality roll —
   * though Bedlam inflicts them freely (Mage p. 269).
   */
  extreme: Schema.Boolean,
  /** What provokes a bout, and the reflexive roll that resists it. */
  trigger: Schema.String,
  resist: Schema.String,
  /** The bout, in the book's one mechanical sentence. */
  effect: Schema.String,
  /** The Bedlam form's added weakness (Mage pp. 269–271). */
  bedlam: BedlamWeakness,
  page: Schema.Struct({ wod: Schema.Number, mage: Schema.Number }),
})
type DerangementBody = typeof DerangementBody.Type

export const DerangementDef = Schema.Struct({
  name: DerangementName,
  /** The other half of the pair: the severe form of a mild one, the mild of a severe. */
  partner: DerangementName,
  ...DerangementBody.fields,
})
export type DerangementDef = typeof DerangementDef.Type

const RESOLVE_COMPOSURE = "Resolve + Composure"

// --- The catalog, total over DerangementName ---

const CATALOG: Record<DerangementName, DerangementBody> = {
  Depression: {
    severity: "mild", extreme: false,
    trigger: "Failing a personal goal, or any dramatic failure", resist: RESOLVE_COMPOSURE,
    effect: "Lose one Willpower point and spend none for the rest of the scene.",
    bedlam: { _tag: "arcanum", arcanum: "death", penalty: 1 },
    page: { wod: 97, mage: 269 },
  },
  Melancholia: {
    severity: "severe", extreme: false,
    trigger: "Failing a personal goal, or any dramatic failure", resist: RESOLVE_COMPOSURE,
    effect: "As Depression, and all dice pools suffer −2 for the rest of the scene.",
    bedlam: { _tag: "arcanum", arcanum: "death", penalty: 2 },
    page: { wod: 97, mage: 269 },
  },
  Phobia: {
    severity: "mild", extreme: false,
    trigger: "Meeting the feared kind of person, place or thing", resist: RESOLVE_COMPOSURE,
    effect: "Keep at least Speed yards from it and back away when it nears; attacks on it suffer −5; cornered, freeze.",
    bedlam: { _tag: "fearedSource", penalty: 1 },
    page: { wod: 97, mage: 269 },
  },
  Hysteria: {
    severity: "severe", extreme: false,
    trigger: "Meeting the feared kind of person, place or thing", resist: RESOLVE_COMPOSURE,
    effect: "Flee it at full Speed and stay out of sensory range; never attack it; touched or trapped, faint for the scene.",
    bedlam: { _tag: "fearedSource", penalty: 2 },
    page: { wod: 97, mage: 269 },
  },
  Narcissism: {
    severity: "mild", extreme: false,
    trigger: "Achieving a goal", resist: RESOLVE_COMPOSURE,
    effect: "For the scene, −3 to teamwork efforts and −1 to Social rolls; help offered only half-heartedly.",
    bedlam: { _tag: "wisdomRolls", penalty: 1 },
    page: { wod: 97, mage: 269 },
  },
  Megalomania: {
    severity: "severe", extreme: false,
    trigger: "Achieving a goal, or losing any contest", resist: RESOLVE_COMPOSURE,
    effect: "As Narcissism one worse (−4 teamwork, −2 Social); must rematch any lost contest, and losing to a social inferior costs a Willpower point.",
    bedlam: { _tag: "wisdomRolls", penalty: 2 },
    page: { wod: 97, mage: 269 },
  },
  Fixation: {
    severity: "mild", extreme: false,
    trigger: "An important success or failure", resist: RESOLVE_COMPOSURE,
    effect: "Fixated for a die roll's worth of scenes: about −1 to tasks unrelated to the fixation, at the Storyteller's call.",
    bedlam: { _tag: "spellcastingElsewhere", penalty: 1 },
    page: { wod: 97, mage: 269 },
  },
  "Obsessive Compulsion": {
    severity: "severe", extreme: false,
    trigger: "Always, unless a scene is bought off", resist: `${RESOLVE_COMPOSURE} at −2`,
    effect: "A set ritual followed to the exclusion of all else; prevented from it, the character may attack friend and foe alike.",
    bedlam: { _tag: "spellcastingElsewhere", penalty: 2 },
    page: { wod: 98, mage: 270 },
  },
  Suspicion: {
    severity: "mild", extreme: false,
    trigger: "Another person deliberately making the character fail", resist: RESOLVE_COMPOSURE,
    effect: "For the scene, trust in everyone is gone and Social rolls suffer −1.",
    bedlam: { _tag: "arcanum", arcanum: "mind", penalty: 1 },
    page: { wod: 98, mage: 270 },
  },
  Paranoia: {
    severity: "severe", extreme: false,
    trigger: "Any hint of suspicious behavior", resist: `${RESOLVE_COMPOSURE} at −2`,
    effect: "Social rolls always suffer −2; a failed roll means the character flees or attacks the offender.",
    bedlam: { _tag: "arcanum", arcanum: "mind", penalty: 2 },
    page: { wod: 98, mage: 270 },
  },
  "Inferiority Complex": {
    severity: "mild", extreme: false,
    trigger: "A single roll or choice that decides success or failure", resist: RESOLVE_COMPOSURE,
    effect: "Flustered for the scene: all rolls at −1, and no Willpower on the roll that caused it.",
    bedlam: { _tag: "arcanum", arcanum: "fate", penalty: 1 },
    page: { wod: 98, mage: 270 },
  },
  Anxiety: {
    severity: "severe", extreme: false,
    trigger: "A single roll or choice that decides success or failure", resist: RESOLVE_COMPOSURE,
    effect: "As Inferiority Complex, but −2 to all rolls for the scene and no Willpower spent on any of them.",
    bedlam: { _tag: "arcanum", arcanum: "fate", penalty: 2 },
    page: { wod: 98, mage: 270 },
  },
  Vocalization: {
    severity: "mild", extreme: false,
    trigger: "An important decision, or extreme stress", resist: RESOLVE_COMPOSURE,
    effect: "The inner monologue is spoken aloud for the scene, stopping only a turn per Wits dot when pointed out.",
    bedlam: { _tag: "arcanum", arcanum: "spirit", penalty: 1 },
    page: { wod: 98, mage: 270 },
  },
  Schizophrenia: {
    severity: "severe", extreme: true,
    trigger: "Confrontation with the trauma: accusations, disturbing truths, heated arguments", resist: RESOLVE_COMPOSURE,
    effect: "Social rolls always suffer −2; a failed roll means fleeing or attacking the source of the trauma.",
    bedlam: { _tag: "arcanum", arcanum: "spirit", penalty: 2 },
    page: { wod: 99, mage: 270 },
  },
  Irrationality: {
    severity: "mild", extreme: false,
    trigger: "A real threat of violence, persecution, challenge or accusation", resist: RESOLVE_COMPOSURE,
    effect: "For the scene, acts crazy and takes dangerous risks, yet cannot throw the first blow; Wits + Composure to take any action that leaves or defuses the scene.",
    bedlam: { _tag: "covertImprobable" },
    page: { wod: 99, mage: 271 },
  },
  "Multiple Personality": {
    severity: "severe", extreme: true,
    trigger: "The emotional stimulus each persona answers to", resist: RESOLVE_COMPOSURE,
    effect: "Another persona takes over, with its own Skills and Social Attributes rearranged by one to three dots.",
    bedlam: { _tag: "covertImprobable" },
    page: { wod: 99, mage: 271 },
  },
  Avoidance: {
    severity: "mild", extreme: false,
    trigger: "A situation or person tied to a past failure or trauma", resist: RESOLVE_COMPOSURE,
    effect: "Does everything short of harm to avoid it; forced to face it, all rolls suffer −1.",
    bedlam: { _tag: "cannotTargetAvoided" },
    page: { wod: 100, mage: 271 },
  },
  Fugue: {
    severity: "severe", extreme: true,
    trigger: "The particular stress that sets it off", resist: RESOLVE_COMPOSURE,
    effect: "A blackout for the scene: a rigid sequence of behaviors on autopilot, no memory after, and interference may be met with attack.",
    bedlam: { _tag: "none" },
    page: { wod: 100, mage: 271 },
  },
}

const PARTNER: Record<DerangementName, DerangementName> = Object.fromEntries(
  DERANGEMENT_PAIRS.flatMap(([mild, severe]) => [
    [mild, severe],
    [severe, mild],
  ]),
) as Record<DerangementName, DerangementName>

/** The catalog entry for a name — total, since the name is closed. */
export const derangement = (name: DerangementName): DerangementDef => ({
  name,
  partner: PARTNER[name],
  ...CATALOG[name],
})

/** Every derangement, mild forms first in the book's order, then the severe. */
export const DERANGEMENTS: ReadonlyArray<DerangementDef> = DerangementName.literals.map(derangement)

/** Find-by-name over an open string: a miss is a value, not a default. */
export const findDerangement = (name: string): Option.Option<DerangementDef> =>
  Schema.is(DerangementName)(name) ? Option.some(derangement(name)) : Option.none()

/** The other half of the pair. */
export const partnerOf = (name: DerangementName): DerangementName => PARTNER[name]

/**
 * The severe form a mild derangement worsens into (Mage p. 269: when a
 * Bedlam inflicts a derangement the mage already has, the Storyteller may
 * choose "the more severe form of a mild derangement"); a severe one has no
 * further step.
 */
export const severeFormOf = (name: DerangementName): Option.Option<DerangementName> =>
  Arr.findFirst(DERANGEMENT_PAIRS, ([mild]) => mild === name).pipe(
    Option.map(([, severe]) => severe),
  )
