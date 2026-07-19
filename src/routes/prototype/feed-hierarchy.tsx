// PROTOTYPE — throwaway. The feed hierarchy (issue #103, map #95).
//
// One scripted feed — narration, chat, whisper, rolls (plain / exceptional /
// hidden / dramatic chance), a resolved-cast fossil — rendered through three
// competing STRUCTURAL grammars, switchable via ?variant=. The question is
// how entry types rank by framing, indent, rules, and glyph anchors — not
// size alone (census 006/063), with narration lifted off the contrast floor
// (census 003). The live Cast is the real CastCard, docked at the feed's
// foot per #101's answer, viewed from the bystander seat (the spectator is
// a first-class reader); each variant frames the dock differently.
//
//   a — THE MANUSCRIPT MARGIN   a spine runs the left edge; entries hang at
//                               indents with glyph anchors ON the spine; the
//                               narration IS the spine's voice; rolls are
//                               unboxed. The dock breaks the margin system.
//   b — THE STRATA OF ENCLOSURE hierarchy is enclosure weight: narration as
//                               chapter-break lines between rules, chat bare,
//                               rolls hairline-boxed, fossils sealed, and the
//                               live cast the ONLY double-framed thing.
//   c — THE LEDGER              a strict two-register grid: a left gutter of
//                               anchors (¶ / name / die / seal) + a content
//                               column; the dock spans both registers as a
//                               full-bleed stage between double rules.
//
// Rig covenant (#96/#98): real shell, real CastCard, fake data, knobs in the
// URL, no Convex writes. Roll internals reuse the settled language (numeral,
// die faces, breakdown) — the variants disagree about the FRAME around them.
//
// DELETE when map #95 clears.
import type { ReactNode } from "react"
import { useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import type { CastEntry } from "#/domain/activity"
import { isDieDramaticFailure, isDieExplosive, isDieSuccess } from "#/domain/dice"
import { ScrollArea } from "#/components/ui/scroll-area"
import { SessionLayout } from "#/components/game/SessionLayout"
import { ArcanaGlyph } from "#/components/game/ArcanaGlyph"
import { CastCard } from "#/components/game/CastCard"
import { ChatInput } from "#/components/game/ChatInput"
import { VideoRailPlaceholder } from "#/components/game/VideoRailPlaceholder"
import type { Id } from "../../../convex/_generated/dataModel"

// ── The knobs ────────────────────────────────────────────────────────────────

const VARIANT_ORDER = ["a", "b", "c"] as const
type RigVariant = (typeof VARIANT_ORDER)[number]
const VARIANT_LABEL: Record<RigVariant, string> = {
  a: "the manuscript margin",
  b: "the strata of enclosure",
  c: "the ledger",
}

const isVariant = (v: unknown): v is RigVariant =>
  typeof v === "string" && (VARIANT_ORDER as ReadonlyArray<string>).includes(v)

export const Route = createFileRoute("/prototype/feed-hierarchy")({
  validateSearch: (search: Record<string, unknown>) => ({
    variant: isVariant(search.variant) ? search.variant : ("a" as RigVariant),
  }),
  component: FeedHierarchyRig,
})

// ── The scripted feed ────────────────────────────────────────────────────────

const SESSION_ID = "proto-feed-hierarchy" as Id<"sessions">
const BYSTANDER = "dev:proto-witness"
const T0 = 1752950000000

type RollBeat = {
  kind: "roll"
  who: string
  summary: string
  pool: number
  rolls: ReadonlyArray<number>
  explosions: ReadonlyArray<number>
  successes: number
  again: number
  breakdown: string
  hidden?: boolean
  chance?: boolean
  dramatic?: boolean
  exceptional?: boolean
}

type Beat =
  | { kind: "narration"; text: string; opening?: boolean }
  | { kind: "chat"; who: string; text: string; whisper?: boolean }
  | RollBeat
  | {
      kind: "fossil"
      who: string
      arcanum: string
      level: number
      intent: string
      successes: number
      severity: string
    }

const BEATS: ReadonlyArray<Beat> = [
  {
    kind: "narration",
    opening: true,
    text: "The cabal descends into the mausoleum. The air tastes of rust and old prayers, and somewhere below, water moves against stone.",
  },
  { kind: "chat", who: "Morrigan", text: "Careful — the funeral party upstairs is still filing out. Sleepers, all of them." },
  {
    kind: "roll",
    who: "The Little Bear",
    summary: "Wits + Investigation — reading the warding knot",
    pool: 5,
    rolls: [8, 3, 9, 1, 6],
    explosions: [],
    successes: 2,
    again: 10,
    breakdown: "Wits 2 + Investigation 3",
  },
  { kind: "chat", who: "Sizhe", text: "Two successes. The knot is Atlantean, pre-schism. Don't touch it." },
  { kind: "chat", who: "The Little Bear", text: "I'm absolutely going to touch it." },
  {
    kind: "narration",
    text: "The knot recognizes something in the Moros and loosens a strand, almost courteous.",
  },
  {
    kind: "roll",
    who: "Sizhe",
    summary: "Presence + Persuasion — talking the caretaker back upstairs",
    pool: 7,
    rolls: [10, 8, 9, 10, 4, 8, 2],
    explosions: [9, 8],
    successes: 7,
    again: 10,
    exceptional: true,
    breakdown: "Presence 3 + Persuasion 2 + Striking Looks 2",
  },
  { kind: "chat", who: "Morrigan", text: "…he's writing her a key to the crypt annex. Unbelievable.", whisper: true },
  {
    kind: "roll",
    who: "Morrigan",
    summary: "a quiet look ahead",
    pool: 4,
    rolls: [7, 9, 3, 8],
    explosions: [],
    successes: 2,
    again: 10,
    hidden: true,
    breakdown: "Wits 3 + Occult 1",
  },
  {
    kind: "roll",
    who: "The Little Bear",
    summary: "Dexterity + Athletics — the ossuary shelf gives way",
    pool: 0,
    rolls: [1],
    explosions: [],
    successes: 0,
    again: 10,
    chance: true,
    dramatic: true,
    breakdown: "chance die",
  },
  {
    kind: "narration",
    text: "Bone dust everywhere. In the silence after, the water below sounds closer.",
  },
  {
    kind: "fossil",
    who: "The Little Bear",
    arcanum: "death",
    level: 2,
    intent: "Quiet the restless dead stirred by the collapse",
    successes: 3,
    severity: "havoc",
  },
  { kind: "chat", who: "Sizhe", text: "The dead settle. The knot, however, is now very interested in us." },
]

// The live Cast on the dock — the #96 rig's paradoxRolled document, seen
// from the bystander seat: the spectator meets the caster's pool here.
const liveCast: CastEntry = {
  _tag: "cast",
  _id: "proto-cast" as CastEntry["_id"],
  timestamp: T0,
  characterId: "proto-character" as CastEntry["characterId"],
  casterUserId: "dev:proto-arctus",
  casterName: "The Little Bear",
  status: "paradoxRolled",
  arcanum: "death",
  level: 3,
  intent: "Unravel the warding knot sealing the mausoleum door",
  usesMagicalTool: true,
  declaredComponents: [
    { type: "gnosis", name: "Gnosis", dots: 3 },
    { type: "arcanum", name: "Death", dots: 3 },
    { type: "modifier", name: "High Speech", dots: 2 },
    { type: "modifier", name: "Willpower", dots: 2 },
  ],
  declaredPool: 10,
  spellManaCost: 0,
  gnosis: 3,
  witnessCount: 2,
  priorParadoxRolls: 1,
  discretionaryModifiers: [{ source: "Hallowed ground", dice: -1 }],
  manaMitigation: 1,
  paradoxSuccesses: 2,
  paradoxIsDramaticFailure: false,
  createdAt: T0,
  updatedAt: T0,
}

// ── Shared internals (the settled roll language: numeral, faces, breakdown) ──

const DieFace = ({ v, again, chance }: { v: number; again: number; chance?: boolean }) => {
  const success = isDieSuccess(v, chance ?? false)
  const dramatic = isDieDramaticFailure(v, chance ?? false)
  return (
    <span
      className="mv-data grid size-5 place-items-center rounded-[2px] text-[10px] font-bold"
      style={{
        background: dramatic ? "var(--bad)" : success ? "var(--accent)" : "var(--raise)",
        color: dramatic || success ? "#0a0a0c" : "var(--dim)",
        boxShadow: isDieExplosive(v, again, chance ?? false) ? "0 0 0 1px var(--accent)" : undefined,
      }}
    >
      {v}
    </span>
  )
}

/** The settled internal language of a roll — everything inside the frame. */
const RollBody = ({ b }: { b: RollBeat }) => (
  <>
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
        {b.who}
      </span>
      <span className="flex gap-1">
        {b.dramatic && <MiniTag kind="bad">Dramatic Failure</MiniTag>}
        {b.exceptional && <MiniTag kind="good">Exceptional</MiniTag>}
        {b.hidden && <MiniTag>Hidden</MiniTag>}
      </span>
    </div>
    <div className="mt-1 flex items-baseline gap-2">
      <span
        className="mv-data text-[24px] font-bold leading-none"
        style={{ color: b.successes > 0 ? "var(--accent)" : "var(--dim)" }}
      >
        {b.successes}
      </span>
      <span className="text-[11px]" style={{ color: "var(--dim)" }}>
        {b.successes === 1 ? "success" : "successes"} ·{" "}
        {b.chance ? "chance die" : `${b.pool} dice`}
      </span>
    </div>
    <p className="mt-1 text-[11px] italic" style={{ color: "var(--dim)" }}>
      {b.summary}
    </p>
    <div className="mt-1.5 flex flex-wrap gap-1">
      {b.rolls.map((v, i) => (
        <DieFace key={`b${i}`} v={v} again={b.again} chance={b.chance} />
      ))}
      {b.explosions.map((v, i) => (
        <DieFace key={`e${i}`} v={v} again={b.again} />
      ))}
    </div>
    <div className="mv-data mt-1.5 text-[10px]" style={{ color: "var(--dim)" }}>
      {b.breakdown}
    </div>
  </>
)

const MiniTag = ({ kind, children }: { kind?: "good" | "bad"; children: ReactNode }) => {
  const c = kind === "good" ? "var(--accent)" : kind === "bad" ? "var(--bad)" : "var(--dim)"
  return (
    <span
      className="mv-data rounded-[2px] px-1 py-0.5 text-[9px] uppercase tracking-wide"
      style={{ border: `1px solid ${c}`, color: c }}
    >
      {children}
    </span>
  )
}

/** The fossil's shared content: a resolved cast compressed to one seal line. */
const fossilText = (b: Extract<Beat, { kind: "fossil" }>) =>
  `${b.who} · ${b.intent} — ${b.successes} successes, ${b.severity}`

// ── Variant A — THE MANUSCRIPT MARGIN ────────────────────────────────────────
// A spine runs the feed's left edge. Narration is the spine's own voice —
// full measure, serif italic, lifted off the contrast floor. Chat hangs one
// indent in, speaker as a margin anchor. Rolls hang at the same indent,
// UNBOXED, anchored by a die glyph sitting on the spine. Fossils sit on the
// spine under a seal. The dock (rendered by the rig) breaks the margin.

function MarginFeed() {
  return (
    <div
      className="relative pl-4"
      style={{ borderLeft: "1px solid var(--line)" }}
    >
      <div className="grid gap-3">
        {BEATS.map((b, i) => {
          if (b.kind === "narration")
            return (
              <div key={i} className="relative -ml-4 pl-4">
                <span
                  className="absolute left-0 top-[0.55em] size-[7px] -translate-x-1/2 rotate-45"
                  style={{ background: "var(--accent)" }}
                />
                <p
                  className="text-[13px] italic leading-relaxed"
                  style={{ color: "var(--ink)", opacity: 0.85 }}
                >
                  {b.text}
                </p>
              </div>
            )
          if (b.kind === "chat")
            return (
              <div
                key={i}
                className="grid gap-2 pl-2"
                style={{ gridTemplateColumns: "72px 1fr" }}
              >
                <span
                  className="mv-data truncate pt-0.5 text-right text-[10px] uppercase tracking-wide"
                  style={{ color: b.whisper ? "var(--dim)" : "var(--accent)" }}
                >
                  {b.who}
                </span>
                <span
                  className="text-[13px]"
                  style={{
                    color: b.whisper ? "var(--dim)" : "var(--ink)",
                    fontStyle: b.whisper ? "italic" : undefined,
                  }}
                >
                  {b.whisper ? "(whisper) " : ""}
                  {b.text}
                </span>
              </div>
            )
          if (b.kind === "roll")
            return (
              <div key={i} className="relative pl-2">
                <span
                  className="mv-data absolute -left-4 top-1 grid size-[16px] -translate-x-1/2 place-items-center rounded-[2px] border text-[9px]"
                  style={{
                    borderColor: "var(--dim)",
                    color: "var(--dim)",
                    background: "var(--bg, #0a0a0c)",
                    transform: "translateX(-50%) rotate(45deg)",
                  }}
                >
                  <span style={{ transform: "rotate(-45deg)" }}>{b.successes}</span>
                </span>
                <RollBody b={b} />
              </div>
            )
          return (
            <div key={i} className="relative -ml-4 pl-4">
              <span
                className="absolute left-0 top-[0.4em] -translate-x-1/2"
                style={{ color: "var(--dim)" }}
              >
                <ArcanaGlyph arcanum={b.arcanum} size={11} />
              </span>
              <p className="text-[11px]" style={{ color: "var(--dim)" }}>
                <span className="mv-data uppercase tracking-wide">resolved · </span>
                {fossilText(b)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** A's dock frame: the one full-bleed break in the margin system. */
const MarginDock = ({ children }: { children: ReactNode }) => (
  <div
    className="-mx-3 border-y px-3 py-2"
    style={{ borderColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 5%, transparent)" }}
  >
    {children}
  </div>
)

// ── Variant B — THE STRATA OF ENCLOSURE ──────────────────────────────────────
// Hierarchy is enclosure weight, made deliberate. Narration: chapter-break
// lines between flanking rules, small caps, full ink. Chat: bare line (air).
// Roll: the hairline corner-tick box (today's language, now rung 3 of a
// ladder instead of the only frame). Fossil: sealed box, heavy left edge.
// Live cast: the only DOUBLE-framed entry (frame within frame).

function StrataFeed() {
  return (
    <div className="grid gap-2.5">
      {BEATS.map((b, i) => {
        if (b.kind === "narration")
          return (
            <div key={i} className="flex items-center gap-3 py-1">
              <span className="h-px flex-1" style={{ background: "var(--line)" }} />
              <p
                className="max-w-[80%] text-center text-[11.5px] tracking-wide"
                style={{ color: "var(--ink)", opacity: 0.8, fontVariant: "small-caps" }}
              >
                {b.text}
              </p>
              <span className="h-px flex-1" style={{ background: "var(--line)" }} />
            </div>
          )
        if (b.kind === "chat")
          return (
            <div
              key={i}
              className="text-[13px]"
              style={{ color: b.whisper ? "var(--dim)" : "var(--ink)" }}
            >
              <b className={b.whisper ? "" : "mv-accent"}>{b.who}</b>
              {b.whisper && (
                <span className="text-[11px] italic" style={{ color: "var(--dim)" }}>
                  {" "}
                  (whisper)
                </span>
              )}{" "}
              {b.text}
            </div>
          )
        if (b.kind === "roll")
          return (
            <div key={i} className="mv-cornered mv-panel rounded-[3px] p-2.5">
              <RollBody b={b} />
            </div>
          )
        return (
          <div
            key={i}
            className="rounded-[3px] py-1.5 pl-2.5 pr-2"
            style={{
              borderLeft: "3px solid var(--dim2, var(--dim))",
              background: "color-mix(in srgb, var(--dim) 6%, transparent)",
            }}
          >
            <p className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--dim)" }}>
              <ArcanaGlyph arcanum={b.arcanum} size={11} />
              <span className="mv-data uppercase tracking-wide">resolved</span>
              <span className="truncate">{fossilText(b)}</span>
            </p>
          </div>
        )
      })}
    </div>
  )
}

/** B's dock frame: frame-within-frame — the only double enclosure. */
const StrataDock = ({ children }: { children: ReactNode }) => (
  <div className="rounded-[4px] border p-1" style={{ borderColor: "var(--accent)" }}>
    <div className="rounded-[3px] border" style={{ borderColor: "var(--line)" }}>
      {children}
    </div>
  </div>
)

// ── Variant C — THE LEDGER ───────────────────────────────────────────────────
// A strict two-register grid: a left gutter of anchors (¶ narration, name
// chip chat, die glyph roll, arcanum seal fossil), a content column. Rules
// separate narration beats (scene punctuation), not every entry. The dock
// spans both registers between double rules — the broadsheet stage.

function LedgerFeed() {
  return (
    <div
      className="grid gap-x-2 gap-y-2.5"
      style={{ gridTemplateColumns: "56px 1fr" }}
    >
      {BEATS.map((b, i) => {
        if (b.kind === "narration")
          return (
            <div
              key={i}
              className="border-t pt-2"
              style={{ gridColumn: "1 / -1", borderColor: "var(--line)" }}
            >
              <p className="text-[12px] italic leading-relaxed" style={{ color: "var(--ink)", opacity: 0.8 }}>
                <span className="mv-data mr-1.5 not-italic" style={{ color: "var(--dim)" }}>
                  ¶
                </span>
                {b.text}
              </p>
            </div>
          )
        if (b.kind === "chat")
          return (
            <div key={i} className="grid"
              style={{ gridColumn: "1 / -1", gridTemplateColumns: "subgrid" }}>
              <span
                className="mv-data truncate pt-0.5 text-right text-[9px] uppercase tracking-wider"
                style={{ color: b.whisper ? "var(--dim)" : "var(--accent)" }}
              >
                {b.who}
              </span>
              <span
                className="text-[13px]"
                style={{
                  color: b.whisper ? "var(--dim)" : "var(--ink)",
                  fontStyle: b.whisper ? "italic" : undefined,
                }}
              >
                {b.whisper ? "(whisper) " : ""}
                {b.text}
              </span>
            </div>
          )
        if (b.kind === "roll")
          return (
            <div key={i} className="grid"
              style={{ gridColumn: "1 / -1", gridTemplateColumns: "subgrid" }}>
              <span className="flex justify-end pt-0.5">
                <span
                  className="mv-data grid size-5 place-items-center rounded-[2px] text-[10px] font-bold"
                  style={{
                    background: b.successes > 0 ? "var(--accent)" : "var(--raise)",
                    color: b.successes > 0 ? "#0a0a0c" : "var(--dim)",
                  }}
                >
                  {b.successes}
                </span>
              </span>
              <div>
                <RollBody b={b} />
              </div>
            </div>
          )
        return (
          <div key={i} className="grid"
              style={{ gridColumn: "1 / -1", gridTemplateColumns: "subgrid" }}>
            <span className="flex justify-end pt-0.5" style={{ color: "var(--dim)" }}>
              <ArcanaGlyph arcanum={b.arcanum} size={12} />
            </span>
            <p className="text-[11px]" style={{ color: "var(--dim)" }}>
              <span className="mv-data uppercase tracking-wide">resolved · </span>
              {fossilText(b)}
            </p>
          </div>
        )
      })}
    </div>
  )
}

/** C's dock frame: the broadsheet stage — full-bleed between double rules. */
const LedgerDock = ({ children }: { children: ReactNode }) => (
  <div
    className="-mx-3 px-3 py-1.5"
    style={{
      borderTop: "3px double var(--accent)",
      borderBottom: "3px double var(--accent)",
    }}
  >
    {children}
  </div>
)

// ── The rig ──────────────────────────────────────────────────────────────────

function FeedHierarchyRig() {
  const { variant } = Route.useSearch()
  const navigate = Route.useNavigate()

  const stepVariant = (dir: 1 | -1) => {
    void navigate({
      search: (prev) => {
        const i = VARIANT_ORDER.indexOf(prev.variant)
        return {
          variant:
            VARIANT_ORDER[(i + dir + VARIANT_ORDER.length) % VARIANT_ORDER.length],
        }
      },
      replace: true,
    })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      if (e.key === "ArrowRight") stepVariant(1)
      if (e.key === "ArrowLeft") stepVariant(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const feedBody =
    variant === "a" ? <MarginFeed /> : variant === "b" ? <StrataFeed /> : <LedgerFeed />
  const Dock =
    variant === "a" ? MarginDock : variant === "b" ? StrataDock : LedgerDock

  // The real card, bystander seat: read-only chrome, the spectator's view.
  const dockedCast = (
    <Dock>
      <CastCard
        key={variant}
        cast={liveCast}
        sessionId={SESSION_ID}
        isStoryteller={false}
        viewerUserId={BYSTANDER}
        mySheet={null}
      />
    </Dock>
  )

  const feed = (
    <div className="flex h-full flex-col">
      <div
        className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: "var(--line)" }}
      >
        <h2 className="mv-eyebrow">Chronicle</h2>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-3 py-2">{feedBody}</ScrollArea>
      {/* The dock (#101): the record scrolls above; the cockpit holds the foot. */}
      <div className="shrink-0 px-3 pb-2 pt-1">{dockedCast}</div>
    </div>
  )

  return (
    <>
      <SessionLayout
        sessionName="The Feed Hierarchy"
        inviteCode="PROTO-103"
        videoRail={<VideoRailPlaceholder />}
        characterSheet={
          <p className="p-3 text-[12px]" style={{ color: "var(--dim)" }}>
            The bystander holds no sheet — this seat reads the feed.
          </p>
        }
        activityLog={feed}
        dicePoolBuilder={<div />}
        chatInput={
          <ChatInput sessionId={SESSION_ID} members={[]} currentUserId={BYSTANDER} />
        }
        onClearPool={() => {}}
      />

      {/* The knobs — deliberately foreign to the mv language so nobody
          mistakes them for the design under audition. */}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-zinc-100 px-4 py-2 text-zinc-900 shadow-lg">
        <button
          onClick={() => stepVariant(-1)}
          className="rounded-full px-2 py-0.5 text-[13px] font-bold hover:bg-zinc-300"
          title="Previous variant (←)"
        >
          ←
        </button>
        <span className="w-52 text-center font-mono text-[11px] font-semibold">
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
