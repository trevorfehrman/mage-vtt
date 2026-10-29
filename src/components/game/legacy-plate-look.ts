import { Array as Arr, Option, Schema } from "effect"
import { attainmentGates, PathName, type Legacy } from "#/domain/character"
import { arcanumWords, findLegacy, skillWords, type Attainment } from "#/domain/legacies"
import { ArcanumName } from "#/domain/trait-keys"

// The Legacy plate's look (MAG-64), pure: what the growth on the nameplate
// draws, read off the sheet's Legacy and the mage's Gnosis. The sheet's
// Legacy is a free name with its attainment names; when the catalog knows
// the name, the plate also wears the Legacy's primary Arcanum and parent
// Path as emblems, and each attainment carries its reading. A shopped or
// founded Legacy draws its names without them.

/** The Optional Arcanum rider: its Arcanum and dots ("Matter 3"), and the page's words. */
export const Rider = Schema.Struct({ arcanum: Schema.String, text: Schema.String })
export type Rider = typeof Rider.Type

/** What an attainment does, in the book's words, for the fold beneath its name. */
export const AttainmentReading = Schema.Struct({
  /** The attainment as the page prints it. */
  text: Schema.String,
  /** "Gnosis 3, Life 2 (primary), Mind 1, Animal Ken 2 or Survival 2" — as the page prints it. */
  prerequisites: Schema.String,
  rider: Schema.Option(Rider),
})
export type AttainmentReading = typeof AttainmentReading.Type

/** One attainment on the plate: its name, the Gnosis that opens it, whether this mage has reached it, and its reading when the catalog knows it. */
export const LegacyRung = Schema.Struct({
  name: Schema.String,
  gnosis: Schema.Number,
  reached: Schema.Boolean,
  reading: Schema.Option(AttainmentReading),
})
export type LegacyRung = typeof LegacyRung.Type

export const LegacyPlate = Schema.Struct({
  name: Schema.String,
  /** The catalog's primary Arcanum, when the catalog knows this Legacy. */
  primary: Schema.Option(ArcanumName),
  /** The catalog's parent Path, when the catalog knows it and it is one Path. */
  path: Schema.Option(PathName),
  rungs: Schema.Array(LegacyRung),
  /** How many of the three the mage holds. */
  held: Schema.Number,
})
export type LegacyPlate = typeof LegacyPlate.Type

/**
 * The reading of one attainment. The prerequisites line is the page's: its
 * Arcana in the page's order, and "(primary)" only where the page prints
 * it — on the first attainment, where the Legacy's primary Arcanum is named.
 */
export const readingOf = (att: Attainment, primary: ArcanumName, first: boolean): AttainmentReading => ({
  text: att.text,
  prerequisites: [
    `Gnosis ${att.gnosis}`,
    ...att.arcana.map((a) => `${arcanumWords(a)}${first && a.arcanum === primary ? " (primary)" : ""}`),
    ...att.skills.map(skillWords),
  ].join(", "),
  rider: Option.map(Option.fromUndefinedOr(att.synergy), (r) => ({ arcanum: arcanumWords(r), text: r.text })),
})

export const legacyPlate = (legacy: Legacy, gnosis: number): LegacyPlate => {
  const def = findLegacy(legacy.name)
  const rungs = attainmentGates(legacy).map(({ name, gnosis: gate }, i) => ({
    name,
    gnosis: gate,
    reached: gnosis >= gate,
    reading: Option.flatMap(def, (d) =>
      Option.map(Arr.get(d.attainments, i), (att) => readingOf(att, d.primary, i === 0)),
    ),
  }))
  return {
    name: legacy.name,
    primary: Option.map(def, (d) => d.primary),
    path: Option.flatMap(def, (d) => (d.path === "any" ? Option.none() : Option.some(d.path))),
    rungs,
    held: rungs.filter((r) => r.reached).length,
  }
}
