import { Effect, Match, Option, Schema } from "effect"

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

/** Find-by-name across both weapon tables: a miss is a value (ADR-0014). */
export const findWeapon = (name: string): Option.Option<WeaponDef> =>
  Option.fromUndefinedOr(
    MELEE_WEAPONS.find((w) => w.name === name) ??
      RANGED_WEAPONS.find((w) => w.name === name),
  )

export const findArmor = (name: string): Option.Option<ArmorDef> =>
  Option.fromUndefinedOr(ARMOR.find((a) => a.name === name))

// Stays Effect: an unknown weapon name is a typed failure the caller handles.
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
  let weaponDamage = 0
  let weaponDamageType: "bashing" | "lethal" = "bashing"

  if (input.weaponName) {
    const weapon = findWeapon(input.weaponName)
    if (Option.isNone(weapon)) {
      return yield* new CombatError({ message: `Unknown weapon: ${input.weaponName}` })
    }
    weaponDamage = weapon.value.damage
    weaponDamageType = weapon.value.damageType
  }

  const attack = Match.value(input.type).pipe(
    // Strength + Brawl - Defense - Armor, always bashing
    Match.when("unarmed", () => ({
      dice:
        (input.strength ?? 0) +
        (input.brawl ?? 0) -
        input.targetDefense -
        input.targetArmor,
      damageType: "bashing" as const,
    })),
    // Strength + Weaponry + weapon damage - Defense - Armor
    Match.when("melee", () => ({
      dice:
        (input.strength ?? 0) +
        (input.weaponry ?? 0) +
        weaponDamage -
        input.targetDefense -
        input.targetArmor,
      damageType: weaponDamageType,
    })),
    // Dexterity + Firearms + weapon damage - Armor (Defense does NOT apply)
    Match.when("ranged", () => ({
      dice:
        (input.dexterity ?? 0) + (input.firearms ?? 0) + weaponDamage - input.targetArmor,
      damageType: weaponDamageType,
    })),
    // Dexterity + Athletics + weapon damage - Defense - Armor
    Match.when("thrown", () => ({
      dice:
        (input.dexterity ?? 0) +
        (input.athletics ?? 0) +
        weaponDamage -
        input.targetDefense -
        input.targetArmor,
      damageType: weaponDamageType,
    })),
    Match.exhaustive,
  )

  // All-out attack: +2 dice, lose Defense
  const dice = attack.dice + (input.allOutAttack ? 2 : 0)

  return new AttackPool({
    totalDice: Math.max(0, dice),
    damageType: attack.damageType,
    attackerLosesDefense: input.allOutAttack ?? false,
  })
})

// Pure rules leaf (ADR-0014): plain function, exhaustive over the damage kinds.
export const healingTime = (
  damageType: "bashing" | "lethal" | "aggravated",
): HealingRate =>
  Match.value(damageType).pipe(
    Match.when(
      "bashing",
      () =>
        new HealingRate({
          damageType: "bashing",
          minutes: 15,
          description: "15 minutes per point",
        }),
    ),
    Match.when(
      "lethal",
      () =>
        new HealingRate({
          damageType: "lethal",
          minutes: 2 * 24 * 60,
          description: "2 days per point",
        }),
    ),
    Match.when(
      "aggravated",
      () =>
        new HealingRate({
          damageType: "aggravated",
          minutes: 7 * 24 * 60,
          description: "1 week per point",
        }),
    ),
    Match.exhaustive,
  )
