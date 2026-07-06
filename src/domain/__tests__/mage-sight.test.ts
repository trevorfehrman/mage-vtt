import { describe, expect, it } from "@effect/vitest"
import {
  activateMageSight,
  peripheralMageSightPool,
  scrutinyPool,
} from "../mage-sight"

describe("Mage Sight", () => {
  it("active mage sight costs 1 mana and uses highest arcanum", () => {
    const result = activateMageSight({
      arcana: { death: 3, matter: 2 },
    })

    expect(result.manaCost).toBe(1)
    expect(result.primaryArcanum).toBe("death")
    expect(result.primaryDots).toBe(3)
  })

  it("peripheral mage sight pool = Wits + Composure", () => {
    const pool = peripheralMageSightPool({
      wits: 3,
      composure: 2,
    })

    expect(pool.totalDice).toBe(5)
  })

  it("scrutiny pool = Intelligence + Arcanum (extended action)", () => {
    const pool = scrutinyPool({
      intelligence: 3,
      arcanumDots: 4,
    })

    expect(pool.totalDice).toBe(7)
    expect(pool.isExtended).toBe(true)
  })
})
