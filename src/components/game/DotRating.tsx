import { cn } from "#/lib/utils"

interface DotRatingProps {
  current: number
  max?: number
  className?: string
}

export function DotRating({ current, max = 5, className }: DotRatingProps) {
  return (
    <div className={cn("flex gap-0.5", className)}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={cn(
            "inline-block size-2 rounded-full border",
            i < current
              ? "border-[var(--kicker)] bg-[var(--kicker)]"
              : "border-[var(--line)] bg-transparent",
          )}
        />
      ))}
    </div>
  )
}
