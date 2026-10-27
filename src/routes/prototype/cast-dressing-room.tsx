// PROTOTYPE — throwaway. The ladder dressing room (issue #96, map #95).
//
// The cheap viewing rig for the live Cast card: every rung of the ladder
// (7 live + cancelled/voided) × every seat (caster / storyteller / bystander),
// flipped through in seconds instead of a two-account Convex playthrough.
// The #102 grammar audition adds a third knob (?grammar=): three success-ink
// candidates — A merge (success IS verdigris), B quantity (no status hue;
// count, weight, and pips carry it), C mint (a second green at hard tonal
// distance). The settled constitution — danger slot, Mana blue + glyph,
// neutral dice counts — renders identically in all three; the knob only
// swaps the --rail-success alias. The ROOT VERDICT IS PINNED (owner walk
// 2026-07-18): the rail's structure changes too much under the campaign to
// judge hues on this surface; the knob and the two-colored rungs stay as
// audition material for the re-walk after the rebuild. Ember commit buttons
// were auditioned here and rescinded — triggers stay verdigris mv-roll.
// The REAL app shell (SessionLayout), the REAL feed neighbors (MessageItem /
// RollItem), and the REAL CastCard — fed hand-built fake Cast documents via
// URL knobs (?rung=…&seat=…), reload-stable and shareable. Each seat mounts
// the card where the session does (MAG-48): while live it stands in the
// working zone on every seat, above the working slot (MAG-53); the feed
// once it is a record. The slot is the real one — the message box sends
// locally, and +chat / +whisper feed it lines to count.
//
// Unlike the census-era prototypes in this directory, this rig imports app
// code ON PURPOSE — that is its whole job (map #95 reaffirmed ADR-0021's
// workbench decision: state auditioning happens in throwaway routes inside
// the real shell). No Convex writes: everything renders from local fakes;
// pressing a live button fires a real mutation at a fake id, which the server
// refuses — the refusal renders inline, which is itself a state worth seeing.
//
// DELETE when map #95 clears.
import { useEffect, useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { withheldFrom, type CastEntry, type MessageEntry, type RollEntry } from "#/domain/activity"
import type { ParadoxPoolModifier } from "#/domain/paradox"
import { decodeSheet } from "#/domain/character"
import { initialCurrentState } from "#/domain/character"
import { arctusData } from "#/domain/fixtures/arctus"
import { useDicePool } from "#/hooks/use-dice-pool"
import { ScrollArea } from "#/components/ui/scroll-area"
import { SessionLayout } from "#/components/game/SessionLayout"
import { MessageItem, RollItem } from "#/components/game/ActivityLog"
import { CastCard } from "#/components/game/CastCard"
import { CastMount } from "#/components/game/CastMount"
import { isUnresolved } from "#/domain/cast"
import { CharacterSheet } from "#/components/game/CharacterSheet"
import type { WisdomLook } from "#/components/game/WisdomMark"
import { pooledDice } from "#/machines/dice-pool"
import { MessageBox } from "#/components/game/MessageBox"
import { ChronicleSwitch, WorkingSlot } from "#/components/game/WorkingSlot"
import { useWorkingSlot } from "#/hooks/use-working-slot"
import { whisperable } from "#/domain/video-rail"
import { DicePoolBuilder } from "#/components/game/DicePoolBuilder"
import { VideoRail } from "#/components/game/VideoRail"
import type { CharacterSheet as Sheet } from "#/domain/character"
import type { VideoSeat } from "#/domain/video-rail"
import type { Id } from "../../../convex/_generated/dataModel"

// ── The knobs ────────────────────────────────────────────────────────────────

// Rig keys, not raw statuses (ADR-0022): the two-colored rungs audition both
// phases, so Tides and Paradox each get two stops on the knob.
const RUNG_ORDER = [
  "draft",
  "priceFluid",
  "priceFixed",
  "paradoxUnrolled",
  "paradoxRolled",
  "resolved",
  "cancelled",
  "voided",
] as const
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

// MAG-56: two Wisdom knobs. `wisdom` swaps the caster across the owner's
// four cases — 10 amazing, 7 fine, 5 sketchy, 2 really bad — and the
// resolved rung's aftermath follows (a Havoc that runs true at 10 and 7, a
// Bedlam held one scene at 5 and 24 hours at 2); `look` swaps the Wisdom
// treatment on the title card (WisdomMark.tsx) so the owner can judge them.
const WISDOM_ORDER = [10, 7, 5, 2] as const
type RigWisdom = (typeof WISDOM_ORDER)[number]
const LOOK_ORDER: ReadonlyArray<WisdomLook> = ["heat", "word", "scales", "ladder", "rail"]
const isWisdom = (v: unknown): v is RigWisdom =>
  (WISDOM_ORDER as ReadonlyArray<unknown>).includes(typeof v === "string" ? Number(v) : v)
const isLook = (v: unknown): v is WisdomLook =>
  typeof v === "string" && (LOOK_ORDER as ReadonlyArray<string>).includes(v)

export const Route = createFileRoute("/prototype/cast-dressing-room")({
  validateSearch: (search: Record<string, unknown>) => ({
    rung: isRung(search.rung) ? search.rung : ("draft" as RigRung),
    seat: isSeat(search.seat) ? search.seat : ("caster" as RigSeat),
    grammar: isGrammar(search.grammar) ? search.grammar : ("merge" as RigGrammar),
    hurt: search.hurt === true || search.hurt === "true",
    wisdom: isWisdom(search.wisdom) ? (Number(search.wisdom) as RigWisdom) : (7 as RigWisdom),
    look: isLook(search.look) ? search.look : ("heat" as WisdomLook),
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
const ARCTUS_INPUT = {
  id: "proto-character",
  sessionId: SESSION_ID,
  userId: CASTER,
  sessionMemberId: "proto-member",
  ...arctusData,
  ...initialCurrentState(arctusData),
}
const arctusSheet = decodeSheet(ARCTUS_INPUT)

// The video rail's table (MAG-51): the Storyteller and five players in five
// states, so the tiles are judged on the hard cases as well as the easy one:
// Arctus fresh, then hurt into the wound penalty, Resistant damage and
// nearly dry, out of Willpower, a long track.
type BoxKey = "empty" | "bashing" | "lethal" | "aggravated"
const box = (severity: BoxKey, resistant = false) => ({ severity, resistant })
const track = (filled: ReadonlyArray<ReturnType<typeof box>>, length: number) => [
  ...filled,
  ...Array.from({ length: length - filled.length }, () => box("empty")),
]

// MAG-49's hard case: Arctus with two boxes left, so containing both of the
// rig's Paradox successes fills the track — unconscious (never dead).
const hurtArctusSheet = decodeSheet({
  ...ARCTUS_INPUT,
  healthTrack: track([box("lethal"), box("bashing"), box("bashing"), box("bashing"), box("bashing")], 7),
})

const player = (
  name: string,
  overrides: Record<string, unknown>,
): Sheet | null =>
  decodeSheet({
    id: `proto-${name}`,
    sessionId: "proto-dressing-room",
    userId: `dev:proto-${name}`,
    sessionMemberId: `proto-member-${name}`,
    ...arctusData,
    ...initialCurrentState(arctusData),
    name,
    ...overrides,
  })

const RIG_PLAYERS: ReadonlyArray<Sheet | null> = [
  arctusSheet,
  player("Corvin Ashe", {
    shadowName: "Tessellate",
    gnosis: 2,
    healthTrack: track([box("lethal"), box("lethal"), box("bashing"), box("bashing"), box("bashing")], 7),
    willpowerCurrent: 3,
    manaCurrent: 6,
  }),
  player("Mirela Voss", {
    shadowName: "Ninefold",
    gnosis: 3,
    healthTrack: track([box("aggravated", true), box("lethal", true)], 7),
    willpowerCurrent: 5,
    manaCurrent: 1,
  }),
  player("Tobias Wren", { shadowName: "Wick", willpowerCurrent: 0, manaCurrent: 4 }),
  player("Sable", { shadowName: "Hollow Bell", healthTrack: track([box("bashing")], 9) }),
]

const RIG_SEATS: ReadonlyArray<VideoSeat> = [
  { memberId: "proto-st", userId: STORYTELLER, displayName: "Morrigan", role: "storyteller", sheet: null },
  ...RIG_PLAYERS.flatMap((sheet) =>
    sheet
      ? [{ memberId: `seat-${sheet.id}`, userId: String(sheet.userId), displayName: sheet.name, role: "player" as const, sheet }]
      : [],
  ),
]


// One Cast document per rung, built cumulatively — each beat's fields land
// and stay, exactly as the ladder mutations stamp them.
const draft: CastEntry = {
  _tag: "cast",
  _id: "proto-cast" as CastEntry["_id"],
  timestamp: T0,
  startedAt: T0,
  characterId: "proto-character" as CastEntry["characterId"],
  casterUserId: CASTER,
  casterName: "The Little Bear",
  status: "draft",
  arcanum: "death",
  level: 3,
  usesMagicalTool: true,
  // Improvised-cast shape (Gnosis + Arcanum + boosts, spellcasting.ts) and a
  // 0-Mana cost: Death is Moros-ruling, so the honest price is nothing — the
  // walk-through (2026-07-18) caught the earlier fake charging 1 Mana.
  declaredComponents: [
    { type: "gnosis", name: "Gnosis", dots: 3 },
    { type: "arcanum", name: "Death", dots: 3 },
    { type: "modifier", name: "High Speech", dots: 2 },
    { type: "modifier", name: "Willpower", dots: 3 },
  ],
  declaredPool: 11,
  spellManaCost: 0,
  createdAt: T0,
  updatedAt: T0,
}

const priceFluid: CastEntry = {
  ...draft,
  status: "price",
  gnosis: 3,
  adjustments: [{ source: "Hallowed ground", dice: -1 }],
}

// THE FIX (ADR-0022): the stamped Tides seed — inherited-from-scene —
// beside the ST's personal adjustment above.
const priceFixed: CastEntry = {
  ...priceFluid,
  tides: {
    witnessCount: 2,
    circumstances: [{ source: "Ley line nexus", dice: 1 }],
    priorParadoxRolls: 1,
  },
}

const paradoxUnrolled: CastEntry = {
  ...priceFixed,
  status: "paradox",
  manaMitigation: 1,
}

const paradoxRolled: CastEntry = {
  ...paradoxUnrolled,
  paradoxSuccesses: 2,
  // The Paradox merge (2026-07-19 pass 2, note 5): the roll's faces ride the
  // document — the 3-die pool the fixed Tides + mitigation leave, two landing.
  paradoxRolls: [8, 9, 4],
  paradoxExplosions: [],
  paradoxIsChanceDie: false,
  paradoxIsDramaticFailure: false,
}

const resolved: CastEntry = {
  ...paradoxRolled,
  status: "resolved",
  containedSuccesses: 1,
  castPool: 9,
  castSuccesses: 3,
  // The resolution merge (2026-07-19): the release roll's faces ride the
  // document — 9 dice, one 10 exploding into a miss, three successes.
  castRolls: [8, 9, 2, 10, 5, 3, 4, 1, 6],
  // The 10 at combined-index 3 exploded into this miss (parented, issue #122).
  castExplosions: [{ value: 4, parentIndex: 3 }],
  castRoteRerolls: [],
  castIsChanceDie: false,
  castIsDramaticFailure: false,
  castIsExceptionalSuccess: false,
  severity: "havoc",
}

// MAG-56: the aftermath Wisdom governs, per knob. At 7 the one loose success
// is a Havoc and the Wisdom roll (three successes) lets the spell run true;
// at 2 the caster contains nothing, both successes run loose as Bedlam, and
// the table holds it 24 hours.
const RESOLVED_BY_WISDOM: Record<RigWisdom, Partial<CastEntry>> = {
  10: { wisdom: 10, havocSuccesses: 5 },
  7: { wisdom: 7, havocSuccesses: 3 },
  5: { wisdom: 5, containedSuccesses: 0, severity: "bedlam", paradoxSpan: "scene" },
  2: { wisdom: 2, containedSuccesses: 0, severity: "bedlam", paradoxSpan: "day" },
}

const cancelled: CastEntry = { ...priceFixed, status: "cancelled" }

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
  priceFluid,
  priceFixed,
  paradoxUnrolled,
  paradoxRolled,
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
  // MAG-18: a ten-again with a chain (the 10 → 10 → 4) and a lone burst
  // (the second 10 → 7), so the feed shows the plate in situ.
  poolSize: 6,
  rolls: [8, 10, 9, 1, 10, 3],
  explosions: [
    { value: 10, parentIndex: 1 },
    { value: 4, parentIndex: 6 },
    { value: 7, parentIndex: 4 },
  ],
  roteRerolls: [],
  successes: 5,
  isChanceDie: false,
  isDramaticFailure: false,
  isExceptionalSuccess: true,
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
  const { rung, seat, grammar, hurt, wisdom, look } = Route.useSearch()
  const casterNow = hurt ? hurtArctusSheet : arctusSheet
  // MAG-52: the sheet's tool switch flips a local copy (no server here).
  const [toolInHand, setToolInHand] = useState(false)
  // MAG-56: the Wisdom knob rides the shown sheet too, so the rail and the
  // resolved card agree on the caster.
  const shownSheet = useMemo(
    () => decodeSheet({ ...ARCTUS_INPUT, hasMagicalTool: toolInHand, wisdom }),
    [toolInHand, wisdom],
  )
  const navigate = Route.useNavigate()
  const pool = useDicePool(SESSION_ID)

  // MAG-53: the lines the knobs (+chat, +whisper) and the message box add,
  // local — the rig has no server.
  const [arrived, setArrived] = useState<ReadonlyArray<MessageEntry>>([])

  // The ST's adjustments live here, per rung (MAG-45): the fixture cast has
  // no server document, so the card's adjust door writes local state and
  // the Tides box, the felt and the table all move as they would live.
  const [adjusted, setAdjusted] = useState<Partial<Record<RigRung, ReadonlyArray<ParadoxPoolModifier>>>>({})
  const adjustments = adjusted[rung]
  const view = SEAT_VIEW[seat]
  // Each seat sees what the feed query would hand it: the same policy, so a
  // fluid rung's adjustments reach the Storyteller's seat only.
  const reader = {
    userId: view.viewerUserId,
    role: view.isStoryteller ? ("storyteller" as const) : ("player" as const),
  }
  // The caster's live bets (MAG-34) live here too, per rung: the card's
  // drafts door writes them, and every seat's card reads them back — flip
  // the seat to watch the pick or the sacrifice from the other chairs.
  const [drafted, setDrafted] = useState<
    Partial<Record<RigRung, Pick<CastEntry, "draftMitigation" | "draftContainedSuccesses">>>
  >({})
  const cast: CastEntry = withheldFrom(reader)({
    ...CASTS[rung],
    ...(rung === "resolved" ? RESOLVED_BY_WISDOM[wisdom] : {}),
    ...(adjustments !== undefined ? { adjustments } : {}),
    ...drafted[rung],
  })
  const adjust = async (next: ReadonlyArray<ParadoxPoolModifier>) =>
    setAdjusted((prev) => ({ ...prev, [rung]: next }))
  const drafts = {
    mitigation: async (draftMitigation: number) =>
      setDrafted((prev) => ({ ...prev, [rung]: { ...prev[rung], draftMitigation } })),
    containment: async (draftContainedSuccesses: number) =>
      setDrafted((prev) => ({ ...prev, [rung]: { ...prev[rung], draftContainedSuccesses } })),
  }
  const mySheet = seat === "caster" ? casterNow : null

  const PEOPLE = [
    { id: CASTER, name: "The Little Bear" },
    { id: STORYTELLER, name: "Morrigan" },
    { id: BYSTANDER, name: "The Witness" },
  ]
  const me = PEOPLE.find((p) => p.id === view.viewerUserId)!
  const someoneElse = PEOPLE.find((p) => p.id !== view.viewerUserId)!
  // the working slot reads the rig's feed as the route reads the real one
  const slot = useWorkingSlot([systemMsg, chatMsg, priorRoll, ...arrived], view.viewerUserId)
  // the tiles are the whisper roster, the viewer's own excepted
  const people = whisperable(RIG_SEATS, view.viewerUserId)
  let seq = arrived.length
  const line = (
    from: { id: string; name: string },
    text: string,
    whisperTo: ReadonlyArray<string>,
  ): MessageEntry => ({
    _tag: "message",
    _id: `proto-arrived-${(seq += 1)}` as MessageEntry["_id"],
    senderId: from.id,
    senderName: from.name,
    text,
    visibilityType: whisperTo.length === 0 ? "public" : "whisper",
    ...(whisperTo.length === 0
      ? {}
      : {
          whisperTargetIds: whisperTo,
          whisperTargetNames: whisperTo.map((id) => people.find((p) => p.id === id)?.name ?? "you"),
        }),
    timestamp: T0 + seq * 1000,
  })
  // the knob's incoming lines: the slot counts them while the tray shows
  const arrive = (whisper: boolean) => {
    setArrived((prev) => [
      ...prev,
      line(
        someoneElse,
        whisper ? "Don't tell the others — I saw the sigil move." : "Footsteps on the stair. Someone's coming down.",
        whisper ? [view.viewerUserId] : [],
      ),
    ])
  }
  const pooled = pooledDice(pool.context)

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

  // Remount per knob flip: the card's local drafts (mitigation row,
  // containment boxes, refusal line) must not bleed across states.
  const card = (
    <CastCard
      key={`${rung}:${seat}`}
      cast={cast}
      sessionId={SESSION_ID}
      isStoryteller={view.isStoryteller}
      viewerUserId={view.viewerUserId}
      mySheet={mySheet}
      // Every seat watches the caster's cockpit (note 14) — the rig hands
      // all three the same Arctus track.
      casterSheet={casterNow}
      adjust={adjust}
      drafts={drafts}
    />
  )
  // Each seat mounts the card where the session does (MAG-48): a live cast
  // takes the working zone over on every seat, in place of the tray; never
  // in the feed. The record
  // (resolved, cancelled, voided) lands in the feed for everyone.
  const live = isUnresolved(cast.status)

  const feed = (
    <div className="flex h-full flex-col">
      <div
        className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: "var(--line)" }}
      >
        <h2 className="mv-eyebrow">Chronicle</h2>
        <ChronicleSwitch mode={slot.mode} setMode={slot.setMode} unread={slot.unread} pooled={pooled} diceRef={slot.switchRef} />
      </div>
      <ScrollArea className="min-h-0 flex-1 px-3 py-2">
        <div className="grid gap-2">
          <MessageItem message={systemMsg} dropCap />
          <MessageItem message={chatMsg} />
          <RollItem roll={priorRoll} />
          {!live && card}
          {arrived.map((m) => (
            <MessageItem key={m._id} message={m} />
          ))}
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
        videoRail={
          <VideoRail
            seats={RIG_SEATS}
            pending={null}
            whisper={{ choice: slot.whisper, self: view.viewerUserId }}
          />
        }
        characterSheet={
          shownSheet ? (
            <CharacterSheet
              character={shownSheet}
              // a pending spend, so the header's ember is judged too
              pendingMana={2}
              pendingWillpower={1}
              wisdomLook={look}
              onSetMagicalTool={(next) => {
                setToolInHand(next)
                return Promise.resolve()
              }}
            />
          ) : (
            <p className="text-sm" style={{ color: "var(--bad)" }}>
              The Arctus fixture failed to decode — the rig needs a sheet.
            </p>
          )
        }
        activityLog={feed}
        liveCasts={live && <CastMount>{card}</CastMount>}
        workingSlot={
          <WorkingSlot
            mode={slot.mode}
            tray={<DicePoolBuilder pool={pool} />}
            message={
              <MessageBox
                people={people}
                whisper={slot.whisper}
                onSend={(text, targets) => {
                  setArrived((prev) => [...prev, line(me, text, targets)])
                  return Promise.resolve()
                }}
                onEscape={slot.escape}
                inputRef={slot.inputRef}
              />
            }
          />
        }
        onClearPool={pool.reset}
      />
      </div>

      {/* The knobs — deliberately foreign to the mv language so nobody
          mistakes them for the design under audition. */}
      <div className="fixed top-1.5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full bg-zinc-100 px-4 py-2 text-zinc-900 shadow-lg">
        <div className="flex items-center gap-1">
          <button
            onClick={() => arrive(false)}
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold hover:bg-zinc-300"
            title="A chat line arrives from someone else"
          >
            +chat
          </button>
          <button
            onClick={() => arrive(true)}
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold hover:bg-zinc-300"
            title="A whisper to you arrives"
          >
            +whisper
          </button>
        </div>
        <span className="h-4 w-px bg-zinc-400" />
        <button
          onClick={() =>
            void navigate({
              search: (prev) => ({ ...prev, hurt: !hurt }),
              replace: true,
            })
          }
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            hurt ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-300"
          }`}
          title="MAG-49: the caster with two boxes left — containing both fills the track"
        >
          hurt
        </button>
        <span className="h-4 w-px bg-zinc-400" />
        <div className="flex items-center gap-1">
          {WISDOM_ORDER.map((w) => (
            <button
              key={w}
              onClick={() =>
                void navigate({ search: (prev) => ({ ...prev, wisdom: w }), replace: true })
              }
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                w === wisdom ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-300"
              }`}
              title="MAG-56: the caster's Wisdom — 10 amazing, 7 fine, 5 sketchy, 2 really bad; the resolved aftermath follows"
            >
              W{w}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {LOOK_ORDER.map((l) => (
            <button
              key={l}
              onClick={() =>
                void navigate({ search: (prev) => ({ ...prev, look: l }), replace: true })
              }
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                l === look ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-300"
              }`}
              title="MAG-56: the Wisdom look on the title card (WisdomMark.tsx)"
            >
              {l}
            </button>
          ))}
        </div>
        <span className="h-4 w-px bg-zinc-400" />
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
