/**
 * Stage 2b: Apply Manual Corrections
 *
 * Reads data/spells.json and applies corrections for entries the
 * parser couldn't handle automatically. Also merges in the review
 * queue items with manually provided data.
 *
 * On the script runtime (issue #55): the input decodes through a Schema
 * (each stored `pool` through the domain `RotePool` itself) and failure
 * paths exit through `runScript` with a typed cause instead of
 * `process.exit`.
 *
 * Usage: bun scripts/apply-corrections.ts
 */

import { Effect, Result, Schema } from "effect"
import { formatRotePool, parseRotePool, RotePool } from "../src/domain/rote-pool"
import { loadJson, runScript } from "./lib/script-runtime"

const DATA_DIR = new URL("../data/", import.meta.url).pathname

// --- Manual name corrections ---
// Key: "truncatedName|arcanum|level" → correct name
const NAME_CORRECTIONS: Record<string, string> = {
  "Paw|Fate|3": "Monkey's Paw",
  "Eye|Matter|1": "Craftsman's Eye",
  "Eye|Spirit|1": "Exorcist's Eye",
  // "Ban" on page 239 is correct — the spell IS called "Ban"
  // Header bleed on p. 232 glued the running head onto the name.
  "MasterofPrime Create Complex Phantasm|Prime|5": "Create Complex Phantasm",
}

// --- Manual rote-pool fills ---
// Key: "spellName|arcanum|order" → the true dice pool from the book page.
// Applied when the extracted pool is empty or fails to parse (issue #14).
const ROTE_POOL_CORRECTIONS: Record<string, string> = {
  "Self-Healing|Life|Adamantine Arrow": "Dexterity + Medicine + Life",
  "Create Life|Life|Guardians of the Veil": "Intelligence + Medicine + Life",
  "Annihilate Extraordinary Matter|Matter|Adamantine Arrow": "Strength + Athletics + Matter",
  "Multi-Tasking|Mind|Silver Ladder": "Resolve + Academics + Mind",
  // Column wrap dropped the trailing Arcanum (p. 156: "Manipulation + Politics +Fate").
  "Alter Oath|Fate|Silver Ladder": "Manipulation + Politics + Fate",
  // Book: "vs. bond's Potency" (p. 158) — the resistance trait is the bond's Potency.
  "Destroy Bindings|Fate|Adamantine Arrow": "Resolve + Occult + Fate vs Potency",
  // Book: "vs. oath's Potency" (p. 160).
  "Sever Oaths|Fate|Silver Ladder": "Manipulation + Occult + Fate vs Potency",
  // Book: "vs. geas Potency" (p. 161).
  "Break the Chains|Fate|Free Council": "Wits + Occult + Fate vs Potency",
  // Book (p. 182): "Intelligence + Survival (plants) or Animal Ken (animals)
  // or Medicine (humans) + Life" — extraction kept only the first alternative.
  "Analyze Life|Life|Silver Ladder": "Intelligence + Survival or Animal Ken or Medicine + Life",
  // Book: "vs. target spell's Potency" (p. 231).
  "Siphon Integrity|Prime|Free Council": "Resolve + Occult + Prime vs Potency",
  // Book (p. 232): "Intelligence + Crafts (for objects) or Medicine (for people) + Prime".
  "Create Complex Phantasm|Prime|Adamantine Arrow": "Intelligence + Crafts or Medicine + Prime",
  // Book (p. 246): "Intelligence + Medicine (for living creatures) or Crafts
  // or Science (for objects) + Space".
  "Labyrinth|Space|Silver Ladder": "Intelligence + Medicine or Crafts or Science + Space",
}

/** The fields a FIELD_CORRECTIONS entry may fill — filled only over "Unknown". */
const CORRECTABLE_FIELDS = ["practice", "action", "duration", "aspect"] as const

const FIELD_CORRECTIONS: Record<
  string,
  Partial<Record<(typeof CORRECTABLE_FIELDS)[number], string>>
> = {
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
  "Imbue Item|Prime": { duration: "Prolonged (one scene)" },
  "Siphon Mana|Prime": { duration: "Prolonged (one scene)" },
  "Follow Through|Space": { practice: "Ruling" },
  "Temporal Stutter|Time": { duration: "Transitory (one turn)" },
  "Faerie Glade|Time": { duration: "Prolonged (one scene)" },
}

// --- Aspect corrections (issue #14) ---
// Every spell must resolve to a clean Covert/Vulgar Aspect for the seam's
// Covert-only gate. Key: "spellName|arcanum" → aspect. Unlike FIELD_CORRECTIONS
// these overwrite garbage values, not just "Unknown".
const ASPECT_CORRECTIONS: Record<string, string> = {
  // Extraction bleed — the page reads "Aspect: Covert" (p. 326).
  "Goetic Struggle|Mind": "Covert",
  // Extraction bleed — the page reads "Aspect: Covert" (p. 225).
  "Armor of the Soul|Prime": "Covert",
  // GENUINE BOOK EXCEPTION: the page reads "Aspect: Special" (p. 227) — the
  // imbued spell decides. Encoded fail-closed as Vulgar so the Covert-only
  // cast flow refuses it until the Paradox phase can model it (ADR-0008).
  "Imbue Item|Prime": "Vulgar",
}

const VALID_ASPECTS = new Set(["Covert", "Vulgar"])

// --- Review queue items: manually parsed spells ---
const MANUAL_SPELLS = [
  {
    name: "Conditional Duration",
    arcanum: "Fate",
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
    arcanum: "Fate",
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
    arcanum: "Fate",
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
    arcanum: "Life",
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
    arcanum: "Matter",
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
    arcanum: "Spirit",
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

// --- Input shape (issue #55) ---
// Field order mirrors the file so the rewrite is byte-stable on a re-run.
// Free-text columns stay open strings (this script is what cleans them); the
// structured `pool` decodes through the domain `RotePool` itself and is only
// present on already-corrected data — this script wrote it from parseRotePool.
const SpellRote = Schema.Struct({
  order: Schema.String,
  name: Schema.String,
  dicePool: Schema.optionalKey(Schema.String),
  pool: Schema.optionalKey(RotePool),
})

const SpellRecord = Schema.Struct({
  name: Schema.String,
  arcanum: Schema.String,
  level: Schema.Number,
  practice: Schema.String,
  action: Schema.String,
  duration: Schema.String,
  aspect: Schema.String,
  cost: Schema.String,
  description: Schema.String,
  rotes: Schema.Array(SpellRote),
  pageStart: Schema.Number,
})

// --- Errors (rendered by runScript as the exit cause) ---

/** Spells whose Aspect is still not a clean Covert/Vulgar after corrections. */
class DirtyAspectsRemain extends Schema.TaggedErrorClass<DirtyAspectsRemain>()(
  "DirtyAspectsRemain",
  { count: Schema.Number },
) {}

/** Rote pools that parse to no structure even after ROTE_POOL_CORRECTIONS. */
class UnparseableRotePoolsRemain extends Schema.TaggedErrorClass<UnparseableRotePoolsRemain>()(
  "UnparseableRotePoolsRemain",
  { count: Schema.Number },
) {}

/** The corrected output could not be written back to disk. */
class WriteFailed extends Schema.TaggedErrorClass<WriteFailed>()(
  "WriteFailed",
  { path: Schema.String, message: Schema.String },
) {}

const applyCorrections = Effect.fn("ApplyCorrections.run")(function* () {
  const decoded = yield* loadJson(`${DATA_DIR}spells.json`, Schema.Array(SpellRecord))
  // Mutable working copies — the corrections below edit in place.
  const spells = decoded.map((spell) => ({
    ...spell,
    rotes: spell.rotes.map((rote) => ({ ...rote })),
  }))

  let nameFixed = 0
  let fieldsFixed = 0
  let manualAdded = 0

  // Apply name corrections
  for (const spell of spells) {
    const corrected = NAME_CORRECTIONS[`${spell.name}|${spell.arcanum}|${spell.level}`]
    if (corrected !== undefined) {
      console.log(`  Name: "${spell.name}" → "${corrected}"`)
      spell.name = corrected
      nameFixed++
    }
  }

  // Apply field corrections
  for (const spell of spells) {
    const fixes = FIELD_CORRECTIONS[`${spell.name}|${spell.arcanum}`]
    if (fixes) {
      for (const field of CORRECTABLE_FIELDS) {
        const value = fixes[field]
        if (value !== undefined && (spell[field] === "Unknown" || !spell[field])) {
          console.log(`  Field: ${spell.name} → ${field} = "${value}"`)
          spell[field] = value
          fieldsFixed++
        }
      }
    }
  }

  // Aspect cleanup (issue #14): explicit corrections, then validate the lot.
  let aspectsFixed = 0
  for (const spell of spells) {
    const correction = ASPECT_CORRECTIONS[`${spell.name}|${spell.arcanum}`]
    if (correction !== undefined && spell.aspect !== correction) {
      console.log(`  Aspect: ${spell.name} "${spell.aspect.slice(0, 40)}" → "${correction}"`)
      spell.aspect = correction
      aspectsFixed++
    }
  }
  const dirtyAspects = spells.filter((s) => !VALID_ASPECTS.has(s.aspect))
  if (dirtyAspects.length > 0) {
    console.error(`\n✗ ${dirtyAspects.length} spells still carry a dirty aspect:`)
    for (const s of dirtyAspects) {
      console.error(`    ${s.name} (${s.arcanum} ${s.level}): "${s.aspect.slice(0, 60)}"`)
    }
    return yield* new DirtyAspectsRemain({ count: dirtyAspects.length })
  }

  // Structured rote pools (issue #14): parse every prose pool into Traits and
  // canonicalize the prose. An extracted pool that fails falls back to its
  // ROTE_POOL_CORRECTIONS entry (the true pool from the book page); anything
  // still unparseable is a pipeline failure, not a runtime surprise.
  let poolsParsed = 0
  const unparseable: Array<{ spell: string; order: string; pool: string; reason: string }> = []
  for (const spell of spells) {
    for (const rote of spell.rotes) {
      let parsed = yield* Effect.result(parseRotePool(rote.dicePool ?? ""))
      const correction = ROTE_POOL_CORRECTIONS[`${spell.name}|${spell.arcanum}|${rote.order}`]
      if (Result.isFailure(parsed) && correction !== undefined) {
        console.log(`  Rote pool: ${spell.name} (${rote.order}) → "${correction}"`)
        parsed = yield* Effect.result(parseRotePool(correction))
        fieldsFixed++
      }
      if (Result.isSuccess(parsed)) {
        rote.pool = parsed.success
        rote.dicePool = formatRotePool(parsed.success)
        poolsParsed++
      } else {
        unparseable.push({
          spell: `${spell.name} (${spell.arcanum} ${spell.level})`,
          order: rote.order,
          pool: rote.dicePool ?? "",
          reason: parsed.failure.reason,
        })
      }
    }
  }
  if (unparseable.length > 0) {
    console.error(`\n✗ ${unparseable.length} rote pools failed to parse:`)
    for (const u of unparseable) {
      console.error(`    ${u.spell} [${u.order}]: "${u.pool}" — ${u.reason}`)
    }
    return yield* new UnparseableRotePoolsRemain({ count: unparseable.length })
  }

  // Add manual spells from review queue
  for (const manual of MANUAL_SPELLS) {
    // Check if already exists (avoid duplicates)
    const exists = spells.some(
      (s) => s.name === manual.name && s.arcanum === manual.arcanum && s.level === manual.level,
    )
    if (!exists) {
      spells.push(manual)
      console.log(`  Added: ${manual.name} (${manual.arcanum} ${manual.level})`)
      manualAdded++
    }
  }

  // Sort by arcanum then level then name
  spells.sort((a, b) => {
    if (a.arcanum !== b.arcanum) return a.arcanum.localeCompare(b.arcanum)
    if (a.level !== b.level) return a.level - b.level
    return a.name.localeCompare(b.name)
  })

  // Write corrected output
  yield* Effect.tryPromise(() =>
    Bun.write(`${DATA_DIR}spells.json`, JSON.stringify(spells, null, 2)),
  ).pipe(
    Effect.mapError(
      (error) =>
        new WriteFailed({
          path: `${DATA_DIR}spells.json`,
          message: error instanceof Error ? error.message : String(error),
        }),
    ),
  )

  // Re-audit
  const unknownFields = spells.filter(
    (s) => s.practice === "Unknown" || s.action === "Unknown" ||
      s.duration === "Unknown" || s.aspect === "Unknown",
  )
  const emptyPools = spells.reduce(
    (sum, s) => sum + s.rotes.filter((r) => !r.dicePool || r.dicePool.length < 5).length,
    0,
  )

  console.log(`\nCorrections applied:`)
  console.log(`  Names fixed: ${nameFixed}`)
  console.log(`  Fields filled: ${fieldsFixed}`)
  console.log(`  Aspects corrected: ${aspectsFixed}`)
  console.log(`  Rote pools parsed to structure: ${poolsParsed}`)
  console.log(`  Manual spells added: ${manualAdded}`)
  console.log(`  Total spells: ${spells.length}`)
  console.log(`  Remaining Unknown fields: ${unknownFields.length}`)
  console.log(`  Remaining empty dice pools: ${emptyPools}`)

  if (unknownFields.length > 0) {
    console.log(`\n  Still Unknown:`)
    for (const s of unknownFields) {
      const missing = CORRECTABLE_FIELDS.filter((field) => s[field] === "Unknown")
      console.log(`    ${s.name} (${s.arcanum} ${s.level}) — ${missing.join(", ")}`)
    }
  }
})

await runScript(applyCorrections())
