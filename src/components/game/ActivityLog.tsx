import { useRef, useEffect } from "react"
import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Badge } from "#/components/ui/badge"
import { ScrollArea } from "#/components/ui/scroll-area"
import type { Id } from "../../../convex/_generated/dataModel"

interface ActivityLogProps {
  sessionId: Id<"sessions">
  isRolling?: boolean
}

export function ActivityLog({ sessionId, isRolling }: ActivityLogProps) {
  const activity = useQuery(api.activity.list, { sessionId })
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new items or rolling state change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activity?.length, isRolling])

  // Activity comes in desc order — reverse for chronological display
  const sorted = activity ? [...activity].reverse() : []

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--line)] px-3 py-2 shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--kicker)]">
          Activity
        </h2>
      </div>

      <ScrollArea className="flex-1 px-3 py-2">
        <div className="grid gap-1.5">
          {sorted.map((item) => {
            if (item.kind === "message") {
              return <MessageItem key={item._id} message={item} />
            }
            return <RollItem key={item._id} roll={item} />
          })}

          {/* Rolling indicator — appears immediately when dice are in flight */}
          {isRolling && <RollingIndicator />}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  )
}

// --- Sub-components ---

function RollingIndicator() {
  return (
    <div className="rounded-lg border border-[var(--lagoon)]/30 bg-[var(--lagoon)]/5 p-2.5 my-0.5 animate-pulse">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-2 rounded-full bg-[var(--lagoon)] animate-ping" />
        <span className="text-sm text-[var(--lagoon)] font-medium">
          Rolling dice...
        </span>
      </div>
    </div>
  )
}

type MessageEntry = {
  kind: "message"
  _id: string
  senderName: string
  text: string
  visibilityType: string
}

function MessageItem({ message }: { message: MessageEntry }) {
  if (message.visibilityType === "system") {
    return (
      <p className="text-muted-foreground text-center text-xs italic">
        {message.text}
      </p>
    )
  }

  return (
    <div
      className={`text-sm ${
        message.visibilityType === "whisper"
          ? "italic text-[var(--lagoon-deep)]"
          : ""
      }`}
    >
      <span className="font-semibold">{message.senderName}</span>
      {message.visibilityType === "whisper" && (
        <span className="text-muted-foreground text-xs"> (whisper)</span>
      )}
      <span className="text-muted-foreground">: </span>
      {message.text}
    </div>
  )
}

type RollEntry = {
  kind: "roll"
  _id: string
  displayName: string
  components: Array<{ type: string; name: string; dots: number }>
  poolSize: number
  rolls: number[]
  explosions: number[]
  roteRerolls: number[]
  successes: number
  isChanceDie: boolean
  isDramaticFailure: boolean
  isExceptionalSuccess: boolean
  visibility: string
  againThreshold: number
  isRoteAction: boolean
}

function RollItem({ roll }: { roll: RollEntry }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5 my-0.5">
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
        <span className="text-xl font-bold tabular-nums">
          {roll.successes}
        </span>
        <span className="text-muted-foreground text-xs">
          {roll.successes === 1 ? "success" : "successes"} from {roll.poolSize}{" "}
          {roll.isChanceDie ? "chance die" : "dice"}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-0.5">
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
      className={`inline-flex size-5 items-center justify-center rounded text-[10px] font-bold tabular-nums ${
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
