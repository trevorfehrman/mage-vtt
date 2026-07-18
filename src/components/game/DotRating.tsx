import { cn } from "#/lib/utils"

interface DotRatingProps {
  current: number
  max?: number
  /** Row is toggled into the dice pool — dots burn ember (the caster's
   * hand; color grammar 2026-07-18). */
  active?: boolean
  className?: string
  /** Filled-dot color when not active — the sheet's zone tint (gold = attribute). */
  color?: string
}

export function DotRating({
  current,
  max = 5,
  active,
  className,
  color = "var(--ink)",
}: DotRatingProps) {
  return (
    <div className={cn("flex gap-0.5", className)}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className="inline-block size-[7px] rounded-full"
          style={{
            background: i < current ? (active ? "var(--ember)" : color) : "transparent",
            // ring color routes through --mv-dot-ring so a context (a lit
            // Arcana tile) can brighten empty dots without an API change
            boxShadow:
              i < current ? undefined : "inset 0 0 0 1px var(--mv-dot-ring, var(--line))",
          }}
        />
      ))}
    </div>
  )
}
