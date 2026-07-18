// PROTOTYPE — throwaway. The dice tray (issue #98, map #95).
//
// Three answers to one question: what does "I just want to roll N dice" cost,
// and what does the tray look like when the escape hatch is the headline
// rather than a buried stepper? Variants switch via ?variant=, and ?chips=1
// auditions each design with a sheet-assembled pool present, since the ticket
// asks how the two lanes share one tray:
//
//   a — THE RACK        a permanent row of quantities; one tap rolls N dice.
//                       Options behind a disclosure. Sheet pool is its own
//                       lane above; the rack never moves. (two lanes)
//   b — THE FELT        a physical tray; tap the felt to add a die, tap a die
//                       to take it back. Sheet dice land on the same felt in
//                       accent. Options live on the tray lip, always visible.
//                       Dice stay racked after a roll — re-rolls are one tap.
//                       (one unified pool)
//   c — THE WAGER LINE  one sentence, always present: a scrubbable/typeable
//                       count, compact always-visible option glyphs, Roll.
//                       Sheet chips merge into the same line's arithmetic.
//                       (one merged pool)
//
// Same rig covenant as the dressing room (#96): the REAL shell, the REAL feed
// neighbors, fake data, knobs in the URL, no Storybook. Rolls are fabricated
// locally (Math.random is domain-banned, not route-banned) so the payoff beat
// — dice landing in the feed — is felt without a Convex round-trip.
//
// DELETE when map #95 clears.
import { useEffect, useRef, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import type { MessageEntry, RollEntry } from "#/domain/activity"
import { decodeSheet, initialCurrentState } from "#/domain/character"
import { arctusData } from "#/domain/fixtures/arctus"
import { ScrollArea } from "#/components/ui/scroll-area"
import { SessionLayout } from "#/components/game/SessionLayout"
import { MessageItem, RollItem } from "#/components/game/ActivityLog"
import { CharacterSheet } from "#/components/game/CharacterSheet"
import { ChatInput } from "#/components/game/ChatInput"
import { ResourceStrip } from "#/components/game/ResourceStrip"
import { VideoRailPlaceholder } from "#/components/game/VideoRailPlaceholder"
import type { Id } from "../../../convex/_generated/dataModel"

// ── The knobs ────────────────────────────────────────────────────────────────

const VARIANT_ORDER = ["a", "b", "c"] as const
type RigVariant = (typeof VARIANT_ORDER)[number]
const VARIANT_LABEL: Record<RigVariant, string> = {
  a: "the rack",
  b: "the felt",
  c: "the wager line",
}

const isVariant = (v: unknown): v is RigVariant =>
  typeof v === "string" && (VARIANT_ORDER as ReadonlyArray<string>).includes(v)

export const Route = createFileRoute("/prototype/dice-tray")({
  validateSearch: (search: Record<string, unknown>) => ({
    variant: isVariant(search.variant) ? search.variant : ("a" as RigVariant),
    chips: search.chips === true || search.chips === 1 || search.chips === "1",
  }),
  component: DiceTrayRig,
})

// ── The fake table ───────────────────────────────────────────────────────────

const SESSION_ID = "proto-dice-tray" as Id<"sessions">
const ROLLER = "dev:proto-arctus"
const T0 = 1752900000000

const arctusSheet = decodeSheet({
  id: "proto-character",
  sessionId: SESSION_ID,
  userId: ROLLER,
  sessionMemberId: "proto-member",
  ...arctusData,
  ...initialCurrentState(arctusData),
})

// The sheet-assembled pool the ?chips knob turns on: the cohabitation case.
const SHEET_CHIPS = [
  { type: "attribute", name: "Wits", dots: 2 },
  { type: "skill", name: "Investigation", dots: 3 },
] as const
const SHEET_CHIP_DOTS = SHEET_CHIPS.reduce((s, c) => s + c.dots, 0)

const systemMsg: MessageEntry = {
  _tag: "message",
  _id: "proto-msg-1" as MessageEntry["_id"],
  senderId: "system",
  senderName: "System",
  text: "Between scenes. The cabal argues about whose turn it is to buy the pizza.",
  visibilityType: "system",
  timestamp: T0 - 300000,
}

const chatMsg: MessageEntry = {
  _tag: "message",
  _id: "proto-msg-2" as MessageEntry["_id"],
  senderId: "dev:proto-morrigan",
  senderName: "Morrigan",
  text: "Roll me anything. Literally anything. I just want to hear the dice.",
  visibilityType: "public",
  timestamp: T0 - 180000,
}

// ── The dice engine (rig-local; the real one lives behind the seam) ──────────

type RollOpts = {
  againThreshold: 10 | 9 | 8
  isRoteAction: boolean
  hidden: boolean
  willpower: boolean
}
const DEFAULT_OPTS: RollOpts = {
  againThreshold: 10,
  isRoteAction: false,
  hidden: false,
  willpower: false,
}

type PoolComponent = { type: string; name: string; dots: number }
const WP_COMPONENT: PoolComponent = { type: "willpower", name: "Willpower", dots: 3 }

const d10 = () => Math.floor(Math.random() * 10) + 1

const explodeFrom = (
  dice: ReadonlyArray<number>,
  threshold: number,
): Array<number> => {
  const born = dice.filter((r) => r >= threshold).map(() => d10())
  return born.length === 0 ? [] : [...born, ...explodeFrom(born, threshold)]
}

const fabricateRoll = (
  seq: number,
  components: ReadonlyArray<PoolComponent>,
  opts: RollOpts,
  summary: string,
): RollEntry => {
  const poolSize = components.reduce((s, c) => s + c.dots, 0)
  const isChanceDie = poolSize <= 0
  const rolls = isChanceDie
    ? [d10()]
    : Array.from({ length: poolSize }, () => d10())
  const explosions = isChanceDie ? [] : explodeFrom(rolls, opts.againThreshold)
  const roteRerolls =
    !isChanceDie && opts.isRoteAction
      ? rolls.filter((r) => r < 8).map(() => d10())
      : []
  const successes = isChanceDie
    ? rolls.filter((r) => r === 10).length
    : [...rolls, ...explosions, ...roteRerolls].filter((r) => r >= 8).length
  return {
    _tag: "roll",
    _id: `proto-roll-${seq}` as RollEntry["_id"],
    userId: ROLLER,
    displayName: "The Little Bear",
    components: [...components],
    poolSize: Math.max(poolSize, 0),
    rolls,
    explosions,
    roteRerolls,
    successes,
    isChanceDie,
    isDramaticFailure: isChanceDie && rolls[0] === 1,
    isExceptionalSuccess: successes >= 5,
    visibility: opts.hidden ? "hidden" : "public",
    againThreshold: opts.againThreshold,
    isRoteAction: opts.isRoteAction,
    summary,
    timestamp: T0 + seq * 1000,
  }
}

type Submit = (
  components: ReadonlyArray<PoolComponent>,
  opts: RollOpts,
  summary: string,
) => void

type VariantProps = { chips: boolean; submit: Submit }

// ── Shared scraps (a shared header is fine; a shared layout would defeat
//    the point — each variant owns its structure) ────────────────────────────

const AgSegment = ({
  value,
  onChange,
}: {
  value: RollOpts["againThreshold"]
  onChange: (v: RollOpts["againThreshold"]) => void
}) => (
  <div className="flex items-center gap-1">
    {([10, 9, 8] as const).map((n) => (
      <button
        key={n}
        onClick={() => onChange(n)}
        className={`mv-mini ${value === n ? "mv-mini-on" : ""}`}
      >
        {n}-ag
      </button>
    ))}
  </div>
)

const optsSummary = (o: RollOpts): string =>
  [
    o.againThreshold !== 10 ? `${o.againThreshold}-ag` : null,
    o.isRoteAction ? "rote" : null,
    o.hidden ? "hidden" : null,
    o.willpower ? "willpower" : null,
  ]
    .filter(Boolean)
    .join(" · ")

// ── Variant A — THE RACK ─────────────────────────────────────────────────────
// The headline is a permanent row of quantities. One tap = N dice fly. The
// sheet pool, when present, is its own lane above; the rack never moves.

function VariantRack({ chips, submit }: VariantProps) {
  const [opts, setOpts] = useState(DEFAULT_OPTS)
  const [showOpts, setShowOpts] = useState(false)
  const summary = optsSummary(opts)

  const fire = (n: number) => {
    submit(
      [
        { type: "dice", name: "Dice", dots: n },
        ...(opts.willpower ? [WP_COMPONENT] : []),
      ],
      opts,
      `${n} dice — off the rack`,
    )
    setOpts((o) => ({ ...o, willpower: false }))
  }

  const fireSheet = () => {
    submit(
      [...SHEET_CHIPS, ...(opts.willpower ? [WP_COMPONENT] : [])],
      opts,
      "Wits + Investigation",
    )
    setOpts((o) => ({ ...o, willpower: false }))
  }

  return (
    <div className="border-t" style={{ borderColor: "var(--line)" }}>
      {chips && (
        <>
          <div className="flex items-center gap-2 px-3 pt-2.5">
            <span className="mv-eyebrow">Sheet pool</span>
            <span
              className="mv-data ml-auto text-[18px] font-bold leading-none"
              style={{ color: "var(--accent)" }}
            >
              {SHEET_CHIP_DOTS + (opts.willpower ? 3 : 0)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1 px-3 pt-1.5">
            {SHEET_CHIPS.map((c) => (
              <span
                key={c.name}
                className="mv-chip flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
              >
                <span>{c.name}</span>
                <span className="mv-data" style={{ color: "var(--dim)" }}>
                  {c.dots}
                </span>
              </span>
            ))}
            <button
              onClick={fireSheet}
              className="mv-roll ml-auto rounded-[3px] px-3 py-1 text-[12px]"
            >
              Roll {SHEET_CHIP_DOTS + (opts.willpower ? 3 : 0)}
            </button>
          </div>
          <div
            className="mx-3 mt-2 border-t"
            style={{ borderColor: "var(--line)" }}
          />
        </>
      )}

      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span className="mv-eyebrow">Dice</span>
        {!showOpts && summary && (
          <span className="mv-data text-[10px]" style={{ color: "var(--accent)" }}>
            {summary}
          </span>
        )}
        <button
          onClick={() => setShowOpts((s) => !s)}
          className={`mv-mini ml-auto ${showOpts ? "mv-mini-on" : ""}`}
          title="Roll options"
        >
          ⋯
        </button>
      </div>

      {/* the rack: one tap rolls */}
      <div className="grid grid-cols-6 gap-1 px-3 pb-3 pt-2">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => fire(n)}
            className="mv-btn mv-data rounded-[3px] py-1.5 text-[14px] font-bold"
            title={`Roll ${n} dice`}
          >
            {n}
          </button>
        ))}
      </div>

      {showOpts && (
        <div
          className="flex flex-wrap items-center gap-2 border-t px-3 py-2"
          style={{ borderColor: "var(--line)" }}
        >
          <AgSegment
            value={opts.againThreshold}
            onChange={(v) => setOpts((o) => ({ ...o, againThreshold: v }))}
          />
          <button
            onClick={() => setOpts((o) => ({ ...o, isRoteAction: !o.isRoteAction }))}
            className={`mv-mini ${opts.isRoteAction ? "mv-mini-on" : ""}`}
          >
            Rote
          </button>
          <button
            onClick={() => setOpts((o) => ({ ...o, hidden: !o.hidden }))}
            className={`mv-mini ${opts.hidden ? "mv-mini-on" : ""}`}
          >
            Hidden
          </button>
          <button
            onClick={() => setOpts((o) => ({ ...o, willpower: !o.willpower }))}
            className={`mv-mini ${opts.willpower ? "mv-mini-on" : ""}`}
          >
            Willpower +3
          </button>
        </div>
      )}
    </div>
  )
}

// ── Variant B — THE FELT ─────────────────────────────────────────────────────
// A physical tray. Tap the felt, a die lands; tap a die, take it back. Sheet
// dice sit on the same felt in accent. Dice stay racked after a roll, so the
// re-roll is one tap. Options are brass fittings on the lip, always visible.

function VariantFelt({ chips, submit }: VariantProps) {
  const [plainCount, setPlainCount] = useState(0)
  const [opts, setOpts] = useState(DEFAULT_OPTS)
  const sheetDots = chips ? SHEET_CHIP_DOTS : 0
  const total = plainCount + sheetDots + (opts.willpower ? 3 : 0)

  const fire = () => {
    submit(
      [
        ...(chips ? SHEET_CHIPS : []),
        ...(plainCount > 0
          ? [{ type: "dice", name: "Dice", dots: plainCount }]
          : []),
        ...(opts.willpower ? [WP_COMPONENT] : []),
      ],
      opts,
      chips && plainCount > 0
        ? `Wits + Investigation, ${plainCount} loose dice`
        : chips
          ? "Wits + Investigation"
          : `${plainCount} dice off the felt`,
    )
    setOpts((o) => ({ ...o, willpower: false }))
  }

  const die = (accent: boolean, onClick?: () => void) => (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      disabled={!onClick}
      title={onClick ? "Take this die back" : "Sheet die — toggle on the sheet"}
      className="size-[22px] rotate-45 rounded-[4px] border"
      style={{
        borderColor: accent ? "var(--accent)" : "var(--dim)",
        background: accent ? "color-mix(in srgb, var(--accent) 25%, transparent)" : "transparent",
      }}
    />
  )

  return (
    <div className="border-t" style={{ borderColor: "var(--line)" }}>
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span className="mv-eyebrow">The felt</span>
        <span className="mv-data text-[10px]" style={{ color: "var(--dim)" }}>
          tap to add a die
        </span>
        <span
          className="mv-data ml-auto text-[22px] font-bold leading-none"
          style={{ color: total > 0 ? "var(--accent)" : "var(--dim)" }}
        >
          {total > 0 ? total : "◈"}
        </span>
      </div>

      {/* the felt, flanked by its chevrons: ‹ skims a die off, › feeds one on.
          The felt itself stays touchable (tap = add, tap a die = remove) but
          the chevrons are the easy path. */}
      <div className="mx-3 mt-2 flex items-stretch gap-1.5">
        <button
          onClick={() => setPlainCount((n) => Math.max(0, n - 1))}
          disabled={plainCount === 0}
          className="mv-btn w-8 shrink-0 rounded-[6px] text-[20px] leading-none disabled:opacity-30"
          title="Take a die off the felt"
        >
          ‹
        </button>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setPlainCount((n) => n + 1)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setPlainCount((n) => n + 1)
          }}
          className="block min-w-0 flex-1 cursor-copy rounded-[6px] border p-2 text-left"
          style={{
            borderColor: "var(--line)",
            background: "color-mix(in srgb, var(--accent) 6%, transparent)",
            minHeight: 64,
          }}
          title="Tap the felt to add a die"
        >
          <span className="flex flex-wrap gap-2.5 p-1">
            {chips &&
              Array.from({ length: sheetDots }, (_, i) => (
                <span key={`s${i}`}>{die(true)}</span>
              ))}
            {Array.from({ length: plainCount }, (_, i) => (
              <span key={`p${i}`}>
                {die(false, () => setPlainCount((n) => n - 1))}
              </span>
            ))}
            {total === 0 && (
              <span
                className="mv-data self-center pl-1 text-[11px] italic"
                style={{ color: "var(--dim)" }}
              >
                an empty tray rolls a chance die…
              </span>
            )}
          </span>
        </div>
        <button
          onClick={() => setPlainCount((n) => n + 1)}
          className="mv-btn w-8 shrink-0 rounded-[6px] text-[20px] leading-none"
          title="Feed a die onto the felt"
        >
          ›
        </button>
      </div>
      {chips && (
        <p className="mv-data px-4 pt-1 text-[10px]" style={{ color: "var(--dim)" }}>
          <span style={{ color: "var(--accent)" }}>◆</span> Wits + Investigation, from the sheet
        </p>
      )}

      {/* the lip: always-visible fittings */}
      <div className="mt-2 flex flex-wrap items-center gap-2 px-3">
        <button onClick={() => setPlainCount((n) => n + 5)} className="mv-mini">
          +5
        </button>
        <button
          onClick={() => setPlainCount(0)}
          disabled={plainCount === 0}
          className="mv-mini disabled:opacity-40"
        >
          Sweep
        </button>
        <span className="h-4 w-px" style={{ background: "var(--line)" }} />
        <AgSegment
          value={opts.againThreshold}
          onChange={(v) => setOpts((o) => ({ ...o, againThreshold: v }))}
        />
        <button
          onClick={() => setOpts((o) => ({ ...o, isRoteAction: !o.isRoteAction }))}
          className={`mv-mini ${opts.isRoteAction ? "mv-mini-on" : ""}`}
        >
          Rote
        </button>
        <button
          onClick={() => setOpts((o) => ({ ...o, hidden: !o.hidden }))}
          className={`mv-mini ${opts.hidden ? "mv-mini-on" : ""}`}
        >
          Hidden
        </button>
        <button
          onClick={() => setOpts((o) => ({ ...o, willpower: !o.willpower }))}
          className={`mv-mini ${opts.willpower ? "mv-mini-on" : ""}`}
        >
          WP +3
        </button>
      </div>

      <div className="p-3">
        <button
          onClick={fire}
          className="mv-roll w-full rounded-[3px] py-2 text-[13px]"
        >
          {total > 0 ? `Roll ${total} dice` : "Roll chance die"}
        </button>
      </div>
    </div>
  )
}

// ── Variant C — THE WAGER LINE ───────────────────────────────────────────────
// One sentence, always present. The count is typed or scrubbed; every option
// is a compact glyph on the same line; the sheet chips merge into the same
// arithmetic. Enter rolls.

function VariantWager({ chips, submit }: VariantProps) {
  const [count, setCount] = useState(3)
  const [opts, setOpts] = useState(DEFAULT_OPTS)
  const sheetDots = chips ? SHEET_CHIP_DOTS : 0
  const total = count + sheetDots + (opts.willpower ? 3 : 0)

  const fire = () => {
    submit(
      [
        ...(count > 0 ? [{ type: "dice", name: "Dice", dots: count }] : []),
        ...(chips ? SHEET_CHIPS : []),
        ...(opts.willpower ? [WP_COMPONENT] : []),
      ],
      opts,
      chips ? `${count} dice + Wits + Investigation` : `${count} dice, on the line`,
    )
    setOpts((o) => ({ ...o, willpower: false }))
  }

  return (
    <div className="border-t px-3 py-3" style={{ borderColor: "var(--line)" }}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setCount((n) => Math.max(0, n - 1))}
          className="mv-btn grid size-7 place-items-center rounded-[3px] text-[14px] leading-none"
        >
          −
        </button>
        <input
          value={count}
          inputMode="numeric"
          onChange={(e) => {
            const n = Number.parseInt(e.target.value, 10)
            setCount(Number.isNaN(n) ? 0 : Math.max(0, Math.min(30, n)))
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") fire()
            if (e.key === "ArrowUp") setCount((n) => Math.min(30, n + 1))
            if (e.key === "ArrowDown") setCount((n) => Math.max(0, n - 1))
          }}
          onWheel={(e) => {
            setCount((n) =>
              Math.max(0, Math.min(30, n + (e.deltaY < 0 ? 1 : -1))),
            )
          }}
          className="mv-data w-12 rounded-[3px] border bg-transparent py-1 text-center text-[20px] font-bold"
          style={{
            borderColor: "var(--line)",
            color: total > 0 ? "var(--accent)" : "var(--dim)",
          }}
        />
        <button
          onClick={() => setCount((n) => Math.min(30, n + 1))}
          className="mv-btn grid size-7 place-items-center rounded-[3px] text-[14px] leading-none"
        >
          +
        </button>
        <span className="mv-data text-[11px]" style={{ color: "var(--dim)" }}>
          dice
        </span>

        {chips && (
          <>
            <span className="mv-data text-[13px]" style={{ color: "var(--dim)" }}>
              +
            </span>
            {SHEET_CHIPS.map((c) => (
              <span
                key={c.name}
                className="mv-chip flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
              >
                <span>{c.name}</span>
                <span className="mv-data" style={{ color: "var(--dim)" }}>
                  {c.dots}
                </span>
              </span>
            ))}
            <span
              className="mv-data text-[13px] font-bold"
              style={{ color: "var(--accent)" }}
            >
              = {total}
            </span>
          </>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <AgSegment
          value={opts.againThreshold}
          onChange={(v) => setOpts((o) => ({ ...o, againThreshold: v }))}
        />
        <button
          onClick={() => setOpts((o) => ({ ...o, isRoteAction: !o.isRoteAction }))}
          className={`mv-mini ${opts.isRoteAction ? "mv-mini-on" : ""}`}
          title="Rote action: reroll failures once"
        >
          R
        </button>
        <button
          onClick={() => setOpts((o) => ({ ...o, hidden: !o.hidden }))}
          className={`mv-mini ${opts.hidden ? "mv-mini-on" : ""}`}
          title="Hidden: only you and the Storyteller see it"
        >
          H
        </button>
        <button
          onClick={() => setOpts((o) => ({ ...o, willpower: !o.willpower }))}
          className={`mv-mini ${opts.willpower ? "mv-mini-on" : ""}`}
          title="Spend Willpower: +3 dice"
        >
          W
        </button>
        <button
          onClick={fire}
          className="mv-roll ml-auto rounded-[3px] px-4 py-1.5 text-[13px]"
        >
          {total > 0 ? `Roll ${total}` : "Roll chance die"}
        </button>
      </div>
    </div>
  )
}

// ── The rig ──────────────────────────────────────────────────────────────────

function DiceTrayRig() {
  const { variant, chips } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [entries, setEntries] = useState<Array<RollEntry>>([])
  const seqRef = useRef(0)
  const feedEndRef = useRef<HTMLDivElement | null>(null)

  const submit: Submit = (components, opts, summary) => {
    seqRef.current += 1
    setEntries((prev) => [
      ...prev,
      fabricateRoll(seqRef.current, components, opts, summary),
    ])
  }

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [entries.length])

  const stepVariant = (dir: 1 | -1) => {
    void navigate({
      search: (prev) => {
        const i = VARIANT_ORDER.indexOf(prev.variant)
        return {
          ...prev,
          variant:
            VARIANT_ORDER[
              (i + dir + VARIANT_ORDER.length) % VARIANT_ORDER.length
            ],
        }
      },
      replace: true,
    })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
      )
        return
      if (e.key === "ArrowRight") stepVariant(1)
      if (e.key === "ArrowLeft") stepVariant(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const tray =
    variant === "a" ? (
      <VariantRack key={`a${chips}`} chips={chips} submit={submit} />
    ) : variant === "b" ? (
      <VariantFelt key={`b${chips}`} chips={chips} submit={submit} />
    ) : (
      <VariantWager key={`c${chips}`} chips={chips} submit={submit} />
    )

  const feed = (
    <div className="flex h-full flex-col">
      <div
        className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: "var(--line)" }}
      >
        <h2 className="mv-eyebrow">Chronicle</h2>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-3 py-2">
        <div className="grid gap-2">
          <MessageItem message={systemMsg} dropCap />
          <MessageItem message={chatMsg} />
          {entries.map((e) => (
            <RollItem key={e._id} roll={e} />
          ))}
          <div ref={feedEndRef} />
        </div>
      </ScrollArea>
    </div>
  )

  return (
    <>
      <SessionLayout
        sessionName="The Dice Tray"
        inviteCode="PROTO-98"
        videoRail={<VideoRailPlaceholder />}
        characterSheet={
          arctusSheet ? (
            <CharacterSheet character={arctusSheet} />
          ) : (
            <p className="text-sm" style={{ color: "var(--bad)" }}>
              The Arctus fixture failed to decode — the rig needs a sheet.
            </p>
          )
        }
        activityLog={feed}
        dicePoolBuilder={
          <>
            {arctusSheet && <ResourceStrip character={arctusSheet} />}
            {tray}
          </>
        }
        chatInput={
          <ChatInput sessionId={SESSION_ID} members={[]} currentUserId={ROLLER} />
        }
        onClearPool={() => {}}
      />

      {/* The knobs — deliberately foreign to the mv language so nobody
          mistakes them for the design under audition. */}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-zinc-100 px-4 py-2 text-zinc-900 shadow-lg">
        <button
          onClick={() =>
            void navigate({
              search: (prev) => ({ ...prev, chips: !prev.chips }),
              replace: true,
            })
          }
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            chips ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-300"
          }`}
          title="Toggle a sheet-assembled pool into the tray"
        >
          sheet chips
        </button>
        <span className="h-4 w-px bg-zinc-400" />
        <button
          onClick={() => stepVariant(-1)}
          className="rounded-full px-2 py-0.5 text-[13px] font-bold hover:bg-zinc-300"
          title="Previous variant (←)"
        >
          ←
        </button>
        <span className="w-40 text-center font-mono text-[11px] font-semibold">
          {variant.toUpperCase()} — {VARIANT_LABEL[variant]}
        </span>
        <button
          onClick={() => stepVariant(1)}
          className="rounded-full px-2 py-0.5 text-[13px] font-bold hover:bg-zinc-300"
          title="Next variant (→)"
        >
          →
        </button>
      </div>
    </>
  )
}
