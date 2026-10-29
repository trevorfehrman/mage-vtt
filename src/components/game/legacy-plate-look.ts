import { Option } from "effect"
import { attainmentGates, type Legacy } from "#/domain/character"
import { findLegacy } from "#/domain/legacies"
import type { ArcanumName } from "#/domain/trait-keys"

// The Legacy plate's look (MAG-64), pure: what the growth on the nameplate
// draws, read off the sheet's Legacy and the mage's Gnosis. The sheet's
// Legacy is a free name with its attainment names; when the catalog knows
// the name, the plate also wears the Legacy's primary Arcanum as its emblem
// and its nickname. A shopped or founded Legacy draws without them.

/** One attainment on the plate: its name, the Gnosis that opens it, and whether this mage has reached it. */
export type LegacyRung = {
  readonly name: string
  readonly gnosis: number
  readonly reached: boolean
}

export type LegacyPlate = {
  readonly name: string
  /** The catalog's primary Arcanum, when the catalog knows this Legacy. */
  readonly primary: Option.Option<ArcanumName>
  /** What other mages call its members, when the catalog knows. */
  readonly nickname: Option.Option<string>
  readonly rungs: ReadonlyArray<LegacyRung>
  /** How many of the three the mage holds. */
  readonly held: number
}

export const legacyPlate = (legacy: Legacy, gnosis: number): LegacyPlate => {
  const def = findLegacy(legacy.name)
  const rungs = attainmentGates(legacy).map(({ name, gnosis: gate }) => ({
    name,
    gnosis: gate,
    reached: gnosis >= gate,
  }))
  return {
    name: legacy.name,
    primary: Option.map(def, (d) => d.primary),
    nickname: Option.map(def, (d) => d.nickname),
    rungs,
    held: rungs.filter((r) => r.reached).length,
  }
}
