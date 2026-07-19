import { useState } from "react"
import { useMutation } from "convex/react"
import type { CastEntry } from "#/domain/activity"
import { seamErrorMessage } from "#/lib/seam-errors"
import { GateButton } from "#/components/ui/gate-button"
import { ArcanaGlyph } from "./ArcanaGlyph"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

/**
 * The offer in the Storyteller's roll zone (owner call 2026-07-19): a vulgar
 * draft waiting in the wings occupies the ST's felt — answering it IS the
 * Storyteller's rolling until it's answered, so it replaces the tray instead
 * of doubling the chronicle card. The card in the feed stays the table's
 * record; the engage/decline decision lives only here. Same trigger grammar
 * as the declaring felt's foot: the walk-away on the left, the verdigris
 * commitment on the right.
 */

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function StorytellerOffer({
  cast,
  sessionId,
  stageGate = null,
  moreWaiting = 0,
}: {
  cast: CastEntry
  sessionId: Id<"sessions">
  /** The server's StageOccupied refusal, mirrored so Engage explains itself
   * before the click (ADR-0021); null when the stage is free. */
  stageGate?: string | null
  /** Drafts queued behind this one — the wings hold more than one caster. */
  moreWaiting?: number
}) {
  const engage = useMutation(api.casts.engage)
  const decline = useMutation(api.casts.decline)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(seamErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const step = { sessionId, castId: cast._id }

  return (
    <div className="border-t" style={{ borderColor: "var(--line)" }}>
      {/* who offers what — the waiting pulse wears the world's hand */}
      <div className="flex flex-wrap items-baseline gap-1.5 px-3 pt-2.5">
        <span className="mv-eyebrow flex items-center gap-1.5">
          <span
            className="inline-flex size-1.5 animate-pulse rounded-full"
            style={{ background: "var(--turn-world)" }}
          />
          The offer
        </span>
        <ArcanaGlyph arcanum={cast.arcanum} size={14} className="mv-accent self-center" />
        <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
          {cast.casterName}
        </span>
        <span className="mv-data text-[10px]" style={{ color: "var(--dim)" }}>
          vulgar {capitalize(cast.arcanum)} {cast.level}
          {cast.roteName ? ` · Rote “${cast.roteName}”` : ""}
        </span>
      </div>

      {cast.intent && (
        <p className="px-3 pt-1 text-[11px] italic" style={{ color: "var(--dim)" }}>
          &ldquo;{cast.intent}&rdquo;
        </p>
      )}

      {/* the declared terms — the same receipt the chronicle card carries */}
      <p className="mv-data px-3 pt-1.5 text-[10px]" style={{ color: "var(--dim)" }}>
        declared pool {cast.declaredPool}
        {cast.potency !== undefined ? ` · Potency ${cast.potency} bought` : ""}
        {cast.targets !== undefined ? ` · ×${cast.targets} targets` : ""}
        {cast.spellManaCost > 0 ? ` · ${cast.spellManaCost} Mana cost` : ""}
        {cast.usesMagicalTool ? " · tool in hand −1" : ""}
      </p>

      {moreWaiting > 0 && (
        <p className="px-3 pt-1 text-[11px] italic" style={{ color: "var(--dim)" }}>
          {moreWaiting} more {moreWaiting === 1 ? "waits" : "wait"} in the wings
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 p-3">
        <button
          onClick={() => run(() => decline(step))}
          disabled={busy}
          className="mv-btn rounded-[3px] px-3 py-1.5 text-[12px] disabled:opacity-40"
        >
          Decline
        </button>
        <span className="flex-1" />
        <GateButton
          gate={stageGate}
          onClick={() => run(() => engage(step))}
          disabled={busy}
          className="mv-roll rounded-[3px] px-3 py-1.5 text-[12px] disabled:opacity-40"
        >
          Engage
        </GateButton>
      </div>

      {error && (
        <p className="px-3 pb-2 text-[12px]" style={{ color: "var(--bad)" }}>
          {error}
        </p>
      )}
    </div>
  )
}
