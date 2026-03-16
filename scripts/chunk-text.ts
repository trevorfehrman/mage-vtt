/**
 * Stage 3: Smart Chunking for RAG
 *
 * Reads extracted pages and creates semantic chunks with metadata
 * for vector search. Includes both rules AND lore text.
 *
 * Filters out:
 *   - Sections overridden by homebrew rules
 *   - Pure art/fiction pages (cover, in-character journal)
 *   - The Boston appendix (sample setting, not relevant)
 *
 * Outputs: data/chunks.json
 *
 * Usage: bun scripts/chunk-text.ts
 */

const PAGES_DIR = new URL("../data/pages/", import.meta.url).pathname
const OUTPUT_DIR = new URL("../data/", import.meta.url).pathname

// --- Book structure: page ranges and their content types ---
interface Section {
  name: string
  chapter: string
  pageStart: number
  pageEnd: number
  contentType: "rules" | "lore" | "glossary" | "creation" | "spells" | "storytelling" | "skip"
  override?: string // if set, this section is replaced by homebrew
}

const SECTIONS: Section[] = [
  // Skip cover, credits, fiction
  { name: "Cover and Credits", chapter: "Front Matter", pageStart: 1, pageEnd: 13, contentType: "skip" },
  // Introduction
  { name: "Introduction", chapter: "Introduction", pageStart: 14, pageEnd: 15, contentType: "lore" },
  { name: "How to Use This Book", chapter: "Introduction", pageStart: 16, pageEnd: 16, contentType: "rules" },
  { name: "Lexicon", chapter: "Introduction", pageStart: 17, pageEnd: 20, contentType: "glossary" },
  // Chapter One: Mage Society (lore-heavy, valuable for AI brainstorming)
  { name: "The Awakened World", chapter: "Chapter One", pageStart: 21, pageEnd: 30, contentType: "lore" },
  { name: "The Five Paths", chapter: "Chapter One", pageStart: 31, pageEnd: 40, contentType: "lore" },
  { name: "The Five Orders", chapter: "Chapter One", pageStart: 41, pageEnd: 50, contentType: "lore" },
  { name: "Consilium and Cabals", chapter: "Chapter One", pageStart: 51, pageEnd: 55, contentType: "lore" },
  { name: "Lex Magicus", chapter: "Chapter One", pageStart: 56, pageEnd: 58, contentType: "lore" },
  { name: "Realms Invisible", chapter: "Chapter One", pageStart: 59, pageEnd: 63, contentType: "lore" },
  // Chapter Two: Character
  { name: "Character Creation Overview", chapter: "Chapter Two", pageStart: 64, pageEnd: 69, contentType: "creation" },
  { name: "Character Creation Steps", chapter: "Chapter Two", pageStart: 70, pageEnd: 75, contentType: "creation" },
  { name: "Gnosis", chapter: "Chapter Two", pageStart: 76, pageEnd: 78, contentType: "rules" },
  { name: "Merits", chapter: "Chapter Two", pageStart: 79, pageEnd: 100, contentType: "rules" },
  { name: "Mage Traits", chapter: "Chapter Two", pageStart: 101, pageEnd: 110, contentType: "rules" },
  // Combat — PARTIALLY overridden by homebrew initiative
  { name: "Combat Rules", chapter: "Chapter Two", pageStart: 111, pageEnd: 115, contentType: "rules" },
  { name: "Initiative (OVERRIDDEN)", chapter: "Chapter Two", pageStart: 116, pageEnd: 117, contentType: "skip", override: "tick-initiative" },
  { name: "Combat Actions and Resolution", chapter: "Chapter Two", pageStart: 118, pageEnd: 125, contentType: "rules" },
  // Chapter Three: Magic
  { name: "Spellcasting Rules", chapter: "Chapter Three", pageStart: 126, pageEnd: 131, contentType: "rules" },
  { name: "Laws of Higher Realities", chapter: "Chapter Three", pageStart: 132, pageEnd: 132, contentType: "rules" },
  { name: "Death Arcanum", chapter: "Chapter Three", pageStart: 133, pageEnd: 147, contentType: "spells" },
  { name: "Fate Arcanum", chapter: "Chapter Three", pageStart: 148, pageEnd: 165, contentType: "spells" },
  { name: "Forces Arcanum", chapter: "Chapter Three", pageStart: 166, pageEnd: 183, contentType: "spells" },
  { name: "Life Arcanum", chapter: "Chapter Three", pageStart: 184, pageEnd: 197, contentType: "spells" },
  { name: "Matter Arcanum", chapter: "Chapter Three", pageStart: 198, pageEnd: 210, contentType: "spells" },
  { name: "Mind Arcanum", chapter: "Chapter Three", pageStart: 211, pageEnd: 226, contentType: "spells" },
  { name: "Prime Arcanum", chapter: "Chapter Three", pageStart: 227, pageEnd: 238, contentType: "spells" },
  { name: "Space Arcanum", chapter: "Chapter Three", pageStart: 239, pageEnd: 250, contentType: "spells" },
  { name: "Spirit Arcanum", chapter: "Chapter Three", pageStart: 251, pageEnd: 264, contentType: "spells" },
  { name: "Time Arcanum", chapter: "Chapter Three", pageStart: 265, pageEnd: 275, contentType: "spells" },
  { name: "Resonance and Scrutiny", chapter: "Chapter Three", pageStart: 276, pageEnd: 282, contentType: "rules" },
  { name: "Enchanted Items and Demesnes", chapter: "Chapter Three", pageStart: 283, pageEnd: 288, contentType: "rules" },
  { name: "Creative Thaumaturgy", chapter: "Chapter Three", pageStart: 289, pageEnd: 295, contentType: "rules" },
  // Chapter Four: Storytelling
  { name: "Storytelling Advice", chapter: "Chapter Four", pageStart: 296, pageEnd: 320, contentType: "storytelling" },
  { name: "Antagonists", chapter: "Chapter Four", pageStart: 321, pageEnd: 345, contentType: "lore" },
  // Appendix One: Legacies
  { name: "Legacies", chapter: "Appendix One", pageStart: 346, pageEnd: 370, contentType: "rules" },
  // Appendix Two: Boston — skip (sample setting)
  { name: "Boston Setting (SKIP)", chapter: "Appendix Two", pageStart: 371, pageEnd: 402, contentType: "skip" },
]

interface Chunk {
  id: string
  text: string
  chapter: string
  section: string
  contentType: string
  pageStart: number
  pageEnd: number
  charCount: number
  source: "core-rules" | "homebrew"
}

// Target chunk size in characters (~300-600 tokens ≈ 1200-2400 chars)
const TARGET_CHUNK_SIZE = 1800
const MAX_CHUNK_SIZE = 3000
const MIN_CHUNK_SIZE = 400

async function loadPage(pageNum: number): Promise<string> {
  const path = `${PAGES_DIR}${String(pageNum).padStart(3, "0")}.json`
  const file = Bun.file(path)
  if (!(await file.exists())) return ""
  const data = await file.json()
  return data.text
}

/** Split text at paragraph or section boundaries */
function splitAtBoundaries(text: string): string[] {
  // Split on double newlines first
  let parts = text.split(/\n{2,}/)

  // If any part is still too large, split on single newlines
  const result: string[] = []
  for (const part of parts) {
    if (part.length > MAX_CHUNK_SIZE) {
      const subParts = part.split(/\n/)
      result.push(...subParts)
    } else {
      result.push(part)
    }
  }

  // If STILL too large, split on sentence boundaries
  const final: string[] = []
  for (const part of result) {
    if (part.length > MAX_CHUNK_SIZE) {
      const sentences = part.match(/[^.!?]+[.!?]+/g) || [part]
      final.push(...sentences)
    } else {
      final.push(part)
    }
  }

  return final.filter((p) => p.trim().length > 0)
}

/** Merge small paragraphs into chunks of target size */
function mergeIntoChunks(paragraphs: string[], targetSize: number): string[] {
  const chunks: string[] = []
  let current = ""

  for (const para of paragraphs) {
    if (current.length + para.length > MAX_CHUNK_SIZE && current.length >= MIN_CHUNK_SIZE) {
      chunks.push(current.trim())
      current = para
    } else if (current.length + para.length > targetSize && current.length >= MIN_CHUNK_SIZE) {
      chunks.push(current.trim())
      current = para
    } else {
      current += (current ? "\n\n" : "") + para
    }
  }

  if (current.trim().length >= MIN_CHUNK_SIZE) {
    chunks.push(current.trim())
  } else if (current.trim().length > 0 && chunks.length > 0) {
    // Append small remainder to last chunk
    chunks[chunks.length - 1] += "\n\n" + current.trim()
  } else if (current.trim().length > 0) {
    chunks.push(current.trim())
  }

  return chunks
}

async function chunkText() {
  console.log("Loading pages and chunking by section...")

  const allChunks: Chunk[] = []
  let chunkId = 0

  for (const section of SECTIONS) {
    if (section.contentType === "skip") {
      if (section.override) {
        console.log(`  SKIP (overridden by homebrew): ${section.name}`)
      } else {
        console.log(`  SKIP: ${section.name}`)
      }
      continue
    }

    // Load all pages for this section
    let sectionText = ""
    for (let p = section.pageStart; p <= section.pageEnd; p++) {
      const pageText = await loadPage(p)
      sectionText += pageText + "\n\n"
    }

    if (sectionText.trim().length < 100) {
      console.log(`  EMPTY: ${section.name}`)
      continue
    }

    // Split into paragraphs and merge into chunks
    const paragraphs = splitAtBoundaries(sectionText)
    const textChunks = mergeIntoChunks(paragraphs, TARGET_CHUNK_SIZE)

    for (let i = 0; i < textChunks.length; i++) {
      chunkId++
      const chunk: Chunk = {
        id: `chunk-${String(chunkId).padStart(4, "0")}`,
        text: textChunks[i],
        chapter: section.chapter,
        section: section.name,
        contentType: section.contentType,
        pageStart: section.pageStart,
        pageEnd: section.pageEnd,
        charCount: textChunks[i].length,
        source: "core-rules",
      }
      allChunks.push(chunk)
    }

    console.log(
      `  ${section.name}: ${textChunks.length} chunks (${sectionText.trim().length} chars)`,
    )
  }

  // Add homebrew rules as chunks
  const homebrewFile = Bun.file(`${OUTPUT_DIR}homebrew-rules.json`)
  if (await homebrewFile.exists()) {
    const homebrew = await homebrewFile.json()

    if (homebrew.initiative) {
      chunkId++
      const initText = [
        `HOMEBREW RULE: ${homebrew.initiative.name}`,
        "",
        homebrew.initiative.description,
        "",
        `Setup: ${homebrew.initiative.system.setup}`,
        "",
        `Acting: ${homebrew.initiative.system.acting}`,
        "",
        `Tiebreakers (in order): ${homebrew.initiative.system.tiebreakers.join(" > ")}`,
        "",
        "Action Tick Costs:",
        ...Object.entries(homebrew.initiative.system.actionCosts).map(
          ([action, cost]: [string, any]) => {
            if (typeof cost === "number") return `  - ${action}: ${cost} ticks`
            if (cost.min !== undefined) return `  - ${action}: ${cost.min}-${cost.max} ticks (${cost.effect})`
            return `  - ${action}: ${cost.base || 0} ticks${cost.note ? ` (${cost.note})` : ""}`
          },
        ),
        "",
        `Resolution: ${homebrew.initiative.system.resolution}`,
      ].join("\n")

      allChunks.push({
        id: `chunk-${String(chunkId).padStart(4, "0")}`,
        text: initText,
        chapter: "Homebrew",
        section: "Tick-Based Initiative",
        contentType: "rules",
        pageStart: 0,
        pageEnd: 0,
        charCount: initText.length,
        source: "homebrew",
      })
      console.log(`  Homebrew: Tick-Based Initiative (1 chunk)`)
    }
  }

  // Add glossary entries as individual chunks (high value for RAG)
  const glossaryChunks = allChunks.filter(
    (c) => c.contentType === "glossary",
  )

  // Stats
  console.log(`\n--- Summary ---`)
  console.log(`Total chunks: ${allChunks.length}`)

  const byType: Record<string, number> = {}
  for (const c of allChunks) byType[c.contentType] = (byType[c.contentType] || 0) + 1
  console.log("By type:")
  for (const [t, n] of Object.entries(byType)) console.log(`  ${t}: ${n}`)

  const bySource: Record<string, number> = {}
  for (const c of allChunks) bySource[c.source] = (bySource[c.source] || 0) + 1
  console.log("By source:")
  for (const [s, n] of Object.entries(bySource)) console.log(`  ${s}: ${n}`)

  const avgSize = Math.round(
    allChunks.reduce((s, c) => s + c.charCount, 0) / allChunks.length,
  )
  const minSize = Math.min(...allChunks.map((c) => c.charCount))
  const maxSize = Math.max(...allChunks.map((c) => c.charCount))
  console.log(`Chunk sizes: avg=${avgSize}, min=${minSize}, max=${maxSize}`)

  const totalChars = allChunks.reduce((s, c) => s + c.charCount, 0)
  console.log(`Total text: ${totalChars} chars (~${Math.round(totalChars / 4)} tokens)`)

  await Bun.write(`${OUTPUT_DIR}chunks.json`, JSON.stringify(allChunks, null, 2))
  console.log(`\nWrote data/chunks.json`)
}

chunkText()
