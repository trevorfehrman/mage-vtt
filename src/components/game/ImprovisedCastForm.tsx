import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { ARCANA } from "#/domain/character"
import { seamErrorMessage } from "#/lib/seam-errors"

/**
 * Minimal improvised-cast form — seam-proving scaffolding, NOT the casting UX
 * (PRD #4). The real casting experience (spell browser, rote cards, XState pool
 * builder) is its own MVP line item; replacing this form touches zero server
 * code. Deliberately unpolished — do not invest here.
 */

interface ImprovisedCastFormProps {
  sessionId: Id<"sessions">
  characterId: Id<"characters">
  arcana: Partial<Record<string, number>>
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function ImprovisedCastForm({
  sessionId,
  characterId,
  arcana,
}: ImprovisedCastFormProps) {
  const cast = useMutation(api.characters.castSpell)
  const [arcanum, setArcanum] = useState<string>("")
  const [level, setLevel] = useState(1)
  const [potency, setPotency] = useState(1)
  const [targets, setTargets] = useState(1)
  const [highSpeech, setHighSpeech] = useState(false)
  const [willpower, setWillpower] = useState(false)
  const [extraMana, setExtraMana] = useState(0)
  const [hidden, setHidden] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!arcanum) return
    setBusy(true)
    setError(null)
    try {
      await cast({
        sessionId,
        characterId,
        arcanum,
        level,
        ...(potency > 1 ? { potency } : {}),
        ...(targets > 1 ? { targets } : {}),
        ...(highSpeech ? { highSpeech } : {}),
        ...(willpower ? { spendWillpower: true } : {}),
        ...(extraMana > 0 ? { extraManaCost: extraMana } : {}),
        ...(hidden ? { visibility: "hidden" as const } : {}),
      })
      // The result lands in the Activity Log; nothing to render here.
    } catch (err) {
      setError(seamErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="mv-eyebrow">Improvised Cast</h3>
        <span className="mv-rule flex-1" />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          value={arcanum}
          onChange={(e) => setArcanum(e.target.value)}
          className="rounded border border-[var(--line)] bg-background px-2 py-1"
        >
          <option value="">Arcanum…</option>
          {ARCANA.map((name) => (
            <option key={name} value={name}>
              {capitalize(name)} ({arcana[name] ?? 0})
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1">
          Level
          <select
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="rounded border border-[var(--line)] bg-background px-2 py-1"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          Potency
          <input
            type="number"
            min={1}
            value={potency}
            onChange={(e) => setPotency(Number(e.target.value))}
            className="w-12 rounded border border-[var(--line)] bg-background px-1 py-1"
          />
        </label>
        <label className="flex items-center gap-1">
          Targets
          <input
            type="number"
            min={1}
            value={targets}
            onChange={(e) => setTargets(Number(e.target.value))}
            className="w-12 rounded border border-[var(--line)] bg-background px-1 py-1"
          />
        </label>
        <label className="flex items-center gap-1">
          Extra Mana
          <input
            type="number"
            min={0}
            value={extraMana}
            onChange={(e) => setExtraMana(Number(e.target.value))}
            className="w-12 rounded border border-[var(--line)] bg-background px-1 py-1"
          />
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={highSpeech}
            onChange={(e) => setHighSpeech(e.target.checked)}
          />
          High Speech
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={willpower}
            onChange={(e) => setWillpower(e.target.checked)}
          />
          Willpower +3
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={hidden}
            onChange={(e) => setHidden(e.target.checked)}
          />
          Hidden
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !arcanum}
          className="mv-btn rounded-[3px] px-3 py-1 disabled:opacity-50"
        >
          {busy ? "Casting…" : "Cast"}
        </button>
      </div>
      {error && (
        <p className="mt-1 text-xs" style={{ color: "var(--bad)" }}>
          {error}
        </p>
      )}
    </section>
  )
}
