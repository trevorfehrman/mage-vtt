// PROTOTYPE — throwaway. Answers decision-map ticket `ui-direction`.
// Three radically-different session-UI directions on ONE route, switchable via
// ?variant=A|B|C and the floating bottom bar. All three share the agreed spine:
// a CENTER TABBED WORKSPACE with the Whiteboard as the default tab (+ Character
// Sheet, + Rules lookup). They differ in (a) where video/presence, the activity
// log, and dice/chat live, and (b) occult visual identity. Mock data only — not
// wired to Convex. DELETE once a direction is chosen; fold the winner into
// SessionLayout. See docs/ui-direction.md for the verdict.
import { useEffect, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

export const Route = createFileRoute("/prototype/ui-direction")({
  validateSearch: (s: Record<string, unknown>) => ({
    variant: (["A", "B", "C"].includes(s.variant as string)
      ? (s.variant as string)
      : "A") as "A" | "B" | "C",
  }),
  component: Prototype,
})

// ---------------------------------------------------------------------------
// Mock data (mirrors real component density without Convex)
// ---------------------------------------------------------------------------
const CHAR = {
  name: "Arctus",
  shadow: "Ashfall",
  path: "Obrimos",
  order: "Adamantine Arrow",
  gnosis: 3,
  wisdom: 6,
  attributes: {
    Intelligence: 3, Wits: 2, Resolve: 3,
    Strength: 2, Dexterity: 3, Stamina: 3,
    Presence: 2, Manipulation: 2, Composure: 4,
  },
  skills: [
    ["Occult", 3], ["Athletics", 2], ["Firearms", 3],
    ["Weaponry", 2], ["Investigation", 2], ["Persuasion", 1],
  ] as const,
  arcana: [["Forces", 3], ["Prime", 2], ["Fate", 1], ["Matter", 1]] as const,
  health: 8, healthBashing: 1, healthLethal: 1,
  willpower: 5, willpowerMax: 7,
  mana: 4, manaMax: 12,
  defense: 2, initiative: 7, speed: 10,
}

const MEMBERS = [
  { name: "Vera (ST)", online: true, st: true },
  { name: "Arctus", online: true, st: false, you: true },
  { name: "Mara", online: true, st: false },
  { name: "Cassius", online: false, st: false },
]

type Activity =
  | { kind: "roll"; who: string; pool: string; dice: number[]; successes: number; exceptional?: boolean }
  | { kind: "msg"; who: string; text: string }
  | { kind: "whisper"; who: string; to: string; text: string }
  | { kind: "system"; text: string }

const FEED: Activity[] = [
  { kind: "system", text: "Vera opened the ward. Combat begins on tick 0." },
  { kind: "msg", who: "Vera (ST)", text: "The ley line under the chapel pulses — you can feel the Mana thrumming." },
  { kind: "roll", who: "Arctus", pool: "Wits + Occult + Prime", dice: [10, 8, 7, 9, 3], successes: 3 },
  { kind: "whisper", who: "Vera (ST)", to: "Arctus", text: "Your Mage Sight catches a second resonance — something older." },
  { kind: "msg", who: "Mara", text: "I move to cover behind the font." },
  { kind: "roll", who: "Arctus", pool: "Gnosis + Forces (Fireball)", dice: [10, 10, 8, 6, 5, 2], successes: 4, exceptional: false },
  { kind: "system", text: "Arctus casts Forces ••• — Paradox risk (vulgar). 2 Paradox dice rolled: 0 successes." },
]

const RULE_HITS = [
  { title: "Paradox", chapter: "Mage 1e · Ch. 2", snippet: "When a mage casts a vulgar spell in front of Sleeper witnesses, roll a number of dice equal to…" },
  { title: "Spending Mana", chapter: "Mage 1e · Ch. 2", snippet: "A mage may spend one Mana per turn per dot of Gnosis. Spending Mana on a ruling Arcanum…" },
  { title: "Exceptional Success", chapter: "WoD Core · Ch. 1", snippet: "Five or more successes on a single roll is an exceptional success, granting a beneficial…" },
]

// ---------------------------------------------------------------------------
// Occult skins — each variant sets these CSS vars on its root
// ---------------------------------------------------------------------------
type Skin = React.CSSProperties & Record<string, string>
const SKIN: Record<"A" | "B" | "C", { name: string; blurb: string; vars: Skin }> = {
  A: {
    name: "Grimoire",
    blurb: "Warm illuminated-manuscript. Book-margin rails around the stage.",
    vars: {
      "--pp-bg": "#150d0b",
      "--pp-panel": "linear-gradient(165deg,#241614,#1b100e)",
      "--pp-ink": "#ecdcb6",
      "--pp-muted": "#a88c6a",
      "--pp-accent": "#c9a24b",
      "--pp-accent2": "#8a3b2e",
      "--pp-line": "rgba(201,162,75,0.22)",
      "--pp-glow": "rgba(201,162,75,0.10)",
      "--pp-head": "'Fraunces', Georgia, serif",
      "--pp-num": "'Fraunces', Georgia, serif",
    },
  },
  B: {
    name: "Astral Console",
    blurb: "Cool arcane HUD. Video ribbon on top, dice command bar on the bottom.",
    vars: {
      "--pp-bg": "#08081a",
      "--pp-panel": "linear-gradient(165deg,#15123a,#0d0b24)",
      "--pp-ink": "#dcd9ff",
      "--pp-muted": "#8a86c4",
      "--pp-accent": "#a78bfa",
      "--pp-accent2": "#67e8f9",
      "--pp-line": "rgba(167,139,250,0.26)",
      "--pp-glow": "rgba(103,232,249,0.12)",
      "--pp-head": "'Fraunces', Georgia, serif",
      "--pp-num": "ui-monospace, 'SF Mono', Menlo, monospace",
    },
  },
  C: {
    name: "Round Table",
    blurb: "Dark & cinematic. Minimal chrome; stage maximized; log in a drawer.",
    vars: {
      "--pp-bg": "#0d1014",
      "--pp-panel": "linear-gradient(165deg,#171d25,#11151b)",
      "--pp-ink": "#d3dae2",
      "--pp-muted": "#7d8894",
      "--pp-accent": "#b08d57",
      "--pp-accent2": "#5b7f86",
      "--pp-line": "rgba(176,141,87,0.20)",
      "--pp-glow": "rgba(176,141,87,0.08)",
      "--pp-head": "'Fraunces', Georgia, serif",
      "--pp-num": "ui-monospace, Menlo, monospace",
    },
  },
}

// ---------------------------------------------------------------------------
// Shared pieces (read colors from --pp-* so each variant re-skins them)
// ---------------------------------------------------------------------------
function Dots({ n, max = 5 }: { n: number; max?: number }) {
  return (
    <span className="inline-flex gap-[3px]">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className="size-[9px] rounded-full"
          style={{
            background: i < n ? "var(--pp-accent)" : "transparent",
            border: "1px solid var(--pp-line)",
            boxShadow: i < n ? "0 0 6px var(--pp-glow)" : "none",
          }}
        />
      ))}
    </span>
  )
}

function Panel({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-lg ${className}`}
      style={{ background: "var(--pp-panel)", border: "1px solid var(--pp-line)", ...style }}
    >
      {children}
    </div>
  )
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em]"
      style={{ color: "var(--pp-accent)" }}
    >
      {children}
    </div>
  )
}

function VideoTile({ m, small }: { m: (typeof MEMBERS)[number]; small?: boolean }) {
  return (
    <div
      className={`relative flex items-end overflow-hidden rounded-md ${small ? "h-16" : "aspect-video"}`}
      style={{
        background: "radial-gradient(120% 120% at 50% 0%, rgba(255,255,255,0.06), transparent 60%), var(--pp-bg)",
        border: "1px solid var(--pp-line)",
        opacity: m.online ? 1 : 0.4,
      }}
    >
      <div className="flex w-full items-center justify-between px-2 py-1 text-[11px]" style={{ color: "var(--pp-ink)" }}>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full" style={{ background: m.online ? "var(--pp-accent2)" : "var(--pp-muted)" }} />
          {m.name}
        </span>
        {m.st && <span style={{ color: "var(--pp-accent)" }}>ST</span>}
      </div>
    </div>
  )
}

function ActivityFeed({ dense }: { dense?: boolean }) {
  return (
    <div className={`flex flex-col ${dense ? "gap-1.5" : "gap-2.5"} text-[13px]`} style={{ color: "var(--pp-ink)" }}>
      {FEED.map((a, i) => {
        if (a.kind === "system")
          return <div key={i} className="text-center text-[11px] italic" style={{ color: "var(--pp-muted)" }}>— {a.text} —</div>
        if (a.kind === "msg")
          return (
            <div key={i}>
              <span className="font-semibold" style={{ color: "var(--pp-accent)" }}>{a.who} </span>
              <span>{a.text}</span>
            </div>
          )
        if (a.kind === "whisper")
          return (
            <div key={i} className="rounded px-2 py-1" style={{ background: "var(--pp-glow)", border: "1px dashed var(--pp-line)" }}>
              <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--pp-accent2)" }}>whisper → {a.to} </span>
              <div><span className="font-semibold" style={{ color: "var(--pp-accent)" }}>{a.who} </span>{a.text}</div>
            </div>
          )
        // roll
        return (
          <div key={i} className="rounded px-2 py-1.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--pp-line)" }}>
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold" style={{ color: "var(--pp-ink)" }}>{a.who}</span>
              <span className="text-[11px]" style={{ color: "var(--pp-muted)" }}>{a.pool}</span>
            </div>
            <div className="flex items-center gap-1">
              {a.dice.map((d, j) => (
                <span
                  key={j}
                  className="grid size-6 place-items-center rounded text-[11px] font-bold"
                  style={{
                    fontFamily: "var(--pp-num)",
                    color: d >= 8 ? "var(--pp-bg)" : "var(--pp-muted)",
                    background: d >= 8 ? "var(--pp-accent)" : "transparent",
                    border: "1px solid var(--pp-line)",
                    boxShadow: d === 10 ? "0 0 8px var(--pp-accent)" : "none",
                  }}
                >
                  {d}
                </span>
              ))}
              <span className="ml-auto text-[13px] font-bold" style={{ color: "var(--pp-accent2)", fontFamily: "var(--pp-num)" }}>
                {a.successes} ✦
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DiceBar({ compact }: { compact?: boolean }) {
  const chips = ["Wits 2", "Occult 3", "Prime 2", "+2 rote"]
  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-2"
      style={{ background: "var(--pp-panel)", border: "1px solid var(--pp-line)" }}
    >
      {!compact && <span className="text-[10px] uppercase tracking-widest" style={{ color: "var(--pp-accent)" }}>Pool</span>}
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((c) => (
          <span key={c} className="rounded-full px-2 py-0.5 text-[11px]" style={{ color: "var(--pp-ink)", background: "var(--pp-glow)", border: "1px solid var(--pp-line)" }}>
            {c}
          </span>
        ))}
      </div>
      <span className="ml-1 text-[13px] font-bold" style={{ color: "var(--pp-ink)", fontFamily: "var(--pp-num)" }}>7d</span>
      <button
        className="ml-auto rounded-md px-3 py-1 text-[12px] font-bold uppercase tracking-wide"
        style={{ color: "var(--pp-bg)", background: "var(--pp-accent)", boxShadow: "0 0 12px var(--pp-glow)" }}
      >
        Roll
      </button>
    </div>
  )
}

function ChatInput() {
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: "var(--pp-bg)", border: "1px solid var(--pp-line)" }}>
      <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ color: "var(--pp-accent2)", border: "1px solid var(--pp-line)" }}>public</span>
      <input
        placeholder="Speak, or /whisper…"
        className="flex-1 bg-transparent text-[13px] outline-none"
        style={{ color: "var(--pp-ink)" }}
      />
    </div>
  )
}

// --- center-workspace tabs (the agreed spine) ---
const TABS = ["Whiteboard", "Character", "Rules"] as const
type Tab = (typeof TABS)[number]

function WhiteboardStage() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg" style={{ background: "var(--pp-bg)", border: "1px solid var(--pp-line)" }}>
      {/* faint grid */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.18]">
        <defs>
          <pattern id="pp-grid" width="34" height="34" patternUnits="userSpaceOnUse">
            <path d="M34 0H0V34" fill="none" stroke="var(--pp-accent)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pp-grid)" />
      </svg>
      {/* sketch strokes */}
      <svg className="absolute inset-0 h-full w-full" style={{ color: "var(--pp-accent)" }}>
        <path d="M120 220 q80 -120 220 -60 t180 90" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
        <circle cx="360" cy="180" r="46" fill="none" stroke="var(--pp-accent2)" strokeWidth="2" opacity="0.6" />
        <text x="300" y="120" fill="var(--pp-muted)" fontSize="13" fontStyle="italic">the chapel — ward line</text>
      </svg>
      {/* tokens */}
      {[["Arctus", 46, 62, true], ["Mara", 30, 40, false], ["✦", 58, 34, false]].map(([label, x, y, you], i) => (
        <div
          key={i}
          className="absolute grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[10px] font-bold"
          style={{
            left: `${x}%`, top: `${y}%`,
            color: "var(--pp-bg)",
            background: you ? "var(--pp-accent)" : "var(--pp-accent2)",
            boxShadow: "0 0 14px var(--pp-glow)",
          }}
        >
          {String(label).slice(0, 4)}
        </div>
      ))}
      {/* toolbar */}
      <div className="absolute left-3 top-3 flex gap-1 rounded-md p-1" style={{ background: "var(--pp-panel)", border: "1px solid var(--pp-line)" }}>
        {["✎", "◻", "⌫", "⊹"].map((t) => (
          <button key={t} className="grid size-7 place-items-center rounded text-[13px]" style={{ color: "var(--pp-ink)" }}>{t}</button>
        ))}
      </div>
      <div className="absolute bottom-3 right-3 text-[11px] italic" style={{ color: "var(--pp-muted)" }}>shared whiteboard · theater-of-mind</div>
    </div>
  )
}

function SheetPanel() {
  return (
    <div className="h-full overflow-y-auto p-1" style={{ color: "var(--pp-ink)" }}>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-2xl" style={{ fontFamily: "var(--pp-head)", color: "var(--pp-ink)" }}>{CHAR.name}</h2>
          <div className="text-[12px]" style={{ color: "var(--pp-muted)" }}>“{CHAR.shadow}” · {CHAR.path} · {CHAR.order}</div>
        </div>
        <div className="flex items-center gap-3 text-[12px]">
          <span>Gnosis <b style={{ fontFamily: "var(--pp-num)", color: "var(--pp-accent)" }}>{CHAR.gnosis}</b></span>
          <span>Wisdom <b style={{ fontFamily: "var(--pp-num)", color: "var(--pp-accent)" }}>{CHAR.wisdom}</b></span>
        </div>
      </div>
      {/* resource meters */}
      <div className="mb-3 grid grid-cols-3 gap-2 text-[12px]">
        {[["Health", CHAR.health, CHAR.health], ["Willpower", CHAR.willpower, CHAR.willpowerMax], ["Mana", CHAR.mana, CHAR.manaMax]].map(([label, cur, max]) => (
          <Panel key={label as string} className="px-2 py-1.5">
            <div style={{ color: "var(--pp-muted)" }}>{label}</div>
            <div style={{ fontFamily: "var(--pp-num)", color: "var(--pp-accent)" }}>{cur} / {max}</div>
          </Panel>
        ))}
      </div>
      <Kicker>Attributes</Kicker>
      <div className="mb-3 grid grid-cols-3 gap-x-4 gap-y-1 text-[12px]">
        {Object.entries(CHAR.attributes).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <span>{k.slice(0, 4)}</span><Dots n={v} />
          </div>
        ))}
      </div>
      <Kicker>Arcana</Kicker>
      <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
        {CHAR.arcana.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <span style={{ color: "var(--pp-accent)" }}>{k}</span><Dots n={v} />
          </div>
        ))}
      </div>
      <Kicker>Skills</Kicker>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
        {CHAR.skills.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <span>{k}</span><Dots n={v} />
          </div>
        ))}
      </div>
    </div>
  )
}

function RulesPanel() {
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col p-1" style={{ color: "var(--pp-ink)" }}>
      <div className="mb-3 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "var(--pp-bg)", border: "1px solid var(--pp-line)" }}>
        <span style={{ color: "var(--pp-accent)" }}>✦</span>
        <input defaultValue="how does paradox work when sleepers watch?" className="flex-1 bg-transparent text-[13px] outline-none" style={{ color: "var(--pp-ink)" }} />
        <button className="rounded px-2 py-0.5 text-[11px] font-bold" style={{ color: "var(--pp-bg)", background: "var(--pp-accent)" }}>Ask</button>
      </div>
      <Panel className="mb-3 p-3 text-[13px] leading-relaxed">
        <Kicker>LLM answer</Kicker>
        Casting a <b>vulgar</b> spell before Sleeper witnesses risks Paradox. Roll Paradox dice
        equal to the spell's dots (reduced by spending Mana or reaching). Any successes become
        Paradox, inflicting resistant Bashing and possibly Havoc… <span style={{ color: "var(--pp-muted)" }}>[Mage 1e, Ch.2]</span>
      </Panel>
      <Kicker>Sources</Kicker>
      <div className="flex flex-col gap-2">
        {RULE_HITS.map((r) => (
          <Panel key={r.title} className="px-3 py-2 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="font-semibold" style={{ color: "var(--pp-accent)" }}>{r.title}</span>
              <span style={{ color: "var(--pp-muted)" }}>{r.chapter}</span>
            </div>
            <div style={{ color: "var(--pp-ink)" }}>{r.snippet}</div>
          </Panel>
        ))}
      </div>
    </div>
  )
}

function CenterWorkspace({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex shrink-0 items-center gap-1 border-b pb-2" style={{ borderColor: "var(--pp-line)" }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="rounded-md px-3 py-1 text-[13px] font-medium"
            style={{
              fontFamily: t === tab ? "var(--pp-head)" : undefined,
              color: t === tab ? "var(--pp-bg)" : "var(--pp-ink)",
              background: t === tab ? "var(--pp-accent)" : "transparent",
              border: "1px solid " + (t === tab ? "transparent" : "var(--pp-line)"),
            }}
          >
            {t}
          </button>
        ))}
        <span className="ml-auto text-[11px]" style={{ color: "var(--pp-muted)" }}>tick 0 · Arctus to act</span>
      </div>
      <div className="min-h-0 flex-1">
        {tab === "Whiteboard" && <WhiteboardStage />}
        {tab === "Character" && <SheetPanel />}
        {tab === "Rules" && <RulesPanel />}
      </div>
    </div>
  )
}

function Presence() {
  return (
    <div className="flex items-center gap-2">
      {MEMBERS.map((m) => (
        <span key={m.name} className="flex items-center gap-1 text-[11px]" style={{ color: "var(--pp-ink)" }}>
          <span className="size-2 rounded-full" style={{ background: m.online ? "var(--pp-accent2)" : "var(--pp-muted)" }} />
          {m.name}
        </span>
      ))}
    </div>
  )
}

function Header({ title }: { title: string }) {
  return (
    <header className="flex shrink-0 items-center justify-between px-4 py-2" style={{ borderBottom: "1px solid var(--pp-line)", background: "var(--pp-panel)" }}>
      <div className="flex items-center gap-4">
        <h1 className="text-lg" style={{ fontFamily: "var(--pp-head)", color: "var(--pp-ink)" }}>{title}</h1>
        <Presence />
      </div>
      <span className="text-[11px]" style={{ color: "var(--pp-muted)", fontFamily: "var(--pp-num)" }}>MAGE-7X2Q</span>
    </header>
  )
}

// ---------------------------------------------------------------------------
// VARIANT A — Grimoire: book-margin rails (video left, log right), center stage
// ---------------------------------------------------------------------------
function VariantA({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div className="flex h-full flex-col" style={{ ...SKIN.A.vars, background: "var(--pp-bg)" }}>
      <Header title="The Fall of Arctus" />
      <div className="grid min-h-0 flex-1 gap-3 p-3" style={{ gridTemplateColumns: "150px 1fr 320px" }}>
        {/* left margin — video PiP + presence */}
        <div className="flex min-h-0 flex-col gap-2">
          <Kicker>At the table</Kicker>
          <div className="flex flex-col gap-2 overflow-y-auto">
            {MEMBERS.map((m) => <VideoTile key={m.name} m={m} small />)}
          </div>
        </div>
        {/* center stage */}
        <Panel className="min-h-0 p-3"><CenterWorkspace tab={tab} setTab={setTab} /></Panel>
        {/* right margin — activity + dice + chat */}
        <div className="flex min-h-0 flex-col gap-2">
          <Panel className="min-h-0 flex-1 overflow-y-auto p-3">
            <Kicker>Chronicle</Kicker>
            <ActivityFeed />
          </Panel>
          <DiceBar />
          <ChatInput />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// VARIANT B — Astral Console: video ribbon on top, stat rail left, feed right,
// dice command bar spanning the bottom (HUD).
// ---------------------------------------------------------------------------
function VariantB({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div className="flex h-full flex-col" style={{ ...SKIN.B.vars, background: "var(--pp-bg)" }}>
      {/* video ribbon */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid var(--pp-line)", background: "var(--pp-panel)" }}>
        <h1 className="mr-2 text-base" style={{ fontFamily: "var(--pp-head)", color: "var(--pp-ink)" }}>Astral Console</h1>
        <div className="flex flex-1 gap-2">
          {MEMBERS.map((m) => (
            <div key={m.name} className="w-28"><VideoTile m={m} small /></div>
          ))}
        </div>
        <span className="text-[11px]" style={{ color: "var(--pp-muted)", fontFamily: "var(--pp-num)" }}>MAGE-7X2Q</span>
      </div>
      <div className="grid min-h-0 flex-1 gap-3 p-3" style={{ gridTemplateColumns: "180px 1fr 300px" }}>
        {/* stat-chip rail */}
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          <Kicker>Arctus</Kicker>
          {[["Gnosis", CHAR.gnosis], ["Health", CHAR.health], ["Willpower", `${CHAR.willpower}/${CHAR.willpowerMax}`], ["Mana", `${CHAR.mana}/${CHAR.manaMax}`], ["Defense", CHAR.defense], ["Initiative", CHAR.initiative]].map(([k, v]) => (
            <Panel key={k as string} className="flex items-center justify-between px-2 py-1.5 text-[12px]">
              <span style={{ color: "var(--pp-muted)" }}>{k}</span>
              <span style={{ color: "var(--pp-accent)", fontFamily: "var(--pp-num)" }}>{v}</span>
            </Panel>
          ))}
          <button className="mt-1 rounded-md py-1.5 text-[12px] font-bold" style={{ color: "var(--pp-bg)", background: "var(--pp-accent)" }}>Open full sheet ▸</button>
        </div>
        {/* center stage */}
        <Panel className="min-h-0 p-3"><CenterWorkspace tab={tab} setTab={setTab} /></Panel>
        {/* feed */}
        <Panel className="min-h-0 overflow-y-auto p-3">
          <Kicker>Feed</Kicker>
          <ActivityFeed dense />
        </Panel>
      </div>
      {/* command bar */}
      <div className="shrink-0 px-3 pb-3"><DiceBar /></div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// VARIANT C — Round Table: minimal chrome, stage maximized. Floating video
// cluster top-right; activity log in a slide-over drawer; compact dice FAB.
// ---------------------------------------------------------------------------
function VariantC({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const [drawer, setDrawer] = useState(false)
  return (
    <div className="relative flex h-full flex-col" style={{ ...SKIN.C.vars, background: "var(--pp-bg)" }}>
      <Header title="The Table" />
      {/* stage fills */}
      <div className="min-h-0 flex-1 p-3">
        <Panel className="h-full p-3"><CenterWorkspace tab={tab} setTab={setTab} /></Panel>
      </div>
      {/* floating video cluster */}
      <div className="absolute right-4 top-16 flex w-40 flex-col gap-2">
        {MEMBERS.filter((m) => m.online).map((m) => <VideoTile key={m.name} m={m} small />)}
      </div>
      {/* compact dice FAB */}
      <div className="absolute bottom-4 left-1/2 w-[min(560px,90%)] -translate-x-1/2">
        <DiceBar />
      </div>
      {/* drawer toggle */}
      <button
        onClick={() => setDrawer((d) => !d)}
        className="absolute right-4 bottom-4 rounded-full px-4 py-2 text-[12px] font-bold"
        style={{ color: "var(--pp-bg)", background: "var(--pp-accent)", boxShadow: "0 0 16px var(--pp-glow)" }}
      >
        {drawer ? "Close log ▸" : "◂ Chronicle"}
      </button>
      {/* slide-over log */}
      {drawer && (
        <div className="absolute right-0 top-0 flex h-full w-80 flex-col gap-2 p-3" style={{ background: "var(--pp-panel)", borderLeft: "1px solid var(--pp-line)" }}>
          <Kicker>Chronicle</Kicker>
          <div className="min-h-0 flex-1 overflow-y-auto"><ActivityFeed /></div>
          <ChatInput />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Switcher + route
// ---------------------------------------------------------------------------
function Switcher({ variant, onSet }: { variant: "A" | "B" | "C"; onSet: (v: "A" | "B" | "C") => void }) {
  if (import.meta.env.PROD) return null
  const order: ("A" | "B" | "C")[] = ["A", "B", "C"]
  const idx = order.indexOf(variant)
  const go = (d: number) => onSet(order[(idx + d + 3) % 3])
  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full px-3 py-2 text-white shadow-2xl"
      style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.15)" }}
    >
      <button onClick={() => go(-1)} className="grid size-7 place-items-center rounded-full hover:bg-white/10">←</button>
      <span className="min-w-[168px] text-center text-[13px]">
        <b>{variant}</b> — {SKIN[variant].name}
      </span>
      <button onClick={() => go(1)} className="grid size-7 place-items-center rounded-full hover:bg-white/10">→</button>
    </div>
  )
}

function Prototype() {
  const { variant } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [tab, setTab] = useState<Tab>("Whiteboard")

  const setVariant = (v: "A" | "B" | "C") => navigate({ search: { variant: v } })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el && ["INPUT", "TEXTAREA"].includes(el.tagName)) return
      const order: ("A" | "B" | "C")[] = ["A", "B", "C"]
      const idx = order.indexOf(variant)
      if (e.key === "ArrowLeft") setVariant(order[(idx + 2) % 3])
      if (e.key === "ArrowRight") setVariant(order[(idx + 1) % 3])
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return (
    <div className="h-screen w-screen overflow-hidden">
      {variant === "A" && <VariantA tab={tab} setTab={setTab} />}
      {variant === "B" && <VariantB tab={tab} setTab={setTab} />}
      {variant === "C" && <VariantC tab={tab} setTab={setTab} />}
      <Switcher variant={variant} onSet={setVariant} />
    </div>
  )
}
