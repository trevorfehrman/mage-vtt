import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import type { KnownRote } from "#/domain/character"
import { formatRotePool } from "#/domain/rote-pool"
import { seamErrorMessage } from "#/lib/seam-errors"

/**
 * Minimal known-Rotes list + cast trigger — seam-proving scaffolding, NOT the
 * casting UX (issue #18: "the real casting face is its own slice, and
 * replacing scaffold touches no server code"). Deliberately unpolished — do
 * not invest here.
 */

interface RoteCastFormProps {
  sessionId: Id<"sessions">
  characterId: Id<"characters">
  rotes: ReadonlyArray<KnownRote>
}

export function RoteCastForm({ sessionId, characterId, rotes }: RoteCastFormProps) {
  const cast = useMutation(api.characters.castRote)
  const [skillChoices, setSkillChoices] = useState<Record<string, string>>({})
  const [potency, setPotency] = useState(1)
  const [targets, setTargets] = useState(1)
  const [highSpeech, setHighSpeech] = useState(false)
  const [willpower, setWillpower] = useState(false)
  const [extraMana, setExtraMana] = useState(0)
  const [hidden, setHidden] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  if (rotes.length === 0) return null

  const submit = async (rote: KnownRote) => {
    setBusy(rote.name)
    setError(null)
    try {
      const skillChoice = skillChoices[rote.name]
      await cast({
        sessionId,
        characterId,
        roteName: rote.name,
        ...(skillChoice ? { skillChoice } : {}),
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
      setBusy(null)
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="mv-eyebrow">Rotes</h3>
        <span className="mv-rule flex-1" />
      </div>
      <ul className="grid gap-1 text-xs">
        {rotes.map((rote) => (
          <li key={rote.name} className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{rote.name}</span>
            <span className="text-muted-foreground">
              {rote.spellName} ({rote.spellArcanum} {rote.spellLevel}) —{" "}
              {formatRotePool(rote.pool)}
            </span>
            {rote.pool.skills.length > 1 && (
              <select
                value={skillChoices[rote.name] ?? ""}
                onChange={(e) =>
                  setSkillChoices((prev) => ({ ...prev, [rote.name]: e.target.value }))
                }
                className="rounded border border-[var(--line)] bg-background px-2 py-1"
              >
                <option value="">Skill…</option>
                {rote.pool.skills.map((skill) => (
                  <option key={skill} value={skill}>
                    {skill}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => submit(rote)}
              disabled={busy !== null}
              className="mv-btn rounded-[3px] px-3 py-1 disabled:opacity-50"
            >
              {busy === rote.name ? "Casting…" : "Cast"}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
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
      </div>
      {error && (
        <p className="mt-1 text-xs" style={{ color: "var(--bad)" }}>
          {error}
        </p>
      )}
    </section>
  )
}
