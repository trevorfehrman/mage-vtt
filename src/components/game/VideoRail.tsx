import { Schema } from "effect"
import { Feather } from "lucide-react"
import { CharacterSheet } from "#/domain/character"
import { VideoSeat, seatName } from "#/domain/video-rail"
import { HealthLine, PoolNumerals } from "./CastHeaderStats"

/**
 * The left rail: one tile per seat, the Storyteller's first (MAG-51). The
 * video is still a stand-in (owner call 2026-07-04 — the slot renders so the
 * grid can be judged whole; the video track replaces the frame's inside).
 *
 * Every player's depletables ride inside their own tile, on every seat, so
 * the table sees who is hurt or dry without asking, and they stay in view
 * when the sheet is switched off. The band (owner, 2026-10-24, from a
 * two-round audition — under the tile, then inside it): the name alone at
 * the head on a fade, health left and Will · Mana right at the foot on
 * another, the numerals on the boxes' center line. The Cast header's
 * grammar, drawn smaller: a pending spend shows what would be left, in ember.
 *
 * The tiles share the rail's height — 16:9 while there is room, shorter when
 * there isn't — so a full table (1 Storyteller + 5 players) never scrolls.
 */
const Pending = Schema.Struct({
  characterId: Schema.String,
  mana: Schema.Number,
  willpower: Schema.Number,
})

const VideoRailProps = Schema.Struct({
  seats: Schema.Array(VideoSeat),
  /** The viewer's own armed spend, weighed on their own tile. */
  pending: Schema.NullOr(Pending),
})

const SCRIM = "rgba(4,6,8,0.78)"

/** MAG-53: the tiles are the whisper roster — click a face to whisper
 * them, click more to add them. Absent, the tiles are plain frames. */
interface WhisperDoor {
  /** who is being whispered to, by user id */
  readonly selected: ReadonlyArray<string>
  /** the viewer's own user id: their own tile can't be whispered */
  readonly self: string
  /** `caret`: a pointer chose them, so the message line takes the caret; a
   * keyboard keeps focus on the tiles to go on choosing */
  readonly onToggle: (userId: string, caret: boolean) => void
}

export function VideoRail({
  seats,
  pending,
  whisper,
}: typeof VideoRailProps.Type & { whisper?: WhisperDoor }) {
  return (
    // The rail is the container the 16:9 cap reads (inline, so it holds
    // under a running dev server).
    <div className="flex h-full flex-col gap-2 p-2" style={{ containerType: "inline-size" }}>
      {seats.map((seat) => (
        <Frame
          key={seat.memberId}
          door={
            whisper === undefined || seat.userId === whisper.self
              ? null
              : {
                  on: whisper.selected.includes(seat.userId),
                  name: seatName(seat),
                  toggle: (caret: boolean) => whisper.onToggle(seat.userId, caret),
                }
          }
        >
          {seat.sheet === null && seat.role === "storyteller" ? (
            <span className="mv-data uppercase tracking-wider" style={{ color: "var(--dim)", fontSize: 9 }}>
              {seat.displayName} · Storyteller
            </span>
          ) : (
            <PlayerBands
              // the sheet's own headline: the shadow name when there is one
              name={seatName(seat)}
              storyteller={seat.role === "storyteller"}
              sheet={seat.sheet}
              pending={pending !== null && seat.sheet?.id === pending.characterId ? pending : null}
            />
          )}
        </Frame>
      ))}
    </div>
  )
}

/** The video's stand-in: a dark frame sharing the rail's height. With a
 * whisper door it is a toggle: chosen, its border burns accent and a
 * quill rides its edge. */
function Frame({
  children,
  door,
}: {
  children: React.ReactNode
  door: { on: boolean; name: string; toggle: (caret: boolean) => void } | null
}) {
  const Tag = door === null ? "div" : "button"
  return (
    <Tag
      {...(door === null
        ? {}
        : {
            type: "button" as const,
            // a keyboard press reports no clicks (detail 0)
            onClick: (e: React.MouseEvent) => door.toggle(e.detail !== 0),
            "aria-pressed": door.on,
            title: door.on ? `Stop whispering to ${door.name}` : `Whisper to ${door.name}`,
          })}
      className={`relative grid min-h-0 w-full flex-1 place-items-center overflow-hidden rounded-[3px] border ${door === null ? "" : "mv-tile-door cursor-pointer"}`}
      style={{
        maxHeight: "calc(100cqw * 9 / 16)",
        borderColor: door?.on ? "var(--accent)" : "var(--line)",
        boxShadow: door?.on ? "inset 0 0 0 1px var(--accent), 0 0 12px -4px var(--accent)" : undefined,
        background:
          "radial-gradient(120% 90% at 50% 35%, color-mix(in srgb, var(--panel) 70%, var(--line)), var(--void, #07090b))",
      }}
    >
      {children}
      {door?.on && (
        // the quill: chosen to whisper, in the corner opposite the name
        <Feather
          aria-hidden
          className="absolute right-1.5 bottom-1/2 size-3.5 translate-y-1/2"
          style={{ color: "var(--accent)" }}
        />
      )}
    </Tag>
  )
}

const PlayerBandsProps = Schema.Struct({
  name: Schema.String,
  /** A playtest Storyteller wearing a sheet keeps their mark. */
  storyteller: Schema.Boolean,
  sheet: Schema.NullOr(CharacterSheet),
  pending: Schema.NullOr(Pending),
})

function PlayerBands({ name, storyteller, sheet, pending }: typeof PlayerBandsProps.Type) {
  return (
    <>
      <div
        className="absolute inset-x-0 top-0 flex items-baseline justify-between gap-2 px-2 pt-1.5 pb-4"
        style={{ background: `linear-gradient(to bottom, ${SCRIM} 45%, transparent)` }}
      >
        <span className="mv-h truncate leading-none" style={{ color: "var(--ink)", fontSize: 12 }}>
          {name}
        </span>
        {storyteller && (
          <span className="mv-data shrink-0 uppercase tracking-wider" style={{ color: "var(--dim)", fontSize: 9 }}>
            Storyteller
          </span>
        )}
      </div>
      {sheet && (
        // Both rows start at the same top and the numerals' row is the
        // boxes' 11px, so the numerals sit on the boxes' center line.
        <div
          className="absolute inset-x-0 bottom-0 flex items-start justify-between gap-2 px-2 pt-4"
          style={{ background: `linear-gradient(to top, ${SCRIM} 60%, transparent)`, paddingBottom: 3 }}
        >
          <HealthLine track={sheet.healthTrack} ghosts={0} box={11} />
          <span className="flex items-center" style={{ height: 11 }}>
            <PoolNumerals
              sheet={sheet}
              pendingMana={pending?.mana ?? 0}
              pendingWillpower={pending?.willpower ?? 0}
              size={11}
            />
          </span>
        </div>
      )}
    </>
  )
}
