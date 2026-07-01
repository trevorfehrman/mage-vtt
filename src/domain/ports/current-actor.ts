import { Context } from "effect"
import type { PlayerId } from "../ids"

/**
 * The authenticated principal behind the current request (ADR-0004).
 *
 * `isDev` is the global god-mode tier, resolved once at auth from an env allowlist
 * — orthogonal to Session role. This tracer bullet only plumbs the identity;
 * `rolls.create` never exercises a bypass.
 */
export interface Actor {
  readonly userId: PlayerId
  readonly isDev: boolean
}

export class CurrentActor extends Context.Service<CurrentActor, Actor>()(
  "CurrentActor",
) {}
