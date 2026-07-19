import { useMemo } from "react"
import { Option } from "effect"
import { AnimatePresence, useReducedMotion } from "motion/react"
import {
  previewImprovisedCast,
  previewRoteCast,
  type CastPreview,
} from "#/domain/cast-preview"
import { toGnosisRank, type TidesSnapshot } from "#/domain/cast"
import type { CharacterSheet } from "#/domain/character"
import { calculateParadoxPool } from "#/domain/paradox"
import { rollOdds } from "#/domain/probability"
import {
  potencyPenalty,
  TARGET_BRACKETS,
  targetCountPenalty,
} from "#/domain/spellcasting"
import { WILLPOWER_BONUS_DICE } from "#/domain/willpower-economy"
import { GateButton } from "#/components/ui/gate-button"
import { Input } from "#/components/ui/input"
import { declaredFactors, type CastContext } from "#/machines/cast"
import { ArcanaGlyph } from "./ArcanaGlyph"
import { FeltDie } from "./FeltDie"
import type { useCast } from "#/hooks/use-cast"

type CastAPI = ReturnType<typeof useCast>

/**
 * The felt in a declaring posture (issue #107; the #105 audit's unification):
 * arming a cast lands the pool as physical dice on the #98 felt — sheet dice
 * verdigris, Willpower's +3 with its own ember provenance — and the factor
 * fittings ghost two dice per press (the #102 pending recipe: the price
 * visible before it's paid), wrapping to reset past the cap. The resting
 * face is the audit's: identity (+ implied level) · the felt · price line ·
 * Willpower · intent · trigger. Everything the audit evicted is gone: no
 * mana stepper (rider spends live on the Mana strip), no High Speech, no
 * hidden toggle, no tool toggle (a standing sheet fact, reported in the
 * price line). Numbers come from the real leaves — cast-preview,
 * calculateParadoxPool, rollOdds — off live scene Tides (ADR-0022: price
 * your risk off public truth before declaring); the server recomputes and
 * stays authoritative.
 */

/** Dice a factor choice ghosts: −2 per Potency dot, −2 per targets bracket. */
const ghostCost = (potency: number, targets: number): number =>
  -(potencyPenalty(potency) + targetCountPenalty(targets))

const diceLabel = (n: number): string => (n === 1 ? "1 die" : `${n} dice`)
const pct = (p: number): string => `${(p * 100).toFixed(0)}%`
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** One preview call for both askings — the whole armed declaration, or the
 * physical pool before the bought factors take their dice. */
const previewOf = (
  context: CastContext,
  sheet: CharacterSheet,
  factors: ReturnType<typeof declaredFactors>,
): CastPreview | null => {
  const { selection, skillChoice } = context
  if (!selection) return null
  if (selection.method === "rote" && skillChoice === null) return null
  return Option.getOrNull(
    selection.method === "improvised"
      ? previewImprovisedCast({
          sheet,
          arcanum: selection.arcanum,
          ...factors,
        })
      : previewRoteCast({
          sheet,
          rote: selection.rote,
          ...(skillChoice !== null ? { skillChoice } : {}),
          ...factors,
        }),
  )
}

/**
 * The armed declaration's full preview — factors applied, Mana priced — the
 * same call the felt renders from, exported so the session route can ghost
 * the pending Mana spend on the ResourceStrip without a second derivation.
 */
export const armedPreview = (
  context: CastContext,
  sheet: CharacterSheet,
): CastPreview | null => previewOf(context, sheet, declaredFactors(context))

export function DeclarationFelt({
  cast,
  character,
  tides,
  hasPendingCast = false,
}: {
  cast: CastAPI
  character: CharacterSheet
  /** The scene's live Tides (ADR-0022) — zeros in downtime. */
  tides: TidesSnapshot
  /** One unresolved Cast per character (issue #68): gates Draft Vulgar. */
  hasPendingCast?: boolean
}) {
  const reduced = useReducedMotion()
  const { selection, skillChoice, potency, targets, spendWillpower } = cast.context
  const casting = cast.state === "casting"
  const drafting = cast.state === "drafting"
  const busy = casting || drafting

  // The physical pool — the dice before the bought factors take theirs.
  // Both previews degrade to null on refused input (issue #51); the felt
  // then shows no dice and the server's typed refusal stays the authority.
  const physicalPreview = useMemo((): CastPreview | null => {
    const { potency: _potency, targets: _targets, ...prefactor } =
      declaredFactors(cast.context)
    return previewOf(cast.context, character, prefactor)
  }, [cast.context, character])

  const preview = useMemo(
    () => armedPreview(cast.context, character),
    [cast.context, character],
  )

  if (!selection) return null

  const physical = physicalPreview?.dice ?? 0
  const live = preview?.dice ?? 0
  const ghosts = Math.min(Math.max(physical - live, 0), physical)
  const odds = rollOdds(live)
  const manaCost = preview?.manaCost ?? 0
  const manaShort = preview !== null && manaCost > character.manaCurrent
  const wpDice = spendWillpower ? WILLPOWER_BONUS_DICE : 0
  const sheetDiceCount = physical - wpDice

  // Fittings: each press ghosts two more dice; a press past what the pool
  // can afford wraps the fitting back to rest (the chevrons' cycle, kept
  // from the #105 pilot).
  const pressPotency = () => {
    const next = potency + 1
    cast.setPotency(ghostCost(next, targets) > physical ? 1 : next)
  }
  const pressTargets = () => {
    const next = TARGET_BRACKETS[TARGET_BRACKETS.indexOf(targets) + 1]
    cast.setTargets(
      next === undefined || ghostCost(potency, next) > physical ? 1 : next,
    )
  }

  const willpowerGate =
    character.willpowerCurrent < 1 && !spendWillpower
      ? "No Willpower left to spend."
      : null

  // The Tides' ask (ADR-0022): the Paradox forecast a vulgar draft would
  // face, priced off public scene truth before declaring — the same leaves
  // the freeze and the ST's roll use. The tool rides in as the sheet fact.
  const paradox = calculateParadoxPool({
    gnosis: toGnosisRank(character.gnosis),
    isRote: selection.method === "rote",
    usesMagicalTool: character.magicalTool,
    witnessCount: tides.witnessCount,
    priorParadoxRollsThisScene: tides.priorParadoxRolls,
    discretionaryModifiers: tides.circumstances,
  })
  const paradoxOdds = rollOdds(paradox.totalDice)

  const roteAspect =
    selection.method === "rote" ? selection.rote.spellAspect : undefined
  const needsSkillChoice = selection.method === "rote" && skillChoice === null

  // Button gates (issue #68): each mirrors a server refusal through shared
  // domain data, so a refusable click explains itself at the control
  // (ADR-0021). Controls that can never succeed for this spell don't render.
  const showCast = roteAspect !== "Vulgar"
  const showDraft = roteAspect !== "Covert"
  const castGate = needsSkillChoice
    ? "Pick the rote's skill first."
    : manaShort
      ? `Not enough Mana: need ${manaCost}, have ${character.manaCurrent}.`
      : null
  const draftGate = needsSkillChoice
    ? "Pick the rote's skill first."
    : manaShort
      ? `Not enough Mana: need ${manaCost}, have ${character.manaCurrent}.`
      : hasPendingCast
        ? "This character already has an unresolved Cast."
        : null

  // The one verdigris trigger the eye should land on: the only open door
  // when the aspect closes the other, Cast otherwise.
  const primary: "cast" | "draft" = showCast ? "cast" : "draft"

  const dice = Array.from({ length: physical }, (_, i) => {
    const ghosted = i >= physical - ghosts
    const kind = i >= sheetDiceCount ? "willpower" : "sheet"
    return (
      <FeltDie
        key={`${kind}:${i}`}
        kind={kind}
        reduced={reduced}
        ghosted={ghosted}
        title={
          ghosted
            ? "Spent on spell factors — the price you're weighing"
            : kind === "willpower"
              ? "Willpower — one point, precommitted and blind; Paradox can eat these like any others"
              : "Your pool, from the sheet"
        }
      />
    )
  })

  const lineage = physicalPreview
    ? physicalPreview.components
        .filter((c) => c.dots > 0 && c.name !== "Willpower")
        .map((c) => c.name)
        .join(" + ")
    : null

  return (
    <div className="border-t" style={{ borderColor: "var(--line)" }}>
      {/* identity — what you're declaring; level implied, quietly overridable */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2.5">
        <span className="mv-eyebrow">Declaring</span>
        <ArcanaGlyph
          arcanum={
            selection.method === "rote"
              ? selection.rote.spellArcanum.toLowerCase()
              : selection.arcanum
          }
          size={14}
          className="mv-accent"
        />
        <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
          {selection.method === "rote"
            ? selection.rote.name
            : `Improvised ${capitalize(selection.arcanum)}`}
        </span>
        {selection.method === "rote" ? (
          selection.rote.pool.skills.length > 1 && (
            <span className="flex items-center gap-1 pl-1">
              {selection.rote.pool.skills.map((skill) => (
                <button
                  key={skill}
                  onClick={() => cast.setSkillChoice(skill)}
                  disabled={busy}
                  className={`mv-mini ${skillChoice === skill ? "mv-mini-on" : ""}`}
                >
                  {skill}
                </button>
              ))}
            </span>
          )
        ) : (
          <button
            onClick={() =>
              cast.setLevel(cast.context.level >= selection.dots ? 1 : cast.context.level + 1)
            }
            disabled={busy}
            className="mv-data cursor-pointer border-none bg-transparent p-0 text-[10px]"
            style={{ color: "var(--dim)" }}
            title="The Practice tier your intent implies — click to override; past your dots it wraps."
          >
            level {"●".repeat(cast.context.level)}
          </button>
        )}
      </div>

      {/* the felt — the pool as physical dice; ghosts are the price being
          weighed. Not a tray here: dice come from the sheet, not the hand. */}
      <div className="px-3 pt-2">
        <div
          className="mv-felt relative rounded-[6px] border p-2"
          style={{
            borderColor: "var(--line)",
            background: "color-mix(in srgb, var(--accent) 6%, transparent)",
            minHeight: 64,
          }}
        >
          <span className="flex max-h-44 flex-wrap gap-2.5 overflow-y-auto p-1 pr-16">
            <AnimatePresence initial={false}>{dice}</AnimatePresence>
          </span>
          {physical === 0 && (
            <span className="mv-empty pointer-events-none absolute inset-0">
              {needsSkillChoice
                ? "pick a skill — the dice land here"
                : "no pool — a chance die waits"}
            </span>
          )}
          {/* the live count + odds, re-priced per press (the real leaves) */}
          {physical > 0 && (
            <span
              className="mv-data pointer-events-none absolute bottom-1.5 right-2 text-right leading-none"
              title={
                live === 0
                  ? "The factors ate the pool — a chance die"
                  : `${diceLabel(live)} · ${pct(odds.success)} at least one success`
              }
            >
              <span className="text-[18px] font-bold" style={{ color: "var(--ink)" }}>
                {live === 0 ? "◈" : live}
              </span>
              <span className="pl-1 text-[9px]" style={{ color: "var(--dim)" }}>
                {live === 0 ? "chance" : `dice · ${pct(odds.success)}`}
              </span>
            </span>
          )}
        </div>
        {lineage && (
          <p className="mv-data pt-1 text-[10px]" style={{ color: "var(--dim)" }}>
            <span style={{ color: "var(--accent)" }}>◆</span> {lineage}, from the
            sheet
          </p>
        )}
      </div>

      {/* lip fittings — the two summonable bets + Willpower's arriving dice */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2">
        <button
          onClick={pressPotency}
          disabled={busy}
          className={`mv-mini grow whitespace-nowrap disabled:opacity-40 ${potency > 1 ? "mv-mini-on" : ""}`}
          title="Buy the Potency floor: −2 dice per dot, ghosted before you pay. Insurance against dispel — the bought floor is stamped on the cast for the Storyteller to roll against. Press past the cap to reset."
        >
          Potency {"◆".repeat(potency)}
        </button>
        <button
          onClick={pressTargets}
          disabled={busy}
          className={`mv-mini grow whitespace-nowrap disabled:opacity-40 ${targets > 1 ? "mv-mini-on" : ""}`}
          title="Each bracket doubles targets for −2 dice (2/4/8/16), ghosted before you pay. Press past the cap to reset."
        >
          Targets ×{targets}
        </button>
        <GateButton
          gate={willpowerGate}
          onClick={() => cast.setSpendWillpower(!spendWillpower)}
          disabled={busy}
          className={`mv-mini grow whitespace-nowrap disabled:opacity-40 ${spendWillpower ? "mv-mini-on" : ""}`}
        >
          Willpower +{WILLPOWER_BONUS_DICE}
        </GateButton>
      </div>

      {/* the price line — auto Mana + the Tides' ask; the tool is a sheet
          fact reported in the receipt, never a dial (issue #107) */}
      <div className="mv-data px-3 pt-2 text-[10px]" style={{ color: "var(--dim)" }}>
        Mana{" "}
        <b style={{ color: manaShort ? "var(--bad)" : "var(--mana)" }}>
          ◈ {manaCost}
        </b>{" "}
        auto
        {showDraft && (
          <>
            {" "}
            · the Tides ask{" "}
            <b style={{ color: "var(--ink)" }}>
              {paradox.totalDice === 0 ? "a chance die" : diceLabel(paradox.totalDice)}
            </b>{" "}
            · bites{" "}
            <b style={{ color: "var(--rail-danger)" }}>{pct(paradoxOdds.success)}</b>
          </>
        )}
        {character.magicalTool && (
          <span title="Standing sheet fact — flips on the sheet, not here.">
            {" "}
            · tool in hand −1
          </span>
        )}
      </div>
      {preview?.contestedVs && (
        <p className="px-3 pt-1 text-[11px] italic" style={{ color: "var(--dim)" }}>
          contested vs {preview.contestedVs.join(" + ")} — the target&apos;s pool is
          the Storyteller&apos;s to roll
        </p>
      )}

      {/* intent + the trigger */}
      <div className="flex flex-wrap items-center gap-2 p-3">
        <Input
          value={cast.context.intent}
          onChange={(e) => cast.setIntent(e.target.value)}
          placeholder="What is the spell for?"
          disabled={busy}
          className="w-auto flex-1 basis-40"
        />
        {showCast && (
          <GateButton
            gate={castGate}
            onClick={cast.cast}
            disabled={busy}
            className={`${primary === "cast" ? "mv-roll" : "mv-btn"} rounded-[3px] px-3 py-1.5 text-[12px] disabled:opacity-40`}
          >
            {casting
              ? "Casting…"
              : preview === null || preview.isChanceDie
                ? "Cast ◈"
                : `Cast ${preview.dice}`}
          </GateButton>
        )}
        {showDraft && (
          <GateButton
            gate={draftGate}
            onClick={cast.draftVulgar}
            disabled={busy}
            className={`${primary === "draft" ? "mv-roll" : "mv-btn"} rounded-[3px] px-3 py-1.5 text-[12px] disabled:opacity-40`}
            title={
              draftGate ??
              "Draft into the wings — the Paradox handshake plays out on the Cast card."
            }
          >
            {drafting ? "Drafting…" : "Draft Vulgar"}
          </GateButton>
        )}
        <button
          onClick={cast.cancel}
          disabled={busy}
          className="mv-btn rounded-[3px] px-2.5 py-1.5 text-[12px]"
        >
          Cancel
        </button>
      </div>

      {/* error — the seam's typed refusal (cast or draft, one channel) */}
      {cast.context.error && (
        <p className="px-3 pb-2 text-[12px]" style={{ color: "var(--bad)" }}>
          {cast.context.error.message}
        </p>
      )}
    </div>
  )
}
