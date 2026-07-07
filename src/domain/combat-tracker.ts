import { Result, Schema } from "effect"
import { byChain } from "./initiative"
import { CombatId, SceneId, SessionId } from "./ids"

/**
 * The Combat tracker (issue #60, PRD #40): the FFX tick timeline. A Combat is
 * a child of a Scene — roster plus tick counters, not a mode (CONTEXT.md); at
 * most one active per Scene, serially many; the Storyteller ends it and the
 * Scene continues. The clock never advances itself (ADR-0015): the app
 * computes and displays, the ST bills every cost by hand.
 *
 * The roster is a two-kind participant union: sheet-backed rows reference a
 * real character (initiative stats read off the sheet at roll time) and
 * hand-entered rows carry the ST's hand-typed Dex/Composure/Wits/Willpower —
 * the paper NPC exactly as written, never touching a sheet. Participant rows
 * stay raw primitives (ADR-0011): the union is shared verbatim with the
 * `combats` table mirror in `tables.ts`, the `ParadoxPoolModifier` precedent.
 */

export const CombatStatus = Schema.Literals(["active", "ended"])
export type CombatStatus = typeof CombatStatus.Type

/** The hand-typed stat block of a paper NPC — the roll's and the chain's inputs. */
export const HandStats = Schema.Struct({
  dexterity: Schema.Number,
  composure: Schema.Number,
  wits: Schema.Number,
  willpower: Schema.Number,
})
export type HandStats = typeof HandStats.Type

/**
 * The initiative roll as it landed (d10 + Dexterity + Composure), plus the
 * chain stats as they stood at roll time — sheet-backed rows snapshot the
 * sheet here, so the tiebreak chain reads one place for both kinds forever
 * after (the sheet may change mid-fight; the rolled initiative may not).
 */
export const InitiativeStamp = Schema.Struct({
  roll: Schema.Number,
  total: Schema.Number,
  ...HandStats.fields,
})
export type InitiativeStamp = typeof InitiativeStamp.Type

/**
 * Aim/Dodge reminder chrome (issue #60): displayed memory, never an enforced
 * modifier (ADR-0015) — `aim` reads "+N dice on the next attack", `dodge`
 * "+N Defense". Any other cost the participant pays clears it.
 */
export const AimDodgeReminder = Schema.Struct({
  kind: Schema.Literals(["aim", "dodge"]),
  bonus: Schema.Number,
})
export type AimDodgeReminder = typeof AimDodgeReminder.Type

const participantFields = {
  /** Stable within the Combat, minted from the document's `seq` counter. */
  id: Schema.String,
  name: Schema.String,
  /** Present once initiative is rolled. */
  initiative: Schema.optionalKey(InitiativeStamp),
  /** Current Ticks owed — maintained by the flows, present once rolled. */
  ticks: Schema.optionalKey(Schema.Number),
  /** Ticks billed as action costs since rolling — survives re-resolution. */
  spentTicks: Schema.optionalKey(Schema.Number),
  reminder: Schema.optionalKey(AimDodgeReminder),
}

export const SheetParticipant = Schema.Struct({
  kind: Schema.Literals(["sheet"]),
  // A plain string, not `ConvexId("characters")` (the `userId` precedent):
  // the flows mint participants cast-free, and the server re-validates the
  // reference through `getSheet`'s `normalizeId` on every read.
  characterId: Schema.String,
  ...participantFields,
})
export type SheetParticipant = typeof SheetParticipant.Type

export const HandParticipant = Schema.Struct({
  kind: Schema.Literals(["manual"]),
  stats: HandStats,
  ...participantFields,
})
export type HandParticipant = typeof HandParticipant.Type

export const CombatParticipant = Schema.Union([SheetParticipant, HandParticipant])
export type CombatParticipant = typeof CombatParticipant.Type

/**
 * Seam mirror of a `combats` row (ADR-0004): decoded at the adapter from
 * Convex's `Doc<"combats">` — the domain never sees `Doc<T>`. `nextActorId`
 * is stamped by the flows each time the timeline changes: "who's up" is
 * `findNextActor`'s answer (chain, then a logged coinflip — issue #59),
 * settled server-side once so every screen highlights the same face.
 */
export class Combat extends Schema.Class<Combat>("Combat")({
  id: CombatId,
  sessionId: SessionId,
  sceneId: SceneId,
  status: CombatStatus,
  participants: Schema.Array(CombatParticipant),
  /** Participant-id mint: `p${seq}` was the last id issued. */
  seq: Schema.Number,
  nextActorId: Schema.optionalKey(Schema.String),
}) {}

// --- Pure rules leaves (ADR-0014) ---

/** A participant's row for the queue leaves, once rolled: stored Ticks plus
 * the chain stats the roll stamped. */
export const rolledEntries = (
  participants: ReadonlyArray<CombatParticipant>,
): ReadonlyArray<{
  participantId: string
  ticks: number
  wits: number
  dexterity: number
  composure: number
  willpower: number
}> =>
  participants.flatMap((p) =>
    p.initiative !== undefined && p.ticks !== undefined
      ? [
          {
            participantId: p.id,
            ticks: p.ticks,
            wits: p.initiative.wits,
            dexterity: p.initiative.dexterity,
            composure: p.initiative.composure,
            willpower: p.initiative.willpower,
          },
        ]
      : [],
  )

/**
 * The timeline's display order: rolled participants by Ticks, the settled
 * next actor leading any tie (fate already spoke — the display must not
 * contradict it), further ties by the house chain, residue by roster order;
 * unrolled participants trail in roster order, waiting on their d10.
 */
export const timeline = (combat: {
  participants: ReadonlyArray<CombatParticipant>
  nextActorId?: string | undefined
}): ReadonlyArray<CombatParticipant> =>
  combat.participants
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      if (a.p.ticks === undefined || b.p.ticks === undefined) {
        // Unrolled rows trail; among themselves, roster order.
        if (a.p.ticks === undefined && b.p.ticks === undefined) return a.i - b.i
        return a.p.ticks === undefined ? 1 : -1
      }
      if (a.p.ticks !== b.p.ticks) return a.p.ticks - b.p.ticks
      if (a.p.id === combat.nextActorId) return -1
      if (b.p.id === combat.nextActorId) return 1
      return byChain(a.p.initiative ?? {}, b.p.initiative ?? {}) || a.i - b.i
    })
    .map(({ p }) => p)

// --- Client seam decode (ADR-0005, the `decodeActiveScene` posture) ---

/**
 * The `combats` row as `api.combats.getActive` returns it — the same document
 * the server adapter decodes into `Combat`; this is that translation for the
 * client boundary. Extra columns (`_creationTime`, `startedAt`, `endedAt`)
 * fall away in the decode.
 */
const CombatWire = Schema.Struct({
  _id: Schema.String,
  sessionId: Schema.String,
  sceneId: Schema.String,
  status: CombatStatus,
  participants: Schema.Array(CombatParticipant),
  seq: Schema.Number,
  nextActorId: Schema.optionalKey(Schema.String),
})

const decodeWire = Schema.decodeUnknownResult(CombatWire)

/**
 * Decode the active-combat query off the wire. `null` passes through (no
 * Combat is an answer); a corrupt row degrades to `null` with a warning
 * rather than taking the tracker down.
 */
export const decodeActiveCombat = (input: unknown): Combat | null => {
  if (input === null || input === undefined) return null
  const wire = decodeWire(input)
  if (Result.isFailure(wire)) {
    console.warn("Combat: dropped an unreadable active-combat row", wire.failure)
    return null
  }
  const row = wire.success
  return new Combat({
    id: CombatId.make(row._id),
    sessionId: SessionId.make(row.sessionId),
    sceneId: SceneId.make(row.sceneId),
    status: row.status,
    participants: row.participants,
    seq: row.seq,
    ...(row.nextActorId !== undefined ? { nextActorId: row.nextActorId } : {}),
  })
}
