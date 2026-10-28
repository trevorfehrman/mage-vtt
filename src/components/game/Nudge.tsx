// The nudge (MAG-67; owner 2026-10-28, second round: "try above and below
// and let the width be the width of the numbers and ensure the numbers
// remain aligned with the health bar"): a thin + above a purse's number and
// a thin − below it, each as wide as the number and laid over the number's
// margins so the number itself never moves. Each press moves what the
// purse holds by one and lands as the player's own mark in the Chronicle.
// Capacity is shape: the + stops at the purse's printed size, the − at
// nothing. The nudge wraps the number it belongs to.
import type { ReactNode } from "react"
import { Schema } from "effect"

const NudgeProps = Schema.Struct({
  label: Schema.String,
  current: Schema.Number,
  max: Schema.Number,
})

interface NudgeHandlers {
  /** Absent: the number is read-only (another's sheet, the Cast header). */
  onNudge?: ((next: number) => void) | undefined
  children: ReactNode
}

const BAR = 9

export function Nudge({ label, current, max, onNudge, children }: typeof NudgeProps.Type & NudgeHandlers) {
  const bar = (by: number) => (
    <button
      type="button"
      disabled={by < 0 ? current <= 0 : current >= max}
      onClick={() => onNudge?.(current + by)}
      aria-label={`${label} ${by < 0 ? "−1" : "+1"}`}
      className="mv-key mv-data absolute inset-x-0 grid place-items-center rounded-[2px] text-[9px] leading-none transition-colors disabled:opacity-25"
      style={{
        height: BAR,
        [by < 0 ? "bottom" : "top"]: -(BAR + 2),
        color: "var(--dim)",
        boxShadow: "inset 0 0 0 1px var(--line)",
      }}
    >
      {by < 0 ? "−" : "+"}
    </button>
  )
  return (
    <span className="relative inline-flex">
      {children}
      {onNudge !== undefined && bar(1)}
      {onNudge !== undefined && bar(-1)}
    </span>
  )
}
