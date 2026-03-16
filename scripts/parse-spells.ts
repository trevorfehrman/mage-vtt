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

// The 10 Arcana
const ARCANA = [
  "Death",
  "Fate",
  "Forces",
  "Life",
  "Matter",
  "Mind",
  "Prime",
  "Space",
  "Spirit",
  "Time",
] as const

type Arcanum = (typeof ARCANA)[number]

// The 5 Orders
const ORDERS = [
  "Adamantine Arrow",
  "Free Council",
  "Guardians of the Veil",
  "Mysterium",
  "Silver Ladder",
] as const

// Practices
const PRACTICES = [
  "Compelling",
  "Knowing",
  "Unveiling",
  "Ruling",
  "Shielding",
  "Veiling",
  "Fraying",
  "Perfecting",
  "Weaving",
  "Patterning",
  "Unraveling",
  "Making",
  "Unmaking",
] as const

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
  raw: string
}

interface ReviewItem {
  page: number
  rawText: string
  reason: string
}

// Count dots (• or *) in text
function countDots(text: string): number {
  const dots = text.match(/[•·]/g)
  return dots ? dots.length : 0
}

// Parse spell level from various formats: "Death •", "Death ••••", "Death 3"
function parseLevel(levelStr: string): number {
  const dots = countDots(levelStr)
  if (dots > 0) return dots

  const numMatch = levelStr.match(/(\d)/)
  if (numMatch) return parseInt(numMatch[1])

  return 0
}

// Extract a field value from text, handling line breaks
function extractField(text: string, field: string): string | null {
  // Match field name followed by colon and value (may span lines)
  const pattern = new RegExp(
    `${field}:\\s*(.+?)(?=\\n(?:Practice|Action|Duration|Aspect|Cost|[A-Z][a-z]+ Rote)|$)`,
    "s",
  )
  const match = text.match(pattern)
  if (!match) return null
  return match[1].trim().replace(/\s+/g, " ")
}

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

// Find all spell headers in the concatenated text
function findSpellHeaders(
  fullText: string,
): Array<{ name: string; arcanum: Arcanum; level: number; index: number }> {
  const headers: Array<{
    name: string
    arcanum: Arcanum
    level: number
    index: number
  }> = []

  for (const arcanum of ARCANA) {
    // Match patterns like "Spell Name (Death •)" or "Spell Name (Death ••••)"
    const pattern = new RegExp(
      `([A-Z][A-Za-z\\s'\\-]+?)\\s*\\(${arcanum}\\s+([•·]+|\\d)\\)`,
      "g",
    )
    let match
    while ((match = pattern.exec(fullText)) !== null) {
      const name = match[1].trim()
      const level = parseLevel(match[2])

      // Skip false positives (very long names are probably not spell names)
      if (name.length > 60 || name.length < 3) continue
      // Skip if the name contains common non-spell words
      if (/^(The|A|An|This|That|When|If|In|On|For)\s/.test(name) && name.split(" ").length > 5) continue

      headers.push({
        name,
        arcanum,
        level,
        index: match.index,
      })
    }
  }

  // Sort by position in text
  headers.sort((a, b) => a.index - b.index)

  return headers
}

// Extract rotes from a spell's text block
function extractRotes(text: string): Rote[] {
  const rotes: Rote[] = []

  for (const order of ORDERS) {
    const pattern = new RegExp(
      `${order}\\s+Rote:\\s*(.+?)\\nDice\\s*Pool:\\s*(.+?)(?=\\n(?:[A-Z]|$))`,
      "gs",
    )
    let match
    while ((match = pattern.exec(text)) !== null) {
      rotes.push({
        order,
        name: match[1].trim().replace(/\s+/g, " "),
        dicePool: match[2].trim().replace(/\s+/g, " ").replace(/-\s*/g, ""),
      })
    }
  }

  return rotes
}

// Find which page a text index falls on
function findPage(
  pageOffsets: Array<{ page: number; startIndex: number; endIndex: number }>,
  index: number,
): number {
  for (const po of pageOffsets) {
    if (index >= po.startIndex && index < po.endIndex) {
      return po.page
    }
  }
  return 0
}

async function parseSpells() {
  console.log("Loading pages...")
  const pages = await loadAllPages()
  console.log(`Loaded ${pages.length} pages`)

  // Concatenate all text with page boundary tracking
  let fullText = ""
  const pageOffsets: Array<{
    page: number
    startIndex: number
    endIndex: number
  }> = []

  for (const p of pages) {
    const start = fullText.length
    fullText += p.text + "\n\n"
    pageOffsets.push({ page: p.page, startIndex: start, endIndex: fullText.length })
  }

  console.log(`Total text: ${fullText.length} chars`)

  // Find all spell headers
  console.log("Finding spell headers...")
  const headers = findSpellHeaders(fullText)
  console.log(`Found ${headers.length} spell headers`)

  // Parse each spell
  const spells: Spell[] = []
  const reviewQueue: ReviewItem[] = []

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]
    const nextIndex = i + 1 < headers.length ? headers[i + 1].index : fullText.length
    const spellText = fullText.slice(header.index, nextIndex)

    const practice = extractField(spellText, "Practice")
    const action = extractField(spellText, "Action")
    const duration = extractField(spellText, "Duration")
    const aspect = extractField(spellText, "Aspect")
    const cost = extractField(spellText, "Cost")
    const rotes = extractRotes(spellText)

    const page = findPage(pageOffsets, header.index)

    // If we got at least practice and action, it's a real spell
    if (practice && action) {
      spells.push({
        name: header.name,
        arcanum: header.arcanum,
        level: header.level,
        practice,
        action,
        duration: duration || "Unknown",
        aspect: aspect || "Unknown",
        cost: cost || "None",
        description: spellText.slice(0, 500).replace(/\s+/g, " "),
        rotes,
        pageStart: page,
        raw: spellText,
      })
    } else {
      reviewQueue.push({
        page,
        rawText: spellText.slice(0, 300),
        reason: `Missing fields: ${!practice ? "practice " : ""}${!action ? "action " : ""}${!duration ? "duration " : ""}`,
      })
    }
  }

  // Write outputs
  console.log(`\nParsed: ${spells.length} spells, ${reviewQueue.length} need review`)

  // Stats by arcanum
  const byArcanum: Record<string, number> = {}
  for (const s of spells) {
    byArcanum[s.arcanum] = (byArcanum[s.arcanum] || 0) + 1
  }
  console.log("\nBy arcanum:")
  for (const [arcanum, count] of Object.entries(byArcanum).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${arcanum}: ${count}`)
  }

  // Stats by level
  const byLevel: Record<number, number> = {}
  for (const s of spells) {
    byLevel[s.level] = (byLevel[s.level] || 0) + 1
  }
  console.log("\nBy level:")
  for (const [level, count] of Object.entries(byLevel).sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  )) {
    console.log(`  ${level} dots: ${count}`)
  }

  // Total rotes
  const totalRotes = spells.reduce((sum, s) => sum + s.rotes.length, 0)
  console.log(`\nTotal rotes found: ${totalRotes}`)

  await Bun.write(
    `${OUTPUT_DIR}spells.json`,
    JSON.stringify(spells, null, 2),
  )
  console.log(`\nWrote data/spells.json`)

  if (reviewQueue.length > 0) {
    await Bun.write(
      `${OUTPUT_DIR}review-queue.json`,
      JSON.stringify(reviewQueue, null, 2),
    )
    console.log(`Wrote data/review-queue.json (${reviewQueue.length} items)`)
  }
}

parseSpells()
