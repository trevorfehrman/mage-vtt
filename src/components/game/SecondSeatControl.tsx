import { Armchair } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select"
import { seatName, type VideoSeat } from "#/domain/video-rail"
import type { Id } from "../../../convex/_generated/dataModel"

/** Sentinel Select value for "your own seat" — a member `_id` never collides. */
const OWN_SEAT = "own-seat"

interface SecondSeatControlProps {
  /** The table's seats, named as their tiles name them (owner, 2026-10-25). */
  seats: ReadonlyArray<VideoSeat>
  ownUserId: string
  seatId: Id<"sessionMembers"> | null
  onSeat: (seatId: Id<"sessionMembers"> | null) => void
}

/**
 * The Second Seat control (ADR-0013) — Dev-only, rendered in the session
 * header next to presence. A member dropdown to sit down / stand up, and,
 * while seated, an unmissable accent-bordered marker naming the seat: the
 * whole page below reads as that member, so the frame must say so.
 */
export function SecondSeatControl({
  seats,
  ownUserId,
  seatId,
  onSeat,
}: SecondSeatControlProps) {
  const targets = seats.filter((m) => m.userId !== ownUserId)
  if (targets.length === 0) return null

  const seated = seatId ? seats.find((m) => m.memberId === seatId) : undefined

  return (
    <div className="flex items-center gap-2">
      {seated && (
        <span
          className="mv-data inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{
            border: "1px solid var(--accent)",
            color: "var(--accent)",
            boxShadow: "0 0 6px color-mix(in srgb, var(--accent) 40%, transparent)",
          }}
        >
          <Armchair className="size-3" />
          Second Seat: {seatName(seated)}
        </span>
      )}
      <Select
        value={seatId ?? OWN_SEAT}
        onValueChange={(value) =>
          onSeat(value === OWN_SEAT ? null : (value as Id<"sessionMembers">))
        }
      >
        <SelectTrigger
          size="sm"
          className="mv-data h-6 gap-1 border-[var(--line)] px-2 text-[10px]"
          style={{ color: "var(--dim)" }}
          title="Second Seat: read the session as another member (Dev)"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={OWN_SEAT}>Your own seat</SelectItem>
          {targets.map((m) => (
            <SelectItem key={m.memberId} value={m.memberId}>
              {seatName(m)}
              {m.role === "storyteller" ? " (ST)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
