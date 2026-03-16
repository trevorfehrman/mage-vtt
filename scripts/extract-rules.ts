/**
 * Stage 2c: Extract Path Data & Character Creation Rules
 *
 * Extracts structured game data that powers character creation,
 * validation, and derived stat calculations.
 *
 * Outputs:
 *   - data/path-data.json — Path/Arcana/Order reference data
 *   - data/character-rules.json — Creation rules, Gnosis table, derived stats
 *
 * Usage: bun scripts/extract-rules.ts
 */

const OUTPUT_DIR = new URL("../data/", import.meta.url).pathname

// ============================================================
// PATH DATA — from page 132 (and confirmed against page 68)
// ============================================================

const pathData = {
  paths: [
    {
      name: "Acanthus",
      realm: "Arcadia",
      tarotCard: "The Fool",
      rulingArcana: ["Time", "Fate"],
      commonArcana: ["Death", "Life", "Matter", "Mind", "Prime", "Space", "Spirit"],
      inferiorArcanum: "Forces",
      resistanceBonus: { attribute: "Composure", bonus: 1 },
      nicknames: ["Enchanters", "Witches"],
    },
    {
      name: "Mastigos",
      realm: "Pandemonium",
      tarotCard: "The Devil",
      rulingArcana: ["Space", "Mind"],
      commonArcana: ["Death", "Fate", "Forces", "Mind", "Space", "Spirit", "Time"],
      inferiorArcanum: "Matter",
      resistanceBonus: { attribute: "Resolve", bonus: 1 },
      nicknames: ["Psychonauts", "Warlocks"],
    },
    {
      name: "Moros",
      realm: "Stygia",
      tarotCard: "Death",
      rulingArcana: ["Matter", "Death"],
      commonArcana: ["Fate", "Life", "Matter", "Mind", "Prime", "Space", "Time"],
      inferiorArcanum: "Spirit",
      resistanceBonus: { attribute: "Composure", bonus: 1 },
      nicknames: ["Alchemists", "Necromancers"],
    },
    {
      name: "Obrimos",
      realm: "The Aether",
      tarotCard: "The Sun",
      rulingArcana: ["Forces", "Prime"],
      commonArcana: ["Fate", "Life", "Matter", "Mind", "Space", "Spirit", "Time"],
      inferiorArcanum: "Death",
      resistanceBonus: { attribute: "Resolve", bonus: 1 },
      nicknames: ["Theurgists", "Thaumaturges"],
    },
    {
      name: "Thyrsus",
      realm: "The Primal Wild",
      tarotCard: "The Moon",
      rulingArcana: ["Life", "Spirit"],
      commonArcana: ["Death", "Fate", "Forces", "Matter", "Prime", "Space", "Time"],
      inferiorArcanum: "Mind",
      resistanceBonus: { attribute: "Composure", bonus: 1 },
      nicknames: ["Shamans", "Ecstatics"],
    },
  ],

  orders: [
    {
      name: "Adamantine Arrow",
      roteSkills: ["Athletics", "Intimidation", "Medicine"],
      description: "Warriors and soldiers of the Awakened. Roots in Atlantis.",
    },
    {
      name: "Free Council",
      roteSkills: ["Crafts", "Persuasion", "Science"],
      description: "Modernizers of magic. Founded in the 20th century.",
    },
    {
      name: "Guardians of the Veil",
      roteSkills: ["Investigation", "Stealth", "Subterfuge"],
      description: "Spies and secret police of the Awakened.",
    },
    {
      name: "Mysterium",
      roteSkills: ["Investigation", "Occult", "Survival"],
      description: "Seekers of magical knowledge and lore.",
    },
    {
      name: "Silver Ladder",
      roteSkills: ["Expression", "Persuasion", "Subterfuge"],
      description: "Leaders and politicians of the Awakened.",
    },
  ],

  arcana: [
    { name: "Death", purview: "Darkness, decay, ectoplasm, ghosts, soul stealing" },
    { name: "Fate", purview: "Blessings, curses, destiny, fortune, oaths, probability" },
    { name: "Forces", purview: "Electricity, gravity, kinetic energy, light, physics, radiation, sound, weather" },
    { name: "Life", purview: "Disease, evolution, healing, metamorphosis, vigor" },
    { name: "Matter", purview: "Alchemy, elemental air/earth/fire/water, shaping, transmutation" },
    { name: "Mind", purview: "Communication, hallucination, mental projection, telepathy" },
    { name: "Prime", purview: "Illusions, magical imbuement, Mana, resonance, tass" },
    { name: "Space", purview: "Conjuration, scrying, sympathy, teleportation, wards" },
    { name: "Spirit", purview: "Exorcism, the Shadow Realm, soul retrieval, spirits" },
    { name: "Time", purview: "Divination, prophecy, temporal acceleration/deceleration" },
  ],

  arcanaLevelNames: {
    1: "Initiate",
    2: "Apprentice",
    3: "Disciple",
    4: "Adept",
    5: "Master",
    6: "Archmaster",
  },

  arcanaLimits: {
    ruling: { maxWithoutInstruction: 5, xpCostMultiplier: 6 },
    common: { maxWithoutInstruction: 4, xpCostMultiplier: 7 },
    inferior: { maxWithoutInstruction: 2, xpCostMultiplier: 8 },
  },
}

// ============================================================
// CHARACTER CREATION RULES — from pages 64-76
// ============================================================

const characterRules = {
  creation: {
    steps: [
      { step: 1, name: "Concept", description: "Choose concept, virtue, vice" },
      { step: 2, name: "Attributes", description: "Prioritize Mental/Physical/Social (5/4/3). All start at 1. 5th dot costs 2." },
      { step: 3, name: "Skills", description: "Prioritize Mental/Physical/Social (11/7/4). 5th dot costs 2." },
      { step: 4, name: "Skill Specialties", description: "Choose 3 Skill Specialties." },
      { step: 5, name: "Mage Template", description: "Choose Path, Order, assign Arcana, choose Rote Specialties." },
      { step: 6, name: "Merits", description: "Spend 7 dots on Merits." },
      { step: 7, name: "Advantages", description: "Calculate derived stats (Willpower, Wisdom, Health, etc.)." },
    ],

    attributeAllocation: {
      primary: 5,
      secondary: 4,
      tertiary: 3,
      baseDotsPerAttribute: 1,
      fifthDotCost: 2,
    },

    skillAllocation: {
      primary: 11,
      secondary: 7,
      tertiary: 4,
      baseDotsPerSkill: 0,
      fifthDotCost: 2,
    },

    skillSpecialties: 3,
    meritDots: 7,

    mageTemplate: {
      startingArcana: {
        description: "6 dots among at least 2 Arcana. 2 of first 3 must be from Path's Ruling Arcana.",
        totalDots: 6,
        minArcana: 2,
        rulingRequirement: "2 of first 3 Arcana must be Ruling",
      },
      startingGnosis: 1,
      startingWisdom: 7,
      roteSpecialties: {
        description: "3 free Skill Specialties from Order's Rote Skills list",
        count: 3,
      },
    },

    wisdomTradeoff: {
      description: "May sacrifice 1 dot of Wisdom for 5 XP, min Wisdom 5 (max 10 XP bonus)",
      xpPerDot: 5,
      minWisdom: 5,
    },
  },

  // Derived stats formulas
  derivedStats: {
    health: { formula: "Stamina + Size", defaultSize: 5 },
    willpower: { formula: "Resolve + Composure" },
    defense: { formula: "Lower of Dexterity or Wits + Athletics" },
    initiative: { formula: "Dexterity + Composure" },
    speed: { formula: "Strength + Dexterity + 5" },
    mana: { formula: "Based on Gnosis (see Gnosis table)" },
    wisdom: { startingValue: 7 },
  },

  // Gnosis effects table (from page 78)
  gnosisTable: [
    { gnosis: 1, arcanaMax: 3, maxMana: 10, manaPerTurn: 1, auraBonus: 0, paradoxDice: 1, timePerRoll: "3 hours" },
    { gnosis: 2, arcanaMax: 4, maxMana: 11, manaPerTurn: 2, auraBonus: 0, paradoxDice: 1, timePerRoll: "3 hours" },
    { gnosis: 3, arcanaMax: 5, maxMana: 12, manaPerTurn: 3, auraBonus: 0, paradoxDice: 2, timePerRoll: "1 hour" },
    { gnosis: 4, arcanaMax: 5, maxMana: 13, manaPerTurn: 4, auraBonus: 0, paradoxDice: 2, timePerRoll: "1 hour" },
    { gnosis: 5, arcanaMax: 5, maxMana: 14, manaPerTurn: 5, auraBonus: 0, paradoxDice: 3, timePerRoll: "30 minutes" },
    { gnosis: 6, arcanaMax: 6, maxMana: 15, manaPerTurn: 6, auraBonus: 1, paradoxDice: 3, timePerRoll: "30 minutes" },
    { gnosis: 7, arcanaMax: 7, maxMana: 20, manaPerTurn: 7, auraBonus: 2, paradoxDice: 4, timePerRoll: "10 minutes" },
    { gnosis: 8, arcanaMax: 8, maxMana: 30, manaPerTurn: 8, auraBonus: 3, paradoxDice: 4, timePerRoll: "10 minutes" },
    { gnosis: 9, arcanaMax: 9, maxMana: 50, manaPerTurn: 10, auraBonus: 4, paradoxDice: 5, timePerRoll: "1 minute" },
    { gnosis: 10, arcanaMax: 10, maxMana: 100, manaPerTurn: 15, auraBonus: 5, paradoxDice: 5, timePerRoll: "1 minute" },
  ],

  // Arcana mastery limits per Gnosis (from page 78)
  // arcanaMastery[gnosis-1][arcanum-rank-1] = max dots
  arcanaMastery: [
    // Gnosis 1:  1st 2nd 3rd 4th 5th 6th 7th 8th 9th 10th
    [3, 3, 3, 3, 2, 2, 2, 1, 1, 1],
    [4, 4, 3, 3, 3, 2, 2, 2, 1, 1],
    [5, 4, 4, 3, 3, 3, 2, 2, 2, 1],
    [5, 5, 4, 4, 3, 3, 3, 2, 2, 2],
    [5, 5, 5, 4, 4, 3, 3, 3, 2, 2],
    [6, 5, 5, 5, 4, 4, 3, 3, 3, 2],
    [7, 6, 5, 5, 5, 4, 4, 3, 3, 3],
    [7, 7, 6, 5, 5, 5, 4, 4, 3, 3],
    [7, 7, 7, 6, 5, 5, 5, 4, 4, 3],
    [7, 7, 7, 7, 6, 5, 5, 5, 4, 4],
  ],

  // XP costs
  xpCosts: {
    attribute: { formula: "new dots x 5" },
    skill: { formula: "new dots x 3" },
    skillSpecialty: { cost: 3 },
    rulingArcanum: { formula: "new dots x 6" },
    commonArcanum: { formula: "new dots x 7" },
    inferiorArcanum: { formula: "new dots x 8" },
    otherArcanum: { formula: "new dots x 8" },
    gnosis: { formula: "new dots x 8" },
    wisdom: { formula: "new dots x 3" },
    merit: { formula: "new dots x 2" },
    rote: { cost: 2 },
    willpower: { cost: 8, description: "1 dot of Willpower" },
  },

  // Attributes and Skills reference
  attributes: {
    mental: ["Intelligence", "Wits", "Resolve"],
    physical: ["Strength", "Dexterity", "Stamina"],
    social: ["Presence", "Manipulation", "Composure"],
  },

  skills: {
    mental: ["Academics", "Computer", "Crafts", "Investigation", "Medicine", "Occult", "Politics", "Science"],
    physical: ["Athletics", "Brawl", "Drive", "Firearms", "Larceny", "Stealth", "Survival", "Weaponry"],
    social: ["Animal Ken", "Empathy", "Expression", "Intimidation", "Persuasion", "Socialize", "Streetwise", "Subterfuge"],
  },

  // Virtues and Vices
  virtues: ["Charity", "Faith", "Fortitude", "Hope", "Justice", "Prudence", "Temperance"],
  vices: ["Envy", "Gluttony", "Greed", "Lust", "Pride", "Sloth", "Wrath"],
}

// ============================================================
// HOMEBREW RULES — from the storyteller
// ============================================================

const homebrewRules = {
  initiative: {
    name: "Tick-Based Initiative (from Scion: Hero)",
    description: "Dynamic initiative system replacing static initiative from the core book.",
    replacesCorePage: "Standard initiative rules",
    system: {
      setup: "Each participant rolls d10 + Dexterity + Composure. Highest total gets 0 ticks, all others get (highest - their total) ticks.",
      acting: "When a participant has 0 ticks remaining, they may act. If multiple participants have 0 ticks, highest Wits acts first.",
      tiebreakers: ["Wits", "Dexterity", "Composure", "Willpower", "Coinflip"],
      actionCosts: {
        attack: 3,
        castSpell: 5,
        aim: { min: 1, max: 3, effect: "+1 die per tick spent on next attack" },
        move: 3,
        dodge: { min: 1, max: 3, effect: "+1 Defense per tick spent" },
        useItem: { base: 3, note: "More at Storyteller discretion" },
        otherAction: { note: "Storyteller discretion" },
      },
      resolution: "When no participants have 0 ticks, all participants remove ticks one at a time until someone reaches 0.",
    },
  },
}

async function writeFiles() {
  await Bun.write(
    `${OUTPUT_DIR}path-data.json`,
    JSON.stringify(pathData, null, 2),
  )
  console.log(`Wrote data/path-data.json`)
  console.log(`  ${pathData.paths.length} paths, ${pathData.orders.length} orders, ${pathData.arcana.length} arcana`)

  await Bun.write(
    `${OUTPUT_DIR}character-rules.json`,
    JSON.stringify(characterRules, null, 2),
  )
  console.log(`Wrote data/character-rules.json`)
  console.log(`  ${characterRules.creation.steps.length} creation steps, ${characterRules.gnosisTable.length} gnosis levels`)
  console.log(`  ${Object.keys(characterRules.xpCosts).length} XP cost categories`)

  await Bun.write(
    `${OUTPUT_DIR}homebrew-rules.json`,
    JSON.stringify(homebrewRules, null, 2),
  )
  console.log(`Wrote data/homebrew-rules.json`)
  console.log(`  ${Object.keys(homebrewRules).length} homebrew rules`)
}

writeFiles()
