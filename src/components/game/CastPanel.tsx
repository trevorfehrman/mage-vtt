import { useMemo, type ReactNode } from "react"
import { Effect, Exit } from "effect"
import {
  previewImprovisedCast,
  previewRoteCast,
  type CastPreview,
} from "#/domain/cast-preview"
import type { CharacterSheet } from "#/domain/character"
import { WILLPOWER_BONUS_DICE } from "#/domain/willpower-economy"
import { declaredFactors } from "#/machines/cast"
import { ArcanaGlyph } from "./ArcanaGlyph"
import type { useCast } from "#/hooks/use-cast"

type CastAPI = ReturnType<typeof useCast>

/**
 * The shared pre-roll factor panel (PRD #11, issue #20): both cast routes —
 * a Rote entry or an Arcanum row on the sheet — land here to declare factors,
 * with the pool as the live readout (same slot and language as the
 * DicePoolBuilder it replaces while a cast is armed). The numbers come from
 * `cast-preview`, the client mirror of the server's own leaves; the server
 * recomputes and stays authoritative.
 */
export function CastPanel({
  cast,
  character,
}: {
  cast: CastAPI
  character: CharacterSheet
}) {
  const { selection, skillChoice } = cast.context
  const casting = cast.state === "casting"

  const preview = useMemo((): CastPreview | null => {
    if (!selection) return null
    const factors = declaredFactors(cast.context)
    // An "or" pool with no pick has no pool yet — the caster decides first.
    if (selection.method === "rote" && skillChoice === null) return null
    const exit: Exit.Exit<CastPreview, unknown> =
      selection.method === "improvised"
        ? Effect.runSyncExit(
            previewImprovisedCast({
              sheet: character,
              arcanum: selection.arcanum,
              ...factors,
            }),
          )
        : Effect.runSyncExit(
            previewRoteCast({
              sheet: character,
              rote: selection.rote,
              ...(skillChoice !== null ? { skillChoice } : {}),
              ...factors,
            }),
          )
    // A failed preview degrades to no readout — the server recomputes and
    // refuses with its typed tag; a readout must never crash the panel.
    return Exit.isSuccess(exit) ? exit.value : null
  }, [cast.context, selection, skillChoice, character])

  if (!selection) return null

  const needsSkillChoice = selection.method === "rote" && skillChoice === null
  const manaShort = preview !== null && preview.manaCost > character.manaCurrent

  return (
    <div className="border-t" style={{ borderColor: "var(--line)" }}>
      {/* what's armed + the live pool readout */}
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span className="mv-eyebrow">Casting</span>
        <span
          className="mv-data ml-auto text-[22px] font-bold leading-none"
          style={{ color: "var(--accent)" }}
        >
          {preview === null ? "—" : preview.isChanceDie ? "◈" : preview.dice}
        </span>
        <span className="mv-data text-[10px]" style={{ color: "var(--dim)" }}>
          {preview?.isChanceDie ? "chance" : "dice"}
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-3 pt-1.5">
        {selection.method === "rote" ? (
          <>
            <ArcanaGlyph
              arcanum={selection.rote.spellArcanum.toLowerCase()}
              size={14}
              className="mv-accent"
            />
            <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
              {selection.rote.name}
            </span>
            <span className="mv-data text-[10px]" style={{ color: "var(--dim)" }}>
              {selection.rote.spellName} · {selection.rote.spellArcanum}{" "}
              {selection.rote.spellLevel}
            </span>
          </>
        ) : (
          <>
            <ArcanaGlyph arcanum={selection.arcanum} size={14} className="mv-accent" />
            <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
              Improvised {capitalize(selection.arcanum)}
            </span>
          </>
        )}
      </div>

      {/* improvised: the declared effect level (its Practice) */}
      {selection.method === "improvised" && (
        <FactorRow label="level">
          {Array.from({ length: selection.dots }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => cast.setLevel(n)}
              disabled={casting}
              className={`mv-mini ${cast.context.level === n ? "mv-mini-on" : ""}`}
            >
              {n}
            </button>
          ))}
        </FactorRow>
      )}

      {/* rote "or" pool: the caster picks one alternative */}
      {selection.method === "rote" && selection.rote.pool.skills.length > 1 && (
        <FactorRow label="skill">
          {selection.rote.pool.skills.map((skill) => (
            <button
              key={skill}
              onClick={() => cast.setSkillChoice(skill)}
              disabled={casting}
              className={`mv-mini ${skillChoice === skill ? "mv-mini-on" : ""}`}
            >
              {skill}
            </button>
          ))}
        </FactorRow>
      )}

      {/* the assembled pool, exactly as the entry will record it */}
      <div className="flex min-h-[30px] flex-wrap gap-1 px-3 pt-2">
        {preview === null ? (
          <span className="mv-data text-[11px] italic" style={{ color: "var(--dim)" }}>
            pick a skill to see the pool…
          </span>
        ) : (
          preview.components.map((c, i) => (
            <span
              key={`${c.type}:${c.name}:${i}`}
              className="mv-chip flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
            >
              {c.type === "arcanum" && (
                <ArcanaGlyph arcanum={c.name} size={12} className="mv-accent" />
              )}
              <span>{c.name}</span>
              <span className="mv-data" style={{ color: "var(--dim)" }}>
                {c.dots > 0 && c.type === "modifier" ? `+${c.dots}` : c.dots}
              </span>
            </span>
          ))
        )}
      </div>

      {/* spell factors */}
      <FactorRow label="potency">
        <Stepper
          value={cast.context.potency}
          onChange={cast.setPotency}
          disabled={casting}
        />
      </FactorRow>
      <FactorRow label="targets">
        <Stepper
          value={cast.context.targets}
          onChange={cast.setTargets}
          disabled={casting}
        />
      </FactorRow>
      <FactorRow label="mana +">
        <Stepper
          value={cast.context.extraMana}
          onChange={cast.setExtraMana}
          disabled={casting}
        />
      </FactorRow>

      <div className="mt-2 flex flex-wrap items-center gap-2 px-3">
        <button
          onClick={() => cast.setHighSpeech(!cast.context.highSpeech)}
          disabled={casting}
          className={`mv-mini ${cast.context.highSpeech ? "mv-mini-on" : ""}`}
        >
          High Speech
        </button>
        <button
          onClick={() => cast.setSpendWillpower(!cast.context.spendWillpower)}
          disabled={casting}
          className={`mv-mini ${cast.context.spendWillpower ? "mv-mini-on" : ""}`}
        >
          Willpower +{WILLPOWER_BONUS_DICE}
        </button>
        <button
          onClick={() =>
            cast.setVisibility(
              cast.context.visibility === "hidden" ? "public" : "hidden",
            )
          }
          disabled={casting}
          className={`mv-mini ${cast.context.visibility === "hidden" ? "mv-mini-on" : ""}`}
        >
          Hidden
        </button>
      </div>

      {/* the cost readout — server recomputes; this is the same math */}
      {preview !== null && (
        <div className="mv-data px-3 pt-2 text-[11px]" style={{ color: manaShort ? "var(--bad)" : "var(--dim)" }}>
          Mana {preview.manaCost} · have {character.manaCurrent}
        </div>
      )}
      {preview?.contestedVs && (
        <p className="px-3 pt-1 text-[11px] italic" style={{ color: "var(--dim)" }}>
          contested vs {preview.contestedVs.join(" + ")} — the target&apos;s pool is
          the Storyteller&apos;s to roll
        </p>
      )}

      {/* action */}
      <div className="flex gap-2 p-3">
        <button
          onClick={cast.cast}
          disabled={casting || needsSkillChoice}
          className="mv-roll flex-1 rounded-[3px] py-2 text-[13px] disabled:opacity-40"
        >
          {casting
            ? "Casting…"
            : preview === null
              ? "Cast"
              : preview.isChanceDie
                ? "Cast a chance die"
                : `Cast ${preview.dice} dice`}
        </button>
        <button
          onClick={cast.cancel}
          disabled={casting}
          className="mv-btn rounded-[3px] px-3 text-[12px]"
        >
          Cancel
        </button>
      </div>

      {/* error — the seam's typed refusal, mapped to table language */}
      {cast.context.error && (
        <p className="px-3 pb-2 text-[12px]" style={{ color: "var(--bad)" }}>
          {cast.context.error}
        </p>
      )}
    </div>
  )
}

// --- Sub-components ---

function FactorRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-2 flex items-center gap-3 px-3">
      <span
        className="mv-data w-14 shrink-0 text-[10px] uppercase tracking-wider"
        style={{ color: "var(--dim)" }}
      >
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  )
}

function Stepper({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (value: number) => void
  disabled: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(value - 1)}
        disabled={disabled}
        className="mv-btn grid size-6 place-items-center rounded-[3px] text-[13px] leading-none"
      >
        −
      </button>
      <span className="mv-data w-7 text-center text-[13px] font-bold">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        disabled={disabled}
        className="mv-btn grid size-6 place-items-center rounded-[3px] text-[13px] leading-none"
      >
        +
      </button>
    </div>
  )
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
