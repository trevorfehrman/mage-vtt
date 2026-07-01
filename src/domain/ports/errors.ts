import { Schema } from "effect"

/**
 * Generic "a document the flow expected wasn't there" failure.
 *
 * Ports fail this instead of returning null (ADR-0010, "Not found" category).
 * It lives in `ports/` — beside the reads that raise it — and is imported by the
 * Convex-Effect bridge for error mapping. We deliberately do NOT proliferate
 * per-entity `CharacterNotFound` / `SessionNotFound` variants.
 */
export class DocumentNotFound extends Schema.TaggedErrorClass<DocumentNotFound>()(
  "DocumentNotFound",
  {
    table: Schema.String,
    id: Schema.String,
  },
) {}
