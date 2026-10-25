import type { ReactNode, RefObject } from "react"
import { Dices, Feather } from "lucide-react"
import type { SlotMode, Unread } from "#/domain/working-slot"

/**
 * The working slot (MAG-53, owner's pick from a three-way audition,
 * 2026-10-24): the message box and the dice tray share one place at the
 * rail's foot. In a video-call game chat is a niche tool — needed, but it
 * can't hold a permanent place on every seat. The switch lives in the
 * Chronicle's header, beside the messages it governs (ChronicleSwitch).
 * Both instruments stay mounted, hidden rather than unmounted, so an unsent
 * message and a composed pool survive a flip. The slot also stands below a
 * live cast on every seat (MAG-50's opening).
 */
export function WorkingSlot({ mode, tray, message }: { mode: SlotMode; tray: ReactNode; message: ReactNode }) {
  return (
    <>
      <div hidden={mode !== "dice"}>{tray}</div>
      <div hidden={mode !== "message"}>{message}</div>
    </>
  )
}

/** What arrived while the tray showed: a whisper to you filled ("@1 +2"),
 * table chat outlined ("2"). */
function UnreadMark({ unread }: { unread: Unread }) {
  if (unread.chat + unread.whisper === 0) return null
  const whisper = unread.whisper > 0
  return (
    <span className={`mv-unread ${whisper ? "mv-unread-whisper" : ""}`}>
      {whisper ? `@${unread.whisper}${unread.chat > 0 ? ` +${unread.chat}` : ""}` : unread.chat}
    </span>
  )
}

/** The switch, in the Chronicle's header row. Each side, while hidden,
 * carries its news: the dice waiting on the felt, the lines unread. */
export function ChronicleSwitch({
  mode,
  setMode,
  unread,
  pooled,
  diceRef,
}: {
  mode: SlotMode
  setMode: (m: SlotMode) => void
  unread: Unread
  /** dice composed on the felt */
  pooled: number
  /** where Escape in the message line hands focus back */
  diceRef?: RefObject<HTMLButtonElement | null>
}) {
  return (
    <div role="group" aria-label="Rail tool" className="ml-auto flex items-center gap-1">
      <button
        ref={diceRef}
        type="button"
        aria-pressed={mode === "dice"}
        onClick={() => setMode("dice")}
        className={`mv-mini flex items-center gap-1 ${mode === "dice" ? "mv-mini-on" : ""}`}
      >
        <Dices className="size-3" aria-hidden /> Dice
        {mode !== "dice" && pooled > 0 && <span>· {pooled}</span>}
      </button>
      <button
        type="button"
        aria-pressed={mode === "message"}
        onClick={() => setMode("message")}
        className={`mv-mini flex items-center gap-1 ${mode === "message" ? "mv-mini-on" : ""}`}
      >
        <Feather className="size-3" aria-hidden /> Message
        {mode !== "message" && <UnreadMark unread={unread} />}
      </button>
    </div>
  )
}
