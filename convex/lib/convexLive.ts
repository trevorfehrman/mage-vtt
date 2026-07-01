/**
 * ConvexLive adapter (ADR-0004): the production `GameStore` / `CurrentActor` /
 * `OverrideStamp` implementation, backed by a request-scoped Convex `ctx` + the
 * authenticated user. Kept honest against `InMemory` by the conformance test.
 *
 * Lives in the Convex bundle (imports `ctx.db`) but speaks Effect-Schema domain
 * mirrors, decoded here — the domain never sees Convex's `Doc<T>`.
 */

import { Clock, Effect, Layer } from "effect"
import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import { PlayerId, MessageId, RollId, SessionId } from "../../src/domain/ids"
import { NotAMember } from "../../src/domain/authz"
import { Membership } from "../../src/domain/membership"
import {
  OverrideMarker,
  OverrideStamp,
  makeOverrideStamp,
} from "../../src/domain/override"
import { CurrentActor, type Actor } from "../../src/domain/ports/current-actor"
import {
  GameStore,
  type MessageDraft,
  type RollDraft,
} from "../../src/domain/ports/game-store"

/** Minimal shape of the authenticated user the seam needs. */
interface AuthUser {
  readonly _id: string
}

/**
 * Global god-mode allowlist, resolved once at auth from an env var
 * (`DEV_USER_IDS`, comma-separated). Orthogonal to Session role.
 */
const isDevUser = (userId: string): boolean => {
  const raw = process.env.DEV_USER_IDS ?? ""
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .includes(userId)
}

const overrideToDoc = (marker: OverrideMarker | null) =>
  marker
    ? {
        invokedByUserId: marker.invokedByUserId,
        invokedByName: marker.invokedByName,
        kind: marker.kind,
      }
    : undefined

export const convexLive = (
  ctx: MutationCtx,
  user: AuthUser,
): Layer.Layer<GameStore | CurrentActor | OverrideStamp> => {
  // Translate a domain-branded session id back into a Convex `Id<"sessions">` at
  // the adapter boundary. `normalizeId` validates the string belongs to the table
  // (no unchecked cast); a null here means a malformed id slipped past the
  // `v.id("sessions")` arg validator — a bug, so we fail loudly.
  const sessionRef = (sessionId: string): Id<"sessions"> => {
    const id = ctx.db.normalizeId("sessions", sessionId)
    if (id === null) {
      throw new Error(`Not a valid sessions id: ${sessionId}`)
    }
    return id
  }

  // Request-scoped record of a bent rule (ADR-0006). Authz helpers `record` into
  // it; the write helpers `read` it and stamp. Never set by rolls.create.
  const override = makeOverrideStamp()

  const actor: Actor = {
    userId: PlayerId.make(user._id),
    isDev: isDevUser(user._id),
  }

  const gameStore = GameStore.of({
    getMembership: (sessionId, userId) =>
      Effect.gen(function* () {
        const rows = yield* Effect.promise(() =>
          ctx.db
            .query("sessionMembers")
            .withIndex("by_sessionId", (q) =>
              q.eq("sessionId", sessionRef(sessionId)),
            )
            .collect(),
        )
        const row = rows.find((m) => m.userId === userId)
        if (!row) {
          return yield* new NotAMember({ sessionId, userId })
        }
        // Decode the Convex row into the domain mirror (compound-key identity).
        return new Membership({
          userId: PlayerId.make(row.userId),
          sessionId: SessionId.make(sessionId),
          role: row.role,
          displayName: row.displayName,
        })
      }),

    insertRoll: (draft: RollDraft) =>
      Effect.gen(function* () {
        const timestamp = yield* Clock.currentTimeMillis
        const r = draft.result
        const marker = overrideToDoc(override.current())
        const id = yield* Effect.promise(() =>
          ctx.db.insert("diceRolls", {
            sessionId: sessionRef(draft.sessionId),
            userId: draft.member.userId,
            displayName: draft.member.displayName,
            components: draft.components.map((c) => ({ ...c })),
            poolSize: r.poolSize,
            rolls: [...r.rolls],
            explosions: [...r.explosions],
            roteRerolls: [...r.roteRerolls],
            successes: r.successes,
            isChanceDie: r.isChanceDie,
            isDramaticFailure: r.isDramaticFailure,
            isExceptionalSuccess: r.isExceptionalSuccess,
            visibility: r.visibility,
            againThreshold: r.againThreshold,
            isRoteAction: r.isRoteAction,
            summary: draft.summary,
            // Only present when a rule was bent (ADR-0006) — omit the key entirely
            // otherwise, to satisfy exactOptionalPropertyTypes.
            ...(marker ? { override: marker } : {}),
            timestamp,
          }),
        )
        return RollId.make(id)
      }),

    insertMessage: (draft: MessageDraft) =>
      Effect.gen(function* () {
        const timestamp = yield* Clock.currentTimeMillis
        const id = yield* Effect.promise(() =>
          ctx.db.insert("messages", {
            sessionId: sessionRef(draft.sessionId),
            senderId: draft.sender.userId,
            senderName: draft.sender.displayName,
            text: draft.text,
            visibilityType: draft.visibility,
            ...(draft.whisperTargetId
              ? { whisperTargetId: draft.whisperTargetId }
              : {}),
            timestamp,
          }),
        )
        return MessageId.make(id)
      }),
  })

  return Layer.mergeAll(
    Layer.succeed(GameStore, gameStore),
    Layer.succeed(CurrentActor, actor),
    Layer.succeed(OverrideStamp, override.stamp),
  )
}
