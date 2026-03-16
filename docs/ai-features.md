# AI Features

Three planned AI integrations, all using Convex as the backend and Vercel AI SDK for streaming.

## 1. Storyteller Improv Chatbot

**What**: An AI assistant in the storyteller portal for on-the-fly narrative help.

**Use cases**:
- Generate NPC dialogue on demand
- Suggest encounter complications
- Create atmospheric descriptions
- Help improvise when players go off-script

**Architecture**:
- Vercel AI SDK (`@ai-sdk/anthropic`) for streaming responses
- Convex action calls Anthropic API
- Chat history persisted in Convex `messages` table
- Context includes: current scene, active characters, recent chat history

## 2. Rules RAG System

**What**: Ingest the Mage: The Awakening PDF rulebook, chunk and embed it, and provide natural language queries.

**Use cases**:
- "How does Forces 3 rote casting work?"
- "What's the penalty for maintaining too many active spells?"
- Powers the rote searchable dropdown (auto-complete from rules)
- Rules citations with page references

**Architecture**:
- PDF → text chunks (preprocessing step)
- Chunks embedded and stored in Convex `ruleChunks` table with vector embeddings
- Convex vector search for semantic retrieval
- Retrieved chunks fed as context to AI for natural language answers
- Both players and storyteller can query

## 3. Character Creation Assistant

**What**: Guided character creation with AI suggestions based on player choices.

**Use cases**:
- Suggest concepts based on chosen Path and Order
- Recommend attribute/skill distributions for a given concept
- Explain mechanical implications of choices
- Validate against game rules (e.g., can't have Arcanum higher than Gnosis)

**Architecture**:
- XState wizard flow (character creation state machine)
- At each step, optionally invoke AI for suggestions
- Rules RAG provides mechanical context
- Final character validated with Effect Schema before persisting to Convex
