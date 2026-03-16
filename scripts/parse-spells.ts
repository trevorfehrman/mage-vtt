/**
 * Stage 2: Structured Spell/Rote Parsing
 *
 * Reads extracted page text from data/pages/ and parses spells into
 * structured JSON records. Outputs:
 *   - data/spells.json — successfully parsed spells
 *   - data/review-queue.json — spells that need manual review
 *
 * Usage: bun scripts/parse-spells.ts
 */

const PAGES_DIR = new URL("../data/pages/", import.meta.url).pathname
const OUTPUT_DIR = new URL("../data/", import.meta.url).pathname

const ARCANA = [
  "Death", "Fate", "Forces", "Life", "Matter",
  "Mind", "Prime", "Space", "Spirit", "Time",
] as const
type Arcanum = (typeof ARCANA)[number]

const ORDERS = [
  "Adamantine Arrow", "Free Council", "Guardians of the Veil",
  "Mysterium", "Silver Ladder",
] as const

const ATTRIBUTES = [
  "Strength", "Dexterity", "Stamina",
  "Intelligence", "Wits", "Resolve",
  "Presence", "Manipulation", "Composure",
]

const SKILLS = [
  "Academics", "Computer", "Crafts", "Investigation", "Medicine",
  "Occult", "Politics", "Science",
  "Athletics", "Brawl", "Drive", "Firearms", "Larceny",
  "Stealth", "Survival", "Weaponry",
  "Animal Ken", "Empathy", "Expression", "Intimidation",
  "Persuasion", "Socialize", "Streetwise", "Subterfuge",
]

interface Rote {
  order: string
  name: string
  dicePool: string
}

interface Spell {
  name: string
  arcanum: Arcanum
  level: number
  practice: string
  action: string
  duration: string
  aspect: string
  cost: string
  description: string
  rotes: Rote[]
  pageStart: number
}

interface ReviewItem {
  page: number
  rawText: string
  reason: string
}

// --- Cleaning utilities ---

/** Remove line-break hyphens: "Intelli-\ngence" → "Intelligence" */
function dehyphenate(text: string): string {
  return text.replace(/(\w)-\s*\n\s*(\w)/g, "$1$2")
}

/** Collapse all whitespace (newlines, multiple spaces) to single space */
function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

/** Clean a spell name: remove chapter headers, newlines, artifacts */
function cleanSpellName(name: string): string {
  return collapse(
    name
      .replace(/^MAGIC\s*/i, "")
      .replace(/^CHAPTER\s+\w+\s*/i, "")
      .replace(/\n/g, " "),
  )
}

/** Clean a rote name: de-hyphenate and collapse */
function cleanRoteName(name: string): string {
  return collapse(dehyphenate(name))
}

/** Count dots (•) in text */
function countDots(text: string): number {
  return (text.match(/[•·]/g) || []).length
}

function parseLevel(levelStr: string): number {
  const dots = countDots(levelStr)
  if (dots > 0) return dots
  const numMatch = levelStr.match(/(\d)/)
  if (numMatch) return parseInt(numMatch[1])
  return 0
}

// --- Loading ---

async function loadAllPages(): Promise<Array<{ page: number; text: string }>> {
  const pages: Array<{ page: number; text: string }> = []
  for (let i = 1; i <= 402; i++) {
    const path = `${PAGES_DIR}${String(i).padStart(3, "0")}.json`
    const file = Bun.file(path)
    if (await file.exists()) {
      const data = await file.json()
      pages.push({ page: data.page, text: data.text })
    }
  }
  return pages
}

// --- Spell header detection ---

function findSpellHeaders(
  fullText: string,
): Array<{ name: string; arcanum: Arcanum; level: number; index: number }> {
  const headers: Array<{
    name: string; arcanum: Arcanum; level: number; index: number
  }> = []

  for (const arcanum of ARCANA) {
    // Match "Spell Name (Arcanum •••)" allowing newlines in the name
    const pattern = new RegExp(
      `([A-Z][A-Za-z\\s'\\-\n]+?)\\s*\\(${arcanum}\\s+([•·]+|\\d)\\)`,
      "g",
    )
    let match
    while ((match = pattern.exec(fullText)) !== null) {
      const rawName = match[1].trim()
      const name = cleanSpellName(rawName)
      const level = parseLevel(match[2])

      if (name.length > 50 || name.length < 3) continue
      // Skip obvious non-spells
      if (/^\d+$/.test(name)) continue

      headers.push({ name, arcanum, level, index: match.index })
    }
  }

  headers.sort((a, b) => a.index - b.index)

  // Deduplicate — same name + arcanum + level within 100 chars = same spell
  const deduped: typeof headers = []
  for (const h of headers) {
    const prev = deduped[deduped.length - 1]
    if (prev && prev.name === h.name && prev.arcanum === h.arcanum && h.index - prev.index < 100) {
      continue
    }
    deduped.push(h)
  }

  return deduped
}

// --- Field extraction ---

/** Extract a structured field from the spell text block */
function extractField(text: string, field: string): string | null {
  // Dehyphenate the whole block first so fields aren't broken
  const cleaned = dehyphenate(text)

  // Match "Field: value" — value runs until the next known field or a Rote header
  const fieldNames = "Practice|Action|Duration|Aspect|Cost"
  const orderNames = ORDERS.join("|")
  const stopPattern = `(?=${fieldNames}:|(?:${orderNames})\\s+Rote:|[A-Z][a-z]+\\s+Rote:)`

  const pattern = new RegExp(
    `${field}:\\s*(.+?)(?:\\n\\s*${stopPattern}|\\n\\n)`,
    "s",
  )
  const match = cleaned.match(pattern)
  if (!match) {
    // Try a simpler single-line match
    const simple = new RegExp(`${field}:\\s*(.+?)$`, "m")
    const simpleMatch = cleaned.match(simple)
    if (simpleMatch) return collapse(simpleMatch[1])
    return null
  }
  return collapse(match[1])
}

// --- Rote extraction ---

/** Build the full dice pool by looking for Attribute + Skill + Arcanum patterns */
function extractFullDicePool(text: string, arcanum: string): string {
  // Dehyphenate and collapse the text around the Dice Pool line
  const cleaned = dehyphenate(text)

  // Find "Dice Pool:" and grab generous text after it
  const dpMatch = cleaned.match(/Dice\s*Pool:\s*(.{10,120})/s)
  if (!dpMatch) return ""

  let pool = collapse(dpMatch[1])

  // Trim to just the formula: stop at the first sentence-like content
  // Dice pools look like "Intelligence + Occult + Death" or "Wits + Occult or Science + Death"
  // They DON'T contain words like "the", "this", "a", "mage", "spell"
  const words = pool.split(/\s+/)
  const formulaParts: string[] = []
  for (const word of words) {
    const clean = word.replace(/[,.]$/, "")
    if (
      clean === "+" || clean === "or" || clean === "vs." || clean === "vs" ||
      ATTRIBUTES.includes(clean) ||
      SKILLS.some(s => s.split(" ").includes(clean)) ||
      ARCANA.includes(clean as Arcanum) ||
      clean === "Ken" || clean === "the" || clean === "of" ||
      clean === "Gnosis" || clean === "Resistance" ||
      /^[A-Z][a-z]+$/.test(clean) // Capitalized word (likely a stat)
    ) {
      formulaParts.push(clean)
    } else {
      break
    }
  }

  const result = formulaParts.join(" ")
    .replace(/\s*\+\s*/g, " + ")
    .replace(/\s+/g, " ")
    .trim()

  return result || pool.slice(0, 60)
}

function extractRotes(text: string, arcanum: Arcanum): Rote[] {
  const rotes: Rote[] = []
  const cleaned = dehyphenate(text)

  for (const order of ORDERS) {
    // Match "Order Rote: Name" — name can span the rest of the line
    const pattern = new RegExp(
      `(${order})\\s+Rote:\\s*([^\\n]+)`,
      "g",
    )
    let match
    while ((match = pattern.exec(cleaned)) !== null) {
      const name = cleanRoteName(match[2])
      // Get the text after this match for dice pool extraction
      const afterMatch = cleaned.slice(match.index, match.index + 500)
      const dicePool = extractFullDicePool(afterMatch, arcanum)

      rotes.push({ order, name, dicePool })
    }
  }

  return rotes
}

// --- Page tracking ---

function findPage(
  pageOffsets: Array<{ page: number; startIndex: number; endIndex: number }>,
  index: number,
): number {
  for (const po of pageOffsets) {
    if (index >= po.startIndex && index < po.endIndex) return po.page
  }
  return 0
}

// --- Main ---

async function parseSpells() {
  console.log("Loading pages...")
  const pages = await loadAllPages()
  console.log(`Loaded ${pages.length} pages`)

  let fullText = ""
  const pageOffsets: Array<{ page: number; startIndex: number; endIndex: number }> = []
  for (const p of pages) {
    const start = fullText.length
    fullText += p.text + "\n\n"
    pageOffsets.push({ page: p.page, startIndex: start, endIndex: fullText.length })
  }

  console.log(`Total text: ${fullText.length} chars`)
  console.log("Finding spell headers...")
  const headers = findSpellHeaders(fullText)
  console.log(`Found ${headers.length} spell headers`)

  const spells: Spell[] = []
  const reviewQueue: ReviewItem[] = []

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]
    const nextIndex = i + 1 < headers.length ? headers[i + 1].index : Math.min(header.index + 5000, fullText.length)
    const spellText = fullText.slice(header.index, nextIndex)

    const practice = extractField(spellText, "Practice")
    const action = extractField(spellText, "Action")
    const duration = extractField(spellText, "Duration")
    const aspect = extractField(spellText, "Aspect")
    const cost = extractField(spellText, "Cost")
    const rotes = extractRotes(spellText, header.arcanum)
    const page = findPage(pageOffsets, header.index)

    // Build a clean description (first ~400 chars of the spell, after the header)
    const headerEnd = spellText.indexOf(")")
    const descStart = headerEnd > 0 ? headerEnd + 1 : 0
    const descText = collapse(dehyphenate(spellText.slice(descStart, descStart + 600)))
    // Trim description to end at a sentence boundary
    const sentenceEnd = descText.slice(0, 500).lastIndexOf(".")
    const description = sentenceEnd > 100 ? descText.slice(0, sentenceEnd + 1) : descText.slice(0, 400)

    if (practice || action) {
      spells.push({
        name: header.name,
        arcanum: header.arcanum,
        level: header.level,
        practice: practice || "Unknown",
        action: action || "Unknown",
        duration: duration || "Unknown",
        aspect: aspect || "Unknown",
        cost: cost || "None",
        description,
        rotes,
        pageStart: page,
      })
    } else {
      reviewQueue.push({
        page,
        rawText: spellText.slice(0, 300),
        reason: `Missing: ${!practice ? "practice " : ""}${!action ? "action " : ""}`,
      })
    }
  }

  // --- Stats ---
  console.log(`\nParsed: ${spells.length} spells, ${reviewQueue.length} need review`)

  const byArcanum: Record<string, number> = {}
  for (const s of spells) byArcanum[s.arcanum] = (byArcanum[s.arcanum] || 0) + 1
  console.log("\nBy arcanum:")
  for (const [a, c] of Object.entries(byArcanum).sort((a, b) => b[1] - a[1]))
    console.log(`  ${a}: ${c}`)

  const byLevel: Record<number, number> = {}
  for (const s of spells) byLevel[s.level] = (byLevel[s.level] || 0) + 1
  console.log("\nBy level:")
  for (const [l, c] of Object.entries(byLevel).sort((a, b) => Number(a[0]) - Number(b[0])))
    console.log(`  ${l} dots: ${c}`)

  const totalRotes = spells.reduce((sum, s) => sum + s.rotes.length, 0)
  const emptyPools = spells.reduce((sum, s) => sum + s.rotes.filter(r => !r.dicePool || r.dicePool.length < 5).length, 0)
  const unknownFields = spells.filter(s => s.practice === "Unknown" || s.action === "Unknown" || s.duration === "Unknown" || s.aspect === "Unknown")

  console.log(`\nTotal rotes: ${totalRotes}`)
  console.log(`Rotes with empty/short dice pools: ${emptyPools}`)
  console.log(`Spells with any Unknown field: ${unknownFields.length}`)

  // Quality check: names with issues
  const badNames = spells.filter(s => /\n/.test(s.name) || /^[a-z]/.test(s.name) || s.name.length < 4)
  console.log(`Spells with suspicious names: ${badNames.length}`)

  // --- Write output ---
  await Bun.write(`${OUTPUT_DIR}spells.json`, JSON.stringify(spells, null, 2))
  console.log(`\nWrote data/spells.json`)

  if (reviewQueue.length > 0) {
    await Bun.write(`${OUTPUT_DIR}review-queue.json`, JSON.stringify(reviewQueue, null, 2))
    console.log(`Wrote data/review-queue.json (${reviewQueue.length} items)`)
  }
}

parseSpells()
