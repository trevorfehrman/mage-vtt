import { Context, Effect, Schema } from "effect"

/**
 * Override provenance (ADR-0006).
 *
 * A structured marker stamped on Activity records produced by *bending a rule* —
 * a Storyteller or Dev acting as another player's character, or a repair.
 * Normal actions leave it absent; it fires on bypass, not identity (an ST/Dev
 * casting their own character is unmarked). `requireOwnedCharacter` records the
 * bypass; the `GameStore` write helpers stamp every record the mutation writes.
 */

export const OverrideKind = Schema.Literals([
  "godmode-action",
  "storyteller-action",
  "repair",
])
export type OverrideKind = typeof OverrideKind.Type

export class OverrideMarker extends Schema.Class<OverrideMarker>("OverrideMarker")({
  invokedByUserId: Schema.String,
  invokedByName: Schema.String,
  kind: OverrideKind,
}) {}

/**
 * Request-scoped record of whether the current mutation bent a rule.
 *
 * `Authz` helpers `record` a bypass; the `GameStore` write helpers `read` it and
 * stamp every record they write (structural, not copy-paste — a flow author can't
 * forget to mark a privileged action). Provided per-request by each adapter,
 * seeded absent.
 */
export class OverrideStamp extends Context.Service<
  OverrideStamp,
  {
    readonly record: (marker: OverrideMarker) => Effect.Effect<void>
    readonly read: Effect.Effect<OverrideMarker | null>
  }
>()("OverrideStamp") {}

/**
 * Build a request-scoped `OverrideStamp` backed by a single mutable cell, shared
 * by both adapters. `stamp` is the service to provide; `current()` lets a write
 * helper read the marker synchronously when building a row.
 */
export const makeOverrideStamp = () => {
  let current: OverrideMarker | null = null
  const stamp = OverrideStamp.of({
    record: (marker) =>
      Effect.sync(() => {
        current = marker
      }),
    read: Effect.sync(() => current),
  })
  return { stamp, current: () => current }
}
