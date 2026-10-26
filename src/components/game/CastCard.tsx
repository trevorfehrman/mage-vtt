import { useEffect, useState, type ReactNode } from "react"
import { Match, Schema } from "effect"
import { useMutation } from "convex/react"
import { useMachine } from "@xstate/react"
import { AnimatePresence, useReducedMotion } from "motion/react"
import type { CastEntry } from "#/domain/activity"
import {
  castPoolAfterParadox,
  containmentCap,
  containmentOutlook,
  mitigationCap,
  isPriceFixed,
  isRoteCast,
  toGnosisRank,
  waitingOn,
  type CastStatus,
} from "#/domain/cast"
import type { CharacterSheet } from "#/domain/character"
import type { HealthTrack } from "#/domain/damage"
import { emptyOrdinals } from "#/domain/health"
import {
  calculateParadoxPool,
  resolveParadox,
  type ParadoxPoolModifier,
  type ParadoxSeverity,
} from "#/domain/paradox"
import { castOddsUnderParadox, rollOdds, severityOdds, SeverityOdds } from "#/domain/probability"
import { Mana, PoolSize } from "#/domain/quantities"
import { signedDice, tideDraftDice, tidesNetInk, tidesWeight, type TideDraft } from "./tides-ground"
import { TidesBox, type Weather } from "./TidesBox"
import { seamErrorMessage } from "#/lib/seam-errors"
import { WILLPOWER_COMPONENT_NAME } from "#/domain/willpower-economy"
import { castLadderMachine, ladderControls, ladderRung } from "#/machines/cast-ladder"
import { healthBoxGlyph, ResistantDot } from "./HealthGlyphs"
import { BurstFaces } from "./BurstFaces"
import { UnifiedDie } from "./UnifiedDie"
import { settleOpacity, type DieGroup, type GhostInk, type PoolKind } from "./die-look"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "#/components/ui/tooltip"
import { PriorRollsGlyph, SleeperGlyph, TidesGlyph, ToolGlyph } from "./TideGlyphs"
import { ParadoxGlyph } from "./ParadoxGlyph"
import { Felt } from "./Felt"
import { CastMark, HealthLine, PoolNumerals } from "./CastHeaderStats"
import { Lozenge } from "./Lozenge"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

/**
 * The live Cast card (issue #43, ADR-0016; the card takeover, owner ruling
 * 2026-07-19): a projection of the Cast document — one artifact rendered by
 * seat. While the cast is live it takes the working zone over on every seat,
 * in place of the tray (MAG-48, the live zone), with every control the seat
 * needs — engage/decline included; the Activity feed carries only the
 * record, once it resolves. The XState machine mirrors the subscribed
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

/** The contained mark (MAG-49): every Paradox success taken on the body —
 * the caster bore it. One word, in the lore slot's own voice. */
const CONTAINED_MARK = "Borne"

/** A ghost wears the ink of the REASON it isn't there (MAG-49, owner
 * 2026-10-25). A cast die is lost to one of two causes, each with its hover
 * group, ink and word: loose Paradox in its red, wounds in the penalty
 * numbers' own ink. The felt's ghosts and its legend read this one table. */
const LOST_TO = {
  paradox: { group: "lostToParadox", ink: "var(--paradox)", says: "Lost to Paradox" },
  wounds: { group: "lostToWounds", ink: "var(--bad)", says: "Lost to wounds" },
} as const satisfies Record<string, { group: DieGroup; ink: GhostInk; says: string }>

/** A Paradox success contained on the body: the ember the contained boxes wear. */
const CONTAINED_INK: GhostInk = "var(--ember)"

export function CastCard({
  cast,
  sessionId,
  isStoryteller,
  viewerUserId,
  mySheet,
  casterSheet = null,
  moreWaiting = 0,
  adjust,
  drafts,
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
  /** The dressing room's door (MAG-45): its cast is a fixture the server
   * would refuse, so the rig keeps the ST's adjustments in local state and
   * hands this in. The live route leaves it undefined and the Convex
   * mutation runs. */
  adjust?: ((adjustments: ReadonlyArray<ParadoxPoolModifier>) => Promise<unknown>) | undefined
  /** The dressing room's door for the caster's live bets (MAG-34), as
   * `adjust` is for the ST's: the rig keeps the drafts in local state. */
  drafts?:
    | {
        mitigation: (draftMitigation: number) => Promise<unknown>
        containment: (draftContainedSuccesses: number) => Promise<unknown>
      }
    | undefined
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
  // the live cast holds the ST's working zone (MAG-48), so the offer's
  // decision lives on it — and no feed carries a live card (MAG-46), so it
  // never doubles.
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
  const setDraftMitigation = useMutation(api.casts.setDraftMitigation)
  const setDraftContainment = useMutation(api.casts.setDraftContainment)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The caster's two bets (MAG-34): local first, so a click answers at once,
  // and broadcast in the background (`broadcast` below) so every seat
  // watches them move. They open from the server's draft: a reconnecting
  // caster drops back into the pick and the half-built sacrifice.
  const [mitigation, setMitigation] = useState(cast.draftMitigation ?? 0)
  // The live cast's shrunk form (MAG-48): the viewer's own choice, like the
  // tray's (MAG-47). Each cast opens tall — it is new news at the table.
  const [shrunk, setShrunk] = useState(false)
  const [contained, setContained] = useState(cast.draftContainedSuccesses ?? 0)
  // The ST's draft tide (issue #44; MAG-45): one shore's skeleton pill
  // opened for typing — local until Enter lands it on the document.
  const [draft, setDraft] = useState<TideDraft | null>(null)
  /** The die group under the pointer (the badges work): its dice glow, the
   * rest settle. A group is a die's kind, or a ghost's cause (MAG-49). */
  const [litGroup, setLitGroup] = useState<DieGroup | null>(null)
  const settle = (group: DieGroup) => settleOpacity(litGroup, group)

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

  // A live bet's write never holds the card (MAG-34): #113 withdrew the first
  // broadcast draft because each click waited on the server. The click
  // answers locally; the draft follows. A refusal surfaces and steps the
  // pick back, so the caster's seat never shows a bet the table can't see.
  const broadcast = (write: () => Promise<unknown>, stepBack: () => void) => {
    write().catch((err: unknown) => {
      stepBack()
      setError(seamErrorMessage(err))
    })
  }
  const pickMitigation = (value: number) => {
    const before = mitigation
    setMitigation(value)
    broadcast(
      () =>
        drafts !== undefined
          ? drafts.mitigation(value)
          : setDraftMitigation({ ...step, draftMitigation: value }),
      () => setMitigation(before),
    )
  }
  const pickContained = (value: number) => {
    const before = contained
    setContained(value)
    broadcast(
      () =>
        drafts !== undefined
          ? drafts.containment(value)
          : setDraftContainment({ ...step, draftContainedSuccesses: value }),
      () => setContained(before),
    )
  }
  // What every seat renders: the caster's own clicks, everyone else the
  // server's draft of them.
  const liveMitigation = isCaster ? mitigation : (cast.draftMitigation ?? 0)
  const liveContained = isCaster ? contained : (cast.draftContainedSuccesses ?? 0)

  // Every change to the ST's adjustments goes through one door.
  const applyAdjustments = (adjustments: ReadonlyArray<ParadoxPoolModifier>) =>
    adjust !== undefined
      ? adjust(adjustments)
      : adjustPrice({ ...step, adjustments: adjustments.map((d) => ({ ...d })) })

  // Enter in the open pill lands the tide on the document (MAG-45: the pill
  // IS the form — the owner retired the block of chips beneath the card).
  const addTide = async () => {
    if (draft === null || busy) return
    const source = draft.source.trim()
    if (source.length === 0) return
    const ok = await run(() =>
      applyAdjustments([...(cast.adjustments ?? []), { source, dice: tideDraftDice(draft) }]),
    )
    if (ok) setDraft((d) => (d === draft ? null : d))
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
  // The pool reality will roll. Before the commit the local mitigation pick
  // does NOT shrink it: the bought-off dice ghost in place on the felt (MAG-44,
  // the owner's 2026-10-22 call — "as I click down the table there should be
  // a ghost outline of the dice I'm erasing"), so the count is the
  // unmitigated pool and `mitigated` below says how many of its dice are
  // bought off. After the commit the stamped mitigation is real and the pool
  // is smaller — but its bought-off dice still ghost (`boughtOff` below).
  const pool = poolInputs
    ? calculateParadoxPool({
        ...poolInputs,
        ...(cast.manaMitigation !== undefined
          ? { manaMitigation: cast.manaMitigation }
          : {}),
      })
    : null

  // The felt's pool while the Tides are still fluid (pass 3, note 1): the
  // Scene seed (witnesses, accumulator) isn't stamped yet, so this is a
  // PROVISIONAL pool — Gnosis base + rote/tool + the ST's live adjustments
  // (the ST's seat only; the feed withholds them from the rest until the
  // fix) — that grows and shrinks as tags land and truly settles at the fix.
  // `gnosis` stamps at engage, so the base is computable from the first
  // on-stage moment, on every seat's card.
  const provisionalInputs =
    pool === null && status === "price" && cast.gnosis !== undefined
      ? {
          gnosis: toGnosisRank(cast.gnosis),
          isRote: isRoteCast(cast),
          usesMagicalTool: cast.usesMagicalTool,
          discretionaryModifiers: cast.adjustments ?? [],
        }
      : null
  const provisionalPool = provisionalInputs ? calculateParadoxPool(provisionalInputs) : null
  const feltPool = pool ?? provisionalPool

  // Input caps mirror the server's refusals; the server stays authoritative.
  const poolBeforeMitigation = poolInputs
    ? calculateParadoxPool(poolInputs).totalDice
    : 0
  // The cockpit's sheet: the CASTER's track and purse, whichever seat is
  // watching — the caster's own when they hold the card, the passed-in
  // caster sheet on every other seat (the 2026-07-19 polish, note 14).
  const cockpitSheet = isCaster ? mySheet : casterSheet
  const mitigateCap = cockpitSheet
    ? mitigationCap(poolBeforeMitigation, cockpitSheet.manaCurrent, cast.spellManaCost)
    : 0
  // The commit decision is live: the Tides are fixed and nothing is spent.
  const deciding = status === "price" && isPriceFixed(cast)
  // Dice the selected mitigation row buys off — live while the commit
  // decision is, on every seat (MAG-34); they ghost from the Paradox row's
  // end (the cockpit's own doctrine for eaten cast dice), which is where the
  // scene's red dice sit, so Mana erases the weather first and only then
  // reaches into Gnosis.
  const mitigated = deciding ? Math.min(liveMitigation, mitigateCap) : 0
  // After the commit the stamped mitigation keeps its ghosts (owner,
  // 2026-10-23, the MAG-17 tour's second call): the dice the Mana bought off
  // stay on the Paradox row, dashed, so the price still reads on the felt
  // until the roll; the rolled faces carry none (owner, 2026-10-25).
  const boughtOff =
    pool !== null && cast.manaMitigation !== undefined
      ? Math.max(0, poolBeforeMitigation - pool.totalDice)
      : 0
  const paradoxGhosts = mitigated + boughtOff

  const containCap = cockpitSheet
    ? containmentCap(cockpitSheet.healthTrack, cast.paradoxSuccesses ?? 0)
    : (cast.paradoxSuccesses ?? 0)
  // The containment bet, on every seat (MAG-34).
  const cockpitContained =
    status === "paradox" && cast.paradoxSuccesses !== undefined
      ? Math.min(liveContained, containCap)
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

  // The cast's odds under the bet, standing above the Cast button (owner,
  // 2026-10-25): the cockpit's surviving pool when the sheet decoded, the
  // same leaf off the local count when it did not (the NumberInput fallback
  // still bets).
  const castOdds =
    status === "paradox" && cast.paradoxSuccesses !== undefined
      ? rollOdds(
          outlook?.castPool ??
            castPoolAfterParadox(cast.declaredPool, cast.paradoxSuccesses, cockpitContained),
        )
      : null

  const waiting = waitingOn(cast)
  const terminal = waiting === null
  // Whose move it is, from this seat: the shrunk line and the footer agree.
  const isMyMove =
    (waiting === "caster" && isCaster) || (waiting === "storyteller" && isStoryteller)

  // The declared pool as physical dice (card takeover, 2026-07-19): the felt
  // grammar, never the sentence "declared pool 3" — Willpower's precommitted
  // dice keep their ember provenance, the rest are the sheet's verdigris.
  // During the caster's containment bet, the dice the bet would eat
  // (uncontained Paradox + the new wound penalty) ghost from the row's end:
  // the price being weighed before the one Cast click. The end is where the
  // embers sit, and that's doctrine, not an accident — the Willpower dice
  // are pool members "as losable to Paradox as any other die" (ADR-0022).
  // Felt audition (2026-10-22): every die wears where it came from — Gnosis
  // and the boosts the sheet's verdigris (intrinsic), the Arcanum's dice
  // neutral with the Arcanum's glyph inside, Willpower its own amethyst —
  // grouped green · arcanum · will, Willpower still last because the bet
  // ghosts from the row's end.
  const willpowerDice =
    cast.declaredComponents.find((c) => c.name === WILLPOWER_COMPONENT_NAME)
      ?.dots ?? 0
  const HIGH_SPEECH_COMPONENT_NAME = "High Speech"
  const FELT_ORDER: ReadonlyArray<PoolKind> = ["sheet", "arcanum", "highSpeech", "willpower"]
  const feltSpecs: ReadonlyArray<{ kind: PoolKind; arcanum?: string }> = [
    ...cast.declaredComponents
      .filter((c) => c.name !== WILLPOWER_COMPONENT_NAME)
      .flatMap((c) =>
        Array.from({ length: Math.max(0, c.dots) }, () =>
          c.type === "arcanum"
            ? { kind: "arcanum" as const, arcanum: cast.arcanum }
            : c.name === HIGH_SPEECH_COMPONENT_NAME
              ? { kind: "highSpeech" as const }
              : { kind: "sheet" as const },
        ),
      )
      // intrinsic verdigris, then the Arcanum's metal, then High Speech's white
      .sort((x, y) => FELT_ORDER.indexOf(x.kind) - FELT_ORDER.indexOf(y.kind)),
    ...Array.from({ length: willpowerDice }, () => ({ kind: "willpower" as const })),
  ]
  const feltKinds: ReadonlyArray<PoolKind> = [
    ...feltSpecs.map((s) => s.kind),
    ...Array.from({ length: Math.max(0, cast.declaredPool - feltSpecs.length) }, () => "sheet" as const),
  ].slice(0, cast.declaredPool)
  // Every seat sees the dice Paradox would eat (owner, 2026-10-23, the MAG-17
  // tour's first call): the caster's ghosts follow their live bet, everyone
  // else's the default outlook (nothing contained) — public once rolled.
  const eaten = outlook !== null ? outlook.eaten : 0
  // Hover a cast die and its whole GROUP comes forward (the badges work,
  // 2026-10-22 evening): every die of that kind glows in its own ink, the
  // other kinds settle back a step, and one tooltip speaks for the group.
  // No encompassing box — a group can split across a wrap, and per-die state
  // wraps for free. The Tooltip is the keyed presence child (presence reaches
  // the die's motion element through context, so exits still play); the
  // trigger is a tight span around the die, since the die takes no ref.
  // Tooltip copy is max information, minimum characters (owner, 2026-10-22):
  // the intrinsic group names its sheet components ("Gnosis 3", or a rote's
  // "Resolve 2 · Occult 3"), the rest name themselves and their count.
  const groupCount = (kind: PoolKind) => feltKinds.filter((k) => k === kind).length
  const titleCase = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)
  const sheetTerms = cast.declaredComponents
    .filter((c) => c.type !== "arcanum" && c.name !== HIGH_SPEECH_COMPONENT_NAME && c.name !== WILLPOWER_COMPONENT_NAME)
    .map((c) => `${c.name} ${c.dots}`)
    .join(" · ")
  const groupSays = (kind: PoolKind, arcanum: string | undefined) =>
    Match.value(kind).pipe(
      Match.when("willpower", (k) => `Willpower +${groupCount(k)}`),
      Match.when("arcanum", (k) => `${arcanum === undefined ? "Arcanum" : titleCase(arcanum)} ${groupCount(k)}`),
      Match.when("highSpeech", (k) => `High Speech +${groupCount(k)}`),
      // the intrinsic group (and anything else the cast row never draws)
      Match.orElse((k) => (sheetTerms.length > 0 ? sheetTerms : `Sheet ${groupCount(k)}`)),
    )
  // The eaten dice have two causes (MAG-49): each loose Paradox success
  // (p. 124) and the wound penalty the track carries (WoD p. 171). They ghost
  // apart, from the row's end, each in its CAUSE's ink — Paradox's red, the
  // wounds' the penalty numbers' own — so containing visibly turns a red
  // ghost into a die, or, when the bet's damage brings a new penalty, into a
  // wound ghost (owner, 2026-10-25: "the ghost cast dice should be the color
  // of the reason they aren't there").
  const lost = { paradox: outlook?.eatenByParadox ?? 0, wounds: outlook?.eatenByWounds ?? 0 }
  const feltDice = feltKinds.map((kind, i) => {
    const fromEnd = feltKinds.length - 1 - i
    const arcanum = feltSpecs[i]?.arcanum
    // A ghost's group is its cause (owner, 2026-10-25): hover or focus one
    // and every die lost to the same thing comes forward, one tooltip for
    // the group. Paradox's ghosts stand at the row's end, the wounds' before.
    const cause = fromEnd < lost.paradox ? "paradox" : fromEnd < eaten ? "wounds" : null
    const lostTo = cause === null ? null : LOST_TO[cause]
    const group: DieGroup = lostTo?.group ?? kind
    const says = cause === null || lostTo === null ? groupSays(kind, arcanum) : `${lostTo.says} −${lost[cause]}`
    return (
      <Tooltip key={`${kind}:${i}`}>
        <TooltipTrigger asChild>
          <span
            className="grid size-[20px] place-items-center transition-opacity duration-150"
            style={{ opacity: settle(group) }}
            {...(lostTo !== null ? { tabIndex: 0 } : {})}
            onPointerEnter={() => setLitGroup(group)}
            onPointerLeave={() => setLitGroup(null)}
            onFocus={() => setLitGroup(group)}
            onBlur={() => setLitGroup(null)}
          >
            <UnifiedDie
              mode="pool"
              kind={kind}
              arcanum={arcanum}
              reduced={reduced}
              glide={false}
              ghost={lostTo !== null}
              ghostInk={lostTo?.ink}
              lit={litGroup === group}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>{says}</TooltipContent>
      </Tooltip>
    )
  })
  // Paradox on the felt (2026-07-19 polish, note 11; walked forward to the
  // first fluid-phase moment by pass 3, note 1): the pool reality will roll,
  // standing beneath the declared pool from engage until the ST's roll —
  // provisional while the Tides are fluid; once they're fixed the dice a
  // mitigation row buys off ghost in place from the row's end, so the whole
  // pool stays visible and the price of the pick is the ghosts. A pool with
  // no dice at all still throws the chance die (the gamble is honest), so a
  // ghosted die stands for it. The
  // first `baseDice` render gnosis-green with the red glyph inside (note 6):
  // reality's own base, never worded as the rank — the rest are the Tides'.
  const paradoxDiceCount =
    feltPool !== null && cast.paradoxSuccesses === undefined && !terminal
      ? feltPool.totalDice + boughtOff
      : null
  // The mage's own reductions — the tool in hand, a rote — come off the
  // mage's own green dice, never the red (owner, 2026-10-23: three floods
  // showed two red dice because the tool's −1 was eating a flood). So the
  // red dice are always exactly the weather: the Tides' net, the Sleepers,
  // the prior rolls, and Mana's ghosts come off the red end as before.
  const ownReductions = (cast.usesMagicalTool ? 1 : 0) + (isRoteCast(cast) ? 1 : 0)
  const paradoxBaseCount =
    paradoxDiceCount !== null && feltPool !== null
      ? Math.min(Math.max(0, feltPool.baseDice - ownReductions), paradoxDiceCount)
      : 0
  // Each term carries its own signed count, like the Tides' pills (owner,
  // 2026-10-23: "Gnosis 3: +2 − Tool: −1").
  const baseSays =
    `Gnosis ${cast.gnosis ?? "?"}: +${feltPool?.baseDice ?? 0}` +
    (cast.usesMagicalTool ? " − Tool: −1" : "") +
    (isRoteCast(cast) ? " − Rote: −1" : "")
  // Once the ST has rolled, the faces live in the Paradox area (MAG-45,
  // owner 2026-10-23 — they used to drop below the felt as glyphs over the
  // lore term): the record from the rolled rung onward, the same area, so
  // the eye never has to look for reality's dice anywhere else. During the
  // caster's containment bet the successes the bet absorbs ghost from the
  // row's end — the felt's one grammar for a price being weighed — and on
  // the record the stamped containment ghosts them for good. A ghosted
  // face is a success that never manifested, not a die that never rolled.
  // Reality has rolled: the faces stand in the Paradox area from the roll on.
  const hasRolledFaces =
    (status === "paradox" || status === "resolved") &&
    ((cast.paradoxRolls?.length ?? 0) > 0 || (cast.paradoxExplosions?.length ?? 0) > 0)
  const containedNow =
    status === "paradox" ? cockpitContained : (cast.containedSuccesses ?? 0)
  // Reality's printed area exists only while it holds dice: the provisional
  // pool before the ST's roll, or the rolled faces from the roll onward.
  const paradoxArea = paradoxDiceCount !== null || hasRolledFaces
  // The badges work (2026-10-22 evening): the Paradox area explains its own
  // red dice, in two registers. INSTRUMENTS are the rule's fixed slots —
  // Sleepers, prior rolls, the tool (rote when rote) — always printed on the
  // area's label row, dim at zero and in ink when live, so the eye learns
  // their positions and reads "why so few / so many" at a glance. Before the
  // fix the scene seed is unstamped, so the seeded instruments read "—". The
  // Tides' net leads the row under the waves glyph, as well as printing in
  // the TIDES eyebrow (owner, 2026-10-23, reversing MAG-45's print-it-once:
  // "i wanna show it both places"). Mana
  // mitigation never badges (pass 3, note 5): the table and the ghosts say it.
  // WEATHER is the ST's named circumstances — scene-wide and this caster's
  // own — drawn as the TidesBox's two shores above the felt. While fluid
  // only the ST's card carries the adjustments: the feed withholds them from
  // every other seat until the fix (`withheldFrom`, owner 2026-10-23), so
  // this card needs no seat check.
  const weather: ReadonlyArray<Weather> = [
    ...(cast.tides?.circumstances ?? []).map((modifier) => ({ modifier })),
    ...(cast.adjustments ?? []).map((modifier, i) => ({
      modifier,
      ...(controls.includes("adjust")
        ? {
            onRemove: () =>
              run(() => applyAdjustments((cast.adjustments ?? []).filter((_, j) => j !== i))),
          }
        : {}),
    })),
  ]
  // Each instrument is a glyph and the raw FACT (owner, 2026-10-22 evening):
  // how many Sleepers, how many prior rolls, the Tides' net pull, tool in
  // hand or not — never the dice they add; the dice show that. Zero prints
  // as the glyph and "0" in dim, unseeded as "—". Live ink says which way
  // it pulls: red for what adds Paradox dice, verdigris for what takes them.
  const seeded = cast.tides !== undefined
  const count = (n: number | undefined) => (n === undefined ? "—" : String(n))
  const tidesNet = tidesWeight(weather.map((w) => w.modifier)).net
  const instruments: ReadonlyArray<{ key: string; glyph: ReactNode; value: string | null; ink: string; says: string }> = [
    {
      key: "tides",
      glyph: <TidesGlyph size={13} />,
      value: signedDice(tidesNet),
      ink: tidesNetInk(tidesNet),
      says: `Tides: ${signedDice(tidesNet)}`,
    },
    {
      key: "sleepers",
      glyph: <SleeperGlyph size={13} />,
      value: count(cast.tides?.witnessCount),
      ink: seeded && cast.tides.witnessCount > 0 ? "var(--paradox)" : "var(--dim)",
      says: !seeded
        ? "Sleepers: set at the fix"
        : `${cast.tides.witnessCount} sleeper${cast.tides.witnessCount === 1 ? "" : "s"} · +${cast.tides.witnessCount > 0 ? 2 : 0}`,
    },
    {
      key: "prior",
      glyph: <PriorRollsGlyph size={13} />,
      value: count(cast.tides?.priorParadoxRolls),
      ink: seeded && cast.tides.priorParadoxRolls > 0 ? "var(--paradox)" : "var(--dim)",
      says: !seeded ? "Prior Paradox: set at the fix" : `${cast.tides.priorParadoxRolls} prior Paradox · +${cast.tides.priorParadoxRolls}`,
    },
    {
      key: "tool",
      glyph: <ToolGlyph size={13} />,
      value: null,
      ink: cast.usesMagicalTool ? "var(--accent)" : "var(--dim)",
      says: cast.usesMagicalTool ? "Tool: −1" : "Tool: none",
    },
    ...(isRoteCast(cast) ? [{ key: "rote", glyph: null, value: "rote", ink: "var(--accent)", says: "Rote: −1" }] : []),
  ]
  const declaredTerms = [
    // The bought floor (issue #107): what a dispel rolls against.
    ...(cast.potency !== undefined ? [`Potency ${cast.potency} bought`] : []),
    ...(cast.targets !== undefined ? [`×${cast.targets} targets`] : []),
  ]

  // The mitigation table (issue #45; note 7) stands on the commit beat on
  // every seat (MAG-34): the caster's to click, everyone else's to watch the
  // pick move. Before the fix it is the Storyteller's, read-only (MAG-45,
  // owner 2026-10-23): the ST sees what each ruling does to the player's
  // choices before fixing them, off the same provisional pool the felt
  // shows. Only the ST sees it then — the other seats do not watch the ST's
  // thoughts in progress — and the affordable rows read from the CASTER's
  // Mana, whichever seat holds the card.
  const tableInputs = deciding
    ? poolInputs
    : controls.includes("adjust")
      ? provisionalInputs
      : null
  const tablePoolBefore = tableInputs !== null ? calculateParadoxPool(tableInputs).totalDice : 0
  const tableAffordable =
    tableInputs !== null && cockpitSheet !== null
      ? mitigationCap(tablePoolBefore, cockpitSheet.manaCurrent, cast.spellManaCost)
      : 0

  // The odds beneath the felt speak ONE register (MAG-45, owner 2026-10-23
  // — they used to have three voices across the rungs): the table's own
  // row, Mana · dice · Paradox · success, with the cast's success priced
  // under reality rolling first (castOddsUnderParadox, p. 124). Before the
  // commit it is the table's zero row — nothing spent yet; where the table
  // itself stands the row stands down. After the commit it is the committed
  // row; once reality has rolled, the Paradox cell carries the rolled count
  // and the success % tracks the surviving pool as the containment bet
  // moves (the cockpit's clicks). The resolved record speaks for itself.
  const oddsRow: OddsRowProps | null = Match.value(status).pipe(
    Match.withReturnType<OddsRowProps | null>(),
    Match.when("price", () =>
      tableInputs !== null || feltPool === null
        ? null
        : pricedRow(Mana.make(0), PoolSize.make(feltPool.totalDice), cast.declaredPool),
    ),
    Match.when("paradox", () => {
      // Once reality has rolled the row stands down (owner, 2026-10-25:
      // "this row isn't earning its keep"): the felt, the severity line and
      // the Cast button's own odds say it all.
      if (pool === null || cast.paradoxSuccesses !== undefined) return null
      return pricedRow(Mana.make(cast.manaMitigation ?? 0), PoolSize.make(pool.totalDice), cast.declaredPool)
    }),
    // The draft prices nothing yet; the record and the dead rungs say nothing
    // here — listed, not defaulted (ADR-0018).
    Match.whenOr("draft", "resolved", "cancelled", "voided", () => null),
    Match.exhaustive,
  )

  // The header's pending spends (pass 2, note 1; MAG-48): the spell's cost
  // ghosts from the moment the cast is on stage ("phase 1" read as the first
  // on-stage phase — a waiting draft doesn't ghost), the selected mitigation
  // joining while the commit decision is live, and a precommitted Willpower
  // point with it. After the commit they're truly spent and the real counts
  // carry them.
  const pendingManaNow = status === "price" ? cast.spellManaCost + mitigated : 0
  const pendingWillpowerNow = status === "price" && (cast.spendWillpower ?? false) ? 1 : 0
  // The header's stats are the CASTER's, on every seat — live only.
  const statsSheet = terminal ? null : cockpitSheet

  return (
    <div
      // MAG-48: a live cast is no card — it stands full width where it is
      // mounted, on the panel's own ground; it becomes a card when it ends
      // and joins the Chronicle (resolved, cancelled or voided).
      className={
        terminal
          ? "mv-cornered mv-panel mv-vulgar-floor rounded-[3px] p-2.5"
          : "mv-vulgar-floor relative px-3 py-2.5"
      }
      style={
        terminal
          ? status !== "resolved"
            ? { opacity: 0.65 }
            : undefined
          : { background: "var(--panel)" }
      }
    >
      {!terminal && (
        <button
          onClick={() => setShrunk((v) => !v)}
          className="mv-grip"
          style={{ top: -6 }}
          title={shrunk ? "Expand" : "Collapse"}
          aria-label={shrunk ? "Open the cast" : "Shrink the cast to one line"}
          aria-expanded={!shrunk}
        >
          <span className="mv-grip-bar" />
        </button>
      )}
      {!terminal && shrunk ? (
        // The shrunk line: whose cast, what it is, and whose move it is.
        <TooltipProvider>
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                {cast.casterName}
              </span>
              <CastMark arcanum={cast.arcanum} level={cast.level} />
            </span>
            <span className="mv-data shrink-0 text-[12px] uppercase tracking-wide" style={{ color: "var(--dim)" }}>
              <span style={{ color: "var(--accent)" }}>
                {RUNGS[Math.min(rungIndex(status), RUNGS.length - 1)]?.label}
              </span>
              {/* whose move, in a word — the name already leads the line */}
              {waiting !== null && (
                <>
                  {" · "}
                  {isMyMove
                    ? "your move"
                    : waiting === "storyteller"
                      ? "Storyteller"
                      : "caster"}
                </>
              )}
            </span>
          </div>
        </TooltipProvider>
      ) : (
      <>
      {/* The header (MAG-48, owner 2026-10-24): the caster's name tops the
          cast as it tops every record of theirs; the cast's mark (the
          Arcanum's glyph standing for its name, the level in verdigris as
          intense as the level is high) beneath it. While the cast is live
          the caster's depletables ride the right: the whole health track
          beside the name, Will · Mana beside the mark — the caster's, on
          every seat, so the masthead strip steps aside. A record carries no
          stats: they'd be today's numbers, not the cast's. */}
      <TooltipProvider>
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-[13px]" style={{ color: "var(--ink)" }}>
            <span className="font-medium">{cast.casterName}</span>
            {cast.roteName && (
              <span className="mv-data text-[12px]" style={{ color: "var(--dim)" }} title={cast.roteName}>
                {" "}
                · Rote &ldquo;{cast.roteName}&rdquo;
              </span>
            )}
          </p>
          {statsSheet !== null && (
            <span className="shrink-0 pt-[3px]">
              <HealthLine track={statsSheet.healthTrack} ghosts={cockpitContained} />
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <CastMark arcanum={cast.arcanum} level={cast.level} />
          <div className="flex items-center gap-1.5">
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
            {statsSheet !== null && (
              <PoolNumerals sheet={statsSheet} pendingMana={pendingManaNow} pendingWillpower={pendingWillpowerNow} />
            )}
          </div>
        </div>
      </TooltipProvider>

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

      <TidesBox
        weather={weather}
        canAdjust={controls.includes("adjust")}
        busy={busy}
        draft={draft}
        onDraft={setDraft}
        onAdd={() => void addTide()}
      />

      {/* Provenance ABOVE the felt (2026-07-20): the pool's lineage and the
          declared terms sit above the dice; the felt itself holds only the
          physical dice. */}
      <div
        className="mv-data mt-2 flex flex-wrap items-baseline justify-between gap-x-2 text-[12px] leading-none"
        style={{ color: "var(--dim)" }}
      >
        {/* Felt audition (2026-10-22): the component tags are gone — each die
            carries its provenance (Gnosis star, Arcanum glyph, High Speech
            rune, Willpower amethyst) and its title names it on hover. */}
        <span className="whitespace-nowrap">{declaredTerms.join(" · ")}</span>
      </div>
      <Felt className="mt-1.5">
        {paradoxArea && (
        <FeltSection
          label="paradox"
          labelAt="top"
          aside={
            <TooltipProvider>
              <span className="flex items-center justify-end gap-x-3 normal-case tracking-normal">
                {instruments.map((inst) => (
                  <Tooltip key={inst.key}>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1" style={{ color: inst.ink }}>
                        {inst.glyph}
                        {inst.value !== null && <span>{inst.value}</span>}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>{inst.says}</TooltipContent>
                  </Tooltip>
                ))}
              </span>
            </TooltipProvider>
          }
        >
        {hasRolledFaces && (
          // The rolled Paradox faces in the burst order (MAG-18); the
          // successes the bet absorbs ghost from the row's end (MAG-45).
          <BurstFaces
            className="px-3.5 pt-2.5 pb-4"
            gap={14}
            rolls={cast.paradoxRolls ?? []}
            roteRerolls={[]}
            explosions={cast.paradoxExplosions ?? []}
            again={10}
            chance={cast.paradoxIsChanceDie ?? false}
            tone="paradox"
            size="md"
            reduced={reduced}
            rolledAt={cast.timestamp}
            contained={containedNow}
            // No Mana ghosts once reality has rolled (owner, 2026-10-25: "it
            // didn't get rolled, that belonged to the previous step"); a
            // contained success wears the body's ember.
            ghostMark={{ says: `Contained ${containedNow}`, ink: CONTAINED_INK }}
          />
        )}
        {paradoxDiceCount !== null && (
          <div className="flex flex-wrap content-start gap-3.5 px-3.5 pt-2.5 pb-4">
            <TooltipProvider>
            <AnimatePresence initial={false}>
              {Array.from({ length: paradoxDiceCount }, (_, i) => {
                const kind: PoolKind = i < paradoxBaseCount ? "paradoxBase" : "paradox"
                const ghosted = i >= paradoxDiceCount - paradoxGhosts
                const group: DieGroup = ghosted ? "mitigated" : kind
                return (
                  <Tooltip key={`paradox:${i}`}>
                    <TooltipTrigger asChild>
                      <span
                        className="grid size-[20px] place-items-center transition-opacity duration-150"
                        style={{ opacity: settle(group) }}
                        {...(ghosted ? { tabIndex: 0 } : {})}
                        onPointerEnter={() => setLitGroup(group)}
                        onPointerLeave={() => setLitGroup(null)}
                        onFocus={() => setLitGroup(group)}
                        onBlur={() => setLitGroup(null)}
                      >
                        <UnifiedDie
                          mode="pool"
                          kind={kind}
                          reduced={reduced}
                          glide={false}
                          ghost={ghosted}
                          lit={litGroup === group}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>
                      {ghosted
                        ? `Mitigated: −${paradoxGhosts}`
                        : kind === "paradoxBase"
                          ? baseSays
                          : `Tides: +${paradoxDiceCount - paradoxBaseCount}`}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
              {paradoxDiceCount === boughtOff && (
                // The chance-die ghost holds the FIRST slot's key: when a
                // flood lands it becomes the base die in place (one motion
                // element, ghost → solid) instead of exiting beside an
                // entering sibling, which made the base land one slot over
                // and jump back (owner, 2026-10-23).
                <Tooltip key={boughtOff > 0 ? "paradox:chance" : "paradox:0"}>
                  <TooltipTrigger asChild>
                    <span className="grid size-[20px] place-items-center">
                      <UnifiedDie mode="pool" kind="paradox" ghost reduced={reduced} glide={false} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>No pool: chance</TooltipContent>
                </Tooltip>
              )}
            </AnimatePresence>
            </TooltipProvider>
          </div>
        )}
        </FeltSection>
        )}
        <FeltSection
          label="cast"
          labelAt="bottom"
          divided={paradoxArea}
          aside={outlook !== null && <LostLegend paradox={lost.paradox} wounds={lost.wounds} />}
        >
        {status === "resolved" && cast.castRolls !== undefined ? (
          // The cast roll on ONE row (2026-07-20), in the burst order
          // (MAG-18): each explosion beside its trigger, then the dice the
          // containment bet ATE as empty ghosts (declared − rolled) trailing,
          // so the felt shows the whole Gnosis + Arcanum pool.
          <BurstFaces
            className="px-3.5 pt-4 pb-2.5"
            gap={14}
            rolls={cast.castRolls}
            roteRerolls={cast.castRoteRerolls ?? []}
            explosions={cast.castExplosions ?? []}
            again={10}
            chance={cast.castIsChanceDie ?? (cast.castPool !== undefined && cast.castPool <= 0)}
            size="md"
            reduced={reduced}
            eaten={Math.max(0, cast.declaredPool - cast.castRolls.length)}
            eatenMark={{ says: "Lost" }}
            rolledAt={cast.timestamp}
          />
        ) : (
          <div className="flex flex-wrap content-start gap-3.5 px-3.5 pt-4 pb-2.5">
            <TooltipProvider>
              <AnimatePresence initial={false}>{feltDice}</AnimatePresence>
            </TooltipProvider>
            {cast.declaredPool === 0 && (
              <span className="mv-data text-[12px]" style={{ color: "var(--dim)" }}>
                chance
              </span>
            )}
          </div>
        )}
        </FeltSection>
      </Felt>
      {/* the odds row — directly beneath the felt (note 16), in the table's
          own grid (MAG-45): one register on every rung */}
      {oddsRow !== null && <OddsRow {...oddsRow} />}

      {/* No "⟐ N rolled" numbers-line (pass 2, note 8): the cockpit's glyph
          column IS the count during the bet, and the Resolution carries the
          record — sentences don't restate what the symbols already say. */}

      {/* Resolution lives IN the card (the resolution merge, 2026-07-19):
          the faces stamped on the document, the successes, and the severity
          lore term — the record every seat reads, no roll card beside it. */}
      {status === "resolved" && <Resolution cast={cast} />}

      {/* The blind insurance, priced (issue #45; note 7): one row per Paradox
          die whatever the Mana — unaffordable rows stand visible and refuse,
          so the table always shows the full shape of the risk. */}
      {tableInputs !== null && (
        <MitigationPreview
          poolInputs={tableInputs}
          declaredPool={cast.declaredPool}
          affordable={tableAffordable}
          // No pick exists before the fix: the ST's reading marks no row.
          selected={deciding ? liveMitigation : null}
          // The ST's fluid-rung table is a reading, not a control (MAG-45).
          onSelect={controls.includes("commit") ? pickMitigation : undefined}
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
          onChange={controls.includes("contain") ? pickContained : undefined}
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
              title="Override: refunds Mana and Willpower, no trace"
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
            >
              Engage
            </button>
          )}
          {controls.includes("lockPrice") && (
            <button
              onClick={() => run(() => lockPrice(step))}
              disabled={busy}
              className="mv-roll rounded-[3px] px-3 py-1.5 text-[12px] disabled:opacity-40"
            >
              Fix the Tides
            </button>
          )}
          {controls.includes("commit") && (
            // The spend rides IN the button (pass 3, note 4 — reversing pass
            // 2's glyph column): "Commit 2 ◈" with the count and glyph in
            // the button's own ink, bare on the trigger (the dark inset, the
            // minus and the blue retired by the owner, 2026-10-22 — the blue
            // did not read on verdigris). The precommitted Willpower point
            // follows wearing the Mana glyph shape (note 12).
            <button
              onClick={() =>
                run(() => commit({ ...step, manaMitigation: mitigation }))
              }
              disabled={busy}
              className="mv-roll inline-flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-[12px] disabled:opacity-40"
              title="No going back"
            >
              Commit
              {/* The spend, bare (owner, 2026-10-22): "Commit 2 ◈" — the
                  count and Mana's glyph in the button's own ink ("the same
                  black as the text — this doesn't read at all" in Mana's
                  blue on verdigris), no minus, no inset. Willpower's point
                  follows the same way; the titles say which is which. */}
              {pendingManaNow > 0 && (
                <b
                  className="mv-data leading-none"
                  title="Mana"
                >
                  {pendingManaNow} <Lozenge />
                </b>
              )}
              {cast.spendWillpower && (
                <b
                  className="mv-data leading-none"
                  title="Willpower"
                >
                  1 <Lozenge />
                </b>
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
              onChange={pickContained}
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
            // The success % stands above the trigger, moving with the bet.
            <span className="flex flex-col items-end gap-1">
              {castOdds !== null && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="mv-data text-[12px]" style={{ color: "var(--dim)" }}>
                        {/* the odds breakdown's own foot (owner, 2026-10-25) */}
                        <OddsFoot success={castOdds.success} expected={castOdds.expected} />
                        {castOdds.isChanceDie && castOdds.dramaticFailure >= DRAMATIC_FAILURE_WARN_FLOOR && (
                          <span style={{ color: "var(--bad)" }}> · dramatic failure {pct(castOdds.dramaticFailure)}</span>
                        )}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>The spell's odds</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <button
                onClick={() =>
                  run(() => release({ ...step, containedSuccesses: contained }))
                }
                disabled={busy}
                className="mv-roll rounded-[3px] px-3 py-1.5 text-[12px] disabled:opacity-40"
              >
                {/* The pool the spell will roll rides the trigger once the
                    Paradox is in (owner, 2026-10-25, MAG-49): "at a glance i
                    wanna be like okay i'm gonna roll 9" — it moves with the bet. */}
                {outlook !== null ? `Cast ${diceLabel(outlook.castPool)}` : "Cast"}
              </button>
            </span>
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
          {isMyMove
            ? " — you"
            : ""}
        </p>
      )}
      </>
      )}
    </div>
  )
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

/** Below one chance in a thousand the chance-die warning is noise, not news. */
const DRAMATIC_FAILURE_WARN_FLOOR = 0.001

const diceLabel = (dice: number): string =>
  dice <= 0 ? "chance" : dice === 1 ? "1 die" : `${dice} dice`


/** The one grid every odds row stands in: Mana · dice · Paradox · success. */
const ROW_GRID = "grid grid-cols-[2.75rem_4.75rem_5.5rem_1fr] items-center gap-2 rounded-[2px] px-1.5 py-0.5 text-left text-[12px]"

/**
 * One odds row's facts (MAG-45): the Mana spent, the red dice, reality's
 * roll by severity (the row lives only before reality rolls) — and the
 * cast's odds with those dice priced in (castOddsUnderParadox, p. 124).
 */
const OddsRowProps = Schema.Struct({
  spend: Mana,
  dice: PoolSize,
  /** Reality's roll by severity: none, then Havoc to Manifestation (MAG-54). */
  severities: SeverityOdds,
  success: Schema.Number,
  /** The cast's expected successes: its strength, past merely working. */
  expected: Schema.Number,
  dramaticFailure: Schema.Number,
})
type OddsRowProps = typeof OddsRowProps.Type

/** A row priced before the roll: this many red dice, rolling first. */
const pricedRow = (spend: Mana, dice: PoolSize, declaredPool: number): OddsRowProps => {
  const cast = castOddsUnderParadox(declaredPool, dice)
  return {
    spend,
    dice,
    severities: severityOdds(dice),
    success: cast.success,
    expected: cast.expected,
    dramaticFailure: cast.dramaticFailure,
  }
}

/** How deep each severity burns: a step brighter into the Paradox red as it
 * worsens. The words never step — they wear --paradox whole (contrast). */
const SEVERITY_DEPTH = {
  havoc: 45,
  bedlam: 65,
  anomaly: 80,
  branding: 90,
  manifestation: 100,
  none: 0,
} as const satisfies Record<ParadoxSeverity, number>

/** A severity's fill: its depth of Paradox red over the surface. */
const paradoxFill = (severity: ParadoxSeverity): string =>
  `color-mix(in srgb, var(--paradox) ${SEVERITY_DEPTH[severity]}%, transparent)`

/** Below this a share is invisible at any width: the bar leaves it out. */
const SLIVER = 0.0005

/**
 * Reality's roll as a bar (MAG-54): the full width is certainty, each
 * severity a segment as wide as its chance and as bright a red as it is
 * bad, the neutral track the chance of no Paradox at all. Every success is a
 * worse outcome, a cast die eaten and a box to contain it (Mage p. 124), so
 * the bar shows the shape of the risk a single "any Paradox" % hides. The
 * segments never shrink: each takes its share of the width the 2px seams
 * leave, so a big pool's bar stays true.
 */
const SeverityBarProps = Schema.Struct({ severities: SeverityOdds })

function SeverityBar({ severities }: typeof SeverityBarProps.Type) {
  const shown = severities.steps.filter((step) => step.p >= SLIVER)
  const seams = Math.max(0, shown.length - 1) * 2
  return (
    <span
      aria-hidden
      className="flex h-[8px] w-full gap-[2px] overflow-hidden rounded-[2px]"
      // the empty track is no Paradox at all: neutral, never a faint red
      style={{ background: "color-mix(in srgb, var(--ink) 8%, transparent)" }}
    >
      {shown.map((step) => (
        <span
          key={step.severity}
          className="h-full shrink-0 first:rounded-l-[2px]"
          style={{
            width: `max(1px, calc(${step.p} * (100% - ${seams}px)))`,
            background: paradoxFill(step.severity),
          }}
        />
      ))}
    </span>
  )
}

/**
 * The spell's odds in the fewest words (owner, 2026-10-25): at least one
 * success, and the average past it. The breakdown's foot, and the odds above
 * the Cast button — one format in both places.
 */
const OddsFootProps = Schema.Struct({ success: Schema.Number, expected: Schema.Number })

function OddsFoot({ success, expected }: typeof OddsFootProps.Type) {
  return (
    <>
      ≥1 success <b style={{ color: "var(--rail-success)" }}>{pct(success)}</b>
      {" · avg "}
      <span style={{ color: "var(--ink)" }}>{expected.toFixed(1)}</span>
    </>
  )
}

/**
 * A row's breakdown (MAG-54, owner 2026-10-25: the bar only if its tooltip
 * shows the breakdown attractively): reality's roll severity by severity —
 * none first in verdigris (the caster's win), then Havoc to Manifestation,
 * each its bar share in its own red — and the spell's odds beneath. The
 * whole row is the trigger, so the eye can sweep down the table and the
 * breakdown follows.
 */
const OddsBreakdownProps = Schema.Struct({
  row: OddsRowProps,
  /** Why a locked row can't be picked, in its own line. */
  note: Schema.optional(Schema.String),
})
type OddsBreakdownProps = typeof OddsBreakdownProps.Type

const severityName = (severity: ParadoxSeverity): string =>
  severity.charAt(0).toUpperCase() + severity.slice(1)

function OddsBreakdown({ row, note }: OddsBreakdownProps) {
  const lines = [
    {
      name: "None",
      p: row.severities.none,
      ink: "var(--accent)",
      fill: "color-mix(in srgb, var(--accent) 70%, transparent)",
    },
    ...row.severities.steps.map((step) => ({
      name: severityName(step.severity),
      p: step.p,
      ink: "var(--paradox)",
      fill: paradoxFill(step.severity),
    })),
  ]
  return (
    <div className="mv-data grid gap-1.5 text-[11px]">
      <div className="flex items-center gap-1.5" style={{ color: "var(--paradox)" }}>
        <ParadoxGlyph size={12} />
        <span>{diceLabel(row.dice)}</span>
      </div>
      <div className="grid grid-cols-[auto_6rem_auto] items-center gap-x-2 gap-y-1">
        {lines.map((line) => (
          <div key={line.name} className="contents" style={{ opacity: line.p < SLIVER ? 0.4 : 1 }}>
            <span style={{ color: line.ink }}>{line.name}</span>
            <span className="h-[6px] w-full rounded-[2px]" style={{ background: "color-mix(in srgb, var(--ink) 6%, transparent)" }}>
              <span
                className="block h-full rounded-[2px]"
                style={{ width: `${line.p * 100}%`, background: line.fill }}
              />
            </span>
            <span className="text-right" style={{ color: "var(--ink)" }}>{pct(line.p)}</span>
          </div>
        ))}
      </div>
      <div className="border-t pt-1.5" style={{ borderColor: "var(--line)", color: "var(--dim)" }}>
        <OddsFoot success={row.success} expected={row.expected} />
      </div>
      {note !== undefined && <div style={{ color: "var(--dim)" }}>{note}</div>}
    </div>
  )
}

/** One odds row wrapped in its breakdown, beside the card where the stage has room. */
function withBreakdown(breakdown: OddsBreakdownProps, trigger: ReactNode) {
  return (
    <Tooltip key={breakdown.row.spend}>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side="left" sideOffset={10} className="max-w-none px-3 py-2.5">
        <OddsBreakdown {...breakdown} />
      </TooltipContent>
    </Tooltip>
  )
}

const OddsCellsProps = Schema.Struct({ ...OddsRowProps.fields, here: Schema.Boolean })

/**
 * The four cells, the same in the table and alone beneath the felt. Danger
 * reads as danger (#102): the Paradox glyph does the yelling (#114); dice
 * counts stay neutral quantities; the Mana price wears Mana's own glyph
 * alone. A chance-die reduction that is a real possibility warns in the
 * row's own grammar.
 */
function OddsCells({ spend, dice, severities, success, expected, dramaticFailure, here }: typeof OddsCellsProps.Type) {
  return (
    <>
      <span style={{ color: here ? "var(--mana)" : undefined }}><Lozenge /> {spend}</span>
      <span style={{ color: here ? "var(--ink)" : undefined }}>{diceLabel(dice)}</span>
      <span className="flex items-center gap-1">
        <ParadoxGlyph size={12} />
        <SeverityBar severities={severities} />
      </span>
      <span className="inline-flex flex-wrap items-center gap-x-2">
        <b className="text-[12px]" style={{ color: "var(--rail-success)" }}>
          {pct(success)}
        </b>
        <span style={{ color: here ? "var(--ink)" : undefined }}>≈{expected.toFixed(1)}</span>
        {dramaticFailure >= DRAMATIC_FAILURE_WARN_FLOOR && (
          <span style={{ color: "var(--bad)" }}>dramatic failure {pct(dramaticFailure)}</span>
        )}
      </span>
    </>
  )
}

/** The odds row alone beneath the felt — the table's grid, no table. */
function OddsRow(props: OddsRowProps) {
  return (
    <TooltipProvider disableHoverableContent>
      {withBreakdown(
        { row: props },
        <div tabIndex={0} className={`mv-data mt-1.5 ${ROW_GRID}`} style={{ color: "var(--dim)" }}>
          <OddsCells {...props} here={false} />
        </div>,
      )}
    </TooltipProvider>
  )
}

/**
 * Pricing the blind insurance (issue #45; note 7): one row per Paradox die
 * regardless of the caster's Mana — the shrunken pool and its exact odds,
 * live off the same leaves the server rolls with. With `onSelect`,
 * affordable rows select (they ARE the mitigation control — the stepper
 * died with note 9); without it the table is a reading (the Storyteller's on
 * the fluid rung, MAG-45; every other seat's watching the pick, MAG-34) and
 * no row is a control. Unaffordable rows stand visible and refuse, their
 * breakdowns explaining the gate (ADR-0021). Each row reads across: Mana
 * out, Paradox in, spell landing (owner, 2026-10-22) — the cast's own odds
 * with THIS row's red dice rolling first and eating dice (p. 124), no
 * containment assumed: the floor.
 */
function MitigationPreview({
  poolInputs,
  declaredPool,
  affordable,
  selected,
  onSelect,
  disabled,
}: {
  poolInputs: Omit<Parameters<typeof calculateParadoxPool>[0], "manaMitigation">
  declaredPool: number
  affordable: number
  /** The caster's pick — clicked here, or watched live (MAG-34); null before the fix. */
  selected: number | null
  onSelect?: ((spend: number) => void) | undefined
  disabled: boolean
}) {
  const poolBefore = calculateParadoxPool(poolInputs).totalDice
  const rows = Array.from({ length: poolBefore + 1 }, (_, spend) =>
    pricedRow(Mana.make(spend), PoolSize.make(calculateParadoxPool({ ...poolInputs, manaMitigation: spend }).totalDice), declaredPool),
  )
  return (
    // The breakdown is read, never hovered: no grace area to hold it open
    // while the pointer sweeps on to the next row.
    <TooltipProvider disableHoverableContent>
      {/* No explainer eyebrow, no dotted frame (#114): the table is the
          phase's whole job and its columns speak the rule — Mana in, Paradox
          dice out. The selected row's box is verdigris (owner, 2026-10-22;
          it burned ember before). */}
      <div className="mt-2 grid gap-1 py-1">
        {rows.map((row) => {
          const locked = row.spend > affordable
          const here = selected !== null && !locked && row.spend === Math.min(selected, affordable)
          // A locked row is a mark, not a disabled control (the pool die's
          // idiom): its breakdown stays reachable and nothing pretends it
          // could be clicked. A read-only table draws every row as a mark,
          // unlocked ones on a clear border — the caster's live pick on the
          // verdigris one (MAG-34).
          return locked || onSelect === undefined
            ? withBreakdown(
                { row, ...(locked ? { note: `${affordable} Mana free` } : {}) },
                <span
                  tabIndex={0}
                  className={`mv-data ${ROW_GRID}`}
                  style={
                    locked
                      ? { border: "1px dashed var(--line)", color: "var(--dim)", opacity: 0.5 }
                      : {
                          border: here ? "1px solid var(--accent)" : "1px solid transparent",
                          color: here ? "var(--ink)" : "var(--dim)",
                        }
                  }
                >
                  <OddsCells {...row} here={here} />
                </span>,
              )
            : withBreakdown(
                { row },
                // aria-disabled, not disabled: a disabled button takes no
                // pointer or focus, and the breakdown must still open while a
                // write is in flight (ADR-0021: a refusing control explains).
                <button
                  onClick={() => {
                    if (!disabled) onSelect(row.spend)
                  }}
                  aria-disabled={disabled}
                  className={`mv-data ${ROW_GRID} aria-disabled:opacity-40`}
                  style={{
                    border: here ? "1px solid var(--accent)" : "1px solid transparent",
                    color: here ? "var(--ink)" : "var(--dim)",
                  }}
                >
                  <OddsCells {...row} here={here} />
                </button>,
              )
        })}
      </div>
    </TooltipProvider>
  )
}

/**
 * The Paradox cockpit (notes 13–15; rebuilt symbolic by pass 2, notes 6/8/9;
 * its glyph row retired by MAG-45 — the rolled faces in the Paradox area
 * carry the count, ghosting as the bet absorbs them): a centered column
 * that IS the phase's headline — the English lore term, the caster's
 * health track beneath it. Box clicks ARE
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
  const ordinals = emptyOrdinals(track)
  // The bet can fill the last box: the martyr slot pre-reserves its height.
  const martyrReachable =
    interactive && cap >= track.filter((b) => b.severity === "empty").length
  return (
    <div className="mt-2 grid justify-items-center gap-1.5 py-1">
      {/* No glyph row (MAG-45): the rolled faces stand in the Paradox area
          above, and the ones the bet absorbs ghost there — the count of what
          is still loose is the solid red faces. */}
      {/* The lore slot: a fixed-height line the severity term burns in, or
          the quiet word when nothing runs loose — same height either way. */}
      <div className="flex h-[24px] items-center justify-center">
        {outlook.uncontained > 0 ? (
          // "2 ⟐ BEDLAM" (owner, 2026-10-25): the loose successes and what
          // they become, on one line; the numeral names itself (ADR-0021).
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  className="mv-h inline-flex items-center gap-2 text-[22px] uppercase leading-none tracking-[0.1em]"
                  style={{
                    color: "var(--paradox)",
                    textShadow:
                      "0 0 14px color-mix(in srgb, var(--paradox) 55%, transparent)",
                  }}
                >
                  <span>{outlook.uncontained}</span>
                  <ParadoxGlyph size={18} />
                  <span>{severity}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>Loose Paradox</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          paradoxSuccesses === 0 ? (
            // nothing to bear; only the chance-die grace has news (note 5)
            dramaticFailure && (
              <span className="mv-data text-[12px]" style={{ color: "var(--rail-success)" }}>
                {PARADOX_GRACE}
              </span>
            )
          ) : (
            // every success taken on the body: the terse mark (MAG-49)
            <span
              className="mv-h text-[22px] uppercase leading-none tracking-[0.14em]"
              style={{
                color: "var(--ember)",
                textShadow: "0 0 14px color-mix(in srgb, var(--ember) 45%, transparent)",
              }}
              title="All contained"
            >
              {CONTAINED_MARK}
            </span>
          )
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-[5px]">
        {track.map((box, i) => {
          const ordinal = ordinals[i] ?? null
          const ghosted = ordinal !== null && ordinal < contained
          const reachable = ordinal !== null && ordinal < cap
          const title =
            ordinal === null
              ? `${box.severity.charAt(0).toUpperCase()}${box.severity.slice(1)}${box.resistant ? " · Resistant" : ""}`
              : ghosted
                ? "Contained"
                : reachable
                  ? "Contain"
                  : "Out of reach"
          // The printed sheet's wound penalties (WoD p. 171): −1/−2/−3 at
          // the last three boxes — standing above them here, since the
          // Resistant dot owns the space beneath (Mage p. 124). Exactly one
          // penalty is ever in effect (the rightmost filled box's), and only
          // that one burns as the bet reaches it.
          const fromEnd = track.length - i
          const penaltyLabel = fromEnd <= 3 ? fromEnd - 4 : null
          const penaltyLive =
            penaltyLabel !== null && outlook.penaltyAfter === penaltyLabel
          // MAG-49: on the caster's own card a box the bet can take says so
          // (a red dashed "+", the Paradox it would absorb), and an empty box
          // past the bet stands down — the click has one place to go.
          const target = interactive && !ghosted && reachable
          const stood = interactive && ordinal !== null && !ghosted && !reachable
          const boxMark = (
            <span
              className="mv-data grid size-6 place-items-center rounded-[2px] border text-[12px] font-bold"
              style={{
                borderColor: ghosted
                  ? "var(--ember)"
                  : target
                    ? "var(--paradox)"
                    : box.severity === "empty"
                      ? "var(--line)"
                      : "var(--accent)",
                borderStyle: ghosted || target ? "dashed" : "solid",
                background: target
                  ? "color-mix(in srgb, var(--paradox) 10%, transparent)"
                  : box.severity === "empty" || box.severity === "bashing"
                    ? "transparent"
                    : "var(--glow)",
                color: ghosted ? "var(--ember)" : target ? "var(--paradox)" : "var(--accent)",
                opacity: stood ? 0.35 : 1,
              }}
            >
              {ghosted ? "╱" : target ? "+" : healthBoxGlyph(box.severity)}
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
                  title="Wound penalty"
                >
                  −{-penaltyLabel}
                </span>
              )}
              {interactive && ordinal !== null && (reachable || ghosted) ? (
                <button
                  onClick={() => onChange(ghosted ? ordinal : ordinal + 1)}
                  disabled={disabled}
                  title={title}
                  className="mv-track-box cursor-pointer rounded-[2px] disabled:opacity-40"
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
                    title="Resistant"
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
          className={`${martyrReachable ? "min-h-[18px] " : ""}mv-data text-center text-[12px]`}
          style={{ color: "var(--bad)" }}
          title={outlook.martyr ? "The cast still completes" : undefined}
        >
          {outlook.martyr ? "unconscious" : ""}
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

/**
 * A printed area of the felt (audition 2026-10-22): the chalk line and the
 * small printed name a casino felt gives each betting area, so the caster's
 * dice and reality's read as two areas with two jobs — the hand he throws
 * and the roll that is made against it first — not one overflowing row.
 */
function FeltSection({
  label,
  labelAt,
  divided = false,
  aside,
  children,
}: {
  label: string
  labelAt: "top" | "bottom"
  divided?: boolean
  /** Printed on the label's row, right-aligned: the area's instruments. */
  aside?: ReactNode
  children: ReactNode
}) {
  const name = (
    <div
      className={`mv-data flex items-baseline justify-between gap-3 px-3.5 text-[9px] uppercase tracking-[0.18em] ${labelAt === "top" ? "pt-3" : "pb-3"}`}
      style={{ color: "var(--dim)" }}
    >
      <span className="shrink-0 whitespace-nowrap">{label}</span>
      {aside && <span className="min-w-0 text-[12px]">{aside}</span>}
    </div>
  )
  return (
    <div
      className={divided ? "border-t" : undefined}
      style={
        divided
          ? { borderColor: "color-mix(in srgb, var(--ink) 62%, var(--panel))" }
          : undefined
      }
    >
      {labelAt === "top" && name}
      {children}
      {labelAt === "bottom" && name}
    </div>
  )
}

/** The wound's mark: a health box struck through, in the penalty's ink. */
const WoundGlyphProps = Schema.Struct({ size: Schema.optional(Schema.Number) })

function WoundGlyph({ size = 13 }: typeof WoundGlyphProps.Type) {
  return (
    <span
      aria-hidden
      className="mv-data grid place-items-center rounded-[2px] border font-bold leading-none"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.7), borderColor: "currentColor" }}
    >
      ╱
    </span>
  )
}

/**
 * The cast felt's legend (MAG-49, owner 2026-10-25), bottom right, mirroring
 * the Paradox area's instruments top right: the dice lost to each cause, a
 * number and a symbol each, in the cause's ink — dim at zero. Each numeral
 * names itself in a focusable tooltip (ADR-0021).
 */
const LostLegendProps = Schema.Struct({ paradox: Schema.Number, wounds: Schema.Number })

function LostLegend({ paradox, wounds }: typeof LostLegendProps.Type) {
  const entries = [
    {
      ...LOST_TO.paradox,
      glyph: <ParadoxGlyph size={13} ink={paradox > 0 ? LOST_TO.paradox.ink : "var(--dim)"} />,
      lost: paradox,
    },
    { ...LOST_TO.wounds, glyph: <WoundGlyph />, lost: wounds },
  ]
  return (
    <TooltipProvider>
      <span className="flex items-center justify-end gap-x-3 normal-case tracking-normal">
        {entries.map((e) => (
          <Tooltip key={e.group}>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                aria-label={`${e.says} ${e.lost}`}
                className="inline-flex items-center gap-1"
                style={{ color: e.lost > 0 ? e.ink : "var(--dim)" }}
              >
                {e.glyph}
                <span>{e.lost > 0 ? `−${e.lost}` : "0"}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>{e.says}</TooltipContent>
          </Tooltip>
        ))}
      </span>
    </TooltipProvider>
  )
}
