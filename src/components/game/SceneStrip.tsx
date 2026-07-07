import { useEffect, useRef, useState } from "react"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { ScenePip } from "#/domain/cast"
import { useScene } from "#/hooks/use-scene"
import { seamErrorMessage } from "#/lib/seam-errors"
import type { Id } from "../../../convex/_generated/dataModel"

/**
 * The Scene strip (issue #42, PRD #39): header-adjacent chrome, one line —
 * deliberately not a fifth panel. Every member sees the active Scene's name
 * and status live; no Scene renders a quiet downtime state. The Storyteller
 * additionally holds the open/close doors and the Sleeper-witnesses toggle
 * (visible to all, ST's to change — it feeds Paradox liability defaults in
 * the negotiation). Player controls never render; the server refuses them
 * regardless (ADR-0010).
 *
 * The right-hand group carries the per-caster Paradox pips (issue #44): who
 * is pushing their luck this Scene, derived from resolved Cast history and
 * updating after each resolution; past a few casters they overflow into a
 * popover. Built to grow further: a possible active-effects surface later.
 */

export function SceneStrip({
  sessionId,
  isStoryteller,
}: {
  sessionId: Id<"sessions">
  isStoryteller: boolean
}) {
  // Decoded at the seam (issue #49): the strip reads the domain Scene
  // artifact and typed pips, never the raw Convex documents.
  const { scene, pips } = useScene(sessionId)
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
        : `${scene.id}:${scene.status}:${scene.sleeperWitnesses}`
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

          {/* The right-hand group — Paradox pips, witnesses, the close door. */}
          <span className="ml-auto flex items-center gap-2">
            {pips !== undefined && pips.length > 0 && <ParadoxPips pips={pips} />}
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

/** How many casters ride the strip inline before the popover takes over. */
const INLINE_PIPS = 3

/**
 * Per-caster Paradox pips (issue #44): only casters with a nonzero
 * accumulator arrive here (the query filters), heaviest first. Past
 * `INLINE_PIPS` casters the tail collapses into a "+N" popover — the strip
 * stays one line no matter how reckless the coven gets.
 */
function ParadoxPips({ pips }: { pips: ReadonlyArray<ScenePip> }) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLSpanElement>(null)

  // The popover stands down on any outside click — strip chrome must never
  // demand a dismissal ritual.
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!popoverRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  const inline = pips.length > INLINE_PIPS ? pips.slice(0, INLINE_PIPS - 1) : pips
  const overflow = pips.length - inline.length

  return (
    <span ref={popoverRef} className="relative flex items-center gap-2">
      <span
        className="mv-data text-[9px] uppercase tracking-wider"
        style={{ color: "var(--dim)" }}
      >
        Paradox
      </span>
      {inline.map((pip) => (
        <PipBadge key={pip.characterId} pip={pip} />
      ))}
      {overflow > 0 && (
        <>
          <button
            onClick={() => setOpen((o) => !o)}
            className={`mv-mini ${open ? "mv-mini-on" : ""}`}
            title={`${overflow} more ${overflow === 1 ? "caster is" : "casters are"} carrying Paradox this Scene`}
          >
            +{overflow}
          </button>
          {open && (
            <div
              className="absolute right-0 top-full z-20 mt-1.5 grid min-w-40 gap-1.5 rounded-[3px] p-2"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                boxShadow: "0 6px 20px rgba(0, 0, 0, 0.55)",
              }}
            >
              {pips.map((pip) => (
                <PipBadge key={pip.characterId} pip={pip} />
              ))}
            </div>
          )}
        </>
      )}
    </span>
  )
}

function PipBadge({ pip }: { pip: ScenePip }) {
  const dots =
    pip.accumulator <= 4 ? "●".repeat(pip.accumulator) : `●×${pip.accumulator}`
  return (
    <span
      className="mv-data inline-flex items-center gap-1 text-[10px]"
      title={`${pip.casterName}: ${pip.accumulator} Paradox ${pip.accumulator === 1 ? "roll" : "rolls"} this Scene — the next pool starts +${pip.accumulator}`}
    >
      <span className="max-w-24 truncate" style={{ color: "var(--ink)" }}>
        {pip.casterName}
      </span>
      <span style={{ color: "var(--bad)", letterSpacing: "1px" }}>{dots}</span>
    </span>
  )
}
