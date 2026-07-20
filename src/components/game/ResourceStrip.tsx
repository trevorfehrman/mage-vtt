import { useState } from "react"
import type { CharacterSheet } from "#/domain/character"
import { woundPenalty } from "#/domain/health"
import { seamErrorMessage } from "#/lib/seam-errors"
import { Switch } from "#/components/ui/switch"
import { healthBoxGlyph, MAGICAL_TOOL_TITLE, ResistantDot } from "./CharacterSheet"

/**
 * The console's masthead (owner call 2026-07-19, superseding #104's caption
 * seat; relaid by pass 3, note 10): the seat's depletables open the working
 * zone — the constant plate above an instrument that shifts forms. Two
 * columns now: on the left the standing tool fact (moved here from the
 * sheet's header — per-seat, beside the resources it prices) ABOVE the
 * health mini-track; on the right Willpower stacked ABOVE Mana, one pip
 * grammar for both spendable pools — filled pip = held (each in its
 * identity color), hollow ember = the point being weighed (the #102 pending
 * recipe), line-dark = spent. Both meters wear the Mana glyph shape ◈, told
 * apart by color alone (pass 3, note 12). No words, no numerals (owner call
 * 2026-07-19): the glyphs and the pip grammar are the labels — hover still
 * names each meter. Personal only; the sheet is the document, this is the
 * HUD.
 */
export function ResourceStrip({
  character,
  pendingWillpower = false,
  pendingMana = 0,
  onSetMagicalTool,
}: {
  character: CharacterSheet
  /** A Willpower spend is armed on the felt — ghost the point being weighed. */
  pendingWillpower?: boolean
  /** Mana armed on the felt (auto cost + rider), spent when the cast commits. */
  pendingMana?: number
  /** Flips the standing tool fact (issue #107; masthead-seated by pass 3,
   * note 10). Absent = the fact renders read-only (the rig, a seat without
   * the mutation). Returns the mutation's promise so a refusal can speak
   * at the toggle. */
  onSetMagicalTool?: ((hasMagicalTool: boolean) => Promise<unknown>) | undefined
}) {
  return (
    <div
      className="flex items-end justify-between gap-3 whitespace-nowrap border-t px-3 py-2"
      // Explicit panel ground: on the session rail the masthead stands on
      // the stage's void (mv-stage-ground) and opens the console itself.
      style={{ borderColor: "var(--line)", background: "var(--panel)" }}
    >
      <div className="grid justify-items-start gap-2">
        <ToolFact
          magicalTool={character.magicalTool}
          onSetMagicalTool={onSetMagicalTool}
        />
        <HealthMini track={character.healthTrack} />
      </div>
      <div className="grid justify-items-end gap-1.5">
        <PipMeter
          label="Willpower"
          color="var(--accent)"
          current={character.willpowerCurrent}
          max={character.willpower}
          pending={pendingWillpower ? 1 : 0}
        />
        <PipMeter
          label="Mana"
          color="var(--mana)"
          current={character.manaCurrent}
          max={character.maxMana}
          pending={pendingMana}
        />
      </div>
    </div>
  )
}

/**
 * The standing tool fact (issue #107), seated in the masthead (pass 3, note
 * 10): a magical tool in hand, −1 Paradox die on every vulgar cast. A
 * Switch, not a button (owner call 2026-07-19): a standing fact should read
 * on/off at a glance. The refusal speaks in place (ADR-0021); without the
 * mutation the fact renders as plain text.
 */
function ToolFact({
  magicalTool,
  onSetMagicalTool,
}: {
  magicalTool: boolean
  onSetMagicalTool?: ((hasMagicalTool: boolean) => Promise<unknown>) | undefined
}) {
  const [error, setError] = useState<string | null>(null)
  const label = (
    <span
      className="mv-data text-[10px] uppercase tracking-[0.06em]"
      style={{ color: magicalTool ? "var(--ink)" : "var(--dim)" }}
    >
      Tool {magicalTool ? "in hand −1" : "set aside"}
    </span>
  )
  if (onSetMagicalTool === undefined) {
    return <span title={MAGICAL_TOOL_TITLE}>{label}</span>
  }
  return (
    <span className="grid justify-items-start gap-1">
      <label
        className="flex cursor-pointer items-center gap-1.5"
        title={`${MAGICAL_TOOL_TITLE} A standing fact of your practice — casts stamp it as declared.`}
      >
        {label}
        <Switch
          size="sm"
          checked={magicalTool}
          onCheckedChange={(checked) => {
            setError(null)
            onSetMagicalTool(checked).catch((err) =>
              setError(seamErrorMessage(err)),
            )
          }}
        />
      </label>
      {error && (
        <span className="text-[11px]" style={{ color: "var(--bad)" }}>
          {error}
        </span>
      )}
    </span>
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
    <div className="flex items-center gap-2" title="Health">
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
 * The shared spendable-pool meter — one grammar for Mana and Will, one glyph
 * shape for both (◈, pass 3, note 12; color is the identity). Points being
 * weighed right now render as the pending ghost (hollow ember ◇, the #102
 * recipe) — every pip sits in a fixed-width cell so the ghost's different
 * advance width can't shuffle its neighbors (pass 3, note 11). The
 * five-group gap only applies to meters of ten or more whose LAST group
 * holds at least two pips: on a short meter the break landed one pip from
 * the end and read as a layout bug, not a counting aid (note 11's other
 * half) — and an 11-pip meter reproduces the same orphan one row down, so
 * a break that would strand a single trailing pip is dropped too. The
 * label survives only as the hover name — the glyph is the visible label.
 */
function PipMeter({
  label,
  color,
  current,
  max,
  pending,
}: {
  label: string
  color: string
  current: number
  max: number
  /** Points armed on the felt — ghosted here, spent when the act commits. */
  pending: number
}) {
  const ghosts = Math.min(pending, current)
  const grouped = max >= 10 && max % 5 !== 1
  return (
    <span className="flex items-center gap-2" title={label}>
      <span className="inline-flex gap-[3px]">
        {Array.from({ length: max }, (_, i) => {
          const isGhost = i >= current - ghosts && i < current
          return (
            <span
              key={i}
              className={`inline-block w-[13px] text-center text-[13px] leading-none ${grouped && i % 5 === 4 && i !== max - 1 ? "mr-[4px]" : ""}`}
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
              {isGhost ? "◇" : "◈"}
            </span>
          )
        })}
      </span>
    </span>
  )
}
