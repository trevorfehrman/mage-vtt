import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Badge } from "#/components/ui/badge"
import { ScrollArea } from "#/components/ui/scroll-area"
import type { Id } from "../../../convex/_generated/dataModel"

export function RollHistory({ sessionId }: { sessionId: Id<"sessions"> }) {
  const rolls = useQuery(api.rolls.list, { sessionId })

  if (!rolls) return null

  return (
    <div className="grid gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--kicker)]">
        Roll History
      </h2>
      <ScrollArea className="max-h-[400px]">
        <div className="grid gap-2">
          {rolls.map((roll) => (
            <div
              key={roll._id}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{roll.displayName}</span>
                <div className="flex gap-1">
                  {roll.isDramaticFailure && (
                    <Badge variant="destructive" className="text-[10px]">
                      Dramatic Failure
                    </Badge>
                  )}
                  {roll.isExceptionalSuccess && (
                    <Badge className="bg-[var(--lagoon)] text-[10px] text-white">
                      Exceptional
                    </Badge>
                  )}
                  {roll.visibility === "hidden" && (
                    <Badge variant="outline" className="text-[10px]">
                      Hidden
                    </Badge>
                  )}
                </div>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums">
                  {roll.successes}
                </span>
                <span className="text-muted-foreground text-xs">
                  {roll.successes === 1 ? "success" : "successes"} from{" "}
                  {roll.poolSize} {roll.isChanceDie ? "chance die" : "dice"}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {roll.rolls.map((r, i) => (
                  <DieResult key={`r-${i}`} value={r} isChanceDie={roll.isChanceDie} />
                ))}
                {roll.roteRerolls.map((r, i) => (
                  <DieResult key={`rr-${i}`} value={r} isRoteReroll />
                ))}
                {roll.explosions.map((r, i) => (
                  <DieResult key={`e-${i}`} value={r} isExplosion />
                ))}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {roll.components.map((c, i) => (
                  <span key={i} className="text-muted-foreground text-[10px]">
                    {c.name} {c.dots > 0 ? `+${c.dots}` : c.dots}
                    {i < roll.components.length - 1 ? " +" : ""}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

function DieResult({
  value,
  isChanceDie,
  isRoteReroll,
  isExplosion,
}: {
  value: number
  isChanceDie?: boolean
  isRoteReroll?: boolean
  isExplosion?: boolean
}) {
  const isSuccess = isChanceDie ? value === 10 : value >= 8
  const isDramatic = isChanceDie && value === 1

  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold tabular-nums ${
        isDramatic
          ? "bg-destructive text-destructive-foreground"
          : isSuccess
            ? "bg-[var(--lagoon)] text-white"
            : "bg-muted text-muted-foreground"
      } ${isRoteReroll ? "ring-1 ring-amber-400" : ""} ${isExplosion ? "ring-1 ring-[var(--lagoon-deep)]" : ""}`}
    >
      {value}
    </span>
  )
}
