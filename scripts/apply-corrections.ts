/**
 * Stage 2b: Apply Manual Corrections
 *
 * Reads data/spells.json and applies corrections for entries the
 * parser couldn't handle automatically. Also merges in the review
 * queue items with manually provided data.
 *
 * Usage: bun scripts/apply-corrections.ts
 */

const DATA_DIR = new URL("../data/", import.meta.url).pathname

// --- Manual name corrections ---
// Key: "truncatedName|arcanum|level" → correct name
const NAME_CORRECTIONS: Record<string, string> = {
  "Paw|Fate|3": "Monkey's Paw",
  "Eye|Matter|1": "Craftsman's Eye",
  "Eye|Spirit|1": "Exorcist's Eye",
  // "Ban" on page 239 is correct — the spell IS called "Ban"
}

// --- Manual field fills for Unknown entries ---
// Key: "spellName|arcanum" → partial Spell fields to merge
const ROTE_POOL_CORRECTIONS: Record<string, Record<string, string>> = {
  "Self-Healing|Life|Adamantine Arrow": "Dexterity + Medicine + Life",
  "Create Life|Life|Guardians of the Veil": "Intelligence + Medicine + Life",
  "Annihilate Extraordinary Matter|Matter|Adamantine Arrow": "Strength + Athletics + Matter",
  "Multi-Tasking|Mind|Silver Ladder": "Resolve + Academics + Mind",
}

const FIELD_CORRECTIONS: Record<string, Record<string, string>> = {
  "Unseen Spy|Prime": { aspect: "Covert" },
  "Sculpt Ephemera|Death": { action: "Instant" },
  "Revenant|Death": { duration: "Prolonged (one scene)", aspect: "Vulgar" },
  "Personal Invisibility|Forces": { duration: "Prolonged (one scene)" },
  "Evolutionary Shift|Life": { duration: "Prolonged (one scene)" },
  "Ultimate Degradation|Life": { practice: "Unraveling" },
  "Reconfigure Object|Matter": { duration: "Prolonged (one scene)" },
  "Transmute Air|Matter": { duration: "Prolonged (one scene)", aspect: "Vulgar" },
  "Greater Transmogrification|Matter": { duration: "Prolonged (one scene)" },
  "Opening the Lidless Eye|Mind": { duration: "Prolonged (one scene)" },
  "Unseen Spy|Prime": { aspect: "Covert" },
  "Imbue Item|Prime": { duration: "Prolonged (one scene)" },
  "Siphon Mana|Prime": { duration: "Prolonged (one scene)" },
  "Follow Through|Space": { practice: "Ruling" },
  "Temporal Stutter|Time": { duration: "Transitory (one turn)" },
  "Faerie Glade|Time": { duration: "Prolonged (one scene)" },
}

// --- Review queue items: manually parsed spells ---
const MANUAL_SPELLS = [
  {
    name: "Conditional Duration",
    arcanum: "Fate" as const,
    level: 2,
    practice: "Ruling",
    action: "Instant (added to another spell)",
    duration: "Varies (conditional)",
    aspect: "Covert",
    cost: "None",
    description: "The mage adds a conditional trigger to a spell's Duration. The spell lasts until the condition is met. This allows for indefinite effects tied to specific events.",
    rotes: [],
    pageStart: 152,
  },
  {
    name: "Target Exemption",
    arcanum: "Fate" as const,
    level: 2,
    practice: "Shielding",
    action: "Instant (added to another spell)",
    duration: "Duration of protected spell",
    aspect: "Covert",
    cost: "None",
    description: "The mage exempts specific targets from a spell's effects. The exempted targets are unaffected by the spell as though they were not present.",
    rotes: [],
    pageStart: 156,
  },
  {
    name: "Unfettered",
    arcanum: "Fate" as const,
    level: 4,
    practice: "Patterning",
    action: "Instant",
    duration: "Prolonged (one scene)",
    aspect: "Covert",
    cost: "None",
    description: "A mage with this level of proficiency with the intricacies of Fate has a significant measure of control over probability and can free himself from harmful supernatural effects.",
    rotes: [],
    pageStart: 160,
  },
  {
    name: "Transform Base Life",
    arcanum: "Life" as const,
    level: 2,
    practice: "Ruling",
    action: "Instant",
    duration: "Prolonged (one scene)",
    aspect: "Vulgar",
    cost: "None",
    description: "The mage can transform one base form of life (such as insects, fungi or algae) into another base form of life. The complexity of the organism cannot be increased beyond base forms.",
    rotes: [],
    pageStart: 186,
  },
  {
    name: "Unseen Aegis",
    arcanum: "Matter" as const,
    level: 2,
    practice: "Shielding",
    action: "Instant",
    duration: "Prolonged (one scene)",
    aspect: "Covert",
    cost: "None",
    description: "This spell acts subtly upon inert material in the mage's immediate vicinity to protect him from harm. Debris shifts, surfaces become more yielding on impact.",
    rotes: [],
    pageStart: 199,
  },
  {
    name: "Soul Jar",
    arcanum: "Spirit" as const,
    level: 2,
    practice: "Ruling",
    action: "Instant and contested",
    duration: "Prolonged (one scene)",
    aspect: "Covert",
    cost: "None",
    description: "As the Death 2 'Soul Jar' spell. The mage creates a receptacle for a spirit, binding it within a physical object.",
    rotes: [],
    pageStart: 250,
  },
]

async function applyCorrections() {
  const spellsFile = Bun.file(`${DATA_DIR}spells.json`)
  const spells = await spellsFile.json()

  let nameFixed = 0
  let fieldsFixed = 0
  let manualAdded = 0

  // Apply name corrections
  for (const spell of spells) {
    const key = `${spell.name}|${spell.arcanum}|${spell.level}`
    if (NAME_CORRECTIONS[key]) {
      console.log(`  Name: "${spell.name}" → "${NAME_CORRECTIONS[key]}"`)
      spell.name = NAME_CORRECTIONS[key]
      nameFixed++
    }
  }

  // Apply field corrections
  for (const spell of spells) {
    const key = `${spell.name}|${spell.arcanum}`
    if (FIELD_CORRECTIONS[key]) {
      const fixes = FIELD_CORRECTIONS[key]
      for (const [field, value] of Object.entries(fixes)) {
        if (spell[field] === "Unknown" || !spell[field]) {
          console.log(`  Field: ${spell.name} → ${field} = "${value}"`)
          spell[field] = value
          fieldsFixed++
        }
      }
    }
  }

  // Apply rote dice pool corrections
  for (const spell of spells) {
    for (const rote of spell.rotes) {
      const key = `${spell.name}|${spell.arcanum}|${rote.order}`
      if (ROTE_POOL_CORRECTIONS[key] && (!rote.dicePool || rote.dicePool.length < 5)) {
        console.log(`  Rote pool: ${spell.name} (${rote.order}) → "${ROTE_POOL_CORRECTIONS[key]}"`)
        rote.dicePool = ROTE_POOL_CORRECTIONS[key]
        fieldsFixed++
      }
    }
  }

  // Add manual spells from review queue
  for (const manual of MANUAL_SPELLS) {
    // Check if already exists (avoid duplicates)
    const exists = spells.some(
      (s: any) => s.name === manual.name && s.arcanum === manual.arcanum && s.level === manual.level,
    )
    if (!exists) {
      spells.push(manual)
      console.log(`  Added: ${manual.name} (${manual.arcanum} ${manual.level})`)
      manualAdded++
    }
  }

  // Sort by arcanum then level then name
  spells.sort((a: any, b: any) => {
    if (a.arcanum !== b.arcanum) return a.arcanum.localeCompare(b.arcanum)
    if (a.level !== b.level) return a.level - b.level
    return a.name.localeCompare(b.name)
  })

  // Write corrected output
  await Bun.write(`${DATA_DIR}spells.json`, JSON.stringify(spells, null, 2))

  // Re-audit
  const unknownFields = spells.filter(
    (s: any) => s.practice === "Unknown" || s.action === "Unknown" ||
      s.duration === "Unknown" || s.aspect === "Unknown",
  )
  const emptyPools = spells.reduce(
    (sum: number, s: any) => sum + s.rotes.filter((r: any) => !r.dicePool || r.dicePool.length < 5).length,
    0,
  )

  console.log(`\nCorrections applied:`)
  console.log(`  Names fixed: ${nameFixed}`)
  console.log(`  Fields filled: ${fieldsFixed}`)
  console.log(`  Manual spells added: ${manualAdded}`)
  console.log(`  Total spells: ${spells.length}`)
  console.log(`  Remaining Unknown fields: ${unknownFields.length}`)
  console.log(`  Remaining empty dice pools: ${emptyPools}`)

  if (unknownFields.length > 0) {
    console.log(`\n  Still Unknown:`)
    for (const s of unknownFields) {
      const missing = []
      if (s.practice === "Unknown") missing.push("practice")
      if (s.action === "Unknown") missing.push("action")
      if (s.duration === "Unknown") missing.push("duration")
      if (s.aspect === "Unknown") missing.push("aspect")
      console.log(`    ${s.name} (${s.arcanum} ${s.level}) — ${missing.join(", ")}`)
    }
  }
}

applyCorrections()
