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
import {
  calculateParadoxPool,
  MANA_MITIGATION_SOURCE,
  resolveParadox,
  type ParadoxPoolModifier,
} from "#/domain/paradox"
import { rollOdds } from "#/domain/probability"
import { seamErrorMessage } from "#/lib/seam-errors"
import { WILLPOWER_COMPONENT_NAME } from "#/domain/willpower-economy"
import { castLadderMachine, ladderControls, ladderRung } from "#/machines/cast-ladder"
import { ArcanaGlyph, arcanumRealm } from "./ArcanaGlyph"
import { healthBoxGlyph, ResistantDot } from "./CharacterSheet"
import { Die } from "./Die"
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
 *
 * The vulgar polish pass (owner notes, 2026-07-19): the felt explains the
 * whole bet — Paradox stands on it as red dice beneath the declared pool,
 * the Tides ride its gutter as ebb/flood badges every seat watches live, and
 * the odds line sits directly beneath. Containment is the caster's own
 * health track rendered in-card (box clicks are the bet — the slider died),
 * the severity lore term burns big in --paradox, and resolution lands IN
 * this card (faces stamped on the document) — one card, never two.
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

/** The chance-die grace (note 5): it lived in the retired Paradox roll
 * card's summary; the cockpit's quiet slot speaks it mid-phase. The
 * Resolution used to echo it, but pass 3's note 9 cut the record to four
 * rows — no Paradox, no row — so the mid-phase slot is the grace's one home
 * and the record carries no dramatic-failure note (flagged to the owner). */
const PARADOX_GRACE =
  "dramatic failure — Paradox relents, and the Scene forgives its next accumulation"

export function CastCard({
  cast,
  sessionId,
  isStoryteller,
  viewerUserId,
  mySheet,
  casterSheet = null,
  moreWaiting = 0,
  onPendingMana,
}: {
  cast: CastEntry
  sessionId: Id<"sessions">
  isStoryteller: boolean
  viewerUserId: string
  /** The viewer's own decoded sheet — the caster's input caps read from it. */
  mySheet: CharacterSheet | null
  /** The CASTER's decoded sheet — the cockpit track every seat watches
   * (spectator suspense is a design goal, ADR-0022). For the caster it is
   * their own sheet; null renders the count fallback instead of the track. */
  casterSheet?: CharacterSheet | null
  /** Drafts queued behind this one — the ST zone's wings note. */
  moreWaiting?: number
  /** The masthead's Mana ghost (2026-07-19 pass 2, note 1): reports the
   * spell's cost from the first on-stage phase, plus the selected mitigation
   * while the commit decision is live; 0 once committed (truly spent). */
  onPendingMana?: ((mana: number) => void) | undefined
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

  // One door for both gestures (pass 2, note 2): the Add press and Enter in
  // the name input land the same tide.
  const addTide = async () => {
    const source = modSource.trim()
    if (source.length === 0 || busy) return
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
  }

  // The Paradox pool as the fix stamped it (ADR-0022) — the same leaf the
  // server rolls with, never a reimplementation. Before the fix nothing is
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
  const priceFixedUncommitted = status === "price" && cast.tides !== undefined
  const pool = poolInputs
    ? calculateParadoxPool({
        ...poolInputs,
        ...(priceFixedUncommitted
          ? { manaMitigation: mitigation }
          : cast.manaMitigation !== undefined
            ? { manaMitigation: cast.manaMitigation }
            : {}),
      })
    : null

  // The felt's pool while the Tides are still fluid (pass 3, note 1): the
  // Scene seed (witnesses, accumulator) isn't stamped yet, so this is a
  // PROVISIONAL pool — Gnosis base + rote/tool + the ST's live adjustments —
  // that grows and shrinks as tags land and truly settles at the fix.
  // `gnosis` stamps at engage, so the base is computable from the first
  // on-stage moment, on every seat's card.
  const provisionalPool =
    pool === null && status === "price" && cast.gnosis !== undefined
      ? calculateParadoxPool({
          gnosis: toGnosisRank(cast.gnosis),
          isRote: isRoteCast(cast),
          usesMagicalTool: cast.usesMagicalTool,
          discretionaryModifiers: cast.adjustments ?? [],
        })
      : null
  const feltPool = pool ?? provisionalPool

  // Input caps mirror the server's refusals; the server stays authoritative.
  const poolBeforeMitigation = poolInputs
    ? calculateParadoxPool(poolInputs).totalDice
    : 0
  const mitigateCap = mySheet
    ? mitigationCap(poolBeforeMitigation, mySheet.manaCurrent, cast.spellManaCost)
    : 0

  // The cockpit's sheet: the CASTER's track, whichever seat is watching —
  // the caster's own when they hold the card, the passed-in caster sheet on
  // every other seat (the 2026-07-19 polish, note 14).
  const cockpitSheet = isCaster ? mySheet : casterSheet
  const containCap = cockpitSheet
    ? containmentCap(cockpitSheet.healthTrack, cast.paradoxSuccesses ?? 0)
    : (cast.paradoxSuccesses ?? 0)
  const cockpitContained = controls.includes("contain")
    ? Math.min(contained, containCap)
    : 0
  const outlook =
    status === "paradox" &&
    cast.paradoxSuccesses !== undefined &&
    cockpitSheet !== null
      ? containmentOutlook({
          track: cockpitSheet.healthTrack,
          declaredPool: cast.declaredPool,
          paradoxSuccesses: cast.paradoxSuccesses,
          contained: cockpitContained,
        })
      : null

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
  const eaten = controls.includes("contain") && outlook !== null ? outlook.eaten : 0
  const feltDice = Array.from({ length: cast.declaredPool }, (_, i) => {
    const kind = i >= cast.declaredPool - willpowerDice ? "willpower" : "sheet"
    const ghosted = i >= cast.declaredPool - eaten
    return (
      <FeltDie
        key={`${kind}:${i}`}
        kind={kind}
        reduced={reduced}
        glide={false}
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
  // Paradox on the felt (2026-07-19 polish, note 11; walked forward to the
  // first fluid-phase moment by pass 3, note 1): the pool reality will roll,
  // standing beneath the declared pool from engage until the ST's roll —
  // provisional while the Tides are fluid, shrinking live as mitigation rows
  // are clicked once they're fixed. A fully mitigated pool still throws the
  // chance die (the gamble is honest), so a ghosted die stands for it. The
  // first `baseDice` render gnosis-green with the red glyph inside (note 6):
  // reality's own base, never worded as the rank — the rest are the Tides'.
  const paradoxDiceCount =
    feltPool !== null && cast.paradoxSuccesses === undefined && !terminal
      ? feltPool.totalDice
      : null
  const paradoxBaseCount =
    paradoxDiceCount !== null && feltPool !== null
      ? Math.min(feltPool.baseDice, paradoxDiceCount)
      : 0
  // The Tides on the felt (notes 3/4/17): the pool's named ±s as ebb/flood
  // badges in the gutter, live on every seat's card — fluid and fixed alike
  // now that the provisional pool computes (note 1) — except on the ST's own
  // card while editable, where the Tides block below carries them instead of
  // doubling here. The mitigation modifier never badges (pass 3, note 5):
  // the table and the shrinking dice count carry it.
  const tideBadges: ReadonlyArray<ParadoxPoolModifier> = controls.includes(
    "adjust",
  )
    ? []
    : feltPool !== null
      ? feltPool.modifiers.filter((m) => m.source !== MANA_MITIGATION_SOURCE)
      : (cast.adjustments ?? [])
  const declaredTerms = [
    // The bought floor (issue #107): what a dispel rolls against.
    ...(cast.potency !== undefined ? [`Potency ${cast.potency} bought`] : []),
    ...(cast.targets !== undefined ? [`×${cast.targets} targets`] : []),
    ...(cast.usesMagicalTool ? ["tool in hand −1"] : []),
  ]

  // The odds line beneath the felt (note 16; repointed by pass 3, note 3):
  // through the whole Tides phase it prices the SPELL — the declared pool's
  // success %, the same grammar every phase speaks — never the table's
  // Paradox % (the mitigation table keeps its per-row odds). Between the
  // commit and the ST's roll it prices the red dice; in the cockpit it
  // prices the surviving cast pool, recomputing as boxes are clicked.
  const paradoxOdds =
    status !== "price" && paradoxDiceCount !== null
      ? rollOdds(paradoxDiceCount)
      : null
  const successOdds =
    outlook !== null
      ? rollOdds(outlook.castPool)
      : status === "price"
        ? rollOdds(cast.declaredPool)
        : null

  // The masthead's Mana ghost (pass 2, note 1): the spell's cost ghosts from
  // the moment the cast is on stage ("phase 1" read as the first on-stage
  // phase — a waiting draft doesn't ghost), the selected mitigation joining
  // while the commit decision is live. After the commit the Mana is truly
  // spent and the masthead's real count carries it.
  const pendingManaNow =
    status === "price"
      ? cast.spellManaCost +
        (controls.includes("commit") ? Math.min(mitigation, mitigateCap) : 0)
      : 0
  useEffect(() => {
    if (onPendingMana === undefined) return
    onPendingMana(pendingManaNow)
    return () => onPendingMana(0)
  }, [onPendingMana, pendingManaNow])

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

      {/* Provenance ABOVE the felt (2026-07-20): the pool's lineage and the
          declared terms sit above the dice; the felt itself holds only the
          physical dice, and the Tides tags stand directly beneath it. */}
      <div
        className="mv-data mt-2 flex flex-wrap items-baseline justify-between gap-x-2 text-[12px] leading-none"
        style={{ color: "var(--dim)" }}
      >
        {/* Each pool component as an outlined tag (2026-07-20), the flood-tag
            grammar: Gnosis in theme-green (it still ADDS dice — the pool is
            Gnosis + Arcanum), the Arcanum in its Supernal realm color (Matter →
            Stygia lead). */}
        <span className="flex flex-wrap items-center gap-1.5">
          {cast.declaredComponents
            .filter((c) => c.dots > 0 && c.name !== WILLPOWER_COMPONENT_NAME)
            .map((c) => {
              const tint =
                c.type === "arcanum"
                  ? `var(--realm-${arcanumRealm(c.name.toLowerCase())})`
                  : "var(--accent)"
              return (
                <span
                  key={c.name}
                  className="whitespace-nowrap rounded-[2px] px-1 py-px"
                  style={{ border: `1px solid ${tint}`, color: tint }}
                >
                  {c.name} + {c.dots}
                </span>
              )
            })}
        </span>
        <span className="whitespace-nowrap">{declaredTerms.join(" · ")}</span>
      </div>
      <div
        className="mv-felt mt-1.5 rounded-[6px] border"
        style={{
          borderColor: "var(--line)",
          background: "color-mix(in srgb, var(--accent) 6%, transparent)",
        }}
      >
        {status === "resolved" && cast.castRolls !== undefined ? (
          // The cast roll on ONE row (2026-07-20): rolled faces, then the dice
          // the containment bet ATE as empty ghosts (declared − rolled), so the
          // felt shows the whole Gnosis + Arcanum pool. Explosions sit inline.
          <div className="flex flex-wrap content-start gap-4 p-2.5">
            {cast.castRolls.map((v, i) => (
              <Die
                key={`fb${i}`}
                v={v}
                again={10}
                chance={
                  cast.castIsChanceDie ??
                  (cast.castPool !== undefined && cast.castPool <= 0)
                }
                size="md"
                diamond
              />
            ))}
            {Array.from({
              length: Math.max(0, cast.declaredPool - cast.castRolls.length),
            }).map((_, i) => (
              <Die key={`fg${i}`} v={0} again={10} size="md" diamond ghost />
            ))}
            {(cast.castRoteRerolls ?? []).map((v, i) => (
              <Die key={`fr${i}`} v={v} again={10} ring="rote" size="md" diamond />
            ))}
            {(cast.castExplosions ?? []).map((v, i) => (
              <Die key={`fe${i}`} v={v} again={10} size="md" diamond />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap content-start gap-4 p-2.5">
            <AnimatePresence initial={false}>{feltDice}</AnimatePresence>
            {cast.declaredPool === 0 && (
              <span className="mv-data text-[12px]" style={{ color: "var(--dim)" }}>
                no pool — a chance die waits
              </span>
            )}
          </div>
        )}
        {status === "resolved" && (cast.paradoxRolls ?? []).length > 0 && (
          <div className="flex flex-wrap content-start gap-4 px-2.5 pb-2.5 pt-1">
            {(cast.paradoxRolls ?? []).map((v, i) => (
              <Die
                key={`fp${i}`}
                v={v}
                again={10}
                chance={cast.paradoxIsChanceDie ?? false}
                tone="paradox"
                size="md"
                diamond
              />
            ))}
            {(cast.paradoxExplosions ?? []).map((v, i) => (
              <Die
                key={`fpe${i}`}
                v={v}
                again={10}
                tone="paradox"
                size="md"
                diamond
              />
            ))}
          </div>
        )}
        {paradoxDiceCount !== null && (
          <div className="flex flex-wrap content-start gap-3 px-2.5 pb-2.5 pt-1">
            <AnimatePresence initial={false}>
              {Array.from({ length: paradoxDiceCount }, (_, i) => (
                <FeltDie
                  key={`paradox:${i}`}
                  kind={i < paradoxBaseCount ? "paradoxBase" : "paradox"}
                  reduced={reduced}
                  glide={false}
                  title={
                    i < paradoxBaseCount
                      ? "Reality's base Paradox dice — a dice count from Gnosis, never the rank; the Tides ebb and flood around these"
                      : "Paradox — a die reality will roll against this cast; Mana mitigation buys these off"
                  }
                />
              ))}
              {paradoxDiceCount === 0 && (
                <FeltDie
                  key="paradox:chance"
                  kind="paradox"
                  ghosted
                  reduced={reduced}
                  glide={false}
                  title="Fully mitigated — reality still throws a single chance die"
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
      {/* The Tides tags directly BENEATH the felt (2026-07-20). */}
      {tideBadges.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {tideBadges.map((m, i) => (
            <TideBadge key={`${m.source}-${i}`} modifier={m} />
          ))}
        </div>
      )}

      {/* the odds line — directly beneath the felt (note 16); ONE line, and
          in the Tides phase it prices the spell, not the table's Paradox
          (pass 3, note 3) */}
      {(paradoxOdds !== null || successOdds !== null) && (
        <div
          className="mv-data mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px]"
          style={{ color: "var(--dim)" }}
        >
          {/* Slimmed (pass 2, note 7): the success % is the odds line — no
              exceptional %, no ~expected counts. The dramatic-failure warning
              stays; danger reads as danger. */}
          {paradoxOdds !== null ? (
            <span className="inline-flex items-center gap-1">
              <ParadoxGlyph size={12} />
              <b style={{ color: "var(--paradox)" }}>{pct(paradoxOdds.success)}</b>
            </span>
          ) : successOdds !== null ? (
            <>
              <span>
                success{" "}
                <b style={{ color: "var(--rail-success)" }}>
                  {pct(successOdds.success)}
                </b>
              </span>
              {successOdds.isChanceDie && (
                <span style={{ color: "var(--bad)" }}>
                  dramatic failure {pct(successOdds.dramaticFailure)}
                </span>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* No "⟐ N rolled" numbers-line (pass 2, note 8): the cockpit's glyph
          column IS the count during the bet, and the Resolution carries the
          record — sentences don't restate what the symbols already say. */}

      {/* Resolution lives IN the card (the resolution merge, 2026-07-19):
          the faces stamped on the document, the successes, and the severity
          lore term — the record every seat reads, no roll card beside it. */}
      {status === "resolved" && <Resolution cast={cast} />}

      {/* The ST's personal adjustments (ADR-0022): facts about this caster's
          situation, patched onto the shared document while the Tides are
          fluid — the scene's ambient Tides live on the strip, not here.
          Relaid again by pass 2, note 2: a left-aligned block taking only the
          space it needs — the name input (Enter adds), then equal-width ebb
          and flood buttons stepping the count in the Tides' own colors, Add
          beside them, the tags stacked beneath. */}
      {controls.includes("adjust") && (
        <div className="mt-2 grid justify-start gap-2 py-1">
          <span className="mv-eyebrow">Tides</span>
          <input
            value={modSource}
            onChange={(e) => setModSource(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void addTide()
            }}
            placeholder="Name an adjustment…"
            className="mv-data w-64 rounded-[3px] border bg-transparent px-2 py-0.5 text-[12px] outline-none focus:border-[var(--accent)]"
            style={{ borderColor: "var(--line)" }}
          />
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setModDice(stepOverZero(modDice, -1))}
              disabled={busy || modDice <= -10}
              className="mv-btn w-16 rounded-[3px] py-1 text-[12px] leading-none disabled:opacity-40"
              style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
              title="Ebb — the Tides pull back: fewer Paradox dice"
            >
              ebb
            </button>
            <span
              className="mv-data w-8 text-center text-[13px] font-bold"
              style={{ color: modDice < 0 ? "var(--accent)" : "var(--ember)" }}
              title={modDice < 0 ? "Ebb — fewer Paradox dice" : "Flood — more Paradox dice"}
            >
              {modDice > 0 ? `+${modDice}` : modDice}
            </span>
            <button
              onClick={() => setModDice(stepOverZero(modDice, 1))}
              disabled={busy || modDice >= 10}
              className="mv-btn w-16 rounded-[3px] py-1 text-[12px] leading-none disabled:opacity-40"
              style={{ borderColor: "var(--ember)", color: "var(--ember)" }}
              title="Flood — the Tides rise: more Paradox dice"
            >
              flood
            </button>
            <button
              onClick={() => void addTide()}
              disabled={busy || modSource.trim().length === 0}
              className="mv-mini disabled:opacity-40"
            >
              Add
            </button>
          </div>
          {(cast.adjustments ?? []).length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {(cast.adjustments ?? []).map((m, i) => (
                <TideBadge
                  key={`${m.source}-${i}`}
                  modifier={m}
                  disabled={busy}
                  onRemove={() =>
                    run(() =>
                      adjustPrice({
                        ...step,
                        adjustments: (cast.adjustments ?? [])
                          .filter((_, j) => j !== i)
                          .map((d) => ({ ...d })),
                      }),
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* The blind insurance, priced (issue #45; note 7): one row per Paradox
          die whatever the Mana — unaffordable rows stand visible and refuse,
          so the table always shows the full shape of the risk. */}
      {controls.includes("commit") && poolInputs !== null && (
        <MitigationPreview
          poolInputs={poolInputs}
          poolBefore={poolBeforeMitigation}
          affordable={mitigateCap}
          selected={mitigation}
          onSelect={setMitigation}
          disabled={busy}
        />
      )}

      {/* The informed bet (issue #45; rebuilt by note 13): the caster's own
          health track IS the containment control — box clicks are the bet,
          the severity lore term burns above it, and every stop is local
          (#113) until the one Cast click. ST and spectator watch the same
          cockpit read-only (note 14). */}
      {/* outlook non-null already implies the rolled Paradox phase and a
          decodable caster sheet — the cockpit's whole precondition. Zero
          Paradox renders the same column (pass 2, note 8): no glyphs, the
          quiet word in the lore slot — the dead "⟐ 0 rolled" line's job. */}
      {outlook !== null && cockpitSheet !== null && (
        <ParadoxCockpit
          track={cockpitSheet.healthTrack}
          paradoxSuccesses={cast.paradoxSuccesses ?? 0}
          dramaticFailure={cast.paradoxIsDramaticFailure ?? false}
          cap={containCap}
          contained={cockpitContained}
          outlook={outlook}
          onChange={controls.includes("contain") ? setContained : undefined}
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
        // items-end keeps every walk-away and trigger on one baseline at one
        // size (pass 2, note 4; the spend column that motivated it moved
        // INTO the Commit button in pass 3, note 4).
        <div className="mt-2 flex flex-wrap items-end gap-2">
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
              title="THE FIX: the Tides stamp onto the card and cannot shift again."
            >
              Fix the Tides
            </button>
          )}
          {controls.includes("commit") && (
            // The spend rides IN the button (pass 3, note 4 — reversing pass
            // 2's glyph column): "Commit − 1 ◈" with the Mana part in Mana's
            // blue, on a dark inset so the blue stays legible against the
            // verdigris trigger. The precommitted Willpower point joins the
            // same inset in Will's own color, wearing the Mana glyph shape
            // (note 12) — the hue is the only difference between the two.
            <button
              onClick={() =>
                run(() => commit({ ...step, manaMitigation: mitigation }))
              }
              disabled={busy}
              className="mv-roll inline-flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-[12px] disabled:opacity-40"
              title="The point of no return: mitigation, spell cost, and any precommitted Willpower commit now."
            >
              Commit
              {(pendingManaNow > 0 || cast.spendWillpower) && (
                <span
                  className="mv-data inline-flex items-center gap-1.5 rounded-[2px] px-1 py-0.5 leading-none"
                  style={{ background: "var(--bg)" }}
                >
                  {pendingManaNow > 0 && (
                    <b
                      style={{ color: "var(--mana)" }}
                      title="The Mana this commit spends — spell cost plus the selected mitigation"
                    >
                      − {pendingManaNow} ◈
                    </b>
                  )}
                  {cast.spendWillpower && (
                    <b
                      style={{ color: "var(--accent)" }}
                      title="The precommitted Willpower point — it spends at the commit"
                    >
                      − 1 ◈
                    </b>
                  )}
                </span>
              )}
            </button>
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
          {controls.includes("contain") && cockpitSheet === null && (
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
              (lit skills, the mitigation row, the containment boxes): things
              that are their own cancel. Ember-as-submit was auditioned and
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
              {/* One word, one width (pass 2, notes 6/9): the tracker shows
                  the bet — the button never restates or resizes with it. */}
              Cast
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
 * One named ± on the Paradox pool, worn as a tide (notes 2–4, 17; restyled
 * by pass 3, note 6 — the owner backtracking on the outlined tags): a
 * smaller FILLED chip — ebb (−dice, the Tides pulling back) on verdigris
 * ground, flood (+dice, the Tides rising) on ember ground — white text on
 * both, per the owner's explicit call. "Smaller" is padding, never type:
 * the 12px vulgar floor (#114) holds. Removable on the ST's editable list.
 */
function TideBadge({
  modifier,
  onRemove,
  disabled = false,
}: {
  modifier: ParadoxPoolModifier
  onRemove?: () => void
  disabled?: boolean
}) {
  const ebb = modifier.dice < 0
  const tint = ebb ? "var(--accent)" : "var(--ember)"
  return (
    <span
      className="mv-data inline-flex items-center gap-1 rounded-[2px] px-1 py-px text-[12px] leading-tight"
      style={{
        background: "transparent",
        border: `1px solid ${tint}`,
        color: tint,
      }}
      title={
        ebb
          ? "Ebb — the Tides pull back: fewer Paradox dice"
          : "Flood — the Tides rise: more Paradox dice"
      }
    >
      {modifier.source}{" "}
      {modifier.dice > 0 ? `+ ${modifier.dice}` : `− ${Math.abs(modifier.dice)}`}
      {onRemove && (
        <button
          onClick={onRemove}
          disabled={disabled}
          className="leading-none opacity-80 disabled:opacity-40"
          style={{ color: tint }}
          title="Remove this adjustment"
        >
          ×
        </button>
      )}
    </span>
  )
}

/**
 * The stepper's ± die count (issue #44): steps over zero (a zero-die
 * modifier means nothing) and stays within the ±10 a single ruling plausibly
 * reaches; a wilder swing is several named rulings, each readable.
 */
const stepOverZero = (value: number, dir: 1 | -1): number => {
  const next = value + dir
  return next === 0 ? next + dir : next
}

/**
 * A plain number input. With a `cap` it clamps and shows the ceiling; without
 * one it counts freely from 0 — the ST's liability counts have no rules
 * ceiling (issue #44). Survives only as the containment fallback for a
 * caster whose sheet failed to decode — the track cockpit is the real control.
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
 * Pricing the blind insurance (issue #45; note 7): one row per Paradox die
 * regardless of the caster's Mana — the shrunken pool and its exact odds,
 * live off the same leaves the server rolls with. Affordable rows select
 * (they ARE the mitigation control — the stepper died with note 9);
 * unaffordable rows stand visible and refuse, their titles explaining the
 * gate (ADR-0021).
 */
function MitigationPreview({
  poolInputs,
  poolBefore,
  affordable,
  selected,
  onSelect,
  disabled,
}: {
  poolInputs: Omit<Parameters<typeof calculateParadoxPool>[0], "manaMitigation">
  poolBefore: number
  affordable: number
  selected: number
  onSelect: (spend: number) => void
  disabled: boolean
}) {
  const rows = Array.from({ length: poolBefore + 1 }, (_, spend) => {
    const dice = calculateParadoxPool({ ...poolInputs, manaMitigation: spend }).totalDice
    return { spend, dice, odds: rollOdds(dice) }
  })
  return (
    // No explainer eyebrow, no dotted frame (#114): the table is the phase's
    // whole job and its columns speak the rule — Mana in, Paradox dice out.
    <div className="mt-2 grid gap-1 py-1">
      {/* Danger reads as danger (#102): the risk is the headline — the
          Paradox glyph does the yelling (#114). Dice counts stay neutral
          quantities — never accent-green good news. Picking a spend is the
          caster's hand, so selection burns ember; the Mana price wears
          Mana's own glyph alone (no symbol+word doubling). */}
      {rows.map(({ spend, dice, odds }) => {
        const locked = spend > affordable
        const here = !locked && spend === Math.min(selected, affordable)
        const cells = (
          <>
            <span style={{ color: here ? "var(--mana)" : undefined }}>◈ {spend}</span>
            <span style={{ color: here ? "var(--ink)" : undefined }}>
              {diceLabel(dice)}
            </span>
            {/* No ~expected column (pass 2, note 7): the % is the odds. */}
            <span className="inline-flex items-center gap-1">
              <ParadoxGlyph size={12} />
              <b className="text-[12px]" style={{ color: "var(--paradox)" }}>
                {pct(odds.success)}
              </b>
            </span>
          </>
        )
        // A locked row is a mark, not a disabled control (the FeltDie idiom):
        // its title stays reachable and nothing pretends it could be clicked.
        return locked ? (
          <span
            key={spend}
            className="mv-data grid grid-cols-[3.5rem_5.5rem_1fr] items-center gap-2 rounded-[2px] px-1.5 py-0.5 text-left text-[12px]"
            style={{ border: "1px dashed var(--line)", color: "var(--dim)", opacity: 0.5 }}
            title={`Needs ${spend} Mana free after the spell's cost — ${affordable} ${affordable === 1 ? "is" : "are"} free.`}
          >
            {cells}
          </span>
        ) : (
          <button
            key={spend}
            onClick={() => onSelect(spend)}
            disabled={disabled}
            className="mv-data grid grid-cols-[3.5rem_5.5rem_1fr] items-center gap-2 rounded-[2px] px-1.5 py-0.5 text-left text-[12px] disabled:opacity-40"
            style={{
              border: here ? "1px solid var(--ember)" : "1px solid transparent",
              color: here ? "var(--ink)" : "var(--dim)",
            }}
          >
            {cells}
          </button>
        )
      })}
    </div>
  )
}

/**
 * The Paradox cockpit (notes 13–15; rebuilt symbolic by pass 2, notes 6/8/9):
 * a centered column that IS the phase's headline — one Paradox glyph per
 * success still to deal with (shrinking as boxes are clicked), the English
 * lore term beneath, the caster's health track beneath that. Box clicks ARE
 * the containment bet: each selected box one Paradox success absorbed as
 * Resistant bashing, worn in the printed sheet's own grammar — the damage
 * glyph in the box, the Resistant dot beneath it (Mage p. 124's "place a dot
 * beneath the marked box"), the −1/−2/−3 wound penalties standing at the last
 * three boxes as the paper sheet prints them (WoD p. 171), burning when the
 * bet brings them into effect. No prose rows: the felt's ghosting dice carry
 * "casts on", the track carries the damage and the penalty. Every slot holds
 * a reserved height so a click never shifts the track under the cursor
 * (note 6). Read-only (no `onChange`) for the ST and spectator seats: the
 * same cockpit, watched (ADR-0022's spectator suspense) — their view prices
 * the un-contained worst case, since the caster's clicks stay local until
 * the Cast (#113).
 */
function ParadoxCockpit({
  track,
  paradoxSuccesses,
  dramaticFailure,
  cap,
  contained,
  outlook,
  onChange,
  disabled = false,
}: {
  track: HealthTrack
  paradoxSuccesses: number
  /** The stamped chance-die grace — the quiet slot speaks it (note 5). */
  dramaticFailure: boolean
  cap: number
  contained: number
  outlook: ReturnType<typeof containmentOutlook>
  onChange?: ((value: number) => void) | undefined
  disabled?: boolean
}) {
  const interactive = onChange !== undefined
  const severity = resolveParadox(outlook.uncontained).severity
  // Bashing fills leftmost empty boxes first (applyDamage), so the bet
  // ghosts the first `contained` empties; each box knows its empty ordinal.
  const emptyOrdinals = track.map((box, i) =>
    box.severity === "empty"
      ? track.slice(0, i).filter((b) => b.severity === "empty").length
      : null,
  )
  // The bet can fill the last box: the martyr slot pre-reserves its height.
  const martyrReachable =
    interactive && cap >= track.filter((b) => b.severity === "empty").length
  return (
    <div className="mt-2 grid justify-items-center gap-1.5 py-1">
      {/* One glyph per Paradox still loose — the count nobody reads as a
          number (note 8). The row keeps its height at zero glyphs. */}
      <div className="flex min-h-[18px] flex-wrap items-center justify-center gap-1.5">
        {Array.from({ length: outlook.uncontained }, (_, i) => (
          <ParadoxGlyph
            key={i}
            size={16}
            title="A Paradox success still loose — contain it on the track below, or it manifests"
          />
        ))}
      </div>
      {/* The lore slot: a fixed-height line the severity term burns in, or
          the quiet word when nothing runs loose — same height either way. */}
      <div className="flex h-[24px] items-center justify-center">
        {outlook.uncontained > 0 ? (
          <span
            className="mv-h text-[22px] uppercase leading-none tracking-[0.1em]"
            style={{
              color: "var(--paradox)",
              textShadow:
                "0 0 14px color-mix(in srgb, var(--paradox) 55%, transparent)",
            }}
          >
            {severity}
          </span>
        ) : (
          <span
            className="mv-data text-[12px]"
            style={{ color: "var(--rail-success)" }}
          >
            {paradoxSuccesses === 0
              ? dramaticFailure
                ? PARADOX_GRACE
                : "no Paradox — the way to the cast is clear"
              : "all contained — reality lets it pass"}
          </span>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-[5px]">
        {track.map((box, i) => {
          const ordinal = emptyOrdinals[i] ?? null
          const ghosted = ordinal !== null && ordinal < contained
          const reachable = ordinal !== null && ordinal < cap
          const title =
            ordinal === null
              ? `${box.severity} damage${box.resistant ? " · Resistant" : ""}`
              : ghosted
                ? "Contained — this box takes Resistant bashing when you Cast; click to release it"
                : reachable
                  ? interactive
                    ? "Contain one more Paradox here — Resistant bashing, one fewer loose"
                    : "A box the caster could offer"
                  : paradoxSuccesses === 0
                    ? "No Paradox rolled — nothing to contain"
                    : paradoxSuccesses <= cap
                      ? `Only ${paradoxSuccesses} Paradox rolled — nothing more to contain`
                      : "Beyond the bet — containment can fill the track, never pass it"
          // The printed sheet's wound penalties (WoD p. 171): −1/−2/−3 at
          // the last three boxes — standing above them here, since the
          // Resistant dot owns the space beneath (Mage p. 124). Exactly one
          // penalty is ever in effect (the rightmost filled box's), and only
          // that one burns as the bet reaches it.
          const fromEnd = track.length - i
          const penaltyLabel = fromEnd <= 3 ? fromEnd - 4 : null
          const penaltyLive =
            penaltyLabel !== null && outlook.penaltyAfter === penaltyLabel
          const boxMark = (
            <span
              className="mv-data grid size-6 place-items-center rounded-[2px] border text-[12px] font-bold"
              style={{
                borderColor: ghosted
                  ? "var(--ember)"
                  : box.severity === "empty"
                    ? "var(--line)"
                    : "var(--accent)",
                borderStyle: ghosted ? "dashed" : "solid",
                background:
                  box.severity === "empty" || box.severity === "bashing"
                    ? "transparent"
                    : "var(--glow)",
                color: ghosted ? "var(--ember)" : "var(--accent)",
              }}
            >
              {ghosted ? "╱" : healthBoxGlyph(box.severity)}
            </span>
          )
          return (
            // Every box wears the label band (pt) whether or not it carries a
            // label, so the track's boxes align and never shift (note 6).
            // `flex` kills the residual 4px cockpit shift (pass 3, note 7,
            // MEASURED): an inline wrapper sizes by line-box baselines, and
            // an EMPTY box baselines at its bottom edge while a marked one
            // baselines at the glyph — the flex wrapper sizes by content
            // boxes alone, so filling a box can't resize the row.
            <span key={i} className="relative flex flex-col items-center pb-[7px] pt-[15px]">
              {penaltyLabel !== null && (
                <span
                  className="mv-data absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-[12px] leading-none"
                  style={{
                    color: penaltyLive ? "var(--bad)" : "var(--dim)",
                    opacity: penaltyLive ? 1 : 0.6,
                    fontWeight: penaltyLive ? 700 : 400,
                  }}
                  title={
                    penaltyLive
                      ? "Wound penalty in effect — it rides every roll, this cast's included"
                      : "Wound penalty once this box is filled (the printed sheet's −1/−2/−3)"
                  }
                >
                  −{-penaltyLabel}
                </span>
              )}
              {interactive && ordinal !== null && (reachable || ghosted) ? (
                <button
                  onClick={() => onChange(ghosted ? ordinal : ordinal + 1)}
                  disabled={disabled}
                  title={title}
                  className="cursor-pointer disabled:opacity-40"
                >
                  {boxMark}
                </button>
              ) : (
                <span title={title}>{boxMark}</span>
              )}
              <span className="absolute bottom-0 left-1/2 flex -translate-x-1/2">
                {ghosted ? (
                  <span
                    className="size-[5px] rounded-full"
                    title="Resistant — heals only naturally (the sheet's dot beneath the box)"
                    style={{ background: "var(--ember)", opacity: 0.7 }}
                  />
                ) : (
                  <ResistantDot resistant={box.resistant} />
                )}
              </span>
            </span>
          )
        })}
      </div>
      {/* The martyr warning's slot reserves its height whenever the bet CAN
          fill the track (note 6): the last box's click must not shift the
          Cast button that gets clicked next. Unreachable = no slot, and no
          click can make one appear. */}
      {(martyrReachable || outlook.martyr) && (
        <p
          className={`${martyrReachable ? "min-h-[30px] " : ""}text-center text-[12px] italic`}
          style={{ color: "var(--bad)" }}
        >
          {outlook.martyr
            ? "This fills your last health box with bashing — the book calls that unconsciousness (Storyteller adjudicates). The cast still completes."
            : ""}
        </p>
      )}
    </div>
  )
}

/**
 * The resolution, in the card (the resolution merge, 2026-07-19; recut to
 * exactly four rows by pass 3, note 9): the result word in caps and green,
 * the cast roll's faces, the Paradox roll's faces bare, and the severity
 * lore word alone — no glyphs, no counts, no "manifests", nothing the dice
 * symbols already say. No Paradox manifesting = no fourth row at all (which
 * retires the "reality lets it pass" line and the record's grace note — the
 * cockpit's quiet slot still speaks the chance-die grace mid-phase). The
 * "N contained" text died with the counts: the caster's ghosted track boxes
 * carry containment history. Cast rows resolved before the merge carry no
 * faces; their face rows simply don't render.
 */
function Resolution({ cast }: { cast: CastEntry }) {
  const successes = cast.castSuccesses ?? 0
  const won = successes > 0
  const manifested = cast.severity !== undefined && cast.severity !== "none"
  return (
    <div className="mt-2 grid justify-items-center gap-1.5">
      {(cast.castIsDramaticFailure || cast.castIsExceptionalSuccess) && (
        <div className="flex items-baseline gap-2">
          {cast.castIsDramaticFailure && <ResolutionTag kind="bad">Dramatic Failure</ResolutionTag>}
          {cast.castIsExceptionalSuccess && <ResolutionTag kind="good">Exceptional</ResolutionTag>}
        </div>
      )}
      {/* Prototype (2026-07-20): the outcome on ONE centered line — SUCCESS
          first (green), a dim divider, then the Paradox severity noun in the
          reality-bending face. The "N success" count is gone; the felt's
          diamonds show every roll at once. */}
      {(won || manifested) && (
        <div className="flex items-baseline justify-center gap-3 text-[18px] uppercase leading-none tracking-[0.1em]">
          {won && (
            <span
              className="mv-h"
              style={{
                color: "var(--rail-success)",
                textShadow: "0 0 12px color-mix(in srgb, var(--rail-success) 50%, transparent)",
              }}
            >
              Success
            </span>
          )}
          {won && manifested && (
            <span aria-hidden style={{ color: "var(--dim)" }}>
              ·
            </span>
          )}
          {manifested && (
            <span
              className="mv-h"
              style={{
                color: "var(--paradox)",
                textShadow: "0 0 12px color-mix(in srgb, var(--paradox) 55%, transparent)",
              }}
            >
              {cast.severity}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/** The resolved card's outcome badge — the roll-card Tag grammar, in place. */
function ResolutionTag({
  kind,
  children,
}: {
  kind: "good" | "bad"
  children: string
}) {
  const c = kind === "good" ? "var(--rail-success)" : "var(--bad)"
  return (
    <span
      className="mv-data rounded-[2px] px-1 py-0.5 text-[12px] uppercase tracking-wide"
      style={{ border: `1px solid ${c}`, color: c }}
    >
      {children}
    </span>
  )
}
