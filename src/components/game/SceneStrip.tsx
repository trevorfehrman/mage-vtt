import { useEffect, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { seamErrorMessage } from "#/lib/seam-errors"
import type { Id } from "../../../convex/_generated/dataModel"

/**
 * The Scene strip (issue #42, PRD #39): header-adjacent chrome, one line —
 * deliberately not a fifth panel. Every member sees the active Scene's name
 * and status live; no Scene renders a quiet downtime state. The Storyteller
 * additionally holds the open/close doors and the Sleeper-witnesses toggle
 * (visible to all, ST's to change — it feeds Paradox liability defaults in
 * the negotiation slice). Player controls never render; the server refuses
 * them regardless (ADR-0010).
 *
 * Built to grow: per-caster Paradox pips join the right-hand group in a later
 * slice, and a possible active-effects surface much later.
 */

export function SceneStrip({
  sessionId,
  isStoryteller,
}: {
  sessionId: Id<"sessions">
  isStoryteller: boolean
}) {
  const scene = useQuery(api.scenes.getActive, { sessionId })
  const openScene = useMutation(api.scenes.open)
  const closeScene = useMutation(api.scenes.close)
  const setWitnesses = useMutation(api.scenes.setWitnesses)

  const [draftName, setDraftName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A refusal describes the world it was refused against; when the live
  // Scene state moves (someone opened, closed, toggled), the stale message
  // stands down rather than contradicting the strip beside it.
  const liveKey =
    scene === undefined
      ? "loading"
      : scene === null
        ? "none"
        : `${scene._id}:${scene.status}:${scene.sleeperWitnesses}`
  useEffect(() => {
    setError(null)
  }, [liveKey])

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      return true
    } catch (err) {
      setError(seamErrorMessage(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  const submitOpen = async () => {
    if (await run(() => openScene({ sessionId, name: draftName }))) {
      setDraftName("")
    }
  }

  return (
    <div
      className="mv-panel flex min-h-8 items-center gap-3 border-x-0 border-t-0 px-4 py-1"
      data-slot="scene-strip"
    >
      <span className="mv-eyebrow shrink-0">Scene</span>

      {scene === undefined ? (
        // Query in flight — hold the line's height, promise nothing.
        <span className="mv-data text-[11px]" style={{ color: "var(--dim)" }}>
          …
        </span>
      ) : scene === null ? (
        <>
          <span className="mv-data text-[11px]" style={{ color: "var(--dim)" }}>
            No Scene — downtime
          </span>
          {isStoryteller && (
            <span className="ml-auto flex items-center gap-2">
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && draftName.trim().length > 0) {
                    void submitOpen()
                  }
                }}
                placeholder="Name the Scene…"
                className="mv-data w-44 rounded-[3px] border bg-transparent px-2 py-0.5 text-[11px] outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--line)" }}
              />
              <button
                onClick={() => void submitOpen()}
                disabled={busy || draftName.trim().length === 0}
                className="mv-mini disabled:cursor-default disabled:opacity-40"
              >
                {busy ? "Opening…" : "Open Scene"}
              </button>
            </span>
          )}
        </>
      ) : (
        <>
          <span className="mv-accent text-[9px] leading-none" title="Scene open">
            ●
          </span>
          <span className="mv-h truncate text-[13px] leading-none">{scene.name}</span>

          {/* The right-hand group — witnesses now, Paradox pips later. */}
          <span className="ml-auto flex items-center gap-2">
            {isStoryteller ? (
              <button
                onClick={() =>
                  void run(() =>
                    setWitnesses({
                      sessionId,
                      sleeperWitnesses: !scene.sleeperWitnesses,
                    }),
                  )
                }
                disabled={busy}
                className={`mv-mini ${scene.sleeperWitnesses ? "mv-mini-on" : ""}`}
                title="Sleepers are watching — feeds the +2 Paradox liability default"
              >
                Sleeper witnesses
              </button>
            ) : (
              <span
                className={`mv-mini cursor-default ${scene.sleeperWitnesses ? "mv-mini-on" : ""}`}
                title={
                  scene.sleeperWitnesses
                    ? "Sleepers are watching — vulgar magic risks more"
                    : "No Sleeper witnesses — the Storyteller's call"
                }
              >
                Sleeper witnesses
              </span>
            )}
            {isStoryteller && (
              <button
                onClick={() => void run(() => closeScene({ sessionId }))}
                disabled={busy}
                className="mv-mini disabled:opacity-40"
              >
                {busy ? "…" : "Close Scene"}
              </button>
            )}
          </span>
        </>
      )}

      {error && (
        <span className="text-[11px]" style={{ color: "var(--bad)" }}>
          {error}
        </span>
      )}
    </div>
  )
}
