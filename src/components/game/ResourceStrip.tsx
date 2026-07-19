import type { CharacterSheet } from "#/domain/character"
import { woundPenalty } from "#/domain/health"
import { healthBoxGlyph, ResistantDot } from "./CharacterSheet"

/**
 * The seat's at-a-glance depletables, pinned to the rail foot beside the
 * controls that spend them — the felt's caption (#104). Health joins Mana and
 * Will (#99, Diablo/PoE: depletables inform every choice, even mid-RP). One
 * line is the law: Health is the sheet's own typed boxes in miniature plus
 * the wound-penalty numeral — the number that rides every roll; Mana is its
 * glyph and count in the identity blue (#102) — a currency reads as a number;
 * Will keeps the diamond meter, small enough to afford and the surface the
 * pending-ghost recipe needs. Personal only; the sheet is the document, this
 * is the HUD.
 */
export function ResourceStrip({
  character,
  pendingWillpower = false,
  pendingMana = 0,
  rider,
}: {
  character: CharacterSheet
  /** A Willpower spend is armed on the felt — ghost the point being weighed. */
  pendingWillpower?: boolean
  /** Mana armed on the felt (auto cost + rider) — the pending-ghost recipe
   * (#102) over Mana's own identity, spent when the cast commits. */
  pendingMana?: number
  /** The rider spend lives where the resource lives (issue #107): while a
   * cast is armed, "the spell text says 1 more" is declared here, never on
   * a bench stepper. */
  rider?: { value: number; onChange: (next: number) => void } | undefined
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 whitespace-nowrap border-t px-3 py-2"
      style={{ borderColor: "var(--line)" }}
    >
      <HealthMini track={character.healthTrack} />
      <span className="mv-eyebrow flex items-center gap-1">
        <span aria-hidden style={{ color: "var(--mana)" }}>
          ◈
        </span>
        Mana{" "}
        <span className="mv-data text-[12px] font-bold" style={{ color: "var(--mana)" }}>
          {character.manaCurrent}
          <span className="font-normal opacity-60">/{character.maxMana}</span>
        </span>
        {pendingMana > 0 && (
          <span
            className="mv-data text-[11px]"
            style={{ color: "var(--mana)", opacity: 0.55 }}
            title="Pending — armed on the felt, spent when the cast commits"
          >
            −{pendingMana}
          </span>
        )}
        {rider && (
          <span className="flex items-center gap-0.5 pl-1">
            <button
              onClick={() => rider.onChange(Math.max(0, rider.value - 1))}
              disabled={rider.value === 0}
              className="mv-mini px-1.5 disabled:opacity-40"
              title="Take back a rider Mana"
            >
              −
            </button>
            <button
              onClick={() => rider.onChange(rider.value + 1)}
              className={`mv-mini px-1.5 ${rider.value > 0 ? "mv-mini-on" : ""}`}
              title="Rider Mana — the spell text asks more; it spends with the cast"
            >
              +
            </button>
          </span>
        )}
      </span>
      <WillMeter
        filled={character.willpowerCurrent}
        max={character.willpower}
        pendingSpend={pendingWillpower ? 1 : 0}
      />
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

function WillMeter({
  filled,
  max,
  pendingSpend,
}: {
  filled: number
  max: number
  /** Points being weighed right now — the pending-ghost recipe (#102). */
  pendingSpend: number
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="mv-eyebrow">Will</span>
      <span className="inline-flex gap-[3px]">
        {Array.from({ length: max }, (_, i) => {
          const pending = i >= filled - pendingSpend && i < filled
          return (
            <span
              key={i}
              className="text-[13px] leading-none"
              style={{
                color: pending
                  ? "var(--ember)"
                  : i < filled
                    ? "var(--accent)"
                    : "var(--line)",
              }}
              title={
                pending
                  ? "Pending — armed on the felt, spent on the roll"
                  : undefined
              }
            >
              {pending ? "◇" : "◆"}
            </span>
          )
        })}
      </span>
    </div>
  )
}
