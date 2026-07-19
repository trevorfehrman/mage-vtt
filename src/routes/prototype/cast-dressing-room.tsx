// PROTOTYPE — throwaway. The ladder dressing room (issue #96, map #95).
//
// The cheap viewing rig for the live Cast card: every rung of the ladder
// (7 live + cancelled/voided) × every seat (caster / storyteller / bystander),
// flipped through in seconds instead of a two-account Convex playthrough.
// The #102 grammar audition adds a third knob (?grammar=): three complete
// success-ink candidates — A merge (success IS verdigris), B quantity (no
// status hue; count, weight, and pips carry it), C mint (a second green at
// hard tonal distance). Everything settled at the 2026-07-18 grilling —
// danger slot, Mana blue + glyph, ember/verdigris rungs and buttons, neutral
// dice counts — renders identically in all three; the knob only swaps the
// --rail-success alias.
// The REAL app shell (SessionLayout), the REAL feed neighbors (MessageItem /
// RollItem), and the REAL CastCard — fed hand-built fake Cast documents via
// URL knobs (?rung=…&seat=…), reload-stable and shareable.
//
// Unlike the census-era prototypes in this directory, this rig imports app
// code ON PURPOSE — that is its whole job (map #95 reaffirmed ADR-0021's
// workbench decision: state auditioning happens in throwaway routes inside
// the real shell). No Convex writes: everything renders from local fakes;
// pressing a live button fires a real mutation at a fake id, which the server
// refuses — the refusal renders inline, which is itself a state worth seeing.
//
// DELETE when map #95 clears.
import { useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import type { CastEntry, MessageEntry, RollEntry } from "#/domain/activity"
import type { CastStatus } from "#/domain/cast"
import { decodeSheet } from "#/domain/character"
import { initialCurrentState } from "#/domain/character"
import { arctusData } from "#/domain/fixtures/arctus"
import { useDicePool } from "#/hooks/use-dice-pool"
import { ScrollArea } from "#/components/ui/scroll-area"
import { SessionLayout } from "#/components/game/SessionLayout"
import { MessageItem, RollItem } from "#/components/game/ActivityLog"
import { CastCard } from "#/components/game/CastCard"
import { CharacterSheet } from "#/components/game/CharacterSheet"
import { ChatInput } from "#/components/game/ChatInput"
import { DicePoolBuilder } from "#/components/game/DicePoolBuilder"
import { ResourceStrip } from "#/components/game/ResourceStrip"
import { SheetlessCastForm } from "#/components/game/SheetlessCastForm"
import { VideoRailPlaceholder } from "#/components/game/VideoRailPlaceholder"
import type { Id } from "../../../convex/_generated/dataModel"

// ── The knobs ────────────────────────────────────────────────────────────────

const RUNG_ORDER = [
  "draft",
  "engaged",
  "liabilitiesLocked",
  "intentionLocked",
  "paradoxRolled",
  "contained",
  "resolved",
  "cancelled",
  "voided",
] as const satisfies ReadonlyArray<CastStatus>
type RigRung = (typeof RUNG_ORDER)[number]

const SEAT_ORDER = ["caster", "storyteller", "bystander"] as const
type RigSeat = (typeof SEAT_ORDER)[number]

// The #102 root candidates: each is ONLY an alias swap on --rail-success —
// the settled grammar (danger, Mana, turns, pending) never varies.
const GRAMMAR_ORDER = ["merge", "quantity", "mint"] as const
type RigGrammar = (typeof GRAMMAR_ORDER)[number]

const GRAMMARS: Record<
  RigGrammar,
  { label: string; vars: Record<string, string> }
> = {
  merge: { label: "A · merge", vars: {} }, // styles.css default: success IS verdigris
  quantity: { label: "B · quantity", vars: { "--rail-success": "var(--ink)" } },
  mint: { label: "C · mint", vars: { "--rail-success": "#93e6bf" } },
}

const isRung = (v: unknown): v is RigRung =>
  typeof v === "string" && (RUNG_ORDER as ReadonlyArray<string>).includes(v)
const isSeat = (v: unknown): v is RigSeat =>
  typeof v === "string" && (SEAT_ORDER as ReadonlyArray<string>).includes(v)
const isGrammar = (v: unknown): v is RigGrammar =>
  typeof v === "string" && (GRAMMAR_ORDER as ReadonlyArray<string>).includes(v)

export const Route = createFileRoute("/prototype/cast-dressing-room")({
  validateSearch: (search: Record<string, unknown>) => ({
    rung: isRung(search.rung) ? search.rung : ("draft" as RigRung),
    seat: isSeat(search.seat) ? search.seat : ("caster" as RigSeat),
    grammar: isGrammar(search.grammar) ? search.grammar : ("merge" as RigGrammar),
  }),
  component: DressingRoom,
})

// ── The fake documents ───────────────────────────────────────────────────────

const SESSION_ID = "proto-dressing-room" as Id<"sessions">
const CASTER = "dev:proto-arctus"
const STORYTELLER = "dev:proto-morrigan"
const BYSTANDER = "dev:proto-witness"
const T0 = 1752800000000

// The caster's decoded sheet — the real Arctus fixture with a fresh current
// state, so the mitigation cap (Mana) and containment bet (health track)
// read real numbers.
const arctusSheet = decodeSheet({
  id: "proto-character",
  sessionId: SESSION_ID,
  userId: CASTER,
  sessionMemberId: "proto-member",
  ...arctusData,
  ...initialCurrentState(arctusData),
})

// One Cast document per rung, built cumulatively — each beat's fields land
// and stay, exactly as the ladder mutations stamp them.
const draft: CastEntry = {
  _tag: "cast",
  _id: "proto-cast" as CastEntry["_id"],
  timestamp: T0,
  characterId: "proto-character" as CastEntry["characterId"],
  casterUserId: CASTER,
  casterName: "The Little Bear",
  status: "draft",
  arcanum: "death",
  level: 3,
  intent: "Unravel the warding knot sealing the mausoleum door",
  usesMagicalTool: true,
  // Improvised-cast shape (Gnosis + Arcanum + boosts, spellcasting.ts) and a
  // 0-Mana cost: Death is Moros-ruling, so the honest price is nothing — the
  // walk-through (2026-07-18) caught the earlier fake charging 1 Mana.
  declaredComponents: [
    { type: "gnosis", name: "Gnosis", dots: 3 },
    { type: "arcanum", name: "Death", dots: 3 },
    { type: "modifier", name: "High Speech", dots: 2 },
    { type: "modifier", name: "Willpower", dots: 2 },
  ],
  declaredPool: 10,
  spellManaCost: 0,
  createdAt: T0,
  updatedAt: T0,
}

const engaged: CastEntry = {
  ...draft,
  status: "engaged",
  gnosis: 3,
  witnessCount: 2,
  priorParadoxRolls: 1,
  discretionaryModifiers: [{ source: "Hallowed ground", dice: -1 }],
}

const liabilitiesLocked: CastEntry = { ...engaged, status: "liabilitiesLocked" }

const intentionLocked: CastEntry = {
  ...liabilitiesLocked,
  status: "intentionLocked",
  manaMitigation: 1,
}

const paradoxRolled: CastEntry = {
  ...intentionLocked,
  status: "paradoxRolled",
  paradoxSuccesses: 2,
  paradoxIsDramaticFailure: false,
}

const contained: CastEntry = {
  ...paradoxRolled,
  status: "contained",
  containedSuccesses: 1,
}

const resolved: CastEntry = {
  ...contained,
  status: "resolved",
  castPool: 9,
  castSuccesses: 3,
  severity: "havoc",
}

const cancelled: CastEntry = { ...liabilitiesLocked, status: "cancelled" }

const voided: CastEntry = {
  ...paradoxRolled,
  status: "voided",
  override: {
    invokedByUserId: STORYTELLER,
    invokedByName: "Morrigan",
    kind: "repair",
  },
}

const CASTS: Record<RigRung, CastEntry> = {
  draft,
  engaged,
  liabilitiesLocked,
  intentionLocked,
  paradoxRolled,
  contained,
  resolved,
  cancelled,
  voided,
}

// The neighbors — a system line (drop-cap), a chat beat, and a settled roll
// card, so the Cast card is judged against the real feed's density.
const systemMsg: MessageEntry = {
  _tag: "message",
  _id: "proto-msg-1" as MessageEntry["_id"],
  senderId: "system",
  senderName: "System",
  text: "The cabal descends into the mausoleum. The air tastes of rust and old prayers.",
  visibilityType: "system",
  timestamp: T0 - 300000,
}

const chatMsg: MessageEntry = {
  _tag: "message",
  _id: "proto-msg-2" as MessageEntry["_id"],
  senderId: STORYTELLER,
  senderName: "Morrigan",
  text: "Careful — the funeral party upstairs is still filing out. Sleepers, all of them.",
  visibilityType: "public",
  timestamp: T0 - 180000,
}

const priorRoll: RollEntry = {
  _tag: "roll",
  _id: "proto-roll-1" as RollEntry["_id"],
  userId: CASTER,
  displayName: "The Little Bear",
  components: [
    { type: "attribute", name: "Wits", dots: 2 },
    { type: "skill", name: "Investigation", dots: 3 },
  ],
  poolSize: 5,
  rolls: [8, 3, 9, 1, 6],
  explosions: [],
  roteRerolls: [],
  successes: 2,
  isChanceDie: false,
  isDramaticFailure: false,
  isExceptionalSuccess: false,
  visibility: "public",
  againThreshold: 10,
  isRoteAction: false,
  summary: "Wits + Investigation — reading the warding knot",
  timestamp: T0 - 120000,
}

const SEAT_VIEW: Record<
  RigSeat,
  { viewerUserId: string; isStoryteller: boolean; label: string }
> = {
  caster: { viewerUserId: CASTER, isStoryteller: false, label: "Caster" },
  storyteller: { viewerUserId: STORYTELLER, isStoryteller: true, label: "Storyteller" },
  bystander: { viewerUserId: BYSTANDER, isStoryteller: false, label: "Bystander" },
}

// ── The rig ──────────────────────────────────────────────────────────────────

function DressingRoom() {
  const { rung, seat, grammar } = Route.useSearch()
  const navigate = Route.useNavigate()
  const pool = useDicePool(SESSION_ID)

  const cast = CASTS[rung]
  const view = SEAT_VIEW[seat]
  const mySheet = seat === "caster" ? arctusSheet : null

  // Functional updaters: each knob patches only its own key, so a fast
  // seat-click + arrow-press never overwrite each other.
  const stepRung = (dir: 1 | -1) => {
    void navigate({
      search: (prev) => {
        const i = RUNG_ORDER.indexOf(prev.rung)
        return {
          ...prev,
          rung: RUNG_ORDER[(i + dir + RUNG_ORDER.length) % RUNG_ORDER.length],
        }
      },
      replace: true,
    })
  }

  // ← / → step the ladder — but never while typing in an input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))
        return
      if (e.key === "ArrowRight") stepRung(1)
      if (e.key === "ArrowLeft") stepRung(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

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
          <RollItem roll={priorRoll} />
          {/* Remount per knob flip: the card's local drafts (mitigation,
              containment slider, refusal line) must not bleed across states. */}
          <CastCard
            key={`${rung}:${seat}`}
            cast={cast}
            sessionId={SESSION_ID}
            isStoryteller={view.isStoryteller}
            viewerUserId={view.viewerUserId}
            mySheet={mySheet}
          />
        </div>
      </ScrollArea>
    </div>
  )

  return (
    <>
      {/* display:contents — no layout, just the grammar's CSS-var override
          inheriting into the whole shell. */}
      <div className="contents" style={GRAMMARS[grammar].vars}>
      <SessionLayout
        sessionName="The Dressing Room"
        inviteCode="PROTO-96"
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
            {mySheet && <ResourceStrip character={mySheet} />}
            <DicePoolBuilder pool={pool} />
          </>
        }
        storytellerTools={
          view.isStoryteller ? <SheetlessCastForm sessionId={SESSION_ID} /> : undefined
        }
        chatInput={
          <ChatInput
            sessionId={SESSION_ID}
            members={[]}
            currentUserId={view.viewerUserId}
          />
        }
        onClearPool={pool.reset}
      />
      </div>

      {/* The knobs — deliberately foreign to the mv language so nobody
          mistakes them for the design under audition. */}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-zinc-100 px-4 py-2 text-zinc-900 shadow-lg">
        <div className="flex items-center gap-1">
          {GRAMMAR_ORDER.map((g) => (
            <button
              key={g}
              onClick={() =>
                void navigate({
                  search: (prev) => ({ ...prev, grammar: g }),
                  replace: true,
                })
              }
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                g === grammar ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-300"
              }`}
              title={
                g === "merge"
                  ? "Success IS verdigris — two token names, one hex"
                  : g === "quantity"
                    ? "No status hue — count, weight, and pips carry success"
                    : "A second green at hard tonal distance"
              }
            >
              {GRAMMARS[g].label}
            </button>
          ))}
        </div>
        <span className="h-4 w-px bg-zinc-400" />
        <div className="flex items-center gap-1">
          {SEAT_ORDER.map((s) => (
            <button
              key={s}
              onClick={() =>
                void navigate({ search: (prev) => ({ ...prev, seat: s }), replace: true })
              }
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                s === seat ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-300"
              }`}
            >
              {SEAT_VIEW[s].label}
            </button>
          ))}
        </div>
        <span className="h-4 w-px bg-zinc-400" />
        <button
          onClick={() => stepRung(-1)}
          className="rounded-full px-2 py-0.5 text-[13px] font-bold hover:bg-zinc-300"
          title="Previous rung (←)"
        >
          ←
        </button>
        <span className="w-36 text-center font-mono text-[11px] font-semibold">
          {RUNG_ORDER.indexOf(rung) + 1}/{RUNG_ORDER.length} · {rung}
        </span>
        <button
          onClick={() => stepRung(1)}
          className="rounded-full px-2 py-0.5 text-[13px] font-bold hover:bg-zinc-300"
          title="Next rung (→)"
        >
          →
        </button>
      </div>
    </>
  )
}
