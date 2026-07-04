import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { MAX_DECLARED_POOL } from "#/domain/flows/sheetless-cast"
import { seamErrorMessage } from "#/lib/seam-errors"
import type { Id } from "../../../convex/_generated/dataModel"

/**
 * The Storyteller's sheet-less cast (PRD #11, issue #15): NPC and spirit
 * opposition with a hand-declared pool, Hidden by default. Rendered only for
 * ST/Dev — the server refuses everyone else regardless. Deliberately minimal:
 * no saved pools, no quick-NPCs, no bestiary (the combat phase's territory).
 */

export function SheetlessCastForm({ sessionId }: { sessionId: Id<"sessions"> }) {
  const cast = useMutation(api.rolls.castSheetless)
  const [poolSize, setPoolSize] = useState(5)
  const [hidden, setHidden] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await cast({
        sessionId,
        poolSize,
        ...(hidden ? {} : { visibility: "public" as const }),
      })
      // The result lands in the Activity Log (Hidden rolls: ST + roller only).
    } catch (err) {
      setError(seamErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-t px-3 py-2.5" style={{ borderColor: "var(--line)" }}>
      <div className="mb-2 flex items-center gap-2">
        <span className="mv-eyebrow">Sheet-less cast</span>
        <span className="mv-data ml-auto text-[10px]" style={{ color: "var(--dim)" }}>
          NPC opposition
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPoolSize((n) => Math.max(0, n - 1))}
          className="mv-btn grid size-6 place-items-center rounded-[3px] text-[13px] leading-none"
        >
          −
        </button>
        <span className="mv-data w-7 text-center text-[13px] font-bold">{poolSize}</span>
        <button
          onClick={() => setPoolSize((n) => Math.min(MAX_DECLARED_POOL, n + 1))}
          className="mv-btn grid size-6 place-items-center rounded-[3px] text-[13px] leading-none"
        >
          +
        </button>
        <button
          onClick={() => setHidden(!hidden)}
          className={`mv-mini ${hidden ? "mv-mini-on" : ""}`}
        >
          Hidden
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="mv-roll ml-auto rounded-[3px] px-3 py-1.5 text-[11px] disabled:opacity-40"
        >
          {busy ? "Casting…" : poolSize === 0 ? "Chance die" : `Cast ${poolSize}`}
        </button>
      </div>
      {error && (
        <p className="mt-1.5 text-[11px]" style={{ color: "var(--bad)" }}>
          {error}
        </p>
      )}
    </div>
  )
}
