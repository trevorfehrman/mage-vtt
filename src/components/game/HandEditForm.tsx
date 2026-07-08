import { useForm } from "@tanstack/react-form"
import { useMutation } from "convex/react"
import { Schema } from "effect"
import { api } from "../../../convex/_generated/api"
import type { CharacterSheet as CharacterSheetData } from "#/domain/character"
import { BoxSeverity, HealthBox } from "#/domain/damage"
import { Mana, Willpower } from "#/domain/quantities"
import { ResistantDot, healthBoxGlyph } from "./CharacterSheet"
import { seamErrorMessage } from "#/lib/seam-errors"
import { issueMessages, standardSchemaFor, submitErrorMessage } from "#/lib/form"
import type { Id } from "../../../convex/_generated/dataModel"

/**
 * The Storyteller's hand-edit panel (PRD #11, issue #19): the fudge/repair
 * path over a sheet's current-state values — Mana, Willpower, health track.
 * Rendered only for the Storyteller (a Dev who is also ST sees it too); the
 * server rejects everyone else regardless, the owning Player included. Every
 * accepted edit is Override-stamped ("Repair") and lands in the Activity Log.
 *
 * The pilot flat form (ADR-0020, issue #70): TanStack Form holds the working
 * copy, validated against the domain quantities via Standard Schema. The
 * working copy edits plain values (Encoded space); `Schema.decodeSync` brands
 * at the submit boundary; only dirty fields go over the wire, and the server
 * re-validates regardless.
 */

// The working copy's shape, composed from the domain schemas — never a
// re-declared mirror. `HealthBox` (not the sheet's `HealthTrack`) because the
// legacy bare-severity encoding is a read concern; the form always writes the
// structured boxes the mutation takes.
const HandEditWorkingCopy = Schema.Struct({
  manaCurrent: Mana,
  willpowerCurrent: Willpower,
  healthTrack: Schema.Array(HealthBox),
})

const handEditStandard = standardSchemaFor(HandEditWorkingCopy)

// The one box vocabulary, in its declared order — never a parallel copy.
const HEALTH_CYCLE: ReadonlyArray<BoxSeverity> = BoxSeverity.literals

const sameBox = (a: HealthBox, b: HealthBox) =>
  a.severity === b.severity && a.resistant === b.resistant

// Two orthogonal axes, two gestures (issue #41): click cycles the wound
// severity; shift-click toggles the Resistant dot beneath the box.
const cycleSeverity = (box: HealthBox): HealthBox => ({
  ...box,
  severity:
    HEALTH_CYCLE[(HEALTH_CYCLE.indexOf(box.severity) + 1) % HEALTH_CYCLE.length]!,
})

const toggleResistant = (box: HealthBox): HealthBox => ({
  ...box,
  resistant: !box.resistant,
})

type WorkingCopy = typeof HandEditWorkingCopy.Encoded

/** Per-field dirtiness against the mount's defaults — one comparison shape
 * for the header, the steppers, and the diff-only submit. */
const diffWorkingCopy = (values: WorkingCopy, defaults: WorkingCopy) => {
  const mana = values.manaCurrent !== defaults.manaCurrent
  const willpower = values.willpowerCurrent !== defaults.willpowerCurrent
  const track = values.healthTrack.some(
    (box, i) => !sameBox(box, defaults.healthTrack[i]!),
  )
  return { mana, willpower, track, any: mana || willpower || track }
}

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

  // Branded sheet values assign into the plain Encoded shape for free —
  // brands are subtypes; the working copy itself stays unbranded.
  const defaultValues: typeof HandEditWorkingCopy.Encoded = {
    manaCurrent: character.manaCurrent,
    willpowerCurrent: character.willpowerCurrent,
    healthTrack: character.healthTrack,
  }

  const form = useForm({
    defaultValues,
    validators: {
      onChange: handEditStandard,
      onSubmitAsync: async ({ value }) => {
        try {
          // The decode boundary: brands applied here, nowhere else.
          const decoded = Schema.decodeSync(HandEditWorkingCopy)(value)
          const dirty = diffWorkingCopy(value, defaultValues)
          await handEdit({
            sessionId,
            characterId,
            ...(dirty.mana ? { manaCurrent: decoded.manaCurrent } : {}),
            ...(dirty.willpower
              ? { willpowerCurrent: decoded.willpowerCurrent }
              : {}),
            ...(dirty.track
              ? { healthTrack: decoded.healthTrack.map((box) => ({ ...box })) }
              : {}),
          })
          // The edit lands on the sheet and in the Activity Log,
          // Override-stamped; the route's remount key resets this form.
          return null
        } catch (err) {
          return {
            form: seamErrorMessage(err, {
              overrides: {
                NotStoryteller: "Only the Storyteller may hand-edit sheets.",
              },
            }),
          }
        }
      },
    },
  })

  return (
    <div className="mv-panel mx-auto w-full max-w-3xl rounded-[3px] p-3">
      <form.Subscribe
        selector={(state) =>
          [state.values, state.isSubmitting, state.canSubmit, state.errorMap] as const
        }
      >
        {([values, isSubmitting, canSubmit, errorMap]) => {
          const dirty = diffWorkingCopy(values, defaultValues)
          const formError = submitErrorMessage(errorMap.onSubmit)
          return (
            <>
              <div className="mb-2 flex items-center gap-2">
                <span className="mv-eyebrow">Hand edit</span>
                <span
                  className="mv-data text-[10px]"
                  style={{ color: "var(--dim)" }}
                >
                  {character.name} · stamped as Repair
                </span>
                {dirty.any && (
                  <button
                    onClick={() => form.reset()}
                    className="mv-data ml-auto text-[10px] underline"
                    style={{ color: "var(--dim)" }}
                  >
                    revert
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {/* Capacity is shape: pools fill to their printed size, never past. */}
                <form.Field name="manaCurrent">
                  {(field) => (
                    <Stepper
                      label="Mana"
                      value={field.state.value}
                      max={character.maxMana}
                      onChange={field.handleChange}
                      dirty={dirty.mana}
                      errors={field.state.meta.errors}
                    />
                  )}
                </form.Field>
                <form.Field name="willpowerCurrent">
                  {(field) => (
                    <Stepper
                      label="Will"
                      value={field.state.value}
                      max={character.willpower}
                      onChange={field.handleChange}
                      dirty={dirty.willpower}
                      errors={field.state.meta.errors}
                    />
                  )}
                </form.Field>

                <form.Field name="healthTrack">
                  {(field) => (
                    <div className="flex items-center gap-1.5">
                      <span className="mv-eyebrow">Health</span>
                      <div className="flex gap-1">
                        {field.state.value.map((box, i) => (
                          <button
                            key={i}
                            onClick={(e) =>
                              field.handleChange(
                                field.state.value.map((b, j) =>
                                  j === i
                                    ? (e.shiftKey ? toggleResistant : cycleSeverity)(b)
                                    : b,
                                ),
                              )
                            }
                            title="Click to cycle: clear → bashing → lethal → aggravated · Shift-click to toggle the Resistant dot"
                            className="flex cursor-pointer flex-col items-center gap-[2px]"
                          >
                            <span
                              className="mv-data grid size-5 place-items-center rounded-[2px] border text-[10px] font-bold"
                              style={{
                                borderColor: !sameBox(
                                  box,
                                  character.healthTrack[i]!,
                                )
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
                  )}
                </form.Field>

                <button
                  onClick={() => void form.handleSubmit()}
                  disabled={isSubmitting || !dirty.any || !canSubmit}
                  className="mv-roll ml-auto rounded-[3px] px-3 py-1.5 text-[11px] disabled:opacity-40"
                >
                  {isSubmitting ? "Applying…" : "Apply override"}
                </button>
              </div>

              {formError && (
                <p className="mt-1.5 text-[11px]" style={{ color: "var(--bad)" }}>
                  {formError}
                </p>
              )}
            </>
          )
        }}
      </form.Subscribe>
    </div>
  )
}

function Stepper({
  label,
  value,
  max,
  onChange,
  dirty,
  errors,
}: {
  label: string
  value: number
  max: number
  onChange: (n: number) => void
  dirty: boolean
  /** Standard Schema issues from field.state.meta.errors — the steppers
   * clamp, so these only fire if a working copy goes wrong programmatically;
   * rendering them keeps the failure visible instead of a dead Apply. */
  errors: ReadonlyArray<unknown>
}) {
  const messages = issueMessages(errors)
  return (
    <div className="flex flex-col gap-0.5">
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
      {messages.length > 0 && (
        <span className="text-[10px]" style={{ color: "var(--bad)" }}>
          {messages.join("; ")}
        </span>
      )}
    </div>
  )
}
