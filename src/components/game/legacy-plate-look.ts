import { Option } from "effect"
import { attainmentGates, skillDisplayName, type Legacy, type PathName } from "#/domain/character"
import { findLegacy, type Attainment, type SkillRequirement } from "#/domain/legacies"
import type { ArcanumName } from "#/domain/trait-keys"

// The Legacy plate's look (MAG-64), pure: what the growth on the nameplate
// draws, read off the sheet's Legacy and the mage's Gnosis. The sheet's
// Legacy is a free name with its attainment names; when the catalog knows
// the name, the plate also wears the Legacy's primary Arcanum and parent
// Path as emblems, and each attainment carries its reading. A shopped or
// founded Legacy draws its names without them.

/** What an attainment does, in the book's words, for the fold beneath its name. */
export type AttainmentReading = {
  /** The attainment as the page prints it. */
  readonly text: string
  /** "Gnosis 3, Life 2 (primary), Mind 1, Animal Ken 2 or Survival 2" — as the page prints it. */
  readonly prerequisites: string
  /** The Optional Arcanum rider, when the attainment has one: its Arcanum and dots, and the page's words. */
  readonly rider: Option.Option<{ readonly arcanum: string; readonly text: string }>
}

/** One attainment on the plate: its name, the Gnosis that opens it, whether this mage has reached it, and its reading when the catalog knows it. */
export type LegacyRung = {
  readonly name: string
  readonly gnosis: number
  readonly reached: boolean
  readonly reading: Option.Option<AttainmentReading>
}

export type LegacyPlate = {
  readonly name: string
  /** The catalog's primary Arcanum, when the catalog knows this Legacy. */
  readonly primary: Option.Option<ArcanumName>
  /** The catalog's parent Path, when the catalog knows it and it is one Path. */
  readonly path: Option.Option<PathName>
  readonly rungs: ReadonlyArray<LegacyRung>
  /** How many of the three the mage holds. */
  readonly held: number
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const skillWords = (req: SkillRequirement): string =>
  req._tag === "skill"
    ? `${skillDisplayName(req.skill)} ${req.dots}`
    : req.options.map((o) => `${skillDisplayName(o.skill)} ${o.dots}`).join(" or ")

export const readingOf = (att: Attainment, primary: ArcanumName): AttainmentReading => ({
  text: att.text,
  prerequisites: [
    `Gnosis ${att.gnosis}`,
    ...att.arcana.map((a) => `${cap(a.arcanum)} ${a.dots}${a.arcanum === primary ? " (primary)" : ""}`),
    ...att.skills.map(skillWords),
  ].join(", "),
  rider: Option.map(Option.fromUndefinedOr(att.synergy), (r) => ({
    arcanum: `${cap(r.arcanum)} ${r.dots}`,
    text: r.text,
  })),
})

export const legacyPlate = (legacy: Legacy, gnosis: number): LegacyPlate => {
  const def = findLegacy(legacy.name)
  const rungs = attainmentGates(legacy).map(({ name, gnosis: gate }, i) => ({
    name,
    gnosis: gate,
    reached: gnosis >= gate,
    reading: Option.map(def, (d) => readingOf(d.attainments[i] ?? d.attainments[0], d.primary)),
  }))
  return {
    name: legacy.name,
    primary: Option.map(def, (d) => d.primary),
    path: Option.flatMap(def, (d) => (d.path === "any" ? Option.none() : Option.some(d.path))),
    rungs,
    held: rungs.filter((r) => r.reached).length,
  }
}
