import { useEffect, useState } from "react"
import { useMutation } from "convex/react"
import { useMachine } from "@xstate/react"
import type { CastEntry } from "#/domain/activity"
import {
  containmentCap,
  effectiveWitnessCount,
  toGnosisRank,
  waitingOn,
  type CastStatus,
} from "#/domain/cast"
import type { CharacterSheet } from "#/domain/character"
import { calculateParadoxPool } from "#/domain/paradox"
import { seamErrorMessage } from "#/lib/seam-errors"
import { castLadderMachine, ladderControls } from "#/machines/cast-ladder"
import { ArcanaGlyph } from "./ArcanaGlyph"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

/**
 * The live Cast card (issue #43, ADR-0016): a projection of the Cast document
 * rendered in the Activity feed — the whole table watches one ladder climb,
 * with buttons only for the viewer's role. The XState machine mirrors the
 * subscribed document (rehydrating mid-ladder on reload is just "render the
 * snapshot"); every button is a Convex mutation whose refusal surfaces inline
 * in table language (ADR-0010).
 */

const RUNGS: ReadonlyArray<{ status: CastStatus; label: string }> = [
  { status: "draft", label: "Draft" },
  { status: "engaged", label: "Engaged" },
  { status: "liabilitiesLocked", label: "Liabilities" },
  { status: "intentionLocked", label: "Intention" },
  { status: "paradoxRolled", label: "Paradox" },
  { status: "contained", label: "Contained" },
  { status: "resolved", label: "Resolved" },
]

const rungIndex = (status: CastStatus): number => {
  const i = RUNGS.findIndex((r) => r.status === status)
  return i === -1 ? RUNGS.length : i
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function CastCard({
  cast,
  sessionId,
  isStoryteller,
  viewerUserId,
  mySheet,
}: {
  cast: CastEntry
  sessionId: Id<"sessions">
  isStoryteller: boolean
  viewerUserId: string
  /** The viewer's own decoded sheet — the caster's input caps read from it. */
  mySheet: CharacterSheet | null
}) {
  // The machine is a projection of the document (ADR-0016): input rehydrates
  // mid-ladder, SYNC tracks every realtime update, and the card renders from
  // the machine's rung — the document remains the only owner of state.
  const [state, send] = useMachine(castLadderMachine, { input: { cast } })
  useEffect(() => send({ type: "SYNC", cast }), [cast, send])
  const status = state.value as CastStatus

  const isCaster = cast.casterUserId === viewerUserId
  const controls = ladderControls(status, { isStoryteller, isCaster })

  const kill = useMutation(api.casts.kill)
  const decline = useMutation(api.casts.decline)
  const engage = useMutation(api.casts.engage)
  const editLiabilities = useMutation(api.casts.editLiabilities)
  const setTool = useMutation(api.casts.setTool)
  const lockLiabilities = useMutation(api.casts.lockLiabilities)
  const lockIntention = useMutation(api.casts.lockIntention)
  const cancel = useMutation(api.casts.cancel)
  const rollParadox = useMutation(api.casts.rollParadox)
  const contain = useMutation(api.casts.contain)
  const rollCast = useMutation(api.casts.rollCast)
  const voidCast = useMutation(api.casts.voidCast)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mitigation, setMitigation] = useState(0)
  const [contained, setContained] = useState(0)
  // The ST's add-a-modifier form (issue #44): local until the Add press.
  const [modSource, setModSource] = useState("")
  const [modDice, setModDice] = useState(1)

  // A stale refusal clears whenever the document moves (the SceneStrip idiom).
  const liveKey = `${cast._id}:${cast.status}:${cast.updatedAt}`
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

  const step = { sessionId, castId: cast._id }

  // The Paradox pool as the engage beat stamped it and the negotiation edits
  // it live (ADR-0015, issue #44) — the same leaf the server rolls with,
  // never a reimplementation. Old rows fall back from count to the boolean.
  const poolInputs =
    cast.gnosis !== undefined
      ? {
          gnosis: toGnosisRank(cast.gnosis),
          usesMagicalTool: cast.usesMagicalTool,
          witnessCount: effectiveWitnessCount(cast),
          priorParadoxRollsThisScene: cast.priorParadoxRolls ?? 0,
          discretionaryModifiers: cast.discretionaryModifiers ?? [],
        }
      : null
  const pool = poolInputs
    ? calculateParadoxPool({
        ...poolInputs,
        ...(status === "liabilitiesLocked"
          ? { manaMitigation: mitigation }
          : cast.manaMitigation !== undefined
            ? { manaMitigation: cast.manaMitigation }
            : {}),
      })
    : null

  // Input caps mirror the server's refusals; the server stays authoritative.
  const poolBeforeMitigation = poolInputs
    ? calculateParadoxPool(poolInputs).totalDice
    : 0
  const manaFree = mySheet ? Math.max(mySheet.manaCurrent - cast.spellManaCost, 0) : 0
  const mitigationCap = Math.min(poolBeforeMitigation, manaFree)
  const containCap = mySheet
    ? containmentCap(mySheet.healthTrack, cast.paradoxSuccesses ?? 0)
    : (cast.paradoxSuccesses ?? 0)

  const waiting = waitingOn(status)
  const terminal = waiting === null

  return (
    <div
      className="mv-cornered mv-panel rounded-[3px] p-2.5"
      style={terminal && status !== "resolved" ? { opacity: 0.65 } : undefined}
    >
      {/* header: who casts what */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ArcanaGlyph arcanum={cast.arcanum} size={14} className="mv-accent" />
          <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
            {cast.casterName}
          </span>
          <span className="mv-data text-[10px]" style={{ color: "var(--dim)" }}>
            vulgar {capitalize(cast.arcanum)} {cast.level}
          </span>
        </div>
        <div className="flex gap-1">
          <span
            className="mv-data rounded-[2px] px-1 py-0.5 text-[9px] uppercase tracking-wide"
            style={{
              border: "1px solid var(--accent)",
              color: "var(--accent)",
            }}
          >
            Vulgar Cast
          </span>
          {status === "voided" && cast.override && (
            <span
              className="mv-data rounded-[2px] px-1 py-0.5 text-[9px] uppercase tracking-wide"
              title={`Invoked by ${cast.override.invokedByName}`}
              style={{ border: "1px solid var(--bad)", color: "var(--bad)" }}
            >
              Voided · Repair
            </span>
          )}
          {status === "cancelled" && (
            <span
              className="mv-data rounded-[2px] px-1 py-0.5 text-[9px] uppercase tracking-wide"
              style={{ border: "1px solid var(--dim)", color: "var(--dim)" }}
            >
              Cancelled
            </span>
          )}
        </div>
      </div>

      {cast.intent && (
        <p className="mt-1 text-[11px] italic" style={{ color: "var(--dim)" }}>
          &ldquo;{cast.intent}&rdquo;
        </p>
      )}

      {/* the ladder — the same rungs on every screen */}
      {status !== "cancelled" && status !== "voided" && (
        <div className="mt-2 flex items-center gap-1">
          {RUNGS.map((rung, i) => {
            const here = i === rungIndex(status)
            const past = i < rungIndex(status)
            return (
              <div key={rung.status} className="flex min-w-0 flex-1 flex-col gap-1">
                <div
                  className="h-[3px] rounded-full"
                  style={{
                    background: past || here ? "var(--accent)" : "var(--raise)",
                    opacity: here ? 1 : past ? 0.55 : 1,
                    boxShadow: here ? "0 0 6px var(--glow)" : undefined,
                  }}
                />
                <span
                  className="mv-data truncate text-center text-[8px] uppercase tracking-wide"
                  style={{ color: here ? "var(--accent)" : "var(--dim)" }}
                >
                  {rung.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* the numbers of the moment */}
      <div className="mt-2 grid gap-1 text-[11px]" style={{ color: "var(--dim)" }}>
        <span className="mv-data">
          declared pool {cast.declaredPool}
          {cast.spellManaCost > 0 ? ` · ${cast.spellManaCost} Mana cost` : ""}
          {cast.usesMagicalTool ? " · tool" : ""}
        </span>
        {pool !== null && !terminal && (
          <span className="mv-data">
            Paradox pool{" "}
            <b style={{ color: "var(--accent)" }}>
              {pool.totalDice === 0 ? "chance die" : `${pool.totalDice} dice`}
            </b>
            {" — "}
            {[`Gnosis ${pool.baseDice}`, ...pool.modifiers.map((m) => `${m.source} ${m.dice > 0 ? "+" : ""}${m.dice}`)].join(", ")}
          </span>
        )}
        {cast.paradoxSuccesses !== undefined && (
          <span className="mv-data">
            Paradox rolled{" "}
            <b style={{ color: cast.paradoxSuccesses > 0 ? "var(--bad)" : "var(--accent)" }}>
              {cast.paradoxSuccesses} {cast.paradoxSuccesses === 1 ? "success" : "successes"}
            </b>
            {cast.paradoxIsDramaticFailure ? " — dramatic failure, Paradox relents" : ""}
            {cast.containedSuccesses !== undefined
              ? ` · ${cast.containedSuccesses} contained`
              : ""}
          </span>
        )}
        {status === "resolved" && (
          <span className="mv-data">
            cast rolled{" "}
            <b style={{ color: (cast.castSuccesses ?? 0) > 0 ? "var(--accent)" : "var(--dim)" }}>
              {cast.castSuccesses} {cast.castSuccesses === 1 ? "success" : "successes"}
            </b>
            {cast.severity && cast.severity !== "none"
              ? ` · Paradox manifests: ${capitalize(cast.severity)}`
              : " · reality lets it pass"}
          </span>
        )}
      </div>

      {/* who the table waits on */}
      {!terminal && (
        <p className="mt-1.5 text-[11px] italic" style={{ color: "var(--dim)" }}>
          <span className="inline-flex size-1.5 animate-pulse rounded-full align-middle" style={{ background: "var(--accent)" }} />{" "}
          waiting on {waiting === "storyteller" ? "the Storyteller" : cast.casterName}
          {(waiting === "caster" && isCaster) ||
          (waiting === "storyteller" && isStoryteller)
            ? " — you"
            : ""}
        </p>
      )}

      {/* The ST's liability buttons (issue #44): each press patches the shared
          document, and every screen watches the pool reassemble live. */}
      {controls.includes("negotiate") && (
        <div
          className="mt-2 grid gap-2 rounded-[3px] p-2"
          style={{ border: "1px dashed var(--line)" }}
        >
          <span className="mv-eyebrow">Liabilities — live for the whole table</span>
          <div className="flex flex-wrap items-center gap-3">
            <NumberInput
              label="witnesses"
              value={effectiveWitnessCount(cast)}
              onChange={(n) => run(() => editLiabilities({ ...step, witnessCount: n }))}
              disabled={busy}
            />
            <NumberInput
              label="prior rolls"
              value={cast.priorParadoxRolls ?? 0}
              onChange={(n) =>
                run(() => editLiabilities({ ...step, priorParadoxRolls: n }))
              }
              disabled={busy}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(cast.discretionaryModifiers ?? []).map((m, i) => (
              <span
                key={`${m.source}-${i}`}
                className="mv-data inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 text-[10px]"
                style={{ border: "1px solid var(--line)", color: "var(--ink)" }}
              >
                {m.source} {m.dice > 0 ? `+${m.dice}` : m.dice}
                <button
                  onClick={() =>
                    run(() =>
                      editLiabilities({
                        ...step,
                        discretionaryModifiers: (cast.discretionaryModifiers ?? [])
                          .filter((_, j) => j !== i)
                          .map((d) => ({ ...d })),
                      }),
                    )
                  }
                  disabled={busy}
                  className="leading-none disabled:opacity-40"
                  style={{ color: "var(--dim)" }}
                  title="Remove this modifier"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={modSource}
              onChange={(e) => setModSource(e.target.value)}
              placeholder="Name a circumstance…"
              className="mv-data w-36 rounded-[3px] border bg-transparent px-2 py-0.5 text-[11px] outline-none focus:border-[var(--accent)]"
              style={{ borderColor: "var(--line)" }}
            />
            <DiceStepper value={modDice} onChange={setModDice} disabled={busy} />
            <button
              onClick={async () => {
                const source = modSource.trim()
                if (source.length === 0) return
                const ok = await run(() =>
                  editLiabilities({
                    ...step,
                    discretionaryModifiers: [
                      ...(cast.discretionaryModifiers ?? []).map((d) => ({ ...d })),
                      { source, dice: modDice },
                    ],
                  }),
                )
                if (ok) setModSource("")
              }}
              disabled={busy || modSource.trim().length === 0}
              className="mv-mini disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* the viewer's controls — and only theirs */}
      {controls.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {controls.includes("engage") && (
            <button
              onClick={() => run(() => engage(step))}
              disabled={busy}
              className="mv-roll rounded-[3px] px-3 py-1.5 text-[12px] disabled:opacity-40"
            >
              Engage
            </button>
          )}
          {controls.includes("decline") && (
            <button
              onClick={() => run(() => decline(step))}
              disabled={busy}
              className="mv-btn rounded-[3px] px-3 py-1.5 text-[12px]"
            >
              Decline
            </button>
          )}
          {controls.includes("kill") && (
            <button
              onClick={() => run(() => kill(step))}
              disabled={busy}
              className="mv-btn rounded-[3px] px-3 py-1.5 text-[12px]"
            >
              Withdraw
            </button>
          )}
          {controls.includes("tool") && (
            <button
              onClick={() =>
                run(() =>
                  setTool({ ...step, usesMagicalTool: !cast.usesMagicalTool }),
                )
              }
              disabled={busy}
              className={`mv-mini disabled:opacity-40 ${cast.usesMagicalTool ? "mv-mini-on" : ""}`}
              title="−1 Paradox die — yours to change until the Storyteller locks"
            >
              Magical tool
            </button>
          )}
          {controls.includes("lockLiabilities") && (
            <button
              onClick={() => run(() => lockLiabilities(step))}
              disabled={busy}
              className="mv-roll rounded-[3px] px-3 py-1.5 text-[12px] disabled:opacity-40"
            >
              Lock Liabilities
            </button>
          )}
          {controls.includes("lockIntention") && (
            <>
              <NumberInput
                label="mitigate"
                value={mitigation}
                cap={mitigationCap}
                onChange={setMitigation}
                disabled={busy}
              />
              <button
                onClick={() =>
                  run(() => lockIntention({ ...step, manaMitigation: mitigation }))
                }
                disabled={busy}
                className="mv-roll rounded-[3px] px-3 py-1.5 text-[12px] disabled:opacity-40"
                title="The point of no return: mitigation and spell cost commit now."
              >
                Lock Intention — commit {cast.spellManaCost + mitigation} Mana
              </button>
            </>
          )}
          {controls.includes("rollParadox") && (
            <button
              onClick={() => run(() => rollParadox(step))}
              disabled={busy}
              className="mv-roll rounded-[3px] px-3 py-1.5 text-[12px] disabled:opacity-40"
            >
              Roll Paradox
            </button>
          )}
          {controls.includes("contain") && (
            <>
              <NumberInput
                label="contain"
                value={contained}
                cap={containCap}
                onChange={setContained}
                disabled={busy}
              />
              <button
                onClick={() =>
                  run(() => contain({ ...step, containedSuccesses: contained }))
                }
                disabled={busy}
                className="mv-roll rounded-[3px] px-3 py-1.5 text-[12px] disabled:opacity-40"
                title="Each contained success is one Resistant bashing wound."
              >
                Contain {contained} as Resistant bashing
              </button>
            </>
          )}
          {controls.includes("rollCast") && (
            <button
              onClick={() => run(() => rollCast(step))}
              disabled={busy}
              className="mv-roll rounded-[3px] px-3 py-1.5 text-[12px] disabled:opacity-40"
            >
              Release the Spell
            </button>
          )}
          {controls.includes("cancel") && (
            <button
              onClick={() => run(() => cancel(step))}
              disabled={busy}
              className="mv-btn rounded-[3px] px-3 py-1.5 text-[12px]"
            >
              Cancel
            </button>
          )}
          {controls.includes("void") && (
            <button
              onClick={() => run(() => voidCast(step))}
              disabled={busy}
              className="mv-btn ml-auto rounded-[3px] px-2 py-1 text-[11px]"
              style={{ borderColor: "var(--bad)", color: "var(--bad)" }}
              title="Override-stamped repair: restores Mana and Health, frees the stage, leaves no accumulator trace."
            >
              Void
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-[12px]" style={{ color: "var(--bad)" }}>
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * A plain number input (issue #43: previews come in a later slice). With a
 * `cap` it clamps and shows the ceiling; without one it counts freely from 0
 * — the ST's liability counts have no rules ceiling (issue #44).
 */
function NumberInput({
  label,
  value,
  cap,
  onChange,
  disabled,
}: {
  label: string
  value: number
  cap?: number
  onChange: (value: number) => void
  disabled: boolean
}) {
  const clamped = cap === undefined ? value : Math.min(value, cap)
  return (
    <div className="flex items-center gap-1">
      <span className="mv-data text-[10px] uppercase tracking-wider" style={{ color: "var(--dim)" }}>
        {label}
      </span>
      <button
        onClick={() => onChange(Math.max(clamped - 1, 0))}
        disabled={disabled || clamped <= 0}
        className="mv-btn grid size-6 place-items-center rounded-[3px] text-[13px] leading-none disabled:opacity-40"
      >
        −
      </button>
      <span className="mv-data w-6 text-center text-[13px] font-bold">{clamped}</span>
      <button
        onClick={() => onChange(cap === undefined ? clamped + 1 : Math.min(clamped + 1, cap))}
        disabled={disabled || (cap !== undefined && clamped >= cap)}
        className="mv-btn grid size-6 place-items-center rounded-[3px] text-[13px] leading-none disabled:opacity-40"
      >
        +
      </button>
      {cap !== undefined && (
        <span className="mv-data text-[10px]" style={{ color: "var(--dim)" }}>
          / {cap}
        </span>
      )}
    </div>
  )
}

/**
 * The discretionary modifier's ± die count (issue #44): steps over zero (a
 * zero-die modifier means nothing) and stays within the ±10 a single ruling
 * plausibly reaches; a wilder swing is several named rulings, each readable.
 */
function DiceStepper({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (value: number) => void
  disabled: boolean
}) {
  const step = (dir: 1 | -1) => {
    const next = value + dir
    onChange(next === 0 ? next + dir : next)
  }
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => step(-1)}
        disabled={disabled || value <= -10}
        className="mv-btn grid size-6 place-items-center rounded-[3px] text-[13px] leading-none disabled:opacity-40"
      >
        −
      </button>
      <span className="mv-data w-7 text-center text-[13px] font-bold">
        {value > 0 ? `+${value}` : value}
      </span>
      <button
        onClick={() => step(1)}
        disabled={disabled || value >= 10}
        className="mv-btn grid size-6 place-items-center rounded-[3px] text-[13px] leading-none disabled:opacity-40"
      >
        +
      </button>
    </div>
  )
}
