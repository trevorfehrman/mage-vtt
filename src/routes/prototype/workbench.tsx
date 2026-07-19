// PROTOTYPE — throwaway. The workbench audit (issue #105, map #95).
//
// The dressing room (#96) shows the CARD's states; this rig shows the
// WORKBENCH's — the declaration surface the sheet click opens in the rail
// foot, rebuilt for the ADR-0022 world: declaration priced off the live
// Tides BEFORE drafting, the tool decision living here exclusively, the
// card no longer duplicating workbench controls.
//
// Three structurally different variants, switchable via ?variant=
// (UI-prototype pattern; ← → cycle):
//   ledger — every decision its own row, price as the footer receipt
//   scales — price first: your hand vs the Tides as a two-pane readout,
//            controls demoted to fitting strips beneath
//   embryo — the workbench IS the future cast card, edited in place
//            (drafting-is-broadcast made literal)
// ?scenario= flips the fixture: improvised / rote (Vulgar, "or" pool) /
// manaShort. All pool and Paradox numbers are the REAL domain leaves
// (cast-preview, calculateParadoxPool, rollOdds) over a fake Tides fixture —
// no Convex writes; Cast/Draft buttons stub to a flash line.
//
// DELETE when map #95 clears.
import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Option } from "effect"
import {
  previewImprovisedCast,
  previewRoteCast,
  type CastPreview,
} from "#/domain/cast-preview"
import { toGnosisRank } from "#/domain/cast"
import { decodeSheet, initialCurrentState, KnownRote } from "#/domain/character"
import { RotePool } from "#/domain/rote-pool"
import { arctusData } from "#/domain/fixtures/arctus"
import { calculateParadoxPool } from "#/domain/paradox"
import { rollOdds } from "#/domain/probability"
import { WILLPOWER_BONUS_DICE } from "#/domain/willpower-economy"
import type { MessageEntry, RollEntry } from "#/domain/activity"
import { ScrollArea } from "#/components/ui/scroll-area"
import { SessionLayout } from "#/components/game/SessionLayout"
import { MessageItem, RollItem } from "#/components/game/ActivityLog"
import { ArcanaGlyph } from "#/components/game/ArcanaGlyph"
import { CharacterSheet } from "#/components/game/CharacterSheet"
import { ChatInput } from "#/components/game/ChatInput"
import { ResourceStrip } from "#/components/game/ResourceStrip"
import { VideoRailPlaceholder } from "#/components/game/VideoRailPlaceholder"
import type { Id } from "../../../convex/_generated/dataModel"

// ── The knobs ────────────────────────────────────────────────────────────────

const VARIANT_ORDER = ["ledger", "scales", "embryo"] as const
type RigVariant = (typeof VARIANT_ORDER)[number]
const VARIANT_LABEL: Record<RigVariant, string> = {
  ledger: "A · ledger",
  scales: "B · scales",
  embryo: "C · embryo",
}

const SCENARIO_ORDER = ["improvised", "rote", "manaShort"] as const
type RigScenario = (typeof SCENARIO_ORDER)[number]

const isVariant = (v: unknown): v is RigVariant =>
  typeof v === "string" && (VARIANT_ORDER as ReadonlyArray<string>).includes(v)
const isScenario = (v: unknown): v is RigScenario =>
  typeof v === "string" && (SCENARIO_ORDER as ReadonlyArray<string>).includes(v)

export const Route = createFileRoute("/prototype/workbench")({
  validateSearch: (search: Record<string, unknown>) => ({
    variant: isVariant(search.variant) ? search.variant : ("ledger" as RigVariant),
    scenario: isScenario(search.scenario)
      ? search.scenario
      : ("improvised" as RigScenario),
  }),
  component: WorkbenchRig,
})

// ── The fixtures ─────────────────────────────────────────────────────────────

const SESSION_ID = "proto-workbench" as Id<"sessions">
const CASTER = "dev:proto-arctus"
const T0 = 1752800000000

const arctusSheet = decodeSheet({
  id: "proto-character",
  sessionId: SESSION_ID,
  userId: CASTER,
  sessionMemberId: "proto-member",
  ...arctusData,
  ...initialCurrentState(arctusData),
})

// The manaShort scenario runs the same mage nearly dry.
const poorSheet = decodeSheet({
  id: "proto-character",
  sessionId: SESSION_ID,
  userId: CASTER,
  sessionMemberId: "proto-member",
  ...arctusData,
  ...initialCurrentState(arctusData),
  manaCurrent: 1,
})

// A fake Vulgar rote with an "or" pool, so the skill-choice row and the
// Draft door both have a scenario. Trait names resolve against Arctus.
const graveMist = new KnownRote({
  name: "Grave Mist",
  spellName: "Quicken the Corpse",
  spellArcanum: "Death",
  spellLevel: 3,
  order: "Mysterium",
  pool: new RotePool({
    attribute: "Resolve",
    skills: ["Occult", "Investigation"],
    arcanum: "Death",
  }),
  spellAspect: "Vulgar",
})

// The Tides — ADR-0022's scene-owned ambient price, as the workbench sees it
// live from the Scene strip's state. This is the rig's whole reason to exist:
// the caster prices risk/reward off public truth BEFORE declaring.
const TIDES = {
  witnessCount: 2,
  circumstances: [
    { source: "Hallowed ground", dice: -1 },
    { source: "Ley line surge", dice: 1 },
  ],
  priorParadoxRolls: 1,
}

// Feed neighbors, for density honesty.
const chatMsg: MessageEntry = {
  _tag: "message",
  _id: "proto-msg-1" as MessageEntry["_id"],
  senderId: "dev:proto-morrigan",
  senderName: "Morrigan",
  text: "The funeral party is still filing out upstairs. Two of them lingering.",
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

// ── The draft (shared across variants so flipping keeps your work) ──────────

type Draft = {
  method: "improvised" | "rote"
  level: number
  skillChoice: string | null
  potency: number
  targets: number
  extraMana: number
  highSpeech: boolean
  spendWillpower: boolean
  hidden: boolean
  usesMagicalTool: boolean
  intent: string
}

const initialDraft = (scenario: RigScenario): Draft => ({
  method: scenario === "rote" ? "rote" : "improvised",
  level: 3,
  skillChoice: null,
  potency: 1,
  targets: 1,
  extraMana: scenario === "manaShort" ? 2 : 0,
  highSpeech: false,
  spendWillpower: false,
  hidden: false,
  usesMagicalTool: true,
  intent: "",
})

type Priced = {
  preview: CastPreview | null
  castOdds: ReturnType<typeof rollOdds> | null
  paradox: ReturnType<typeof calculateParadoxPool>
  paradoxOdds: ReturnType<typeof rollOdds>
  manaShort: boolean
  needsSkill: boolean
}

// ── The rig ──────────────────────────────────────────────────────────────────

function WorkbenchRig() {
  const { variant, scenario } = Route.useSearch()
  const navigate = Route.useNavigate()
  const sheet = scenario === "manaShort" ? poorSheet : arctusSheet
  const [draft, setDraft] = useState<Draft>(() => initialDraft(scenario))
  const [flash, setFlash] = useState<string | null>(null)

  // Scenario flips reset the draft (each is its own fixture).
  useEffect(() => {
    setDraft(initialDraft(scenario))
    setFlash(null)
  }, [scenario])

  const stepVariant = (dir: 1 | -1) => {
    void navigate({
      search: (prev) => {
        const i = VARIANT_ORDER.indexOf(prev.variant)
        return {
          ...prev,
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
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))
        return
      if (e.key === "ArrowRight") stepVariant(1)
      if (e.key === "ArrowLeft") stepVariant(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  if (!sheet) {
    return <p style={{ color: "var(--bad)" }}>The Arctus fixture failed to decode.</p>
  }

  // The live price — real leaves, the ADR-0022 payoff. The Tides feed the
  // Paradox forecast at DECLARATION time, not at The Price rung.
  const preview: CastPreview | null =
    draft.method === "rote"
      ? draft.skillChoice === null
        ? null
        : Option.getOrNull(
            previewRoteCast({
              sheet,
              rote: graveMist,
              skillChoice: draft.skillChoice,
              potency: draft.potency,
              targets: draft.targets,
              highSpeech: draft.highSpeech,
              extraManaCost: draft.extraMana,
              spendWillpower: draft.spendWillpower,
            }),
          )
      : Option.getOrNull(
          previewImprovisedCast({
            sheet,
            arcanum: "death",
            potency: draft.potency,
            targets: draft.targets,
            highSpeech: draft.highSpeech,
            extraManaCost: draft.extraMana,
            spendWillpower: draft.spendWillpower,
          }),
        )

  const paradox = calculateParadoxPool({
    gnosis: toGnosisRank(sheet.gnosis),
    isRote: draft.method === "rote",
    usesMagicalTool: draft.usesMagicalTool,
    witnessCount: TIDES.witnessCount,
    priorParadoxRollsThisScene: TIDES.priorParadoxRolls,
    discretionaryModifiers: TIDES.circumstances,
  })

  const priced: Priced = {
    preview,
    castOdds: preview ? rollOdds(preview.dice) : null,
    paradox,
    paradoxOdds: rollOdds(paradox.totalDice),
    manaShort: preview !== null && preview.manaCost > sheet.manaCurrent,
    needsSkill: draft.method === "rote" && draft.skillChoice === null,
  }

  const bench = { sheet, draft, setDraft, priced, flash, setFlash }
  const workbench =
    variant === "ledger" ? (
      <LedgerBench {...bench} />
    ) : variant === "scales" ? (
      <ScalesBench {...bench} />
    ) : (
      <EmbryoBench {...bench} />
    )

  const feed = (
    <div className="flex h-full flex-col">
      <div
        className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: "var(--line)" }}
      >
        <h2 className="mv-eyebrow">Chronicle</h2>
        <span className="mv-data ml-auto text-[10px]" style={{ color: "var(--dim)" }}>
          Tides: {TIDES.witnessCount} witnesses · ley +1 · hallowed −1 · 1 prior
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-3 py-2">
        <div className="grid gap-2">
          <MessageItem message={chatMsg} />
          <RollItem roll={priorRoll} />
        </div>
      </ScrollArea>
    </div>
  )

  return (
    <>
      <SessionLayout
        sessionName="The Workbench"
        inviteCode="PROTO-105"
        videoRail={<VideoRailPlaceholder />}
        characterSheet={<CharacterSheet character={sheet} />}
        activityLog={feed}
        dicePoolBuilder={
          <>
            <ResourceStrip character={sheet} />
            {workbench}
          </>
        }
        chatInput={
          <ChatInput sessionId={SESSION_ID} members={[]} currentUserId={CASTER} />
        }
        onClearPool={() => {}}
      />

      {/* The knobs — deliberately foreign to the mv language. */}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-zinc-100 px-4 py-2 text-zinc-900 shadow-lg">
        <button
          onClick={() => stepVariant(-1)}
          className="rounded-full px-2 py-0.5 text-[13px] font-bold hover:bg-zinc-300"
          title="Previous variant (←)"
        >
          ←
        </button>
        <span className="w-24 text-center font-mono text-[11px] font-semibold">
          {VARIANT_LABEL[variant]}
        </span>
        <button
          onClick={() => stepVariant(1)}
          className="rounded-full px-2 py-0.5 text-[13px] font-bold hover:bg-zinc-300"
          title="Next variant (→)"
        >
          →
        </button>
        <span className="h-4 w-px bg-zinc-400" />
        <div className="flex items-center gap-1">
          {SCENARIO_ORDER.map((s) => (
            <button
              key={s}
              onClick={() =>
                void navigate({ search: (prev) => ({ ...prev, scenario: s }), replace: true })
              }
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                s === scenario ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Shared bits ──────────────────────────────────────────────────────────────

type BenchProps = {
  sheet: NonNullable<typeof arctusSheet>
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  priced: Priced
  flash: string | null
  setFlash: (f: string | null) => void
}

const pct = (p: number): string =>
  p <= 0 ? "0%" : p < 0.001 ? "<0.1%" : `${(p * 100).toFixed(1)}%`

const diceLabel = (n: number): string =>
  n <= 0 ? "chance die" : n === 1 ? "1 die" : `${n} dice`

function Mini({
  on,
  onClick,
  children,
  title,
}: {
  on?: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`mv-mini ${on ? "mv-mini-on" : ""}`}
    >
      {children}
    </button>
  )
}

function Step({
  value,
  onChange,
  min = 0,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="mv-btn grid size-5 place-items-center rounded-[3px] text-[12px] leading-none"
      >
        −
      </button>
      <span className="mv-data w-6 text-center text-[12px] font-bold">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        className="mv-btn grid size-5 place-items-center rounded-[3px] text-[12px] leading-none"
      >
        +
      </button>
    </div>
  )
}

/** Actions + gate line, shared: the trigger is always verdigris (#102). */
function BenchActions({ draft, priced, setFlash }: BenchProps) {
  const gate = priced.needsSkill
    ? "Pick the rote's skill first."
    : priced.manaShort
      ? `Not enough Mana — need ${priced.preview?.manaCost}, have less.`
      : null
  const vulgar = draft.method === "rote" || true // the rig's scene is vulgar territory
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => setFlash("→ would DRAFT into the wings (stub — no server)")}
        disabled={gate !== null}
        title={gate ?? "Draft into the wings — the handshake plays out on the docked card."}
        className="mv-roll rounded-[3px] px-3 py-1.5 text-[12px] disabled:opacity-40"
      >
        {priced.preview
          ? `Draft — ${diceLabel(priced.preview.dice)} declared`
          : "Draft"}
      </button>
      {vulgar ? null : null}
      <button
        onClick={() => setFlash("cancelled (stub)")}
        className="mv-btn rounded-[3px] px-3 py-1.5 text-[12px]"
      >
        Cancel
      </button>
      {gate && (
        <span className="mv-data text-[10px]" style={{ color: "var(--bad)" }}>
          {gate}
        </span>
      )}
    </div>
  )
}

// ── Variant A: the ledger ────────────────────────────────────────────────────
// Every decision its own row (the #96 comfortable-input standard, maximal);
// the price is a receipt footer. Tall — tests the tray's "building" posture.

function LedgerBench(props: BenchProps) {
  const { draft, setDraft, priced, flash } = props
  const d = (patch: Partial<Draft>) => setDraft((p) => ({ ...p, ...patch }))
  return (
    <div className="border-t px-3 py-2" style={{ borderColor: "var(--line)" }}>
      <div className="flex items-center gap-2">
        <span className="mv-eyebrow">Declaring</span>
        <ArcanaGlyph arcanum="death" size={13} className="mv-accent" />
        <span className="text-[12px]" style={{ color: "var(--ink)" }}>
          {draft.method === "rote" ? "Grave Mist" : "Improvised Death"}
        </span>
        <span
          className="mv-data ml-auto text-[20px] font-bold leading-none"
          style={{ color: "var(--accent)" }}
        >
          {priced.preview ? (priced.preview.isChanceDie ? "◈" : priced.preview.dice) : "—"}
        </span>
        <span className="mv-data text-[9px]" style={{ color: "var(--dim)" }}>
          dice
        </span>
      </div>

      <div className="mt-1.5 grid gap-1.5">
        {draft.method === "rote" && (
          <Row label="skill">
            {["Occult", "Investigation"].map((s) => (
              <Mini key={s} on={draft.skillChoice === s} onClick={() => d({ skillChoice: s })}>
                {s}
              </Mini>
            ))}
          </Row>
        )}
        {draft.method === "improvised" && (
          <Row label="level">
            {[1, 2, 3].map((n) => (
              <Mini key={n} on={draft.level === n} onClick={() => d({ level: n })}>
                {n}
              </Mini>
            ))}
          </Row>
        )}
        <Row label="potency">
          <Step value={draft.potency} min={1} onChange={(v) => d({ potency: v })} />
        </Row>
        <Row label="targets">
          <Step value={draft.targets} min={1} onChange={(v) => d({ targets: v })} />
        </Row>
        <Row label="mana +">
          <Step value={draft.extraMana} onChange={(v) => d({ extraMana: v })} />
        </Row>
        <Row label="voice">
          <Mini on={draft.highSpeech} onClick={() => d({ highSpeech: !draft.highSpeech })}>
            High Speech
          </Mini>
          <Mini
            on={draft.spendWillpower}
            onClick={() => d({ spendWillpower: !draft.spendWillpower })}
            title="Precommitted at declaration, by the book (ADR-0022)."
          >
            Willpower +{WILLPOWER_BONUS_DICE}
          </Mini>
          <Mini on={draft.hidden} onClick={() => d({ hidden: !draft.hidden })}>
            Hidden
          </Mini>
        </Row>
        <Row label="tool">
          <Mini
            on={draft.usesMagicalTool}
            onClick={() => d({ usesMagicalTool: !draft.usesMagicalTool })}
            title="The tool decision lives HERE exclusively now — the card never re-asks."
          >
            Magical tool −1 Paradox
          </Mini>
        </Row>
        <Row label="intent">
          <input
            value={draft.intent}
            onChange={(e) => d({ intent: e.target.value })}
            placeholder="What is the spell for?"
            className="mv-data w-full rounded-[3px] border bg-transparent px-2 py-1 text-[11px] outline-none focus:border-[var(--accent)]"
            style={{ borderColor: "var(--line)" }}
          />
        </Row>
      </div>

      {/* the receipt */}
      <div
        className="mv-data mt-2 grid gap-0.5 border-t pt-1.5 text-[10px]"
        style={{ borderColor: "var(--line)", color: "var(--dim)" }}
      >
        <span>
          Mana{" "}
          <b style={{ color: priced.manaShort ? "var(--bad)" : "var(--mana)" }}>
            ◈ {priced.preview?.manaCost ?? "—"}
          </b>{" "}
          of {props.sheet.manaCurrent}
        </span>
        <span>
          Tides price: Paradox{" "}
          <b style={{ color: "var(--ink)" }}>{diceLabel(priced.paradox.totalDice)}</b> · bites{" "}
          <b style={{ color: "var(--rail-danger)" }}>{pct(priced.paradoxOdds.success)}</b>
          {" — "}
          {priced.paradox.modifiers.map((m) => `${m.source} ${m.dice > 0 ? "+" : ""}${m.dice}`).join(", ")}
        </span>
        <span>
          cast odds <b style={{ color: "var(--rail-success)" }}>{pct(priced.castOdds?.success ?? 0)}</b>
        </span>
      </div>

      <div className="mt-2">
        <BenchActions {...props} />
      </div>
      {flash && (
        <p className="mv-data pt-1 text-[10px] italic" style={{ color: "var(--dim)" }}>
          {flash}
        </p>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="mv-data w-14 shrink-0 text-[9px] uppercase tracking-wider"
        style={{ color: "var(--dim)" }}
      >
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">{children}</div>
    </div>
  )
}

// ── Variant B: the scales ────────────────────────────────────────────────────
// Price first: your hand (ember side) weighed against the Tides (verdigris
// side), the ADR-0022 headline made the workbench's headline. Controls are
// compact fitting strips beneath the scale.

function ScalesBench(props: BenchProps) {
  const { draft, setDraft, priced, flash, sheet } = props
  const d = (patch: Partial<Draft>) => setDraft((p) => ({ ...p, ...patch }))
  return (
    <div className="border-t px-3 py-2" style={{ borderColor: "var(--line)" }}>
      {/* the scale */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className="rounded-[3px] border p-2"
          style={{ borderColor: "var(--ember)", background: "var(--ember-glow)" }}
        >
          <span className="mv-eyebrow" style={{ color: "var(--ember)" }}>
            Your hand
          </span>
          <div className="mv-data mt-1 text-[20px] font-bold leading-none" style={{ color: "var(--ink)" }}>
            {priced.preview ? (priced.preview.isChanceDie ? "◈" : priced.preview.dice) : "—"}
            <span className="pl-1 text-[10px] font-normal" style={{ color: "var(--dim)" }}>
              dice · {pct(priced.castOdds?.success ?? 0)}
            </span>
          </div>
          <div className="mv-data mt-1 text-[9px]" style={{ color: "var(--dim)" }}>
            {priced.preview
              ? priced.preview.components.map((c) => `${c.name} ${c.dots > 0 && c.type === "modifier" ? `+${c.dots}` : c.dots}`).join(" + ")
              : "pick a skill…"}
          </div>
          <div className="mv-data mt-1 text-[9px]" style={{ color: priced.manaShort ? "var(--bad)" : "var(--mana)" }}>
            ◈ {priced.preview?.manaCost ?? "—"} Mana of {sheet.manaCurrent}
          </div>
        </div>
        <div
          className="rounded-[3px] border p-2"
          style={{ borderColor: "var(--accent)", background: "var(--glow)" }}
        >
          <span className="mv-eyebrow" style={{ color: "var(--accent)" }}>
            The Tides
          </span>
          <div className="mv-data mt-1 text-[20px] font-bold leading-none" style={{ color: "var(--ink)" }}>
            {priced.paradox.totalDice}
            <span className="pl-1 text-[10px] font-normal">
              <span style={{ color: "var(--dim)" }}>Paradox · bites </span>
              <b style={{ color: "var(--rail-danger)" }}>{pct(priced.paradoxOdds.success)}</b>
            </span>
          </div>
          <div className="mv-data mt-1 grid gap-px text-[9px]" style={{ color: "var(--dim)" }}>
            {priced.paradox.modifiers.map((m) => (
              <span key={m.source}>
                {m.source} {m.dice > 0 ? `+${m.dice}` : m.dice}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* fitting strips */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {draft.method === "rote" &&
          ["Occult", "Investigation"].map((s) => (
            <Mini key={s} on={draft.skillChoice === s} onClick={() => d({ skillChoice: s })}>
              {s}
            </Mini>
          ))}
        <span className="mv-data text-[9px] uppercase" style={{ color: "var(--dim)" }}>
          potency
        </span>
        <Step value={draft.potency} min={1} onChange={(v) => d({ potency: v })} />
        <span className="mv-data text-[9px] uppercase" style={{ color: "var(--dim)" }}>
          targets
        </span>
        <Step value={draft.targets} min={1} onChange={(v) => d({ targets: v })} />
        <span className="mv-data text-[9px] uppercase" style={{ color: "var(--dim)" }}>
          mana+
        </span>
        <Step value={draft.extraMana} onChange={(v) => d({ extraMana: v })} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Mini on={draft.highSpeech} onClick={() => d({ highSpeech: !draft.highSpeech })}>
          High Speech
        </Mini>
        <Mini on={draft.spendWillpower} onClick={() => d({ spendWillpower: !draft.spendWillpower })}>
          Willpower +{WILLPOWER_BONUS_DICE}
        </Mini>
        <Mini on={draft.hidden} onClick={() => d({ hidden: !draft.hidden })}>
          Hidden
        </Mini>
        <Mini
          on={draft.usesMagicalTool}
          onClick={() => d({ usesMagicalTool: !draft.usesMagicalTool })}
          title="Lives here exclusively — watch it move the Tides pan live."
        >
          Tool −1
        </Mini>
      </div>
      <div className="mt-1.5">
        <input
          value={draft.intent}
          onChange={(e) => d({ intent: e.target.value })}
          placeholder="Intent — what is the spell for?"
          className="mv-data w-full rounded-[3px] border bg-transparent px-2 py-1 text-[11px] outline-none focus:border-[var(--accent)]"
          style={{ borderColor: "var(--line)" }}
        />
      </div>

      <div className="mt-2">
        <BenchActions {...props} />
      </div>
      {flash && (
        <p className="mv-data pt-1 text-[10px] italic" style={{ color: "var(--dim)" }}>
          {flash}
        </p>
      )}
    </div>
  )
}

// ── Variant C: the embryo ────────────────────────────────────────────────────
// The workbench IS the future cast card, edited in place: what you shape at
// the foot is literally what will dock in the feed (drafting-is-broadcast
// made a visual promise). A ghosted four-rung ladder shows where it's going.

const EMBRYO_RUNGS = ["Declare", "The Price", "Paradox", "Resolved"]

function EmbryoBench(props: BenchProps) {
  const { draft, setDraft, priced, flash, sheet } = props
  const d = (patch: Partial<Draft>) => setDraft((p) => ({ ...p, ...patch }))
  return (
    <div className="border-t px-3 py-2" style={{ borderColor: "var(--line)" }}>
      <div className="mv-cornered mv-panel rounded-[3px] p-2.5" style={{ borderStyle: "dashed" }}>
        {/* the card's header, editable */}
        <div className="flex items-center gap-1.5">
          <ArcanaGlyph arcanum="death" size={14} className="mv-accent" />
          <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
            The Little Bear
          </span>
          <span className="mv-data text-[10px]" style={{ color: "var(--dim)" }}>
            vulgar Death {draft.level}
            {draft.method === "rote" ? " · Rote “Grave Mist”" : ""}
          </span>
          <span className="mv-data ml-auto text-[9px] uppercase tracking-wide" style={{ color: "var(--ember)" }}>
            drafting
          </span>
        </div>
        <input
          value={draft.intent}
          onChange={(e) => d({ intent: e.target.value })}
          placeholder="“What is the spell for?” — the card's own intent line"
          className="mt-1 w-full border-0 bg-transparent text-[11px] italic outline-none"
          style={{ color: "var(--dim)" }}
        />

        {/* the ghosted ladder it will climb */}
        <div className="mt-2 flex items-center gap-1 opacity-50">
          {EMBRYO_RUNGS.map((r, i) => (
            <div key={r} className="flex min-w-0 flex-1 flex-col gap-1">
              <div
                className="h-[3px] rounded-full"
                style={{ background: i === 0 ? "var(--turn-caster)" : "var(--raise)" }}
              />
              <span
                className="mv-data truncate text-center text-[8px] uppercase tracking-wide"
                style={{ color: i === 0 ? "var(--turn-caster)" : "var(--dim)" }}
              >
                {r}
              </span>
            </div>
          ))}
        </div>

        {/* the numbers of the moment — live, editable in place */}
        <div className="mt-2 grid gap-1 text-[11px]" style={{ color: "var(--dim)" }}>
          <span className="mv-data flex flex-wrap items-center gap-1.5">
            declared pool{" "}
            <b style={{ color: "var(--ink)" }}>
              {priced.preview ? diceLabel(priced.preview.dice) : "—"}
            </b>
            {draft.method === "rote" &&
              ["Occult", "Investigation"].map((s) => (
                <Mini key={s} on={draft.skillChoice === s} onClick={() => d({ skillChoice: s })}>
                  {s}
                </Mini>
              ))}
            <Mini on={draft.highSpeech} onClick={() => d({ highSpeech: !draft.highSpeech })}>
              +HS
            </Mini>
            <Mini on={draft.spendWillpower} onClick={() => d({ spendWillpower: !draft.spendWillpower })}>
              +WP
            </Mini>
          </span>
          <span className="mv-data flex flex-wrap items-center gap-1.5">
            factors · potency <Step value={draft.potency} min={1} onChange={(v) => d({ potency: v })} />
            targets <Step value={draft.targets} min={1} onChange={(v) => d({ targets: v })} />
            mana+ <Step value={draft.extraMana} onChange={(v) => d({ extraMana: v })} />
          </span>
          <span className="mv-data flex flex-wrap items-center gap-1.5">
            the Tides ask{" "}
            <b style={{ color: "var(--ink)" }}>{diceLabel(priced.paradox.totalDice)}</b>
            <span>
              bites <b style={{ color: "var(--rail-danger)" }}>{pct(priced.paradoxOdds.success)}</b>
            </span>
            <Mini
              on={draft.usesMagicalTool}
              onClick={() => d({ usesMagicalTool: !draft.usesMagicalTool })}
              title="The tool decision lives on the embryo — the docked card only reports it."
            >
              tool −1
            </Mini>
          </span>
          <span className="mv-data">
            Mana{" "}
            <b style={{ color: priced.manaShort ? "var(--bad)" : "var(--mana)" }}>
              ◈ {priced.preview?.manaCost ?? "—"}
            </b>{" "}
            of {sheet.manaCurrent} · cast odds{" "}
            <b style={{ color: "var(--rail-success)" }}>{pct(priced.castOdds?.success ?? 0)}</b>
          </span>
        </div>
      </div>

      <div className="mt-2">
        <BenchActions {...props} />
      </div>
      {flash && (
        <p className="mv-data pt-1 text-[10px] italic" style={{ color: "var(--dim)" }}>
          {flash}
        </p>
      )}
    </div>
  )
}
