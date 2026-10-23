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
  isRoteCast,
  toGnosisRank,
  waitingOn,
  type CastStatus,
} from "#/domain/cast"
import type { CharacterSheet } from "#/domain/character"
import type { HealthTrack } from "#/domain/damage"
import {
  calculateParadoxPool,
  resolveParadox,
  type ParadoxPoolModifier,
} from "#/domain/paradox"
import { castOddsUnderParadox, rollOdds } from "#/domain/probability"
import { signedDice, tidesGround, tidesNetInk, tidesPillEdge, tidesWeight } from "./tides-ground"
import { seamErrorMessage } from "#/lib/seam-errors"
import { WILLPOWER_COMPONENT_NAME } from "#/domain/willpower-economy"
import { castLadderMachine, ladderControls, ladderRung } from "#/machines/cast-ladder"
import { ArcanaGlyph, arcanumTint, isGrossArcanum } from "./ArcanaGlyph"
import { healthBoxGlyph, ResistantDot } from "./CharacterSheet"
import { BurstFaces } from "./BurstFaces"
import { UnifiedDie } from "./UnifiedDie"
import type { PoolKind } from "./die-look"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "#/components/ui/tooltip"
import { PriorRollsGlyph, SleeperGlyph, ToolGlyph } from "./TideGlyphs"
import { ParadoxGlyph } from "./ParadoxGlyph"
import { Felt } from "./Felt"
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
  adjust,
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
  /** The dressing room's door (MAG-45): its cast is a fixture the server
   * would refuse, so the rig keeps the ST's adjustments in local state and
   * hands this in. The live route leaves it undefined and the Convex
   * mutation runs. */
  adjust?: ((adjustments: ReadonlyArray<ParadoxPoolModifier>) => Promise<unknown>) | undefined
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
  // The ST's draft tide (issue #44; MAG-45): one shore's skeleton pill
  // opened for typing — local until Enter lands it on the document.
  const [draft, setDraft] = useState<TideDraft | null>(null)
  /** The cast-die group under the pointer (the badges work): its dice glow, the rest settle. */
  const [litKind, setLitKind] = useState<PoolKind | null>(null)
  const settle = (kind: PoolKind) => (litKind !== null && litKind !== kind ? 0.4 : 1)

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
  // is simply smaller.
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
  // PROVISIONAL pool — Gnosis base + rote/tool + the ST's live adjustments —
  // that grows and shrinks as tags land and truly settles at the fix.
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
  const mitigateCap = mySheet
    ? mitigationCap(poolBeforeMitigation, mySheet.manaCurrent, cast.spellManaCost)
    : 0
  // Dice the selected mitigation row buys off — live only while the commit
  // decision is; they ghost from the Paradox row's end (the cockpit's own
  // doctrine for eaten cast dice), which is where the scene's red dice sit,
  // so Mana erases the weather first and only then reaches into Gnosis.
  const mitigated = controls.includes("commit") ? Math.min(mitigation, mitigateCap) : 0

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
  const eaten = controls.includes("contain") && outlook !== null ? outlook.eaten : 0
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
    kind === "willpower"
      ? `Willpower +${groupCount(kind)}`
      : kind === "arcanum"
        ? `${arcanum === undefined ? "Arcanum" : titleCase(arcanum)} ${groupCount(kind)}`
        : kind === "highSpeech"
          ? `High Speech +${groupCount(kind)}`
          : sheetTerms.length > 0
            ? sheetTerms
            : `Sheet ${groupCount(kind)}`
  const feltDice = feltKinds.map((kind, i) => {
    const ghosted = i >= feltKinds.length - eaten
    const arcanum = feltSpecs[i]?.arcanum
    const says = ghosted ? "Eaten by Paradox" : groupSays(kind, arcanum)
    return (
      <Tooltip key={`${kind}:${i}`}>
        <TooltipTrigger asChild>
          <span
            className="grid size-[20px] place-items-center transition-opacity duration-150"
            style={{ opacity: settle(kind) }}
            onPointerEnter={() => setLitKind(kind)}
            onPointerLeave={() => setLitKind(null)}
          >
            <UnifiedDie
              mode="pool"
              kind={kind}
              arcanum={arcanum}
              reduced={reduced}
              glide={false}
              ghost={ghosted}
              lit={litKind === kind}
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
      ? feltPool.totalDice
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
  // The Tides on the felt (notes 3/4/17): the pool's named ±s as ebb/flood
  // badges in the gutter, live on every seat's card — fluid and fixed alike
  // now that the provisional pool computes (note 1) — except on the ST's own
  // card while editable, where the Tides block below carries them instead of
  // doubling here. The mitigation modifier never badges (pass 3, note 5):
  // the table and the shrinking dice count carry it.
  // The badges work (2026-10-22 evening): the Paradox area explains its own
  // red dice, in two registers. INSTRUMENTS are the rule's fixed slots —
  // Sleepers, prior rolls, the tool (rote when rote) — always printed on the
  // area's label row, dim at zero and in ink when live, so the eye learns
  // their positions and reads "why so few / so many" at a glance. WEATHER
  // is the ST's named circumstances — scene-wide and this caster's own —
  // the only prose in the area and its only colored text, ember rising and
  // verdigris pulling back, so the news of THIS cast pops unhidden. Before
  // the fix the scene seed is unstamped, so the seeded instruments read "—".
  // Mana mitigation never badges (pass 3, note 5): the shrinking count says it.
  // The weather — the ST's named circumstances, scene-wide and this
  // caster's own — is storytelling, so it stands in its OWN section above
  // the felt, the first thing the player reads (owner, 2026-10-22 evening):
  // pills, prose | number, red for a flood (more Paradox dice) and verdigris
  // for an ebb, floods first. Long names run and wrap. The Paradox area's
  // instrument row no longer prints the net at all (MAG-45, owner
  // 2026-10-23: it printed twice — the TIDES eyebrow keeps it).
  const bySign = (a: { modifier: ParadoxPoolModifier }, b: { modifier: ParadoxPoolModifier }) =>
    Math.sign(b.modifier.dice) - Math.sign(a.modifier.dice)
  const weather: ReadonlyArray<{ modifier: ParadoxPoolModifier; onRemove?: () => void }> = Array.from([
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
  ]).sort(bySign)
  // Each instrument is a glyph and the raw FACT (owner, 2026-10-22 evening):
  // how many Sleepers, how many prior rolls, the Tides' net pull, tool in
  // hand or not — never the dice they add; the dice show that. Zero prints
  // as the glyph and "0" in dim, unseeded as "—". Live ink says which way
  // it pulls: red for what adds Paradox dice, verdigris for what takes them.
  const seeded = cast.tides !== undefined
  const count = (n: number | undefined) => (n === undefined ? "—" : String(n))
  const instruments: ReadonlyArray<{ key: string; glyph: ReactNode; value: string | null; ink: string; says: string }> = [
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

  // The mitigation table (issue #45; note 7) is the caster's on the commit
  // beat — and the Storyteller's, read-only, while the Tides are still
  // fluid (MAG-45, owner 2026-10-23): the ST sees what each ruling does to
  // the player's choices before fixing them, off the same provisional pool
  // the felt shows. Only the ST sees it then — the other seats do not watch
  // the ST's thoughts in progress — and the affordable rows read from the
  // CASTER's Mana, whichever seat holds the card.
  const tableInputs = controls.includes("commit")
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
        : pricedRow(0, feltPool.totalDice, cast.declaredPool),
    ),
    Match.when("paradox", () => {
      if (pool === null) return null
      if (cast.paradoxSuccesses === undefined) {
        return pricedRow(cast.manaMitigation ?? 0, pool.totalDice, cast.declaredPool)
      }
      // The surviving cast pool under the bet — the cockpit's own number
      // when the sheet decoded, the same leaf off the local count when it
      // did not (the NumberInput fallback still bets).
      const castPool =
        outlook?.castPool ??
        castPoolAfterParadox(cast.declaredPool, cast.paradoxSuccesses, cockpitContained)
      const odds = rollOdds(castPool)
      return {
        spend: cast.manaMitigation ?? 0,
        // the committed pool, as the table priced it — explosions are the
        // felt's to show, not a change of what was rolled against
        dice: pool.totalDice,
        paradox: { kind: "rolled", successes: cast.paradoxSuccesses },
        success: odds.success,
        dramaticFailure: odds.isChanceDie ? odds.dramaticFailure : 0,
      }
    }),
    // The draft prices nothing yet; the record and the dead rungs say nothing
    // here — listed, not defaulted (ADR-0018).
    Match.whenOr("draft", "resolved", "cancelled", "voided", () => null),
    Match.exhaustive,
  )

  // The masthead's Mana ghost (pass 2, note 1): the spell's cost ghosts from
  // the moment the cast is on stage ("phase 1" read as the first on-stage
  // phase — a waiting draft doesn't ghost), the selected mitigation joining
  // while the commit decision is live. After the commit the Mana is truly
  // spent and the masthead's real count carries it.
  const pendingManaNow = status === "price" ? cast.spellManaCost + mitigated : 0
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
          in your face — VULGAR PRIME 1 — the caster beneath.
          The old "Vulgar Cast" badge died with it: the headline IS the word. */}
      <div className="flex items-start justify-between gap-2">
        <span
          className="mv-h min-w-0 truncate text-[18px] uppercase tracking-[0.06em]"
          style={{ color: "var(--ink)" }}
        >
          Vulgar {cast.arcanum} {cast.level}
        </span>
        <div className="flex items-center gap-1.5 pt-0.5">
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
          {/* The Arcanum's glyph in its own Realm metal, top-right, so the
              headline's text sits flush left (owner, 2026-10-22 evening). */}
          <span style={{ color: arcanumTint(cast.arcanum) }}>
            <ArcanaGlyph
              arcanum={cast.arcanum}
              size={18}
              className="shrink-0"
              variant={isGrossArcanum(cast.arcanum) ? "seal" : "line"}
            />
          </span>
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

      {/* The Tides, a section of their own (owner, 2026-10-22 late): the ST
          setting the stage — the premise of the beat, declared to the player
          and read before the dice. Its own box on the felt's radius and
          line, and after the owner's audition (/prototype/tides-audition,
          treatment H, see tides-ground.ts) the box's ground IS the mood:
          green owns the left edge, red the right, the net slides the seam,
          green leans into the top-left and red into the bottom-right. The
          eyebrow prints the net beside TIDES. The circumstances stand as
          two shores: ebbs stacked bottom-left, floods bottom-right, prose in
          ink, the number outboard behind a rule in the pill's own edge —
          weakest at the top, strongest sinking to the corner. The felt below
          keeps its own ground and stays the star. */}
      {(weather.length > 0 || controls.includes("adjust")) && (() => {
        const mods = weather.map((w) => w.modifier)
        const { net } = tidesWeight(mods)
        const ebbs = Array.from(weather).filter((w) => w.modifier.dice < 0).sort((a, b) => b.modifier.dice - a.modifier.dice)
        const floods = Array.from(weather).filter((w) => w.modifier.dice > 0).sort((a, b) => a.modifier.dice - b.modifier.dice)
        const pill = ({ modifier, onRemove }: (typeof weather)[number], side: "ebb" | "flood", i: number) => {
          const edge = tidesPillEdge(modifier.dice)
          const n = Math.abs(modifier.dice)
          const num = (
            <span
              className="flex items-center whitespace-nowrap px-2 py-1 font-bold"
              style={{
                color: "var(--ink)",
                ...(side === "ebb" ? { borderRight: `1px solid ${edge}` } : { borderLeft: `1px solid ${edge}` }),
              }}
            >
              {signedDice(modifier.dice)}
              {onRemove && (
                <button
                  onClick={onRemove}
                  disabled={busy}
                  className="ml-1.5 leading-none opacity-70 hover:opacity-100 disabled:opacity-40"
                  style={{ color: "var(--dim)" }}
                  title="Remove"
                >
                  ×
                </button>
              )}
            </span>
          )
          return (
            <Tooltip key={`${side}-${modifier.source}-${i}`}>
              <TooltipTrigger asChild>
                <span
                  className="mv-data inline-flex max-w-full items-stretch overflow-hidden border text-[12px] leading-none"
                  style={{
                    borderRadius: 11,
                    borderColor: edge,
                    color: "var(--ink)",
                    background: "color-mix(in srgb, var(--panel) 88%, transparent)",
                  }}
                >
                  {side === "ebb" && num}
                  {/* break between words only — a shore never splits a word */}
                  <span className="px-2.5 py-1" style={{ overflowWrap: "normal", wordBreak: "normal" }}>
                    {modifier.source}
                  </span>
                  {side === "flood" && num}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                {side === "ebb" ? `Ebb · −${n}` : `Flood · +${n}`}
              </TooltipContent>
            </Tooltip>
          )
        }
        // The ST's hand on each shore (MAG-45, owner 2026-10-23): a skeleton
        // pill at the shore's end — dashed in the shore's ink, "+ ebb" /
        // "+ flood" — that is ALWAYS there (owner's second look). Clicking it
        // opens a draft pill above it: the prose typed in the pill's own
        // text cell, the count a plain number in its number cell (− / +, or
        // ↑/↓) — the shore supplies the sign when it lands. ✓ or Enter lands
        // it; × or Esc discards it; clicking away lands it if it has a name
        // and discards it if not. The block of chips that used to sit
        // beneath the card is gone with it.
        const shoreEnd = (side: TideDraft["side"]) => {
          if (!controls.includes("adjust")) return null
          const edge = tidesPillEdge(side === "ebb" ? -1 : 1)
          const shell = "mv-data inline-flex max-w-full items-stretch overflow-hidden border text-[12px] leading-none"
          // A fresh draft on this shore. By mouse it is one press even with a
          // draft open (owner's third look): the press lands the open one if
          // it has a name (not through blur — mousedown is intercepted so
          // the field never loses focus to a disabled button) and opens the
          // new one; a keyboard activation reaches onClick after Tab's blur
          // has already landed or discarded the old draft.
          const openDraft = () => {
            if (draft !== null && draft.side === side && draft.source.trim().length > 0) void addTide()
            setDraft({ side, source: "", count: 1 })
          }
          const skeleton = (
            <button
              key={`${side}-new`}
              onMouseDown={(e) => {
                e.preventDefault()
                if (!busy) openDraft()
              }}
              onClick={(e) => {
                if (e.detail === 0 && !busy) openDraft()
              }}
              className={`${shell} px-2.5 py-1 opacity-60 hover:opacity-100 ${RING}`}
              style={{ borderRadius: 11, borderStyle: "dashed", borderColor: edge, color: "var(--dim)", background: "transparent" }}
              title={side === "ebb" ? "Name an ebb — the Tides pull back: fewer Paradox dice" : "Name a flood — the Tides rise: more Paradox dice"}
            >
              + {side}
            </button>
          )
          if (draft === null || draft.side !== side) return skeleton
          // The number cell steps with its own − and + (owner, 2026-10-23:
          // shift-click and the arrow keys were invisible); the arrow keys
          // still work in the field. The prose cell ends in ✓ (add; Enter)
          // and × (discard; Esc), in the shore's ink — the same × the live
          // pill wears. The flood pill mirrors, like the live ones.
          const stepButton = (dir: 1 | -1) => (
            <button
              onClick={() => setDraft({ ...draft, count: stepTideCount(draft.count, dir) })}
              disabled={busy || (dir === -1 ? draft.count <= 1 : draft.count >= TIDE_COUNT_MAX)}
              className={`px-1.5 py-1 leading-none disabled:opacity-30 ${RING}`}
              style={{ color: "var(--dim)" }}
              title={dir === 1 ? "One more die (↑)" : "One fewer die (↓)"}
            >
              {dir === 1 ? "+" : "−"}
            </button>
          )
          const num = (
            <span
              className="flex items-center whitespace-nowrap font-bold"
              style={{
                color: "var(--ink)",
                ...(side === "ebb" ? { borderRight: `1px solid ${edge}` } : { borderLeft: `1px solid ${edge}` }),
              }}
            >
              {stepButton(-1)}
              <span className="px-0.5" title={side === "ebb" ? "Dice the ebb takes" : "Dice the flood adds"}>
                {draft.count}
              </span>
              {stepButton(1)}
            </span>
          )
          const canAdd = !busy && draft.source.trim().length > 0
          const accept = (
            <button
              onClick={() => void addTide()}
              disabled={!canAdd}
              className={`px-1.5 py-1 leading-none disabled:opacity-30 ${RING}`}
              style={{ color: edge }}
              title="Add this tide (Enter)"
            >
              ✓
            </button>
          )
          const discard = (
            <button
              onClick={() => setDraft(null)}
              disabled={busy}
              className={`px-1.5 py-1 leading-none opacity-70 hover:opacity-100 disabled:opacity-40 ${RING}`}
              style={{ color: "var(--dim)" }}
              title="Discard (Esc)"
            >
              ×
            </button>
          )
          const field = (
            <input
              autoFocus
              value={draft.source}
              onChange={(e) => setDraft({ ...draft, source: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addTide()
                else if (e.key === "Escape") setDraft(null)
                else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                  e.preventDefault()
                  setDraft({ ...draft, count: stepTideCount(draft.count, e.key === "ArrowUp" ? 1 : -1) })
                }
              }}
              disabled={busy}
              placeholder="name it…"
              // mv-field is the repo's text control (component-standards §6);
              // the pill's own edge is the border, so the field's is cleared.
              className="mv-field mv-data min-w-0 px-2 py-1 text-[12px]"
              style={{ width: `${Math.max(10, draft.source.length + 2)}ch`, border: "none", borderRadius: 0 }}
            />
          )
          const draftPill = (
            <span
              key={`${side}-draft`}
              className={shell}
              style={{ borderRadius: 11, borderColor: edge, color: "var(--ink)", background: "color-mix(in srgb, var(--panel) 88%, transparent)" }}
              onBlur={(e) => {
                // focus left the pill (not just moved between its cells)
                if (e.currentTarget.contains(e.relatedTarget)) return
                if (draft.source.trim().length > 0) void addTide()
                else setDraft(null)
              }}
            >
              {side === "ebb" ? (
                <>
                  {num}
                  {field}
                  {accept}
                  {discard}
                </>
              ) : (
                <>
                  {discard}
                  {accept}
                  {field}
                  {num}
                </>
              )}
            </span>
          )
          return (
            <>
              {draftPill}
              {skeleton}
            </>
          )
        }
        return (
          <TooltipProvider>
            {/* No border (owner, 2026-10-22): the tides themselves establish
                the area — the ground's two inks are its edges. */}
            <div
              className="mt-2.5 rounded-[6px] px-3.5 pt-3 pb-3.5"
              style={{ background: tidesGround(mods) }}
            >
              <div
                className="mv-data flex items-baseline justify-between text-[9px] uppercase tracking-[0.18em]"
                style={{ color: "var(--dim)" }}
              >
                <span>tides</span>
                <span className="text-[12px] normal-case tracking-normal" style={{ color: tidesNetInk(net) }}>
                  ≈ {signedDice(net)}
                </span>
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="flex flex-col items-start gap-1.5" style={{ maxWidth: "64%" }}>
                  {ebbs.map((w, i) => pill(w, "ebb", i))}
                  {shoreEnd("ebb")}
                </div>
                <div className="ml-auto flex flex-col items-end gap-1.5" style={{ maxWidth: "64%" }}>
                  {floods.map((w, i) => pill(w, "flood", i))}
                  {shoreEnd("flood")}
                </div>
              </div>
            </div>
          </TooltipProvider>
        )
      })()}

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
            ghostTitle="Contained — this Paradox success lands as Resistant bashing instead of manifesting"
          />
        )}
        {paradoxDiceCount !== null && (
          <div className="flex flex-wrap content-start gap-3.5 px-3.5 pt-2.5 pb-4">
            <TooltipProvider>
            <AnimatePresence initial={false}>
              {Array.from({ length: paradoxDiceCount }, (_, i) => {
                const kind: PoolKind = i < paradoxBaseCount ? "paradoxBase" : "paradox"
                const ghosted = i >= paradoxDiceCount - mitigated
                return (
                  <Tooltip key={`paradox:${i}`}>
                    <TooltipTrigger asChild>
                      <span
                        className="grid size-[20px] place-items-center transition-opacity duration-150"
                        style={{ opacity: settle(kind) }}
                        onPointerEnter={() => setLitKind(kind)}
                        onPointerLeave={() => setLitKind(null)}
                      >
                        <UnifiedDie
                          mode="pool"
                          kind={kind}
                          reduced={reduced}
                          glide={false}
                          ghost={ghosted}
                          lit={litKind === kind}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>
                      {ghosted
                        ? `Mitigated: −${mitigated}`
                        : kind === "paradoxBase"
                          ? baseSays
                          : `Tides: +${paradoxDiceCount - paradoxBaseCount}`}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
              {paradoxDiceCount === 0 && (
                // The chance-die ghost holds the FIRST slot's key: when a
                // flood lands it becomes the base die in place (one motion
                // element, ghost → solid) instead of exiting beside an
                // entering sibling, which made the base land one slot over
                // and jump back (owner, 2026-10-23).
                <Tooltip key="paradox:0">
                  <TooltipTrigger asChild>
                    <span className="grid size-[20px] place-items-center">
                      <UnifiedDie mode="pool" kind="paradox" ghost reduced={reduced} glide={false} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>No pool: chance die</TooltipContent>
                </Tooltip>
              )}
            </AnimatePresence>
            </TooltipProvider>
          </div>
        )}
        </FeltSection>
        )}
        <FeltSection label="cast" labelAt="bottom" divided={paradoxArea}>
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
            rolledAt={cast.timestamp}
          />
        ) : (
          <div className="flex flex-wrap content-start gap-3.5 px-3.5 pt-4 pb-2.5">
            <TooltipProvider>
              <AnimatePresence initial={false}>{feltDice}</AnimatePresence>
            </TooltipProvider>
            {cast.declaredPool === 0 && (
              <span className="mv-data text-[12px]" style={{ color: "var(--dim)" }}>
                no pool — a chance die waits
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
          poolBefore={tablePoolBefore}
          declaredPool={cast.declaredPool}
          affordable={tableAffordable}
          selected={mitigation}
          // The ST's fluid-rung table is a reading, not a control (MAG-45).
          onSelect={controls.includes("commit") ? setMitigation : undefined}
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
              title="The point of no return: mitigation, spell cost, and any precommitted Willpower commit now."
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
                  title="The Mana this commit spends — spell cost plus the selected mitigation"
                >
                  {pendingManaNow} ◈
                </b>
              )}
              {cast.spendWillpower && (
                <b
                  className="mv-data leading-none"
                  title="The precommitted Willpower point — it spends at the commit"
                >
                  1 ◈
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
 * The ST's draft tide (MAG-45): which shore it opens on, its prose, and its
 * count — 1..10, the swing a single ruling plausibly reaches (issue #44); a
 * wilder swing is several named rulings, each readable. The sign is the
 * shore's: an ebb takes dice, a flood adds them.
 */
const TIDE_COUNT_MAX = 10
/** The shared focus plank (styles.css) on controls that wear no mv-* class. */
const RING = "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
const TideDraft = Schema.Struct({
  side: Schema.Literals(["ebb", "flood"]),
  source: Schema.String,
  count: Schema.Number,
})
type TideDraft = typeof TideDraft.Type
const tideDraftDice = (d: TideDraft): number => (d.side === "ebb" ? -d.count : d.count)
const stepTideCount = (count: number, dir: 1 | -1): number =>
  Math.min(TIDE_COUNT_MAX, Math.max(1, count + dir))

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
  dice <= 0 ? "chance die" : dice === 1 ? "1 die" : `${dice} dice`


/** The one grid every odds row stands in: Mana · dice · Paradox · success. */
const ROW_GRID = "grid grid-cols-[3.5rem_5.5rem_4.5rem_1fr] items-center gap-2 rounded-[2px] px-1.5 py-0.5 text-left text-[12px]"

/**
 * One odds row's facts (MAG-45): the Mana spent, the red dice, reality's
 * cell — its success odds before the roll, its rolled count after — and the
 * cast's success % with those dice priced in (castOddsUnderParadox, p. 124).
 */
const OddsRowProps = Schema.Struct({
  spend: Schema.Number,
  dice: Schema.Number,
  paradox: Schema.Union([
    Schema.Struct({ kind: Schema.Literal("odds"), p: Schema.Number }),
    Schema.Struct({ kind: Schema.Literal("rolled"), successes: Schema.Number }),
  ]),
  success: Schema.Number,
  dramaticFailure: Schema.Number,
})
type OddsRowProps = typeof OddsRowProps.Type

/** A row priced before the roll: this many red dice, rolling first. */
const pricedRow = (spend: number, dice: number, declaredPool: number): OddsRowProps => {
  const cast = castOddsUnderParadox(declaredPool, dice)
  return {
    spend,
    dice,
    paradox: { kind: "odds", p: rollOdds(dice).success },
    success: cast.success,
    dramaticFailure: cast.dramaticFailure,
  }
}

const OddsCellsProps = Schema.Struct({ ...OddsRowProps.fields, here: Schema.Boolean })

/**
 * The four cells, the same in the table and alone beneath the felt. Danger
 * reads as danger (#102): the Paradox glyph does the yelling (#114); dice
 * counts stay neutral quantities; the Mana price wears Mana's own glyph
 * alone. A chance-die reduction that is a real possibility warns in the
 * row's own grammar.
 */
function OddsCells({ spend, dice, paradox, success, dramaticFailure, here }: typeof OddsCellsProps.Type) {
  return (
    <>
      <span style={{ color: here ? "var(--mana)" : undefined }}>◈ {spend}</span>
      <span style={{ color: here ? "var(--ink)" : undefined }}>{diceLabel(dice)}</span>
      <span className="inline-flex items-center gap-1">
        <ParadoxGlyph size={12} />
        <b className="text-[12px]" style={{ color: "var(--paradox)" }}>
          {Match.value(paradox).pipe(
            Match.when({ kind: "odds" }, ({ p }) => pct(p)),
            Match.when({ kind: "rolled" }, ({ successes }) => String(successes)),
            Match.exhaustive,
          )}
        </b>
      </span>
      <span className="inline-flex flex-wrap items-center gap-x-2">
        <span>
          success{" "}
          <b className="text-[12px]" style={{ color: "var(--rail-success)" }}>
            {pct(success)}
          </b>
        </span>
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
    <div className={`mv-data mt-1.5 ${ROW_GRID}`} style={{ color: "var(--dim)" }}>
      <OddsCells {...props} here={false} />
    </div>
  )
}

/**
 * Pricing the blind insurance (issue #45; note 7): one row per Paradox die
 * regardless of the caster's Mana — the shrunken pool and its exact odds,
 * live off the same leaves the server rolls with. With `onSelect`,
 * affordable rows select (they ARE the mitigation control — the stepper
 * died with note 9); without it the table is the Storyteller's reading on
 * the fluid rung (MAG-45) and no row is a control. Unaffordable rows stand
 * visible and refuse, their titles explaining the gate (ADR-0021). Each
 * row reads across: Mana out, Paradox in, spell landing (owner,
 * 2026-10-22) — the cast's own odds with THIS row's red dice rolling first
 * and eating dice (p. 124), no containment assumed: the floor.
 */
function MitigationPreview({
  poolInputs,
  poolBefore,
  declaredPool,
  affordable,
  selected,
  onSelect,
  disabled,
}: {
  poolInputs: Omit<Parameters<typeof calculateParadoxPool>[0], "manaMitigation">
  poolBefore: number
  declaredPool: number
  affordable: number
  selected: number
  onSelect?: ((spend: number) => void) | undefined
  disabled: boolean
}) {
  const rows = Array.from({ length: poolBefore + 1 }, (_, spend) =>
    pricedRow(spend, calculateParadoxPool({ ...poolInputs, manaMitigation: spend }).totalDice, declaredPool),
  )
  return (
    // No explainer eyebrow, no dotted frame (#114): the table is the phase's
    // whole job and its columns speak the rule — Mana in, Paradox dice out.
    <div className="mt-2 grid gap-1 py-1">
      {/* The selected row's box is verdigris (owner, 2026-10-22; it burned
          ember before). */}
      {rows.map((row) => {
        const locked = row.spend > affordable
        const here = onSelect !== undefined && !locked && row.spend === Math.min(selected, affordable)
        // A locked row is a mark, not a disabled control (the pool die's idiom):
        // its title stays reachable and nothing pretends it could be clicked.
        return locked ? (
          <span
            key={row.spend}
            className={`mv-data ${ROW_GRID}`}
            style={{ border: "1px dashed var(--line)", color: "var(--dim)", opacity: 0.5 }}
            title={`Needs ${row.spend} Mana free after the spell's cost — ${affordable} ${affordable === 1 ? "is" : "are"} free.`}
          >
            <OddsCells {...row} here={false} />
          </span>
        ) : onSelect === undefined ? (
          <span
            key={row.spend}
            className={`mv-data ${ROW_GRID}`}
            style={{ border: "1px solid transparent", color: "var(--dim)" }}
          >
            <OddsCells {...row} here={false} />
          </span>
        ) : (
          <button
            key={row.spend}
            onClick={() => onSelect(row.spend)}
            disabled={disabled}
            className={`mv-data ${ROW_GRID} disabled:opacity-40`}
            style={{
              border: here ? "1px solid var(--accent)" : "1px solid transparent",
              color: here ? "var(--ink)" : "var(--dim)",
            }}
          >
            <OddsCells {...row} here={here} />
          </button>
        )
      })}
    </div>
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
      {/* No glyph row (MAG-45): the rolled faces stand in the Paradox area
          above, and the ones the bet absorbs ghost there — the count of what
          is still loose is the solid red faces. */}
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
