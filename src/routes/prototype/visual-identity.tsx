// PROTOTYPE — throwaway. Answers decision-map ticket `visual-identity`.
// ITERATION 2 (from owner feedback on the stone/abyss pass):
//   - base = Abyssal dark, KEEP the dark theme
//   - NO static/noise texture (headache), NO glitch-on-text (must stay readable)
//   - NO neon gradient (read as "synthwave, not arcane") → single muted, AGED accent
//   - typography → arcane: Cormorant (high-contrast occult serif) display
// Remaining taste call = which arcane accent → switch swatches via ?accent= .
// Mock data; no Convex. DELETE once a palette is chosen → src/styles.css tokens.
import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

const ACCENTS = {
  verdigris: { name: "Verdigris", accent: "#6fae97", dim: "#3c6b5c", line: "#20302b", glow: "rgba(111,174,151,.13)" },
  amethyst: { name: "Tarnished Amethyst", accent: "#9a86c4", dim: "#574a72", line: "#272232", glow: "rgba(154,134,196,.14)" },
  oxblood: { name: "Oxblood", accent: "#b56d60", dim: "#6e3f39", line: "#2f2320", glow: "rgba(181,109,96,.14)" },
  bone: { name: "Bone Gold", accent: "#cdbd94", dim: "#7c7257", line: "#2b2820", glow: "rgba(205,189,148,.12)" },
} as const
type AccentKey = keyof typeof ACCENTS

export const Route = createFileRoute("/prototype/visual-identity")({
  validateSearch: (s: Record<string, unknown>) => ({
    accent: (Object.keys(ACCENTS).includes(s.accent as string) ? (s.accent as AccentKey) : "verdigris") as AccentKey,
  }),
  component: VisualIdentity,
})

const VIDEO = ["Vera (ST)", "Arctus", "Mara", "Cassius"]
const INITIATIVE = [
  { name: "Arctus", tick: 0, you: true, kind: "pc" as const },
  { name: "Ghoul α", tick: 2, kind: "npc" as const },
  { name: "Mara", tick: 3, kind: "pc" as const },
  { name: "Ghoul β", tick: 5, kind: "npc" as const },
  { name: "Cassius", tick: 6, kind: "pc" as const },
]
const LOG = [
  { who: "Vera (ST)", text: "Two ghouls lurch from the vestry.", sys: true },
  { who: "Arctus", text: "Wits + Occult + Prime → 3 successes", roll: true },
  { who: "Mara", text: "Moving to cover behind the font." },
  { who: "Arctus", text: "Gnosis + Forces (Fireball) → 4 successes", roll: true },
]

// Dark void base is fixed; only the aged accent swaps. No gradients, no noise.
const CSS = `
.vi-root{min-height:100vh;height:100vh;display:flex;flex-direction:column;position:relative;overflow:hidden;
  --bg:#08080b;--panel:#100f14;--raise:#17151d;--ink:#d3ccdb;--dim:#7a7386;
  color:var(--ink);
  font-family:'Manrope',ui-sans-serif,system-ui,sans-serif;
  background:
    radial-gradient(120% 90% at 50% -10%, var(--glow), transparent 45%),
    radial-gradient(140% 120% at 50% 120%, rgba(0,0,0,.55), transparent 55%),
    #08080b;
}
/* soft vignette — crisp, not fuzzy */
.vi-root::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:2;
  box-shadow:inset 0 0 220px 40px rgba(0,0,0,.6)}
.vi-layer{position:relative;z-index:1;display:flex;flex-direction:column;height:100%}
.vi-panel{background:var(--panel);border:1px solid var(--line)}
.vi-h{font-family:'Cormorant',Georgia,serif;font-weight:600;letter-spacing:.02em;color:var(--ink);margin:0}
.vi-eyebrow{font-family:'Space Grotesk',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.24em;font-size:9px;color:var(--dim)}
.vi-rule{height:1px;background:linear-gradient(90deg,var(--accent),transparent);opacity:.5}
.vi-btn{font-family:'Space Grotesk',monospace;text-transform:uppercase;letter-spacing:.08em;
  color:var(--ink);background:var(--raise);border:1px solid var(--line)}
.vi-btn:hover{border-color:var(--accent);color:#fff}
.vi-active{background:var(--accent)!important;color:#0a0a0c!important;border-color:var(--accent)!important;
  box-shadow:0 0 14px var(--glow)!important}
.vi-accent{color:var(--accent)}
.vi-data{font-family:'Space Grotesk',monospace}
`

// the signature mark — a pentacle sigil, drawn crisply (no glitch)
function Sigil({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" stroke="currentColor" strokeWidth="1">
      <circle cx="20" cy="20" r="17" />
      <path d="M20 4 L29.4 33 L4.6 15 H35.4 L10.6 33 Z" strokeLinejoin="round" opacity=".85" />
    </svg>
  )
}

function InitiativeBand() {
  const sorted = [...INITIATIVE].sort((a, b) => a.tick - b.tick)
  return (
    <div className="vi-panel flex items-center gap-4 border-x-0 border-b-0 px-4 py-3">
      <div className="flex shrink-0 flex-col leading-tight">
        <span className="vi-eyebrow">Ticks</span>
        <span className="text-[11px]" style={{ color: "var(--dim)" }}>turn order</span>
      </div>
      <div className="relative flex flex-1 items-end gap-3 overflow-x-auto">
        {sorted.map((c, i) => (
          <div key={c.name} className="relative flex flex-col items-center">
            {i === 0 && <span className="vi-eyebrow mb-0.5 vi-accent">acting</span>}
            <div
              className={`vi-panel vi-data grid size-14 place-items-center overflow-hidden rounded-[3px] text-[11px] font-bold ${c.tick === 0 ? "vi-active" : ""}`}
              style={{
                outline: c.you ? "1px solid var(--accent)" : undefined,
                outlineOffset: "2px",
                // NPCs read as "other" via a desaturated red-tinted border — crisp, legible
                borderColor: c.kind === "npc" ? "#3a2622" : undefined,
                opacity: c.kind === "npc" ? 0.9 : 1,
              }}
              title={`${c.name} · ${c.kind.toUpperCase()}`}
            >
              {c.name.slice(0, 4)}
            </div>
            <span className="vi-data mt-1 text-[10px]" style={{ color: c.tick === 0 ? "var(--accent)" : "var(--dim)" }}>
              {c.tick === 0 ? "NOW" : `+${c.tick}`}
            </span>
          </div>
        ))}
        <span className="mb-4 ml-2 shrink-0 text-[11px] italic" style={{ color: "var(--dim)" }}>…re-inserts by action cost (ADR-0001)</span>
      </div>
    </div>
  )
}

function VideoRail() {
  return (
    <div className="vi-panel flex w-[150px] shrink-0 flex-col gap-2 border-y-0 border-l-0 p-2">
      <span className="vi-eyebrow">At the table</span>
      {VIDEO.map((n, i) => (
        <div key={n} className="vi-panel relative flex aspect-video items-end overflow-hidden">
          <span className="w-full bg-gradient-to-t from-black/75 to-transparent px-1.5 py-1 text-[10px]" style={{ color: "var(--ink)" }}>
            <span className="mr-1 inline-block size-1.5 rounded-full" style={{ background: i < 3 ? "var(--accent)" : "var(--dim)" }} />
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
      <div className="mb-2 flex items-center gap-1.5 border-b pb-2" style={{ borderColor: "var(--line)" }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`vi-btn rounded-[3px] px-3 py-1 text-[12px] ${t === tab ? "vi-active" : ""}`}>{t}</button>
        ))}
        <span className="ml-auto text-[11px] italic" style={{ color: "var(--dim)" }}>shared whiteboard · theater-of-mind</span>
      </div>
      <div className="vi-panel relative min-h-0 flex-1 overflow-hidden">
        {tab === "Whiteboard" ? (
          <>
            {/* faint crisp sigil watermark — arcane, not fuzzy */}
            <Sigil className="pointer-events-none absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2 vi-accent" />
            <svg className="absolute inset-0 h-full w-full" style={{ opacity: 0.1 }}>
              <defs><pattern id="vg" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M34 0H0V34" fill="none" stroke="var(--ink)" strokeWidth="0.5" /></pattern></defs>
              <rect width="100%" height="100%" fill="url(#vg)" />
            </svg>
            <svg className="absolute inset-0 h-full w-full vi-accent">
              <path d="M120 210 q80 -110 210 -60 t170 80" fill="none" stroke="currentColor" strokeWidth="2" opacity=".65" />
              <text x="285" y="120" fill="var(--dim)" fontSize="12" fontStyle="italic" fontFamily="Manrope">the chapel — ward line</text>
            </svg>
            {[["Arctus", 46, 62], ["Mara", 30, 42], ["α", 55, 34]].map(([l, x, y], i) => (
              <div key={i} className="vi-active vi-data absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[10px] font-bold" style={{ left: `${x}%`, top: `${y}%` }}>{String(l).slice(0, 4)}</div>
            ))}
          </>
        ) : (
          <div className="grid h-full place-items-center text-sm" style={{ color: "var(--dim)" }}>{tab} tab</div>
        )}
      </div>
    </div>
  )
}

function RightRail() {
  const pool = ["Wits 2", "Occult 3", "Prime 2", "+2 rote"]
  return (
    <div className="vi-panel flex w-[300px] shrink-0 flex-col border-y-0 border-r-0">
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        <span className="vi-eyebrow">Chronicle</span>
        {LOG.map((l, i) =>
          l.sys ? (
            <div key={i} className="text-center text-[11px] italic" style={{ color: "var(--dim)" }}>— {l.text} —</div>
          ) : l.roll ? (
            <div key={i} className="vi-panel rounded-[3px] px-2 py-1.5 text-[12px]"><b style={{ color: "var(--ink)" }}>{l.who}</b> <span className="vi-accent">{l.text}</span></div>
          ) : (
            <div key={i} className="text-[13px]" style={{ color: "var(--ink)" }}><b className="vi-accent">{l.who}</b> {l.text}</div>
          ),
        )}
        {/* signature: Paradox — crisp accented warning, NO glitch on text */}
        <div className="rounded-[3px] px-2 py-1.5" style={{ border: "1px solid var(--line)", background: "var(--glow)" }}>
          <div className="flex items-center gap-1.5">
            <Sigil className="size-3.5 vi-accent" />
            <span className="vi-eyebrow vi-accent">Paradox · 2</span>
          </div>
          <div className="vi-h mt-0.5 text-[15px]" style={{ color: "var(--ink)" }}>Reality frays</div>
          <div className="text-[11px]" style={{ color: "var(--dim)" }}>vulgar magic witnessed by Sleepers</div>
        </div>
      </div>
      <div className="border-t p-2" style={{ borderColor: "var(--line)" }}>
        <div className="mb-1 flex items-center justify-between">
          <span className="vi-eyebrow">Dice pool</span>
          <button className="vi-btn vi-active rounded-[3px] px-3 py-0.5 text-[11px]">Roll 7d</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {pool.map((c) => (
            <span key={c} className="vi-panel rounded-full px-2 py-0.5 text-[11px]" style={{ color: "var(--ink)" }}>{c}</span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t p-2" style={{ borderColor: "var(--line)" }}>
        <span className="vi-accent rounded-[3px] px-1.5 py-0.5 text-[10px]" style={{ border: "1px solid var(--line)" }}>public</span>
        <input placeholder="Speak, or /whisper…" className="flex-1 bg-transparent text-[13px] outline-none" style={{ color: "var(--ink)" }} />
      </div>
    </div>
  )
}

function VisualIdentity() {
  const { accent } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [combat, setCombat] = useState(true)
  const a = ACCENTS[accent]

  return (
    <div className="vi-root" style={{ ["--accent" as string]: a.accent, ["--dim2" as string]: a.dim, ["--line" as string]: a.line, ["--glow" as string]: a.glow }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant:wght@500;600;700&family=Manrope:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;700&display=swap" />
      <style>{CSS}</style>

      <div className="vi-layer">
        <header className="vi-panel flex shrink-0 items-center justify-between border-x-0 border-t-0 px-4 py-2">
          <div className="flex items-center gap-3">
            <Sigil className="size-6 vi-accent" />
            <h1 className="vi-h text-2xl">The Fall of Arctus</h1>
            <span className="text-[11px]" style={{ color: "var(--dim)" }}>Abyssal · {a.name}</span>
          </div>
          <div className="flex overflow-hidden rounded-[3px]" style={{ border: "1px solid var(--line)" }}>
            {(["explore", "combat"] as const).map((m) => (
              <button key={m} onClick={() => setCombat(m === "combat")} className={`vi-btn rounded-none border-0 px-3 py-1 text-[12px] ${(m === "combat") === combat ? "vi-active" : ""}`}>
                {m === "combat" ? "Combat" : "Exploration"}
              </button>
            ))}
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <VideoRail />
          <CenterTabs />
          <RightRail />
        </div>

        {combat ? (
          <InitiativeBand />
        ) : (
          <div className="vi-panel border-x-0 border-b-0 px-4 py-1.5 text-[11px] italic" style={{ color: "var(--dim)" }}>initiative tracker collapsed — no combat in progress</div>
        )}
      </div>

      {/* accent swatch switcher */}
      {!import.meta.env.PROD && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-3 py-2 text-white shadow-2xl" style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,.18)" }}>
          <span className="text-[11px] text-neutral-400">accent:</span>
          {(Object.keys(ACCENTS) as AccentKey[]).map((k) => (
            <button
              key={k}
              onClick={() => navigate({ search: { accent: k } })}
              title={ACCENTS[k].name}
              className={`size-6 rounded-full ${k === accent ? "ring-2 ring-white" : "ring-1 ring-white/30"}`}
              style={{ background: ACCENTS[k].accent }}
            />
          ))}
          <span className="ml-1 text-[12px]">{a.name}</span>
        </div>
      )}
    </div>
  )
}
