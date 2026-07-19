import type { CharacterSheet } from "#/domain/character"
import { woundPenalty } from "#/domain/health"
import { healthBoxGlyph, ResistantDot } from "./CharacterSheet"

/**
 * The console's masthead (owner call 2026-07-19, superseding #104's caption
 * seat): the seat's depletables open the working zone — the constant plate
 * above an instrument that shifts forms. Two rows: Health keeps its special
 * thing (the sheet's typed boxes in miniature, wound penalty riding); Mana
 * and Will share one pip grammar, because both are spendable pools that
 * ghost during pool composition — filled pip = held (each in its identity
 * color), hollow ember ◇ = the point being weighed (the #102 pending
 * recipe), line-dark = spent. Pips group in fives so a count reads without
 * counting; Mana keeps a small numeral — a currency is counted in numbers.
 * Personal only; the sheet is the document, this is the HUD.
 */
export function ResourceStrip({
  character,
  pendingWillpower = false,
  pendingMana = 0,
}: {
  character: CharacterSheet
  /** A Willpower spend is armed on the felt — ghost the point being weighed. */
  pendingWillpower?: boolean
  /** Mana armed on the felt (auto cost + rider), spent when the cast commits. */
  pendingMana?: number
}) {
  return (
    <div
      className="grid gap-2 whitespace-nowrap border-t px-3 py-2"
      // Explicit panel ground: on the session rail the masthead stands on
      // the stage's void (mv-stage-ground) and opens the console itself.
      style={{ borderColor: "var(--line)", background: "var(--panel)" }}
    >
      <HealthMini track={character.healthTrack} />
      <div className="flex items-center justify-between gap-3">
        <PipMeter
          label="Mana"
          glyph="◈"
          color="var(--mana)"
          current={character.manaCurrent}
          max={character.maxMana}
          pending={pendingMana}
          numeral
        />
        <PipMeter
          label="Will"
          glyph="◆"
          color="var(--accent)"
          current={character.willpowerCurrent}
          max={character.willpower}
          pending={pendingWillpower ? 1 : 0}
        />
      </div>
    </div>
  )
}

/**
 * The health mini-track: the sheet's boxes in miniature — ╱ bashing, ✕ lethal,
 * ✳ aggravated, Resistant dots beneath — plus the derived wound penalty in the
 * existing outcome slot (`--bad` when negative; silent at 0). Glyphs carry the
 * type; no new hue (#102).
 */
function HealthMini({ track }: { track: CharacterSheet["healthTrack"] }) {
  const penalty = woundPenalty(track)
  return (
    <div className="flex items-center gap-2">
      <span className="mv-eyebrow">Health</span>
      <span className="flex gap-[3px]">
        {track.map((box, i) => (
          <span key={i} className="relative">
            <span
              className="mv-data grid size-3.5 place-items-center rounded-[2px] border text-[9px] font-bold"
              style={{
                borderColor:
                  box.severity === "empty" ? "var(--line)" : "var(--accent)",
                background:
                  box.severity === "empty" || box.severity === "bashing"
                    ? "transparent"
                    : "var(--glow)",
                color: "var(--accent)",
              }}
            >
              {healthBoxGlyph(box.severity)}
            </span>
            <span className="absolute left-1/2 top-full mt-[1px] flex -translate-x-1/2">
              <ResistantDot resistant={box.resistant} />
            </span>
          </span>
        ))}
      </span>
      {penalty < 0 && (
        <span
          className="mv-data text-[12px] font-bold"
          style={{ color: "var(--bad)" }}
          title="Wound penalty — it rides every roll"
        >
          {penalty}
        </span>
      )}
    </div>
  )
}

/**
 * The shared spendable-pool meter — one grammar for Mana and Will. Points
 * being weighed right now render as the pending ghost (hollow ember ◇, the
 * #102 recipe); a gap after every fifth pip makes the count skimmable.
 */
function PipMeter({
  label,
  glyph,
  color,
  current,
  max,
  pending,
  numeral = false,
}: {
  label: string
  glyph: string
  color: string
  current: number
  max: number
  /** Points armed on the felt — ghosted here, spent when the act commits. */
  pending: number
  /** A currency is counted in numbers — Mana keeps its small count. */
  numeral?: boolean
}) {
  const ghosts = Math.min(pending, current)
  return (
    <span className="flex items-center gap-2">
      <span className="mv-eyebrow">{label}</span>
      <span className="inline-flex gap-[3px]">
        {Array.from({ length: max }, (_, i) => {
          const isGhost = i >= current - ghosts && i < current
          return (
            <span
              key={i}
              className={`text-[13px] leading-none ${i % 5 === 4 && i !== max - 1 ? "mr-[4px]" : ""}`}
              style={{
                color: isGhost
                  ? "var(--ember)"
                  : i < current
                    ? color
                    : "var(--line)",
              }}
              title={
                isGhost
                  ? "Pending — armed on the felt, spent when it commits"
                  : undefined
              }
            >
              {isGhost ? "◇" : glyph}
            </span>
          )
        })}
      </span>
      {numeral && (
        <span className="mv-data text-[11px]" style={{ color }}>
          {current}
          <span className="font-normal opacity-60">/{max}</span>
          {pending > 0 && (
            <span
              className="opacity-60"
              title="Pending — armed on the felt, spent when it commits"
            >
              {" "}
              −{pending}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
