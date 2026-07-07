import { Context, Schema } from "effect"
import { PlayerId } from "../ids"

/**
 * The authenticated principal behind the current request (ADR-0004).
 *
 * `isDev` is the global god-mode tier, resolved once at auth from an env allowlist
 * — orthogonal to Session role. This tracer bullet only plumbs the identity;
 * `rolls.create` never exercises a bypass.
 */
export const Actor = Schema.Struct({
  userId: PlayerId,
  isDev: Schema.Boolean,
})
export type Actor = typeof Actor.Type

export class CurrentActor extends Context.Service<CurrentActor, Actor>()(
  "CurrentActor",
) {}
