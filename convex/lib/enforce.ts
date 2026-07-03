/**
 * The single Convex entry point for enforced game logic (ADR-0004).
 *
 * `enforcedMutation` captures the repeated dance — authenticate once, build the
 * `ConvexLive` layer, `Effect.provide` exactly once, run through the kept
 * `runConvexEffect` bridge. A new-flow author supplies only a domain `Effect` and
 * its args; auth, authorization, persistence mapping, the Activity-Log line, and
 * error mapping all come from the seam.
 */

import { Effect } from "effect"
import type { ObjectType, PropertyValidators } from "convex/values"
import { mutation } from "../_generated/server"
import type { MutationCtx } from "../_generated/server"
import { requireUser } from "./auth"
import { runConvexEffect } from "./effect"
import { convexLive } from "./convexLive"
import type { OverrideStamp } from "../../src/domain/override"
import type { CurrentActor } from "../../src/domain/ports/current-actor"
import type { GameStore } from "../../src/domain/ports/game-store"

/**
 * Turn a domain flow into a Convex mutation handler: auth once, build the
 * per-request `ConvexLive` layer, `Effect.provide` once, run through the bridge.
 * `ctx` is the concrete generated `MutationCtx`, so `convexLive` and the handler
 * share one ctx identity.
 */
const enforcedHandler =
  <Args extends PropertyValidators, A, E>(
    flow: (
      args: ObjectType<Args>,
    ) => Effect.Effect<A, E, GameStore | CurrentActor | OverrideStamp>,
  ) =>
  async (ctx: MutationCtx, args: ObjectType<Args>): Promise<A> => {
    const user = await requireUser(ctx) // auth, once
    const layer = convexLive(ctx, user) // both ports, per-request
    return runConvexEffect(flow(args).pipe(Effect.provide(layer)))
  }

/**
 * Define an enforced Convex mutation from a validator set and a domain flow.
 *
 * The `mutation` builder is invoked with the concrete `args` at the flow's call
 * site (not through a generic passthrough), which is what keeps Convex's function
 * inference — and its `ctx` type identity — sound.
 */
export function enforcedMutation<Args extends PropertyValidators, A, E>(config: {
  args: Args
  flow: (
    args: ObjectType<Args>,
  ) => Effect.Effect<A, E, GameStore | CurrentActor | OverrideStamp>
}) {
  return mutation({
    args: config.args,
    handler: enforcedHandler(config.flow),
  })
}
