import { Effect, Option } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  calculateAttackPool,
  findWeapon,
  findArmor,
  healingTime,
  MELEE_WEAPONS,
  RANGED_WEAPONS,
  ARMOR,
} from "../combat"

describe("Combat", () => {
  it.effect("unarmed attack pool = Strength + Brawl - Defense", () =>
    Effect.gen(function* () {
      const pool = yield* calculateAttackPool({
        type: "unarmed",
        strength: 3,
        brawl: 2,
        targetDefense: 3,
        targetArmor: 0,
      })

      // 3 + 2 - 3 = 2
      expect(pool.totalDice).toBe(2)
      expect(pool.damageType).toBe("bashing")
    }),
  )

  it.effect("armed melee attack = Strength + Weaponry + weapon - Defense - Armor", () =>
    Effect.gen(function* () {
      const pool = yield* calculateAttackPool({
        type: "melee",
        strength: 3,
        weaponry: 2,
        weaponName: "Sword",
        targetDefense: 2,
        targetArmor: 1,
      })

      // Sword: +3 damage. 3 + 2 + 3 - 2 - 1 = 5
      expect(pool.totalDice).toBe(5)
      expect(pool.damageType).toBe("lethal")
    }),
  )

  it.effect("ranged attack = Dex + Firearms - Armor (no Defense)", () =>
    Effect.gen(function* () {
      const pool = yield* calculateAttackPool({
        type: "ranged",
        dexterity: 3,
        firearms: 3,
        weaponName: "Pistol, Lt.",
        targetDefense: 4, // should be ignored
        targetArmor: 1,
      })

      // Pistol Lt: +2 damage. 3 + 3 + 2 - 1 = 7 (Defense NOT subtracted)
      expect(pool.totalDice).toBe(7)
      expect(pool.damageType).toBe("lethal")
    }),
  )

  it.effect("thrown weapon = Dex + Athletics + weapon - Defense - Armor", () =>
    Effect.gen(function* () {
      const pool = yield* calculateAttackPool({
        type: "thrown",
        dexterity: 3,
        athletics: 2,
        weaponName: "Knife",
        targetDefense: 2,
        targetArmor: 0,
      })

      // Knife: +1 damage. 3 + 2 + 1 - 2 = 4
      expect(pool.totalDice).toBe(4)
      expect(pool.damageType).toBe("lethal")
    }),
  )

  it.effect("an unknown weapon name is a typed CombatError", () =>
    Effect.gen(function* () {
      const error = yield* calculateAttackPool({
        type: "melee",
        strength: 3,
        weaponry: 2,
        weaponName: "Chainsaw",
        targetDefense: 0,
        targetArmor: 0,
      }).pipe(Effect.flip)

      expect(error._tag).toBe("CombatError")
    }),
  )

  it("weapon reference data exists for melee and ranged", () => {
    const sword = Option.getOrThrow(findWeapon("Sword"))
    expect(sword.damage).toBe(3)
    expect(sword.damageType).toBe("lethal")

    const pistol = Option.getOrThrow(findWeapon("Pistol, Lt."))
    expect(pistol.damage).toBe(2)

    expect(MELEE_WEAPONS.length).toBeGreaterThan(5)
    expect(RANGED_WEAPONS.length).toBeGreaterThan(5)
  })

  it("armor reference data exists", () => {
    const kevlar = Option.getOrThrow(findArmor("Kevlar vest"))
    expect(kevlar.rating).toBeGreaterThan(0)

    expect(ARMOR.length).toBeGreaterThan(2)
  })

  it("unknown weapon and armor names are misses, not defaults", () => {
    expect(Option.isNone(findWeapon("Chainsaw"))).toBe(true)
    expect(Option.isNone(findArmor("Cardboard box"))).toBe(true)
  })

  it("healing rates: bashing 15min, lethal 2 days, aggravated 1 week", () => {
    expect(healingTime("bashing").minutes).toBe(15)
    expect(healingTime("lethal").minutes).toBe(2 * 24 * 60) // 2 days
    expect(healingTime("aggravated").minutes).toBe(7 * 24 * 60) // 1 week
  })

  it.effect("all-out attack adds +2 dice but removes defense", () =>
    Effect.gen(function* () {
      const pool = yield* calculateAttackPool({
        type: "unarmed",
        strength: 3,
        brawl: 2,
        targetDefense: 3,
        targetArmor: 0,
        allOutAttack: true,
      })

      // 3 + 2 + 2(all-out) - 3 = 4, but attacker loses Defense
      expect(pool.totalDice).toBe(4)
      expect(pool.attackerLosesDefense).toBe(true)
    }),
  )
})
