// PROTOTYPE — throwaway. Answers decision-map ticket `layout-finalize`.
// SETTLED GRID (owner): FOUR sections —
//   left  = video rail
//   center= tabbed workspace (Whiteboard default · Character · Rules)
//   right = activity log + dice pool + chat
//   bottom= COLLAPSIBLE FFX-style initiative tracker (portraits of PCs + NPCs),
//           shown in combat, collapsed out of combat.
// No top band (owner: "not reaching for a useful top panel — call it four
// sections"). No action hotbar (owner: no action-combos worth shortcutting).
// NEUTRAL skin on purpose — palette is decided separately (visual-identity).
// Mock data; no Convex. DELETE once absorbed. See docs/ui-direction.md.
import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/prototype/layout-5section")({
  component: Layout5,
})

const VIDEO = ["Vera (ST)", "Arctus", "Mara", "Cassius"]

// tick-based initiative: lower tick = acts sooner (0 = acting now)
const INITIATIVE = [
  { name: "Arctus", tick: 0, you: true, kind: "pc" as const },
  { name: "Ghoul α", tick: 2, kind: "npc" as const },
  { name: "Mara", tick: 3, kind: "pc" as const },
  { name: "Ghoul β", tick: 5, kind: "npc" as const },
  { name: "Cassius", tick: 6, kind: "pc" as const },
]

const LOG = [
  { who: "Vera (ST)", text: "Two ghouls lurch from the vestry.", sys: true },
  { who: "Arctus", text: "Wits + Occult + Prime → 3 ✦", roll: true },
  { who: "Mara", text: "Moving to cover behind the font." },
  { who: "Arctus", text: "Gnosis + Forces (Fireball) → 4 ✦", roll: true },
]

// --- bottom band: FFX-style initiative tracker (portraits), collapsible ---
function InitiativeBand() {
  const sorted = [...INITIATIVE].sort((a, b) => a.tick - b.tick)
  return (
    <div className="flex items-center gap-4 border-t border-neutral-800 bg-neutral-900/60 px-4 py-3">
      <div className="flex shrink-0 flex-col leading-tight">
        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Ticks</span>
        <span className="text-[11px] text-neutral-500">turn order</span>
      </div>
      <div className="relative flex flex-1 items-end gap-3 overflow-x-auto">
        <div className="absolute inset-x-0 bottom-4 h-px bg-neutral-800" />
        {sorted.map((c, i) => (
          <div key={c.name} className="relative flex flex-col items-center">
            {i === 0 && <span className="mb-0.5 text-[9px] font-bold text-amber-500">▶ acting</span>}
            {/* portrait */}
            <div
              className={`grid size-14 place-items-center overflow-hidden rounded-md text-[11px] font-bold ${
                c.tick === 0
                  ? "bg-amber-500 text-neutral-950 ring-2 ring-amber-300"
                  : "bg-neutral-800 text-neutral-300"
              } ${
                c.kind === "npc" ? "ring-1 ring-red-800/70" : "ring-1 ring-emerald-800/60"
              } ${c.you ? "outline outline-1 outline-offset-2 outline-amber-500/50" : ""}`}
              title={`${c.name} · ${c.kind.toUpperCase()}`}
            >
              {/* face placeholder */}
              <span className="opacity-90">{c.name.slice(0, 4)}</span>
            </div>
            <span className={`mt-1 text-[10px] ${c.tick === 0 ? "font-bold text-amber-500" : "text-neutral-500"}`}>
              {c.tick === 0 ? "NOW" : `+${c.tick}`}
            </span>
          </div>
        ))}
        <span className="mb-4 ml-2 shrink-0 text-[11px] italic text-neutral-600">…acts, then re-inserts by action cost (ADR-0001)</span>
      </div>
      <button className="shrink-0 self-start rounded bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700">
        + add combatant
      </button>
    </div>
  )
}

function VideoRail() {
  return (
    <div className="flex w-[150px] shrink-0 flex-col gap-2 border-r border-neutral-800 bg-neutral-900/40 p-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">At the table</span>
      {VIDEO.map((n, i) => (
        <div key={n} className="relative flex aspect-video items-end overflow-hidden rounded bg-neutral-800/70 ring-1 ring-neutral-800">
          <span className="w-full bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 text-[10px] text-neutral-200">
            <span className={`mr-1 inline-block size-1.5 rounded-full ${i < 3 ? "bg-emerald-500" : "bg-neutral-600"}`} />
            {n}
          </span>
        </div>
      ))}
    </div>
  )
}

const TABS = ["Whiteboard", "Character", "Rules"] as const
function CenterTabs() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Whiteboard")
  return (
    <div className="flex min-w-0 flex-1 flex-col p-3">
      <div className="mb-2 flex items-center gap-1 border-b border-neutral-800 pb-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1 text-[13px] ${t === tab ? "bg-amber-500 text-neutral-950" : "text-neutral-300 ring-1 ring-neutral-800"}`}
          >
            {t}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-neutral-600">shared whiteboard · theater-of-mind</span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded ring-1 ring-neutral-800">
        {tab === "Whiteboard" ? (
          <>
            <svg className="absolute inset-0 h-full w-full opacity-20">
              <defs>
                <pattern id="g5" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M32 0H0V32" fill="none" stroke="#a3a3a3" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#g5)" />
            </svg>
            <svg className="absolute inset-0 h-full w-full text-amber-500/70">
              <path d="M120 210 q80 -110 210 -60 t170 80" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="340" cy="175" r="42" fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0.6" />
              <text x="285" y="120" fill="#737373" fontSize="12" fontStyle="italic">the chapel — ward line</text>
            </svg>
            {[["Arctus", 46, 62], ["Mara", 30, 42], ["α", 55, 34]].map(([l, x, y], i) => (
              <div key={i} className="absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-amber-500 text-[10px] font-bold text-neutral-950" style={{ left: `${x}%`, top: `${y}%` }}>
                {String(l).slice(0, 4)}
              </div>
            ))}
          </>
        ) : (
          <div className="grid h-full place-items-center text-sm text-neutral-600">{tab} tab — (unchanged from ui-direction prototype)</div>
        )}
      </div>
    </div>
  )
}

// right rail: activity log + dice pool + chat
function RightRail() {
  const pool = ["Wits 2", "Occult 3", "Prime 2", "+2 rote"]
  return (
    <div className="flex w-[300px] shrink-0 flex-col border-l border-neutral-800 bg-neutral-900/40">
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Chronicle</span>
        {LOG.map((l, i) =>
          l.sys ? (
            <div key={i} className="text-center text-[11px] italic text-neutral-600">— {l.text} —</div>
          ) : l.roll ? (
            <div key={i} className="rounded bg-neutral-800/50 px-2 py-1.5 text-[12px] ring-1 ring-neutral-800">
              <b className="text-neutral-200">{l.who}</b> <span className="text-amber-500">{l.text}</span>
            </div>
          ) : (
            <div key={i} className="text-[13px] text-neutral-300"><b className="text-amber-500">{l.who}</b> {l.text}</div>
          ),
        )}
      </div>
      {/* dice pool builder — moved here from the bottom band */}
      <div className="border-t border-neutral-800 p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Dice pool</span>
          <button className="rounded bg-amber-500 px-3 py-0.5 text-[11px] font-bold text-neutral-950">Roll 7d</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {pool.map((c) => (
            <span key={c} className="rounded-full bg-neutral-800/60 px-2 py-0.5 text-[11px] text-neutral-200 ring-1 ring-neutral-800">{c}</span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-neutral-800 p-2">
        <span className="rounded px-1.5 py-0.5 text-[10px] text-emerald-400 ring-1 ring-neutral-800">public</span>
        <input placeholder="Speak, or /whisper…" className="flex-1 bg-transparent text-[13px] text-neutral-200 outline-none" />
      </div>
    </div>
  )
}

function Layout5() {
  const [combat, setCombat] = useState(true)
  return (
    <div className="flex h-screen w-screen flex-col bg-neutral-950 text-neutral-200">
      <header className="flex shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-900/60 px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold">The Fall of Arctus</h1>
          <span className="text-[11px] text-neutral-500">4-section grid · neutral skin (palette = separate ticket)</span>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-neutral-800 p-0.5 text-[12px]">
          {(["explore", "combat"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setCombat(m === "combat")}
              className={`rounded-full px-3 py-1 ${(m === "combat") === combat ? "bg-amber-500 text-neutral-950" : "text-neutral-300"}`}
            >
              {m === "combat" ? "⚔ Combat" : "🗺 Exploration"}
            </button>
          ))}
        </div>
      </header>

      {/* MIDDLE ROW — left rail | center | right rail */}
      <div className="flex min-h-0 flex-1">
        <VideoRail />
        <CenterTabs />
        <RightRail />
      </div>

      {/* BOTTOM BAND — collapsible initiative tracker (combat only) */}
      {combat ? (
        <InitiativeBand />
      ) : (
        <div className="border-t border-neutral-800 bg-neutral-900/60 px-4 py-1.5 text-[11px] italic text-neutral-600">
          initiative tracker collapsed — no combat in progress
        </div>
      )}
    </div>
  )
}
