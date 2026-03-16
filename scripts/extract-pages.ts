/**
 * Stage 1: Raw Text Extraction
 *
 * Extracts text from each page of the Mage: The Awakening 1e PDF
 * and saves it as individual JSON files in data/pages/.
 *
 * Usage: bun scripts/extract-pages.ts [path-to-pdf]
 *
 * Each output file contains:
 *   { page: number, text: string, charCount: number }
 *
 * Resumable: skips pages that already have output files unless --force is passed.
 */

import { getDocument, type TextItem } from "pdfjs-dist/legacy/build/pdf.mjs"

const PDF_PATH =
  process.argv[2] ||
  `${process.env.HOME}/Downloads/Mage the Awakening - Core Rulebook.pdf`
const OUTPUT_DIR = new URL("../data/pages/", import.meta.url).pathname
const FORCE = process.argv.includes("--force")

async function extractPages() {
  const file = Bun.file(PDF_PATH)
  if (!(await file.exists())) {
    console.error(`PDF not found: ${PDF_PATH}`)
    process.exit(1)
  }

  console.log(`Reading PDF: ${PDF_PATH}`)
  const buffer = new Uint8Array(await file.arrayBuffer())

  const doc = await getDocument({ data: buffer }).promise
  const totalPages = doc.numPages
  console.log(`Total pages: ${totalPages}`)

  let extracted = 0
  let skipped = 0
  let errors = 0

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const outPath = `${OUTPUT_DIR}${String(pageNum).padStart(3, "0")}.json`
    const outFile = Bun.file(outPath)

    if (!FORCE && (await outFile.exists())) {
      skipped++
      continue
    }

    try {
      const page = await doc.getPage(pageNum)
      const content = await page.getTextContent()

      // Reconstruct text with line breaks based on Y position changes
      let text = ""
      let lastY: number | null = null

      for (const item of content.items) {
        if (!("str" in item)) continue
        const textItem = item as TextItem

        if (lastY !== null && Math.abs(textItem.transform[5] - lastY) > 2) {
          text += "\n"
        }
        text += textItem.str
        lastY = textItem.transform[5]
      }

      const record = {
        page: pageNum,
        text: text.trim(),
        charCount: text.trim().length,
      }

      await Bun.write(outPath, JSON.stringify(record, null, 2))
      extracted++

      if (extracted % 50 === 0 || pageNum === totalPages) {
        console.log(
          `  Progress: page ${pageNum}/${totalPages} (${extracted} extracted, ${skipped} skipped, ${errors} errors)`,
        )
      }
    } catch (err) {
      errors++
      console.error(`  ERROR on page ${pageNum}:`, err)
      // Continue — don't fail the whole run
    }
  }

  console.log(
    `\nDone: ${extracted} extracted, ${skipped} skipped, ${errors} errors, ${totalPages} total`,
  )

  if (errors > 0) {
    console.log("Re-run with --force to retry failed pages")
  }
}

extractPages()
