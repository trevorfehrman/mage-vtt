import { useEffect, useState } from "react"
import { useMutation } from "convex/react"
import { useMachine } from "@xstate/react"
import { AnimatePresence, useReducedMotion } from "motion/react"
import type { CastEntry } from "#/domain/activity"
import {
  containmentCap,
  containmentOutlook,
  mitigationCap,
  isRoteCast,
  toGnosisRank,
  waitingOn,
  type CastStatus,
} from "#/domain/cast"
import type { CharacterSheet } from "#/domain/character"
import type { HealthTrack } from "#/domain/damage"
import { calculateParadoxPool } from "#/domain/paradox"
import { rollOdds } from "#/domain/probability"
import { seamErrorMessage } from "#/lib/seam-errors"
import { WILLPOWER_COMPONENT_NAME } from "#/domain/willpower-economy"
import { castLadderMachine, ladderControls, ladderRung } from "#/machines/cast-ladder"
import { ArcanaGlyph } from "./ArcanaGlyph"
import { FeltDie } from "./FeltDie"
import { ParadoxGlyph } from "./ParadoxGlyph"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

/**
 * The live Cast card (issue #43, ADR-0016; the card takeover, owner ruling
 * 2026-07-19): a projection of the Cast document — one artifact rendered by
 * seat. While the cast is live it IS the caster's and the Storyteller's roll
 * zones (the vulgar UI is the card, standing where the dice roller was, with
 * every control the seat needs — engage/decline included); the Activity feed
 * carries it only for spectators. The XState machine mirrors the subscribed
 * document (rehydrating mid-ladder on reload is just "render the snapshot");
 * every button is a Convex mutation whose refusal surfaces inline in table
 * language (ADR-0010).
 */

const RUNGS: ReadonlyArray<{ status: CastStatus; label: string }> = [
  { status: "draft", label: "Draft" },
  { status: "price", label: "Tides" },
  { status: "paradox", label: "Paradox" },
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
  moreWaiting = 0,
}: {
  cast: CastEntry
  sessionId: Id<"sessions">
  isStoryteller: boolean
  viewerUserId: string
  /** The viewer's own decoded sheet — the caster's input caps read from it. */
  mySheet: CharacterSheet | null
  /** Drafts queued behind this one — the ST zone's wings note. */
  moreWaiting?: number
}) {
  // The machine is a projection of the document (ADR-0016): input rehydrates
  // mid-ladder, SYNC tracks every realtime update, and the card renders from
  // the machine's rung — the document remains the only owner of state.
  const [state, send] = useMachine(castLadderMachine, { input: { cast } })
  useEffect(() => send({ type: "SYNC", cast }), [cast, send])
  const status = ladderRung(state.value, cast)
  const reduced = useReducedMotion()

  const isCaster = cast.casterUserId === viewerUserId
  // The full vocabulary, engage/decline included (card takeover, 2026-07-19):
  // the card is the ST's roll zone now, so the offer's decision lives on it —
  // and the feed hides the live card from the ST, so it never doubles.
  const controls = ladderControls(cast, { isStoryteller, isCaster })

  const engage = useMutation(api.casts.engage)
  const decline = useMutation(api.casts.decline)
  const kill = useMutation(api.casts.kill)
  const adjustPrice = useMutation(api.casts.adjustPrice)
  const lockPrice = useMutation(api.casts.lockPrice)
  const commit = useMutation(api.casts.commit)
  const cancel = useMutation(api.casts.cancel)
  const rollParadox = useMutation(api.casts.rollParadox)
  const release = useMutation(api.casts.release)
  const voidCast = useMutation(api.casts.voidCast)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mitigation, setMitigation] = useState(0)
  // Containment selection is local until the Cast click (#113): the server
  // first hears the sacrifice when the release commits it.
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

  // The Paradox pool as the freeze stamped it (ADR-0022) — the same leaf the
  // server rolls with, never a reimplementation. Before the freeze nothing is
  // settled, so the card prices nothing (the strip shows the live Tides).
  const poolInputs =
    cast.gnosis !== undefined && cast.tides !== undefined
      ? {
          gnosis: toGnosisRank(cast.gnosis),
          isRote: isRoteCast(cast),
          usesMagicalTool: cast.usesMagicalTool,
          witnessCount: cast.tides.witnessCount,
          priorParadoxRollsThisScene: cast.tides.priorParadoxRolls,
          discretionaryModifiers: [
            ...cast.tides.circumstances,
            ...(cast.adjustments ?? []),
          ],
        }
      : null
  const priceFrozenUncommitted = status === "price" && cast.tides !== undefined
  const pool = poolInputs
    ? calculateParadoxPool({
        ...poolInputs,
        ...(priceFrozenUncommitted
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
  const mitigateCap = mySheet
    ? mitigationCap(poolBeforeMitigation, mySheet.manaCurrent, cast.spellManaCost)
    : 0
  const containCap = mySheet
    ? containmentCap(mySheet.healthTrack, cast.paradoxSuccesses ?? 0)
    : (cast.paradoxSuccesses ?? 0)

  const waiting = waitingOn(cast)
  const terminal = waiting === null

  // The declared pool as physical dice (card takeover, 2026-07-19): the felt
  // grammar, never the sentence "declared pool 3" — Willpower's precommitted
  // dice keep their ember provenance, the rest are the sheet's verdigris.
  // During the caster's containment bet, the dice the bet would eat
  // (uncontained Paradox + the new wound penalty) ghost from the row's end:
  // the price being weighed before the one Cast click. The end is where the
  // embers sit, and that's doctrine, not an accident — the Willpower dice
  // are pool members "as losable to Paradox as any other die" (ADR-0022).
  const willpowerDice =
    cast.declaredComponents.find((c) => c.name === WILLPOWER_COMPONENT_NAME)
      ?.dots ?? 0
  const eaten =
    controls.includes("contain") && mySheet !== null
      ? containmentOutlook({
          track: mySheet.healthTrack,
          declaredPool: cast.declaredPool,
          paradoxSuccesses: cast.paradoxSuccesses ?? 0,
          contained: Math.min(contained, containCap),
        }).eaten
      : 0
  const feltDice = Array.from({ length: cast.declaredPool }, (_, i) => {
    const kind = i >= cast.declaredPool - willpowerDice ? "willpower" : "sheet"
    const ghosted = i >= cast.declaredPool - eaten
    return (
      <FeltDie
        key={`${kind}:${i}`}
        kind={kind}
        reduced={reduced}
        ghosted={ghosted}
        title={
          ghosted
            ? "Eaten by the bet — uncontained Paradox and its wound penalty"
            : kind === "willpower"
              ? "Willpower — precommitted and blind; Paradox can eat these like any others"
              : "The declared pool, from the sheet"
        }
      />
    )
  })
  const lineage = cast.declaredComponents
    .filter((c) => c.dots > 0 && c.name !== "Willpower")
    .map((c) => c.name)
    .join(" + ")
  const declaredTerms = [
    // The bought floor (issue #107): what a dispel rolls against.
    ...(cast.potency !== undefined ? [`Potency ${cast.potency} bought`] : []),
    ...(cast.targets !== undefined ? [`×${cast.targets} targets`] : []),
    ...(cast.usesMagicalTool ? ["tool in hand −1"] : []),
  ]

  return (
    <div
      className="mv-cornered mv-panel mv-vulgar-floor rounded-[3px] p-2.5"
      style={terminal && status !== "resolved" ? { opacity: 0.65 } : undefined}
    >
      {/* the loud header (card takeover, 2026-07-19): the cast names itself
          in your face — VULGAR PRIME 1 — the caster and their intent beneath.
          The old "Vulgar Cast" badge died with it: the headline IS the word. */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ArcanaGlyph arcanum={cast.arcanum} size={18} className="mv-accent shrink-0" />
          <span
            className="mv-h truncate text-[18px] uppercase tracking-[0.06em]"
            style={{ color: "var(--ink)" }}
          >
            Vulgar {cast.arcanum} {cast.level}
          </span>
        </div>
        <div className="flex gap-1 pt-1">
          {status === "voided" && cast.override && (
            <span
              className="mv-data rounded-[2px] px-1 py-0.5 text-[12px] uppercase tracking-wide"
              title={`Invoked by ${cast.override.invokedByName}`}
              style={{ border: "1px solid var(--bad)", color: "var(--bad)" }}
            >
              Voided · Repair
            </span>
          )}
          {status === "cancelled" && (
            <span
              className="mv-data rounded-[2px] px-1 py-0.5 text-[12px] uppercase tracking-wide"
              style={{ border: "1px solid var(--dim)", color: "var(--dim)" }}
            >
              Cancelled
            </span>
          )}
        </div>
      </div>

      <p className="mt-0.5 text-[13px]" style={{ color: "var(--ink)" }}>
        <span className="font-medium">{cast.casterName}</span>
        {cast.roteName && (
          <span className="mv-data text-[12px]" style={{ color: "var(--dim)" }}>
            {" "}
            · Rote &ldquo;{cast.roteName}&rdquo;
          </span>
        )}
      </p>

      {cast.intent && (
        <p className="mt-0.5 text-[12px] italic" style={{ color: "var(--dim)" }}>
          &ldquo;{cast.intent}&rdquo;
        </p>
      )}

      {/* the ladder — the same rungs on every screen */}
      {status !== "cancelled" && status !== "voided" && (
        <div className="mt-2 flex items-center gap-1">
          {RUNGS.map((rung, i) => {
            const here = i === rungIndex(status)
            const past = i < rungIndex(status)
            // One green in all weathers (#114, reversing ADR-0022's
            // two-colored rungs): the tracker only says how far the ladder
            // has climbed — the waiting zone below carries whose move it is.
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
                  className="mv-data truncate text-center text-[12px] uppercase tracking-wide"
                  style={{ color: here ? "var(--accent)" : "var(--dim)" }}
                >
                  {rung.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* the declared pool on the felt — provenance left, terms right in the
          gutter, the same physical grammar as the declaring felt */}
      <div
        className="mv-felt mt-2 rounded-[6px] border"
        style={{
          borderColor: "var(--line)",
          background: "color-mix(in srgb, var(--accent) 6%, transparent)",
        }}
      >
        <div className="flex flex-wrap content-start gap-2.5 p-2.5">
          <AnimatePresence initial={false}>{feltDice}</AnimatePresence>
          {cast.declaredPool === 0 && (
            <span className="mv-data text-[12px]" style={{ color: "var(--dim)" }}>
              no pool — a chance die waits
            </span>
          )}
        </div>
        <div
          className="mv-data flex flex-wrap items-baseline justify-between gap-x-2 px-2.5 pb-2 text-[12px] leading-none"
          style={{ color: "var(--dim)" }}
        >
          <span className="truncate">{lineage}</span>
          <span className="whitespace-nowrap">
            {declaredTerms.join(" · ")}
            {cast.spellManaCost > 0 && (
              <>
                {declaredTerms.length > 0 ? " · " : ""}
                <b
                  className="text-[12px]"
                  style={{ color: "var(--mana)" }}
                  title="Mana cost — it spends when the cast commits"
                >
                  ◈{cast.spellManaCost}
                </b>
              </>
            )}
          </span>
        </div>
      </div>

      {/* the numbers of the moment */}
      <div className="mt-2 grid gap-1 text-[12px]" style={{ color: "var(--dim)" }}>
        {pool !== null && !terminal && (
          <span className="mv-data">
            Paradox pool{" "}
            {/* A dice count is a quantity, never good news (#102) — the
                insurance table below headlines the actual risk. */}
            <b style={{ color: "var(--ink)" }}>
              {pool.totalDice === 0 ? "chance die" : `${pool.totalDice} dice`}
            </b>
            {" — "}
            {[`Gnosis ${pool.baseDice}`, ...pool.modifiers.map((m) => `${m.source} ${m.dice > 0 ? "+" : ""}${m.dice}`)].join(", ")}
          </span>
        )}
        {cast.paradoxSuccesses !== undefined && (
          <span className="mv-data inline-flex items-center gap-1">
            {/* Paradox is never "successes" (#114): the glyph speaks the word,
                the count is the fact — you have this many to deal with. */}
            <ParadoxGlyph size={13} />
            <b style={{ color: cast.paradoxSuccesses > 0 ? "var(--paradox)" : "var(--rail-success)" }}>
              {cast.paradoxSuccesses}
            </b>
            rolled
            {cast.paradoxIsDramaticFailure ? " — dramatic failure, Paradox relents" : ""}
            {cast.containedSuccesses !== undefined
              ? ` · ${cast.containedSuccesses} contained`
              : ""}
          </span>
        )}
        {status === "resolved" && (
          <span className="mv-data">
            cast rolled{" "}
            <b style={{ color: (cast.castSuccesses ?? 0) > 0 ? "var(--rail-success)" : "var(--dim)" }}>
              {cast.castSuccesses} {cast.castSuccesses === 1 ? "success" : "successes"}
            </b>
            {cast.severity && cast.severity !== "none"
              ? ` · Paradox manifests: ${capitalize(cast.severity)}`
              : " · reality lets it pass"}
          </span>
        )}
      </div>

      {/* The ST's personal adjustments (ADR-0022): facts about this caster's
          situation, patched onto the shared document while the Tides are
          fluid — the scene's ambient Tides live on the strip, not here. */}
      {controls.includes("adjust") && (
        <div className="mt-2 grid gap-2 py-1">
          <span className="mv-eyebrow">Tides</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {(cast.adjustments ?? []).map((m, i) => (
              <span
                key={`${m.source}-${i}`}
                className="mv-data inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 text-[12px]"
                style={{ border: "1px solid var(--line)", color: "var(--ink)" }}
              >
                {m.source} {m.dice > 0 ? `+${m.dice}` : m.dice}
                <button
                  onClick={() =>
                    run(() =>
                      adjustPrice({
                        ...step,
                        adjustments: (cast.adjustments ?? [])
                          .filter((_, j) => j !== i)
                          .map((d) => ({ ...d })),
                      }),
                    )
                  }
                  disabled={busy}
                  className="leading-none disabled:opacity-40"
                  style={{ color: "var(--dim)" }}
                  title="Remove this adjustment"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={modSource}
              onChange={(e) => setModSource(e.target.value)}
              placeholder="Name an adjustment…"
              className="mv-data w-36 rounded-[3px] border bg-transparent px-2 py-0.5 text-[12px] outline-none focus:border-[var(--accent)]"
              style={{ borderColor: "var(--line)" }}
            />
            <DiceStepper value={modDice} onChange={setModDice} disabled={busy} />
            <button
              onClick={async () => {
                const source = modSource.trim()
                if (source.length === 0) return
                const ok = await run(() =>
                  adjustPrice({
                    ...step,
                    adjustments: [
                      ...(cast.adjustments ?? []).map((d) => ({ ...d })),
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

      {/* The blind insurance, priced (issue #45): every affordable Mana spend,
          the Paradox pool it buys, and exact odds — before the caster commits. */}
      {controls.includes("commit") && poolInputs !== null && (
        <MitigationPreview
          poolInputs={poolInputs}
          cap={mitigateCap}
          selected={mitigation}
          onSelect={setMitigation}
          disabled={busy}
        />
      )}

      {/* The informed bet (issue #45): drag the slider, watch the double
          shrink — uncontained dice bought back, wound penalties paid for.
          Every stop is local (#113): the table hears one Cast click. */}
      {controls.includes("contain") && mySheet !== null && (
        <ContainmentBet
          track={mySheet.healthTrack}
          declaredPool={cast.declaredPool}
          paradoxSuccesses={cast.paradoxSuccesses ?? 0}
          cap={containCap}
          contained={Math.min(contained, containCap)}
          onChange={setContained}
          disabled={busy}
        />
      )}

      {/* the wings note — more drafts queue behind this one (ST zone) */}
      {moreWaiting > 0 && (
        <p className="mt-1.5 text-[12px] italic" style={{ color: "var(--dim)" }}>
          {moreWaiting} more {moreWaiting === 1 ? "waits" : "wait"} in the wings
        </p>
      )}

      {/* the viewer's controls — and only theirs. Doctrine (#114): the
          walk-aways (Withdraw, Decline, Cancel, Void) live on the left, the
          verdigris trigger stands alone on the right — every phase, no
          exceptions. */}
      {controls.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {controls.includes("kill") && (
            <button
              onClick={() => run(() => kill(step))}
              disabled={busy}
              className="mv-btn rounded-[3px] px-3 py-1.5 text-[12px]"
            >
              Withdraw
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
              className="mv-btn rounded-[3px] px-2 py-1 text-[12px]"
              style={{ borderColor: "var(--bad)", color: "var(--bad)" }}
              title="Override-stamped repair: restores Mana and Willpower, frees the stage, leaves no accumulator trace."
            >
              Void
            </button>
          )}
          <span className="flex-1" />
          {/* No StageOccupied gate mirror here (ADR-0021): the ST zone only
              surfaces the offer when the stage is free — an engaged cast
              holds the zone instead — and the ST is the sole engager, so a
              refusable Engage click is structurally unreachable. The seam
              still refuses and the refusal renders inline. */}
          {controls.includes("engage") && (
            <button
              onClick={() => run(() => engage(step))}
              disabled={busy}
              className="mv-roll rounded-[3px] px-3 py-1.5 text-[12px] disabled:opacity-40"
              title="Put the offer on stage — the Tides get set on this card."
            >
              Engage
            </button>
          )}
          {controls.includes("lockPrice") && (
            <button
              onClick={() => run(() => lockPrice(step))}
              disabled={busy}
              className="mv-roll rounded-[3px] px-3 py-1.5 text-[12px] disabled:opacity-40"
              title="THE FREEZE: the Tides stamp onto the card and cannot shift again."
            >
              Freeze the Tides
            </button>
          )}
          {controls.includes("commit") && (
            <>
              <NumberInput
                label="mitigate"
                value={mitigation}
                cap={mitigateCap}
                onChange={setMitigation}
                disabled={busy}
              />
              <button
                onClick={() =>
                  run(() => commit({ ...step, manaMitigation: mitigation }))
                }
                disabled={busy}
                className="mv-roll rounded-[3px] px-3 py-1.5 text-[12px] disabled:opacity-40"
                title="The point of no return: mitigation, spell cost, and any precommitted Willpower commit now."
              >
                Commit — {cast.spellManaCost + mitigation} Mana
                {cast.spendWillpower ? " + Willpower" : ""}
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
          {controls.includes("contain") && mySheet === null && (
            <NumberInput
              label="contain"
              value={contained}
              cap={containCap}
              onChange={setContained}
              disabled={busy}
            />
          )}
          {/* Triggers are always the verdigris mv-roll — the established
              right-pane pattern. Ember marks ARMED, reversible selection only
              (lit skills, the mitigation row, the recitation): things that
              are their own cancel. Ember-as-submit was auditioned and
              rescinded (#102, owner walk 2026-07-18) — it read as aimless
              against the hot Paradox family. */}
          {controls.includes("release") && (
            <button
              onClick={() =>
                run(() => release({ ...step, containedSuccesses: contained }))
              }
              disabled={busy}
              className="mv-roll rounded-[3px] px-3 py-1.5 text-[12px] disabled:opacity-40"
              title="One commitment: the containment lands as Resistant bashing and the dice fly."
            >
              Cast{contained > 0 ? ` — contain ${contained}` : ""}
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-[12px]" style={{ color: "var(--bad)" }}>
          {error}
        </p>
      )}

      {/* The status zone (#114): who the table waits on, in one dedicated
          spot — the card's foot, every phase, don't-make-me-think. */}
      {!terminal && (
        <p
          className="mt-2 border-t pt-1.5 text-[12px] italic"
          style={{ color: "var(--dim)", borderColor: "var(--line)" }}
        >
          <span
            className="inline-flex size-1.5 animate-pulse rounded-full align-middle"
            style={{
              background:
                waiting === "caster" ? "var(--turn-caster)" : "var(--turn-world)",
            }}
          />{" "}
          waiting on {waiting === "storyteller" ? "the Storyteller" : cast.casterName}
          {(waiting === "caster" && isCaster) ||
          (waiting === "storyteller" && isStoryteller)
            ? " — you"
            : ""}
        </p>
      )}
    </div>
  )
}

/**
 * A plain number input. With a `cap` it clamps and shows the ceiling; without
 * one it counts freely from 0 — the ST's liability counts have no rules
 * ceiling (issue #44). The caster's betting controls pair it with (mitigate)
 * or trade it for (contain) the live previews above (issue #45).
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
      <span className="mv-data text-[12px] uppercase tracking-wider" style={{ color: "var(--dim)" }}>
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
        <span className="mv-data text-[12px]" style={{ color: "var(--dim)" }}>
          / {cap}
        </span>
      )}
    </div>
  )
}

/** Exact odds, table-legible: one decimal, tiny-but-real never rounds to 0. */
const pct = (p: number): string => {
  if (p <= 0) return "0%"
  if (p < 0.001) return "<0.1%"
  return `${(p * 100).toFixed(1)}%`
}

const diceLabel = (dice: number): string =>
  dice <= 0 ? "chance die" : dice === 1 ? "1 die" : `${dice} dice`

/**
 * Pricing the blind insurance (issue #45): one row per affordable Mana spend —
 * the shrunken Paradox pool and its exact odds, live off the same leaves the
 * server rolls with. Rows select; the lock button commits.
 */
function MitigationPreview({
  poolInputs,
  cap,
  selected,
  onSelect,
  disabled,
}: {
  poolInputs: Omit<Parameters<typeof calculateParadoxPool>[0], "manaMitigation">
  cap: number
  selected: number
  onSelect: (spend: number) => void
  disabled: boolean
}) {
  const rows = Array.from({ length: cap + 1 }, (_, spend) => {
    const dice = calculateParadoxPool({ ...poolInputs, manaMitigation: spend }).totalDice
    return { spend, dice, odds: rollOdds(dice) }
  })
  return (
    // No explainer eyebrow, no dotted frame (#114): the table is the phase's
    // whole job and its columns speak the rule — Mana in, Paradox dice out.
    <div className="mt-2 grid gap-1 py-1">
      {/* Danger reads as danger (#102): the risk is the headline — the
          Paradox glyph does the yelling (#114), "bites" retired with it.
          Dice counts stay neutral quantities — never accent-green good news.
          Picking a spend is the caster's hand, so selection burns ember; the
          Mana price wears Mana's own glyph alone (no symbol+word doubling). */}
      {rows.map(({ spend, dice, odds }) => {
        const here = spend === Math.min(selected, cap)
        return (
          <button
            key={spend}
            onClick={() => onSelect(spend)}
            disabled={disabled}
            className="mv-data grid grid-cols-[3.5rem_5.5rem_1fr_1fr] items-center gap-2 rounded-[2px] px-1.5 py-0.5 text-left text-[12px] disabled:opacity-40"
            style={{
              border: here ? "1px solid var(--ember)" : "1px solid transparent",
              color: here ? "var(--ink)" : "var(--dim)",
            }}
          >
            <span style={{ color: here ? "var(--mana)" : undefined }}>
              ◈ {spend}
            </span>
            <span style={{ color: here ? "var(--ink)" : undefined }}>
              {diceLabel(dice)}
            </span>
            <span className="inline-flex items-center gap-1">
              <ParadoxGlyph size={12} />
              <b className="text-[12px]" style={{ color: "var(--paradox)" }}>
                {pct(odds.success)}
              </b>
            </span>
            <span>~{odds.expected.toFixed(2)} Paradox</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * The informed bet (issue #45): per slider stop, the Resistant bashing to be
 * taken, the wound penalty it newly causes, the surviving cast pool — shrunk
 * twice, by uncontained successes and by that self-inflicted penalty — and
 * the pool's exact odds, recomputing at every stop. The martyr stop announces
 * the full-track unconsciousness rule before the caster takes it.
 */
function ContainmentBet({
  track,
  declaredPool,
  paradoxSuccesses,
  cap,
  contained,
  onChange,
  disabled,
}: {
  track: HealthTrack
  declaredPool: number
  paradoxSuccesses: number
  cap: number
  contained: number
  onChange: (value: number) => void
  disabled: boolean
}) {
  const outlook = containmentOutlook({ track, declaredPool, paradoxSuccesses, contained })
  const odds = rollOdds(outlook.castPool)
  return (
    <div className="mt-2 grid gap-1.5 py-1">
      <span className="mv-eyebrow">The bet — flesh against dice</span>
      <div className="flex items-center gap-2">
        <span className="mv-data text-[12px] uppercase tracking-wider" style={{ color: "var(--dim)" }}>
          contain
        </span>
        <input
          type="range"
          min={0}
          max={cap}
          step={1}
          value={contained}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled || cap === 0}
          className="flex-1 accent-[var(--ember)]"
        />
        <span className="mv-data w-10 text-center text-[13px] font-bold">
          {contained} / {cap}
        </span>
      </div>
      <div className="mv-data grid grid-cols-2 gap-x-3 gap-y-0.5 text-[12px] sm:grid-cols-4" style={{ color: "var(--dim)" }}>
        <span>
          takes <b style={{ color: outlook.damage > 0 ? "var(--bad)" : "var(--ink)" }}>
            {outlook.damage} Resistant bashing
          </b>
        </span>
        <span>
          wound penalty <b style={{ color: outlook.newPenalty < 0 ? "var(--bad)" : "var(--ink)" }}>
            {outlook.penaltyAfter}
          </b>
          {outlook.newPenalty < 0 ? ` (${outlook.newPenalty} new)` : ""}
        </span>
        <span>
          casts on <b style={{ color: "var(--ink)" }}>{diceLabel(outlook.castPool)}</b>
        </span>
        <span className="inline-flex items-center gap-1">
          <ParadoxGlyph size={12} />
          <b style={{ color: outlook.uncontained > 0 ? "var(--paradox)" : "var(--ink)" }}>
            {outlook.uncontained}
          </b>{" "}
          loose
        </span>
      </div>
      <div className="mv-data flex flex-wrap gap-x-3 gap-y-0.5 text-[12px]" style={{ color: "var(--dim)" }}>
        <span>
          success <b style={{ color: "var(--rail-success)" }}>{pct(odds.success)}</b>
        </span>
        <span>~{odds.expected.toFixed(2)} successes</span>
        <span>exceptional {pct(odds.exceptional)}</span>
        {odds.isChanceDie && (
          <span style={{ color: "var(--bad)" }}>
            dramatic failure {pct(odds.dramaticFailure)}
          </span>
        )}
      </div>
      {outlook.martyr && (
        <p className="text-[12px] italic" style={{ color: "var(--bad)" }}>
          This fills your last health box with bashing — the book calls that
          unconsciousness (Storyteller adjudicates). The cast still completes.
        </p>
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
