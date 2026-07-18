import { useRef, useEffect, type ReactNode } from "react"
import { Match } from "effect"
import { ScrollArea } from "#/components/ui/scroll-area"
import { useActivity } from "#/hooks/use-activity"
import type { MessageEntry, OverrideMark, RollEntry } from "#/domain/activity"
import type { CharacterSheet } from "#/domain/character"
import { isDieDramaticFailure, isDieExplosive, isDieSuccess } from "#/domain/dice"
import { ArcanaGlyph } from "./ArcanaGlyph"
import { CastCard } from "./CastCard"
import type { Id } from "../../../convex/_generated/dataModel"

/** Within this distance of the log's foot still counts as "at the foot". */
const PIN_THRESHOLD_PX = 48

interface ActivityLogProps {
  sessionId: Id<"sessions">
  isRolling?: boolean
  /** The Second Seat (ADR-0013): read the log as this member instead. */
  seat?: Id<"sessionMembers">
  /** The live Cast card's role gates (issue #43): chrome follows the seat. */
  isStoryteller: boolean
  viewerUserId: string
  /** The viewer's own decoded sheet — the Cast card's input caps read it. */
  mySheet: CharacterSheet | null
}

/**
 * The Chronicle — the log is the record (docs/component-polish.md). Roll cards
 * carry the corner-tick framing; system lines read as narration; the first
 * system line gets the single illuminated drop-cap.
 */
export function ActivityLog({
  sessionId,
  isRolling,
  seat,
  isStoryteller,
  viewerUserId,
  mySheet,
}: ActivityLogProps) {
  const activity = useActivity(sessionId, seat)
  const contentRef = useRef<HTMLDivElement>(null)
  // Pinned = reading the live end of the log. Leaving the foot (e.g. scrolling
  // up to a Cast card's controls, issue #65) releases the pin so new beats and
  // in-place card growth don't yank the viewport; returning to the foot
  // re-engages it.
  const pinnedRef = useRef(true)

  useEffect(() => {
    const content = contentRef.current
    const viewport = content?.closest("[data-slot=scroll-area-viewport]")
    if (!content || !viewport) return

    const onScroll = () => {
      pinnedRef.current =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
        PIN_THRESHOLD_PX
    }
    viewport.addEventListener("scroll", onScroll)

    // Growth of any kind — new entries, the rolling indicator, a Cast card
    // climbing its ladder in place — follows the foot only while pinned.
    // The follow is instant, not smooth: a smooth scroll fires intermediate
    // scroll events that read as "away from the foot" and would release the
    // pin if more growth landed mid-animation.
    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) {
        viewport.scrollTo({ top: viewport.scrollHeight })
      }
    })
    observer.observe(content)

    return () => {
      viewport.removeEventListener("scroll", onScroll)
      observer.disconnect()
    }
  }, [])

  // Activity comes in desc order — reverse for chronological display
  const sorted = activity ? [...activity].reverse() : []

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--line)" }}>
        <h2 className="mv-eyebrow">Chronicle</h2>
      </div>

      {/* min-h-0: without it the flex item's auto minimum tracks content
          height, so a tall entry (the live Cast card, issue #65) grows the
          rail past its box instead of scrolling. */}
      <ScrollArea className="min-h-0 flex-1 px-3 py-2">
        <div ref={contentRef} className="grid gap-2">
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
              // The live Cast card (issue #43): a projection of the Cast
              // document, climbing its ladder in place among the beats.
              Match.tag("cast", (cast) => (
                <CastCard
                  key={cast._id}
                  cast={cast}
                  sessionId={sessionId}
                  isStoryteller={isStoryteller}
                  viewerUserId={viewerUserId}
                  mySheet={mySheet}
                />
              )),
              Match.exhaustive,
            ),
          )}

          {/* Rolling indicator — appears immediately when dice are in flight */}
          {isRolling && <RollingIndicator />}
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

export function MessageItem({ message, dropCap }: { message: MessageEntry; dropCap?: boolean }) {
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
      {Match.value(override.kind).pipe(
        Match.when("storyteller-action", () => "Storyteller"),
        Match.when("repair", () => "Repair"),
        Match.when("godmode-action", () => "God-mode"),
        Match.exhaustive,
      )}
    </Tag>
  )
}

export function RollItem({ roll }: { roll: RollEntry }) {
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
  const success = isDieSuccess(v, chance ?? false)
  const dramatic = isDieDramaticFailure(v, chance ?? false)
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
              : isDieExplosive(v, again, chance ?? false)
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
