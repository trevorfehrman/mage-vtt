import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  calculateAttackPool,
  getWeapon,
  getArmor,
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

  it.effect("weapon reference data exists for melee and ranged", () =>
    Effect.gen(function* () {
      const sword = yield* getWeapon("Sword")
      expect(sword.damage).toBe(3)
      expect(sword.damageType).toBe("lethal")

      const pistol = yield* getWeapon("Pistol, Lt.")
      expect(pistol.damage).toBe(2)

      expect(MELEE_WEAPONS.length).toBeGreaterThan(5)
      expect(RANGED_WEAPONS.length).toBeGreaterThan(5)
    }),
  )

  it.effect("armor reference data exists", () =>
    Effect.gen(function* () {
      const kevlar = yield* getArmor("Kevlar vest")
      expect(kevlar.rating).toBeGreaterThan(0)

      expect(ARMOR.length).toBeGreaterThan(2)
    }),
  )

  it.effect("healing rates: bashing 15min, lethal 2 days, aggravated 1 week", () =>
    Effect.gen(function* () {
      const bashing = yield* healingTime("bashing")
      expect(bashing.minutes).toBe(15)

      const lethal = yield* healingTime("lethal")
      expect(lethal.minutes).toBe(2 * 24 * 60) // 2 days

      const aggravated = yield* healingTime("aggravated")
      expect(aggravated.minutes).toBe(7 * 24 * 60) // 1 week
    }),
  )

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
