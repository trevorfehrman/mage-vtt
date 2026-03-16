import { Effect, Schema } from "effect"

// --- Weapon Data (from WoD Core pages 169-171) ---

interface WeaponDef {
  name: string
  damage: number
  damageType: "bashing" | "lethal"
  size: number
  special?: string
}

export const MELEE_WEAPONS: ReadonlyArray<WeaponDef> = [
  { name: "Sap", damage: 1, damageType: "bashing", size: 1, special: "Knockout" },
  { name: "Brass Knuckles", damage: 1, damageType: "bashing", size: 0, special: "Uses Brawl" },
  { name: "Club", damage: 2, damageType: "bashing", size: 2 },
  { name: "Mace", damage: 3, damageType: "bashing", size: 2 },
  { name: "Knife", damage: 1, damageType: "lethal", size: 1 },
  { name: "Rapier", damage: 2, damageType: "lethal", size: 2, special: "Armor piercing 1" },
  { name: "Sword", damage: 3, damageType: "lethal", size: 2 },
  { name: "Katana", damage: 3, damageType: "lethal", size: 2, special: "Durability +1" },
  { name: "Greatsword", damage: 4, damageType: "lethal", size: 3 },
  { name: "Small Ax", damage: 2, damageType: "lethal", size: 1 },
  { name: "Large Ax", damage: 3, damageType: "lethal", size: 3, special: "9 again" },
  { name: "Great Ax", damage: 5, damageType: "lethal", size: 4, special: "9 again" },
  { name: "Stake", damage: 1, damageType: "lethal", size: 1 },
  { name: "Spear", damage: 3, damageType: "lethal", size: 4, special: "+1 Defense" },
]

export const RANGED_WEAPONS: ReadonlyArray<WeaponDef & {
  ranges: { short: number; medium: number; long: number }
  clip: number
}> = [
  { name: "Revolver, Lt.", damage: 2, damageType: "lethal", size: 1, ranges: { short: 20, medium: 40, long: 80 }, clip: 6 },
  { name: "Revolver, Hvy.", damage: 3, damageType: "lethal", size: 1, ranges: { short: 35, medium: 70, long: 140 }, clip: 6 },
  { name: "Pistol, Lt.", damage: 2, damageType: "lethal", size: 1, ranges: { short: 20, medium: 40, long: 80 }, clip: 18 },
  { name: "Pistol, Hvy.", damage: 3, damageType: "lethal", size: 1, ranges: { short: 30, medium: 60, long: 120 }, clip: 8 },
  { name: "Rifle", damage: 5, damageType: "lethal", size: 3, ranges: { short: 200, medium: 400, long: 800 }, clip: 6 },
  { name: "SMG, Small", damage: 2, damageType: "lethal", size: 1, ranges: { short: 25, medium: 50, long: 100 }, clip: 31 },
  { name: "SMG, Large", damage: 3, damageType: "lethal", size: 2, ranges: { short: 50, medium: 100, long: 200 }, clip: 31 },
  { name: "Assault Rifle", damage: 4, damageType: "lethal", size: 3, ranges: { short: 150, medium: 300, long: 600 }, clip: 43 },
  { name: "Shotgun", damage: 4, damageType: "lethal", size: 2, ranges: { short: 20, medium: 40, long: 80 }, clip: 6 },
  { name: "Crossbow", damage: 2, damageType: "lethal", size: 3, ranges: { short: 40, medium: 80, long: 160 }, clip: 1 },
]

// --- Armor Data (from WoD Core page 171) ---

interface ArmorDef {
  name: string
  rating: number
  defense: number
  speed: number
}

export const ARMOR: ReadonlyArray<ArmorDef> = [
  { name: "Reinforced clothing", rating: 1, defense: 0, speed: 0 },
  { name: "Kevlar vest", rating: 2, defense: 0, speed: 0 },
  { name: "Flak jacket", rating: 3, defense: -1, speed: 0 },
  { name: "Full riot gear", rating: 4, defense: -2, speed: -1 },
]

// --- Types ---

export class AttackPool extends Schema.Class<AttackPool>("AttackPool")({
  totalDice: Schema.Number.check(Schema.isInt()),
  damageType: Schema.Literals(["bashing", "lethal"]),
  attackerLosesDefense: Schema.Boolean,
}) {}

export class HealingRate extends Schema.Class<HealingRate>("HealingRate")({
  damageType: Schema.Literals(["bashing", "lethal", "aggravated"]),
  minutes: Schema.Number.check(Schema.isInt()),
  description: Schema.String,
}) {}

// --- Errors ---

export class CombatError extends Schema.TaggedErrorClass<CombatError>()(
  "CombatError",
  { message: Schema.String },
) {}

// --- Public API ---

export const getWeapon = Effect.fn("Combat.getWeapon")(function* (name: string) {
  const melee = MELEE_WEAPONS.find((w) => w.name === name)
  if (melee) return melee

  const ranged = RANGED_WEAPONS.find((w) => w.name === name)
  if (ranged) return ranged

  yield* new CombatError({ message: `Unknown weapon: ${name}` })
  throw new Error("unreachable")
})

export const getArmor = Effect.fn("Combat.getArmor")(function* (name: string) {
  const armor = ARMOR.find((a) => a.name === name)
  if (!armor) {
    yield* new CombatError({ message: `Unknown armor: ${name}` })
    throw new Error("unreachable")
  }
  return armor
})

export const calculateAttackPool = Effect.fn("Combat.attackPool")(function* (input: {
  type: "unarmed" | "melee" | "ranged" | "thrown"
  strength?: number
  dexterity?: number
  brawl?: number
  weaponry?: number
  firearms?: number
  athletics?: number
  weaponName?: string
  targetDefense: number
  targetArmor: number
  allOutAttack?: boolean
}) {
  let dice = 0
  let damageType: "bashing" | "lethal" = "bashing"
  let weaponDamage = 0

  // Get weapon stats if applicable
  if (input.weaponName) {
    const weapon = yield* getWeapon(input.weaponName)
    weaponDamage = weapon.damage
    damageType = weapon.damageType
  }

  switch (input.type) {
    case "unarmed":
      // Strength + Brawl - Defense - Armor
      dice = (input.strength ?? 0) + (input.brawl ?? 0)
      dice -= input.targetDefense
      dice -= input.targetArmor
      damageType = "bashing"
      break

    case "melee":
      // Strength + Weaponry + weapon damage - Defense - Armor
      dice = (input.strength ?? 0) + (input.weaponry ?? 0) + weaponDamage
      dice -= input.targetDefense
      dice -= input.targetArmor
      damageType = damageType || "lethal"
      break

    case "ranged":
      // Dexterity + Firearms + weapon damage - Armor (NO Defense)
      dice = (input.dexterity ?? 0) + (input.firearms ?? 0) + weaponDamage
      dice -= input.targetArmor
      // Defense does NOT apply to ranged attacks
      break

    case "thrown":
      // Dexterity + Athletics + weapon damage - Defense - Armor
      dice = (input.dexterity ?? 0) + (input.athletics ?? 0) + weaponDamage
      dice -= input.targetDefense
      dice -= input.targetArmor
      break
  }

  // All-out attack: +2 dice, lose Defense
  if (input.allOutAttack) {
    dice += 2
  }

  return new AttackPool({
    totalDice: Math.max(0, dice),
    damageType,
    attackerLosesDefense: input.allOutAttack ?? false,
  })
})

export const healingTime = Effect.fn("Combat.healingTime")(function* (
  damageType: "bashing" | "lethal" | "aggravated",
) {
  switch (damageType) {
    case "bashing":
      return new HealingRate({ damageType, minutes: 15, description: "15 minutes per point" })
    case "lethal":
      return new HealingRate({ damageType, minutes: 2 * 24 * 60, description: "2 days per point" })
    case "aggravated":
      return new HealingRate({ damageType, minutes: 7 * 24 * 60, description: "1 week per point" })
  }
})
