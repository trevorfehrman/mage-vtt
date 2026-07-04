/**
 * Cosmetic stand-in for the left video rail (owner call 2026-07-04, revising
 * issue #13's "no placeholder surfaces"): the slot renders so the 4-section
 * grid can be judged as a whole, but nothing behind it is real. Replaced by
 * the video-chat track when it lands.
 */
export function VideoRailPlaceholder() {
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <span className="mv-eyebrow">Video</span>
      {["Storyteller", "Player", "Player", "Player"].map((label, i) => (
        <div
          key={i}
          className="grid aspect-video shrink-0 place-items-center rounded-[3px] border border-dashed"
          style={{ borderColor: "var(--line)" }}
        >
          <span className="mv-data text-[9px] uppercase tracking-wider" style={{ color: "var(--dim)" }}>
            {label}
          </span>
        </div>
      ))}
      <div className="grid flex-1 place-items-center">
        <span className="mv-data text-[9px]" style={{ color: "var(--dim)" }}>
          reserved — video track
        </span>
      </div>
    </div>
  )
}
