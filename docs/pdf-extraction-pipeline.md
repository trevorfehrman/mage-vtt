# PDF Extraction Pipeline

## Source Material
- **Mage: The Awakening 1st Edition Core Rulebook** (402 pages, 47MB)
- Located: `~/Downloads/Mage the Awakening - Core Rulebook.pdf`
- Text extracts cleanly (digital PDF, not OCR)

## Book Structure

| Section | Pages (approx) | Content Type |
|---|---|---|
| Cover/Credits/Fiction | 1-30 | Skip |
| Introduction + Lexicon | 14-20 | Glossary (structured) + lore (RAG) |
| Ch 1: Mage Society | 21-65 | Lore (RAG) — Paths, Orders, Consilium |
| Ch 2: Character | 66-130 | Rules (structured) — attributes, skills, merits, creation |
| Ch 3: Magic | 131-290 | Spells/Rotes (structured) + casting rules (RAG) |
| Ch 4: Storytelling | 291-340 | Lore + rules (RAG) — antagonists, conflict |
| Appendix 1: Legacies | 341-370 | Advanced options (structured + RAG) |
| Appendix 2: Boston | 371-402 | Skip — sample setting |

## Pipeline Stages

### Stage 1: Raw Text Extraction
- **Input**: PDF file
- **Output**: `data/pages/001.json` through `data/pages/402.json`
- **Tool**: PDF parser (pdf-parse or pdfjs-dist) via Bun script
- **Recovery**: Re-run failed pages individually

### Stage 2: Structured Data Parsing
- **Input**: `data/pages/*.json`
- **Output**:
  - `data/spells.json` — every spell/rote with structured fields
  - `data/character-rules.json` — point allocations, dot limits, formulas
  - `data/path-data.json` — path/arcana mappings, resistance bonuses
  - `data/review-queue.json` — records that didn't parse cleanly
- **Validation**: Effect Schema validates each record
- **Spell fields**: name, arcanum, level (dots), practice, action, duration, aspect, cost, description, rote name, rote order, rote dice pool

### Stage 3: Smart Chunking
- **Input**: `data/pages/*.json` + structured data from Stage 2
- **Output**: `data/chunks.json` — array of chunks with metadata
- **Chunk metadata**: chapter, section, page range, content type (rules|lore|glossary|spell-description)
- **Chunk size**: ~500-1000 tokens per chunk, split on section headers
- **Override filter**: Homebrew replacements EXCLUDE corresponding base rules sections
  - Tick initiative system REPLACES book's static initiative — remove those chunks
  - Any future homebrew overrides follow same pattern
- **Include BOTH rules AND lore/flavor** — both serve the AI chatbot

### Stage 4: Embed + Upload to Convex
- **Input**: `data/chunks.json` + `data/spells.json` + `data/character-rules.json`
- **Output**: Convex tables populated
- **Embedding model**: OpenAI `text-embedding-3-small` (~$0.01 for full book)
- **Same model used locally (seeding) and server-side (queries)**
- **Batched**: Process N chunks at a time, track progress, resume from last batch
- **Idempotent**: Can re-run without duplicating data

## Embedding Strategy

**Model**: OpenAI `text-embedding-3-small`
- Same API for local Bun scripts AND Convex actions at query time
- Cost: ~$0.02 per 1M tokens (~$0.01 for full book, negligible for queries)
- Re-runnable cheaply during development iteration

**Why this model**:
- Convex vector search examples all use OpenAI embeddings
- Best quality/price ratio
- No model mismatch risk between seeding and querying
- Dense technical game rules text benefits from high-quality embeddings

## Anti-Hallucination Design

1. **Single edition only**: Only 1e Awakening content in the corpus. No 2e, no Ascension, no other WoD games.
2. **Homebrew overrides remove base rules**: When the tick initiative system overrides static initiative, the original initiative text is excluded from chunks entirely.
3. **Metadata tagging**: Every chunk tagged with source (core-rules, homebrew, lore, glossary) so the AI can cite sources.
4. **Structured data for validation**: Spell lookups, dice pool calculations, and character rules use structured data from Convex tables — not RAG. RAG is for natural language questions only.

## Convex Tables

### `rotes` (structured, from Stage 2)
- name, arcanum, level, practice, action, duration, aspect, cost
- rote_name, rote_order, rote_dice_pool
- description (text)

### `characterRules` (structured, from Stage 2)
- rule_type (attribute_allocation, skill_allocation, dot_limit, derived_stat, xp_cost)
- data (JSON — the specific rule)

### `pathData` (structured, from Stage 2)
- path, ruling_arcana, common_arcana, inferior_arcanum, resistance_bonus

### `ruleChunks` (RAG, from Stage 4)
- text, embedding (vector), chapter, section, page_range, content_type, source
