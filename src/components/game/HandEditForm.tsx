import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { CharacterSheet as CharacterSheetData } from "#/domain/character"
import { BoxSeverity, type HealthBox } from "#/domain/damage"
import { ResistantDot, healthBoxGlyph } from "./CharacterSheet"
import { seamErrorMessage } from "#/lib/seam-errors"
import type { Id } from "../../../convex/_generated/dataModel"

/**
 * The Storyteller's hand-edit panel (PRD #11, issue #19): the fudge/repair
 * path over a sheet's current-state values — Mana, Willpower, health track.
 * Rendered only for the Storyteller (a Dev who is also ST sees it too); the
 * server rejects everyone else regardless, the owning Player included. Every
 * accepted edit is Override-stamped ("Repair") and lands in the Activity Log.
 */

// The one box vocabulary, in its declared order — never a parallel copy.
const HEALTH_CYCLE: ReadonlyArray<BoxSeverity> = BoxSeverity.literals

const sameBox = (a: HealthBox, b: HealthBox) =>
  a.severity === b.severity && a.resistant === b.resistant

export function HandEditForm({
  sessionId,
  characterId,
  character,
}: {
  sessionId: Id<"sessions">
  characterId: Id<"characters">
  character: CharacterSheetData
}) {
  const handEdit = useMutation(api.characters.handEdit)
  // Draft edits are plain numbers — the branded quantities live in the domain;
  // the wire (mutation args) is raw and the server re-validates.
  const [mana, setMana] = useState<number>(character.manaCurrent)
  const [willpower, setWillpower] = useState<number>(character.willpowerCurrent)
  const [track, setTrack] = useState<ReadonlyArray<HealthBox>>(
    character.healthTrack,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const manaDirty = mana !== character.manaCurrent
  const willpowerDirty = willpower !== character.willpowerCurrent
  const trackDirty = track.some((box, i) => !sameBox(box, character.healthTrack[i]!))
  const dirty = manaDirty || willpowerDirty || trackDirty

  // Two orthogonal axes, two gestures: click cycles the wound severity;
  // shift-click toggles the Resistant dot beneath the box (issue #41).
  const cycleBox = (i: number) =>
    setTrack((prev) =>
      prev.map((box, j) =>
        j === i
          ? {
              ...box,
              severity:
                HEALTH_CYCLE[
                  (HEALTH_CYCLE.indexOf(box.severity) + 1) % HEALTH_CYCLE.length
                ]!,
            }
          : box,
      ),
    )

  const toggleResistant = (i: number) =>
    setTrack((prev) =>
      prev.map((box, j) => (j === i ? { ...box, resistant: !box.resistant } : box)),
    )

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await handEdit({
        sessionId,
        characterId,
        ...(manaDirty ? { manaCurrent: mana } : {}),
        ...(willpowerDirty ? { willpowerCurrent: willpower } : {}),
        ...(trackDirty ? { healthTrack: track.map((box) => ({ ...box })) } : {}),
      })
      // The edit lands on the sheet and in the Activity Log, Override-stamped.
    } catch (err) {
      setError(
        seamErrorMessage(err, {
          overrides: { NotStoryteller: "Only the Storyteller may hand-edit sheets." },
        }),
      )
    } finally {
      setBusy(false)
    }
  }

  const revert = () => {
    setMana(character.manaCurrent)
    setWillpower(character.willpowerCurrent)
    setTrack(character.healthTrack)
    setError(null)
  }

  return (
    <div className="mv-panel mx-auto w-full max-w-3xl rounded-[3px] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="mv-eyebrow">Hand edit</span>
        <span className="mv-data text-[10px]" style={{ color: "var(--dim)" }}>
          {character.name} · stamped as Repair
        </span>
        {dirty && (
          <button
            onClick={revert}
            className="mv-data ml-auto text-[10px] underline"
            style={{ color: "var(--dim)" }}
          >
            revert
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {/* Capacity is shape: pools fill to their printed size, never past. */}
        <Stepper
          label="Mana"
          value={mana}
          max={character.maxMana}
          onChange={setMana}
          dirty={manaDirty}
        />
        <Stepper
          label="Will"
          value={willpower}
          max={character.willpower}
          onChange={setWillpower}
          dirty={willpowerDirty}
        />

        <div className="flex items-center gap-1.5">
          <span className="mv-eyebrow">Health</span>
          <div className="flex gap-1">
            {track.map((box, i) => (
              <button
                key={i}
                onClick={(e) =>
                  e.shiftKey ? toggleResistant(i) : cycleBox(i)
                }
                title="Click to cycle: clear → bashing → lethal → aggravated · Shift-click to toggle the Resistant dot"
                className="flex cursor-pointer flex-col items-center gap-[2px]"
              >
                <span
                  className="mv-data grid size-5 place-items-center rounded-[2px] border text-[10px] font-bold"
                  style={{
                    borderColor: !sameBox(box, character.healthTrack[i]!)
                      ? "var(--accent)"
                      : box.severity === "empty"
                        ? "var(--line)"
                        : "var(--dim)",
                    color: "var(--accent)",
                  }}
                >
                  {healthBoxGlyph(box.severity)}
                </span>
                <ResistantDot resistant={box.resistant} />
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={submit}
          disabled={busy || !dirty}
          className="mv-roll ml-auto rounded-[3px] px-3 py-1.5 text-[11px] disabled:opacity-40"
        >
          {busy ? "Applying…" : "Apply override"}
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

function Stepper({
  label,
  value,
  max,
  onChange,
  dirty,
}: {
  label: string
  value: number
  max: number
  onChange: (n: number) => void
  dirty: boolean
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="mv-eyebrow">{label}</span>
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="mv-btn grid size-6 place-items-center rounded-[3px] text-[13px] leading-none"
      >
        −
      </button>
      <span
        className="mv-data w-7 text-center text-[13px] font-bold"
        style={dirty ? { color: "var(--accent)" } : undefined}
      >
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="mv-btn grid size-6 place-items-center rounded-[3px] text-[13px] leading-none"
      >
        +
      </button>
    </div>
  )
}
