// The nudge (MAG-67; owner 2026-10-28: "+ and − buttons, quite small,
// beneath"): a tiny − + pair under a purse — Destiny's pips on the door,
// Willpower and Mana in the header — that moves what the purse holds by one
// and lands as the player's own mark in the Chronicle. Capacity is shape:
// the + stops at the purse's printed size, the − at nothing.
import { Schema } from "effect"

const NudgeProps = Schema.Struct({
  label: Schema.String,
  current: Schema.Number,
  max: Schema.Number,
})

interface NudgeHandlers {
  onNudge: (next: number) => void
}

export function Nudge({ label, current, max, onNudge }: typeof NudgeProps.Type & NudgeHandlers) {
  const step = (by: number) => (
    <button
      type="button"
      disabled={by < 0 ? current <= 0 : current >= max}
      onClick={() => onNudge(current + by)}
      aria-label={`${label} ${by < 0 ? "−1" : "+1"}`}
      className="mv-key mv-data grid size-[14px] place-items-center rounded-[2px] text-[11px] leading-none transition-colors disabled:opacity-30"
      style={{ color: "var(--dim)", boxShadow: "inset 0 0 0 1px var(--line)" }}
    >
      {by < 0 ? "−" : "+"}
    </button>
  )
  return (
    <span className="flex items-center gap-1">
      {step(-1)}
      {step(1)}
    </span>
  )
}
