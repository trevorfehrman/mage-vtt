/**
 * Generate fine-grained rule chunks from our tested domain logic.
 *
 * These are tiny, precise chunks (100-300 chars) that directly
 * answer mechanical questions. They'll rank higher than paragraph-sized
 * chunks for specific rule queries.
 *
 * Usage: bun scripts/generate-rule-chunks.ts
 */

const OUTPUT_DIR = new URL("../data/", import.meta.url).pathname

interface RuleChunk {
  id: string
  text: string
  chapter: string
  section: string
  contentType: "rule-precise"
  pageStart: number
  pageEnd: number
  charCount: number
  source: "domain-logic"
  domain: string
}

const rules: Array<Omit<RuleChunk, "id" | "charCount">> = [
  // --- Dice System ---
  { text: "Dice Pool: Roll d10s equal to pool size. Each die showing 8, 9, or 10 is a success. 5+ successes = exceptional success.", chapter: "WoD Core", section: "Dice", contentType: "rule-precise", pageStart: 0, pageEnd: 0, source: "domain-logic", domain: "dice" },
  { text: "Exploding 10s (10-again): Each 10 rolled generates an additional die roll, which can also explode. 9-again: 9s and 10s explode. 8-again: 8s, 9s, and 10s explode.", chapter: "WoD Core", section: "Dice", contentType: "rule-precise", pageStart: 0, pageEnd: 0, source: "domain-logic", domain: "dice" },
  { text: "Chance Die: When dice pool is reduced to 0 or below, roll a single d10. Only a 10 counts as a success. A 1 is a dramatic failure. 10s do NOT explode on chance dice.", chapter: "WoD Core", section: "Dice", contentType: "rule-precise", pageStart: 0, pageEnd: 0, source: "domain-logic", domain: "dice" },
  { text: "Rote Action: All failed dice in the initial roll can be re-rolled once. This represents well-practiced actions.", chapter: "WoD Core", section: "Dice", contentType: "rule-precise", pageStart: 0, pageEnd: 0, source: "domain-logic", domain: "dice" },

  // --- Character Creation ---
  { text: "Attribute Allocation: Prioritize Mental/Physical/Social as primary (5 dots), secondary (4 dots), tertiary (3 dots). Each attribute starts at 1. The 5th dot costs 2 dots to purchase.", chapter: "Mage Ch2", section: "Character Creation", contentType: "rule-precise", pageStart: 64, pageEnd: 69, source: "domain-logic", domain: "character" },
  { text: "Skill Allocation: Prioritize Mental/Physical/Social as primary (11 dots), secondary (7 dots), tertiary (4 dots). Skills start at 0. The 5th dot costs 2 dots.", chapter: "Mage Ch2", section: "Character Creation", contentType: "rule-precise", pageStart: 64, pageEnd: 69, source: "domain-logic", domain: "character" },
  { text: "Starting Arcana: 6 dots total, at least 2 Arcana, 2 of the first 3 must be from Path's Ruling Arcana.", chapter: "Mage Ch2", section: "Character Creation", contentType: "rule-precise", pageStart: 64, pageEnd: 69, source: "domain-logic", domain: "character" },
  { text: "Starting Mana equals Wisdom (default 7). Starting Gnosis is 1. Starting Wisdom is 7 (can trade dots for 5 XP each, minimum Wisdom 5).", chapter: "Mage Ch2", section: "Character Creation", contentType: "rule-precise", pageStart: 69, pageEnd: 69, source: "domain-logic", domain: "character" },

  // --- Derived Stats ---
  { text: "Health = Stamina + Size (default Size 5). Willpower = Resolve + Composure. Defense = lower of Dexterity or Wits + Athletics. Initiative = Dexterity + Composure. Speed = Strength + Dexterity + 5.", chapter: "Mage Ch2", section: "Derived Stats", contentType: "rule-precise", pageStart: 76, pageEnd: 76, source: "domain-logic", domain: "character" },
  { text: "Path Resistance Bonus: Acanthus +1 Composure, Mastigos +1 Resolve, Moros +1 Composure, Obrimos +1 Resolve, Thyrsus +1 Composure. This bonus applies to Willpower and Initiative.", chapter: "Mage Ch2", section: "Derived Stats", contentType: "rule-precise", pageStart: 68, pageEnd: 68, source: "domain-logic", domain: "character" },

  // --- Spellcasting ---
  { text: "Improvised Spell Dice Pool = Gnosis + Arcanum. Costs 1 Mana if the primary Arcanum is NOT a Ruling Arcanum for the caster's Path.", chapter: "Mage Ch3", section: "Spellcasting", contentType: "rule-precise", pageStart: 117, pageEnd: 117, source: "domain-logic", domain: "spellcasting" },
  { text: "Rote Spell Dice Pool = Attribute + Skill + Arcanum, as listed in the rote description. Rote Specialties from the caster's Order grant +1 bonus.", chapter: "Mage Ch3", section: "Spellcasting", contentType: "rule-precise", pageStart: 117, pageEnd: 117, source: "domain-logic", domain: "spellcasting" },
  { text: "High Speech: +2 dice bonus to spellcasting. Requires spending an instant action chanting before casting (bonus applies next turn). Loses Defense during chanting.", chapter: "Mage Ch3", section: "Spellcasting", contentType: "rule-precise", pageStart: 117, pageEnd: 117, source: "domain-logic", domain: "spellcasting" },
  { text: "Spell Tolerance = Stamina. Each spell cast on a target beyond their Stamina imposes -1 penalty to further spellcasting on that target.", chapter: "Mage Ch3", section: "Spellcasting", contentType: "rule-precise", pageStart: 128, pageEnd: 128, source: "domain-logic", domain: "spellcasting" },
  { text: "Sympathetic Casting: Costs 1 Mana. Always vulgar. Caster loses Defense. Connection penalties: Intimate -2, Known -4, Acquainted -6, Encountered -8, Described -10.", chapter: "Mage Ch3", section: "Spellcasting", contentType: "rule-precise", pageStart: 116, pageEnd: 116, source: "domain-logic", domain: "spellcasting" },

  // --- Spell Factors ---
  { text: "Potency penalty: 1=0, 2=-2, 3=-4, 4=-6, 5=-8, each additional -2. Target count: 1=0, 2=-2, 4=-4, 8=-6, 16=-8. Size over 20: each +10 is -2.", chapter: "Mage Ch3", section: "Spell Factors", contentType: "rule-precise", pageStart: 118, pageEnd: 118, source: "domain-logic", domain: "spellcasting" },
  { text: "Transitory Duration: 1 turn=0, 2 turns=-2, 3 min=-4, 5 turns=-6, 10 turns=-8. Prolonged: 1 scene=0, 24hr=-2, 2 days=-4, 1 week=-6, 1 month=-8, indefinite=-10.", chapter: "Mage Ch3", section: "Spell Factors", contentType: "rule-precise", pageStart: 119, pageEnd: 119, source: "domain-logic", domain: "spellcasting" },

  // --- Paradox ---
  { text: "Paradox Dice Pool by Gnosis: 1-2=1 die, 3-4=2 dice, 5-6=3 dice, 7-8=4 dice, 9-10=5 dice. Modifiers: +1 per successive roll in scene, -1 rote, -1 magical tool, +2 Sleeper witnesses.", chapter: "Mage Ch3", section: "Paradox", contentType: "rule-precise", pageStart: 127, pageEnd: 127, source: "domain-logic", domain: "paradox" },
  { text: "Paradox Severity: 1 success=Havoc, 2=Bedlam, 3=Anomaly, 4=Branding, 5+=Manifestation. Paradox successes subtract from casting roll. Backlash: take Resistant bashing to contain.", chapter: "Mage Ch3", section: "Paradox", contentType: "rule-precise", pageStart: 127, pageEnd: 127, source: "domain-logic", domain: "paradox" },

  // --- Combat ---
  { text: "Unarmed: Strength + Brawl - Defense - Armor (bashing). Melee: Strength + Weaponry + weapon - Defense - Armor. Ranged: Dexterity + Firearms + weapon - Armor (NO Defense). Thrown: Dexterity + Athletics + weapon - Defense.", chapter: "WoD Ch7", section: "Combat", contentType: "rule-precise", pageStart: 155, pageEnd: 155, source: "domain-logic", domain: "combat" },
  { text: "Defense degrades by 1 per attacker after the first. Dodge: double Defense, lose action. All-out Attack: +2 dice, lose Defense. Charging: move double Speed, lose Defense.", chapter: "WoD Ch7", section: "Combat", contentType: "rule-precise", pageStart: 155, pageEnd: 165, source: "domain-logic", domain: "combat" },
  { text: "Range penalties: short=0, medium=-2, long=-4. Specified targets: torso -1, arm/leg -2, head -3, hand -4, eye -5. Concealment: barely -1, partially -2, substantially -3.", chapter: "WoD Ch7", section: "Combat", contentType: "rule-precise", pageStart: 161, pageEnd: 165, source: "domain-logic", domain: "combat" },

  // --- Health & Damage ---
  { text: "Damage types: Bashing (/), Lethal (X), Aggravated (*). Sorted left to right by severity. Full track overflow: bashing upgrades to lethal, lethal to aggravated.", chapter: "WoD Ch7", section: "Health", contentType: "rule-precise", pageStart: 172, pageEnd: 174, source: "domain-logic", domain: "health" },
  { text: "Wound Penalties: 3rd-to-last box filled=-1, 2nd-to-last=-2, last box=-3. Healing: Bashing 15 min, Lethal 2 days, Aggravated 1 week per point.", chapter: "WoD Ch7", section: "Health", contentType: "rule-precise", pageStart: 172, pageEnd: 176, source: "domain-logic", domain: "health" },

  // --- Mana Economy ---
  { text: "Mana per Turn by Gnosis: 1=1, 2=2, 3=3, 4=4, 5=5, 6=6, 7=7, 8=8, 9=10, 10=15. Max Mana: 10/11/12/13/14/15/20/30/50/100.", chapter: "Mage Ch2", section: "Gnosis", contentType: "rule-precise", pageStart: 76, pageEnd: 78, source: "domain-logic", domain: "mana" },
  { text: "Pattern Restoration: Spend 3 Mana to heal 1 bashing or lethal wound (instant action). Daily limit: Gnosis 1-4=1/day, 5-6=2/day, 7-9=3/day, 10=4/day.", chapter: "Mage Ch2", section: "Mana", contentType: "rule-precise", pageStart: 77, pageEnd: 77, source: "domain-logic", domain: "mana" },
  { text: "Pattern Scouring: Sacrifice 1 Physical Attribute dot to gain 3 Mana. Dot restores in 24 hours. Oblation: Gnosis + Composure at a Hallow, 1 Mana per success, max = Hallow rating per day.", chapter: "Mage Ch2", section: "Mana", contentType: "rule-precise", pageStart: 77, pageEnd: 78, source: "domain-logic", domain: "mana" },

  // --- Initiative (Homebrew) ---
  { text: "HOMEBREW: Tick Initiative (from Scion: Hero). Roll d10 + Dexterity + Composure. Highest gets 0 ticks, others get (highest - theirs). Act at 0 ticks. Tiebreakers: Wits > Dex > Composure > Willpower.", chapter: "Homebrew", section: "Initiative", contentType: "rule-precise", pageStart: 0, pageEnd: 0, source: "domain-logic", domain: "initiative" },
  { text: "HOMEBREW: Tick Action Costs: Attack 3, Cast Spell 5, Aim 1-3 (+1 die per tick), Move 3, Dodge 1-3 (+1 Defense per tick), Use Item 3.", chapter: "Homebrew", section: "Initiative", contentType: "rule-precise", pageStart: 0, pageEnd: 0, source: "domain-logic", domain: "initiative" },

  // --- XP Costs ---
  { text: "XP Costs: Attribute (new dots x5), Skill (new dots x3), Specialty (3), Ruling Arcanum (new dots x6), Common Arcanum (new dots x7), Inferior Arcanum (new dots x8), Gnosis (new dots x8), Wisdom (new dots x3), Merit (new dots x2), Rote (2), Willpower (8).", chapter: "Mage Ch2", section: "Advancement", contentType: "rule-precise", pageStart: 69, pageEnd: 69, source: "domain-logic", domain: "advancement" },

  // --- Counterspell ---
  { text: "Counterspell: Reflexive action, requires 1+ dot in the attacking spell's Arcanum OR Prime. Pool = Gnosis + Arcanum. Successes compared to spell's Potency. Dispelling existing spells: Gnosis + Arcanum vs Potency.", chapter: "Mage Ch3", section: "Counterspell", contentType: "rule-precise", pageStart: 123, pageEnd: 124, source: "domain-logic", domain: "counterspell" },

  // --- Active Spells ---
  { text: "Active Spell Penalty: Mage can maintain spells = Gnosis without penalty. Each spell beyond Gnosis imposes -2 to further spellcasting. Relinquishing costs 1 Willpower dot, spell becomes permanent.", chapter: "Mage Ch3", section: "Spell Control", contentType: "rule-precise", pageStart: 121, pageEnd: 121, source: "domain-logic", domain: "spell-control" },

  // --- Resistance ---
  { text: "Magic Resistance: Contested = target rolls Resistance Attribute + Gnosis (+3 if spending WP). Automated = subtract Resistance Attribute from casting pool (+2 if target spends WP and is aware).", chapter: "Mage Ch3", section: "Resistance", contentType: "rule-precise", pageStart: 121, pageEnd: 122, source: "domain-logic", domain: "spellcasting" },

  // --- Untrained ---
  { text: "Untrained Skill Penalties: Mental skills with 0 dots: -3 penalty. Physical and Social skills with 0 dots: -1 penalty.", chapter: "WoD Ch6", section: "Skills", contentType: "rule-precise", pageStart: 122, pageEnd: 122, source: "domain-logic", domain: "character" },
]

async function main() {
  const chunks: RuleChunk[] = rules.map((r, i) => ({
    ...r,
    id: `rule-${String(i + 1).padStart(4, "0")}`,
    charCount: r.text.length,
  }))

  console.log(`Generated ${chunks.length} fine-grained rule chunks`)
  console.log(`Average size: ${Math.round(chunks.reduce((s, c) => s + c.charCount, 0) / chunks.length)} chars`)

  await Bun.write(`${OUTPUT_DIR}rule-chunks.json`, JSON.stringify(chunks, null, 2))
  console.log("Wrote data/rule-chunks.json")
}

main()
