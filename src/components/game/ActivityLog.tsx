import { useRef, useEffect, type ReactNode } from "react"
import { Match } from "effect"
import { ScrollArea } from "#/components/ui/scroll-area"
import { useActivity } from "#/hooks/use-activity"
import type { MessageEntry, OverrideMark, RollEntry } from "#/domain/activity"
import { ArcanaGlyph } from "./ArcanaGlyph"
import type { Id } from "../../../convex/_generated/dataModel"

interface ActivityLogProps {
  sessionId: Id<"sessions">
  isRolling?: boolean
  /** The Second Seat (ADR-0013): read the log as this member instead. */
  seat?: Id<"sessionMembers">
}

/**
 * The Chronicle — the log is the record (docs/component-polish.md). Roll cards
 * carry the corner-tick framing; system lines read as narration; the first
 * system line gets the single illuminated drop-cap.
 */
export function ActivityLog({ sessionId, isRolling, seat }: ActivityLogProps) {
  const activity = useActivity(sessionId, seat)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new items or rolling state change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activity?.length, isRolling])

  // Activity comes in desc order — reverse for chronological display
  const sorted = activity ? [...activity].reverse() : []

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--line)" }}>
        <h2 className="mv-eyebrow">Chronicle</h2>
      </div>

      <ScrollArea className="flex-1 px-3 py-2">
        <div className="grid gap-2">
          {sorted.map((item, i) =>
            Match.value(item).pipe(
              Match.tag("message", (message) => (
                <MessageItem
                  key={message._id}
                  message={message}
                  dropCap={i === 0 && message.visibilityType === "system"}
                />
              )),
              Match.tag("roll", (roll) => <RollItem key={roll._id} roll={roll} />),
              Match.exhaustive,
            ),
          )}

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
    <div className="mv-panel flex items-center gap-2 rounded-[3px] px-2.5 py-2 text-[12px]">
      <span className="inline-flex size-2 animate-ping rounded-full" style={{ background: "var(--accent)" }} />
      <span className="mv-accent">casting the dice…</span>
    </div>
  )
}

function MessageItem({ message, dropCap }: { message: MessageEntry; dropCap?: boolean }) {
  if (message.visibilityType === "system") {
    if (dropCap && message.text.length > 1) {
      return (
        <div className="flex gap-2 py-0.5" style={{ color: "var(--dim)" }}>
          <span className="mv-h mv-accent shrink-0 text-[32px] leading-[0.8]">
            {message.text.charAt(0)}
          </span>
          <span className="text-[12px] italic">
            {message.text.slice(1)}
            {message.override && (
              <span className="ml-1.5 not-italic">
                <OverrideTag override={message.override} />
              </span>
            )}
          </span>
        </div>
      )
    }
    return (
      <div className="text-center text-[11px] italic" style={{ color: "var(--dim)" }}>
        — {message.text} —{" "}
        {message.override && <OverrideTag override={message.override} />}
      </div>
    )
  }

  return (
    <div className="text-[13px]" style={{ color: "var(--ink)" }}>
      <b className="mv-accent">{message.senderName}</b>
      {message.visibilityType === "whisper" && (
        <span className="text-[11px] italic" style={{ color: "var(--dim)" }}>
          {" "}
          (whisper)
        </span>
      )}{" "}
      <span style={{ color: message.visibilityType === "whisper" ? "var(--dim)" : "var(--ink)" }}>
        {message.text}
      </span>
    </div>
  )
}

/** The rule-was-bent badge (ADR-0006), shared by Roll and Message entries. */
function OverrideTag({ override }: { override: OverrideMark }) {
  return (
    <Tag title={`Invoked by ${override.invokedByName}`}>
      {override.kind === "storyteller-action"
        ? "Storyteller"
        : override.kind === "repair"
          ? "Repair"
          : "God-mode"}
    </Tag>
  )
}

function RollItem({ roll }: { roll: RollEntry }) {
  const arcana = roll.components.filter((c) => c.type === "arcanum")
  return (
    <div className="mv-cornered mv-panel rounded-[3px] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {arcana.map((c) => (
            <ArcanaGlyph key={c.name} arcanum={c.name} size={14} className="mv-accent" />
          ))}
          <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
            {roll.displayName}
          </span>
        </div>
        <div className="flex gap-1">
          {roll.isDramaticFailure && <Tag kind="bad">Dramatic Failure</Tag>}
          {roll.isExceptionalSuccess && <Tag kind="good">Exceptional</Tag>}
          {roll.visibility === "hidden" && <Tag>Hidden</Tag>}
          {roll.override && <OverrideTag override={roll.override} />}
        </div>
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        <span
          className="mv-data text-[24px] font-bold leading-none"
          style={{ color: roll.successes > 0 ? "var(--accent)" : "var(--dim)" }}
        >
          {roll.successes}
        </span>
        <span className="text-[11px]" style={{ color: "var(--dim)" }}>
          {roll.successes === 1 ? "success" : "successes"} ·{" "}
          {roll.isChanceDie ? "chance die" : `${roll.poolSize} dice`}
          {roll.isRoteAction ? " · rote" : ""}
        </span>
      </div>

      {roll.summary && (
        <p className="mt-1 text-[11px] italic" style={{ color: "var(--dim)" }}>
          {roll.summary}
        </p>
      )}

      <div className="mt-1.5 flex flex-wrap gap-1">
        {roll.rolls.map((v, i) => (
          <Die key={`b${i}`} v={v} again={roll.againThreshold} chance={roll.isChanceDie} />
        ))}
        {roll.roteRerolls.map((v, i) => (
          <Die key={`r${i}`} v={v} again={roll.againThreshold} ring="rote" />
        ))}
        {roll.explosions.map((v, i) => (
          <Die key={`e${i}`} v={v} again={roll.againThreshold} ring="exp" />
        ))}
      </div>

      <div className="mv-data mt-1.5 text-[10px]" style={{ color: "var(--dim)" }}>
        {roll.components
          .map((c) => `${c.name} ${c.dots > 0 && c.type === "modifier" ? `+${c.dots}` : c.dots}`)
          .join(" + ")}
      </div>
    </div>
  )
}

function Die({
  v,
  again,
  ring,
  chance,
}: {
  v: number
  again: number
  ring?: "rote" | "exp"
  chance?: boolean
}) {
  const success = chance ? v === 10 : v >= 8
  const dramatic = chance && v === 1
  return (
    <span
      className="mv-data grid size-5 place-items-center rounded-[2px] text-[10px] font-bold"
      style={{
        background: dramatic ? "var(--bad)" : success ? "var(--accent)" : "var(--raise)",
        color: dramatic || success ? "#0a0a0c" : "var(--dim)",
        boxShadow:
          ring === "rote"
            ? "0 0 0 1px var(--dim2)"
            : ring === "exp"
              ? "0 0 0 1px var(--accent)"
              : v >= again && !chance
                ? "0 0 0 1px var(--accent)"
                : undefined,
      }}
    >
      {v}
    </span>
  )
}

function Tag({ kind, title, children }: { kind?: "good" | "bad"; title?: string; children: ReactNode }) {
  const c = kind === "good" ? "var(--accent)" : kind === "bad" ? "var(--bad)" : "var(--dim)"
  return (
    <span
      title={title}
      className="mv-data rounded-[2px] px-1 py-0.5 text-[9px] uppercase tracking-wide"
      style={{ border: `1px solid ${c}`, color: c }}
    >
      {children}
    </span>
  )
}
