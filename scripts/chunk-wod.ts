/**
 * Chunk the WoD Core Rulebook for RAG
 *
 * Same approach as chunk-text.ts but for the WoD core book.
 * Focuses on mechanical chapters: Advantages, Merits, Dramatic Systems, Combat.
 *
 * Usage: bun scripts/chunk-wod.ts
 */

const PAGES_DIR = new URL("../data/wod-pages/", import.meta.url).pathname
const OUTPUT_DIR = new URL("../data/", import.meta.url).pathname

const TARGET_CHUNK_SIZE = 1800
const MAX_CHUNK_SIZE = 3000
const MIN_CHUNK_SIZE = 400

interface Section {
  name: string
  chapter: string
  pageStart: number
  pageEnd: number
  contentType: string
  skip?: boolean
}

const SECTIONS: Section[] = [
  { name: "Cover/Credits/Fiction", chapter: "Front", pageStart: 1, pageEnd: 14, contentType: "skip", skip: true },
  { name: "Secret History", chapter: "Chapter 1", pageStart: 15, pageEnd: 40, contentType: "lore" },
  { name: "Attributes", chapter: "Chapter 2", pageStart: 41, pageEnd: 52, contentType: "rules" },
  { name: "Skills", chapter: "Chapter 3", pageStart: 53, pageEnd: 88, contentType: "rules" },
  { name: "Advantages", chapter: "Chapter 4", pageStart: 89, pageEnd: 106, contentType: "rules" },
  { name: "Merits", chapter: "Chapter 5", pageStart: 107, pageEnd: 118, contentType: "rules" },
  { name: "Dramatic Systems", chapter: "Chapter 6", pageStart: 119, pageEnd: 148, contentType: "rules" },
  // Skip standard initiative section (replaced by homebrew tick system)
  { name: "Initiative (OVERRIDDEN)", chapter: "Chapter 7", pageStart: 151, pageEnd: 152, contentType: "skip", skip: true },
  { name: "Combat", chapter: "Chapter 7", pageStart: 149, pageEnd: 186, contentType: "rules" },
  { name: "Storytelling", chapter: "Chapter 8", pageStart: 187, pageEnd: 226, contentType: "storytelling" },
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
  source: "wod-core"
}

async function loadPage(pageNum: number): Promise<string> {
  const path = `${PAGES_DIR}${String(pageNum).padStart(3, "0")}.json`
  const file = Bun.file(path)
  if (!(await file.exists())) return ""
  const data = await file.json()
  return data.text
}

function splitAtBoundaries(text: string): string[] {
  let parts = text.split(/\n{2,}/)
  const result: string[] = []
  for (const part of parts) {
    if (part.length > MAX_CHUNK_SIZE) {
      result.push(...part.split(/\n/))
    } else {
      result.push(part)
    }
  }
  const final: string[] = []
  for (const part of result) {
    if (part.length > MAX_CHUNK_SIZE) {
      final.push(...(part.match(/[^.!?]+[.!?]+/g) || [part]))
    } else {
      final.push(part)
    }
  }
  return final.filter((p) => p.trim().length > 0)
}

function mergeIntoChunks(paragraphs: string[]): string[] {
  const chunks: string[] = []
  let current = ""
  for (const para of paragraphs) {
    if (current.length + para.length > MAX_CHUNK_SIZE && current.length >= MIN_CHUNK_SIZE) {
      chunks.push(current.trim())
      current = para
    } else if (current.length + para.length > TARGET_CHUNK_SIZE && current.length >= MIN_CHUNK_SIZE) {
      chunks.push(current.trim())
      current = para
    } else {
      current += (current ? "\n\n" : "") + para
    }
  }
  if (current.trim().length >= MIN_CHUNK_SIZE) {
    chunks.push(current.trim())
  } else if (current.trim().length > 0 && chunks.length > 0) {
    chunks[chunks.length - 1] += "\n\n" + current.trim()
  } else if (current.trim().length > 0) {
    chunks.push(current.trim())
  }
  return chunks
}

async function main() {
  console.log("Chunking WoD Core Rulebook...")

  const allChunks: Chunk[] = []
  let chunkId = 2000 // start at 2000 to avoid collision with Mage chunks

  for (const section of SECTIONS) {
    if (section.skip) {
      console.log(`  SKIP: ${section.name}`)
      continue
    }

    let sectionText = ""
    for (let p = section.pageStart; p <= section.pageEnd; p++) {
      sectionText += (await loadPage(p)) + "\n\n"
    }

    if (sectionText.trim().length < 100) continue

    const paragraphs = splitAtBoundaries(sectionText)
    const textChunks = mergeIntoChunks(paragraphs)

    for (const text of textChunks) {
      chunkId++
      allChunks.push({
        id: `chunk-${String(chunkId).padStart(4, "0")}`,
        text,
        chapter: section.chapter,
        section: section.name,
        contentType: section.contentType,
        pageStart: section.pageStart,
        pageEnd: section.pageEnd,
        charCount: text.length,
        source: "wod-core",
      })
    }

    console.log(`  ${section.name}: ${textChunks.length} chunks`)
  }

  const avgSize = Math.round(allChunks.reduce((s, c) => s + c.charCount, 0) / allChunks.length)
  console.log(`\nTotal: ${allChunks.length} chunks, avg ${avgSize} chars`)

  await Bun.write(`${OUTPUT_DIR}wod-chunks.json`, JSON.stringify(allChunks, null, 2))
  console.log("Wrote data/wod-chunks.json")
}

main()
