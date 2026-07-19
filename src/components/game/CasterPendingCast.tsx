import { useState } from "react"
import { useMutation } from "convex/react"
import { Match } from "effect"
import type { CastEntry } from "#/domain/activity"
import { seamErrorMessage } from "#/lib/seam-errors"
import { ArcanaGlyph } from "./ArcanaGlyph"
import { castReceipt } from "./cast-receipt"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

/**
 * The caster's occupied roll zone (issue #110, StorytellerOffer's mirror):
 * while their vulgar cast is pending, the caster rolls nothing else — the
 * seam refuses (issue #109), and this posture is that fact standing where
 * the felt would be. In the wings it carries the one live decision, the
 * walk-away (Withdraw, the same door as the chronicle card's); once engaged
 * the ladder's beats live on the CastCard, so this only points there — the
 * zone stays occupied clear through to resolution.
 */

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function CasterPendingCast({
  cast,
  sessionId,
}: {
  cast: CastEntry
  sessionId: Id<"sessions">
}) {
  const kill = useMutation(api.casts.kill)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const waiting = cast.status === "draft"

  const withdraw = async () => {
    setBusy(true)
    setError(null)
    try {
      await kill({ sessionId, castId: cast._id })
    } catch (err) {
      setError(seamErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  // Whose move the pulse wears: waiting = the world answers; engaged rungs
  // alternate, but the card carries the beats — here it stays the world's.
  // Exhaustive over the closed CastStatus set (ADR-0018): the route only
  // mounts this posture on unresolved statuses, so the terminal arms are a
  // last breath — the feed's own update unmounts the zone a beat later.
  const statusLine = Match.value(cast.status).pipe(
    Match.when(
      "draft",
      () => "waiting on the Storyteller — your dice are spoken for while the offer stands",
    ),
    Match.when(
      "price",
      () => "on stage — the Price is being set on its card; your dice are spoken for",
    ),
    Match.when(
      "paradox",
      () => "on stage — Paradox plays out on its card; your dice are spoken for",
    ),
    Match.when("resolved", () => "resolved — the zone frees"),
    Match.when("cancelled", () => "withdrawn — the zone frees"),
    Match.when("voided", () => "voided — the zone frees"),
    Match.exhaustive,
  )

  return (
    <div className="border-t" style={{ borderColor: "var(--line)" }}>
      {/* what you declared — the zone is yours but spoken for */}
      <div className="flex flex-wrap items-baseline gap-1.5 px-3 pt-2.5">
        <span className="mv-eyebrow flex items-center gap-1.5">
          <span
            className="inline-flex size-1.5 animate-pulse rounded-full"
            style={{ background: "var(--turn-world)" }}
          />
          {waiting ? "In the wings" : "On the stage"}
        </span>
        <ArcanaGlyph arcanum={cast.arcanum} size={14} className="mv-accent self-center" />
        <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
          {cast.roteName ?? `Improvised ${capitalize(cast.arcanum)}`}
        </span>
        <span className="mv-data text-[10px]" style={{ color: "var(--dim)" }}>
          vulgar {capitalize(cast.arcanum)} {cast.level}
        </span>
      </div>

      {cast.intent && (
        <p className="px-3 pt-1 text-[11px] italic" style={{ color: "var(--dim)" }}>
          &ldquo;{cast.intent}&rdquo;
        </p>
      )}

      <p className="mv-data px-3 pt-1.5 text-[10px]" style={{ color: "var(--dim)" }}>
        {castReceipt(cast)}
      </p>

      <p className="px-3 pt-1 text-[11px] italic" style={{ color: "var(--dim)" }}>
        {statusLine}
      </p>

      {/* the trigger row holds only the walk-away: there is nothing to
          commit here — the commitments are the card's (issue #110). An
          engaged cast has no zone controls at all, just its final breath
          of padding. */}
      {waiting ? (
        <div className="flex flex-wrap items-center gap-2 p-3">
          <button
            onClick={() => void withdraw()}
            disabled={busy}
            className="mv-btn rounded-[3px] px-3 py-1.5 text-[12px] disabled:opacity-40"
          >
            Withdraw
          </button>
        </div>
      ) : (
        <div className="pb-3" />
      )}

      {error && (
        <p className="px-3 pb-2 text-[12px]" style={{ color: "var(--bad)" }}>
          {error}
        </p>
      )}
    </div>
  )
}
