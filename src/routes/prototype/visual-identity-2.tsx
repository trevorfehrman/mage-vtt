// PROTOTYPE — throwaway. Answers decision-map ticket `visual-identity` (Pass 4).
//
// Pass 3 read as "competent but generic dark UI." Owner's steer for this pass:
//   - Distinctiveness must come from Mage's OWN iconography used FUNCTIONALLY,
//     not from piled-on ornament ("we can't go nuts and clutter the UI").
//   - Atmosphere = considered & RESTRAINED: watermarks behind text only,
//     legibility absolute. No neon, no gradient-on-text, no static.
//   - Synthesize the strongest idea from all three explored territories:
//       Astral Cartography → the Supernal compass hero moment (behind whiteboard)
//       Alchemical Instrument → the ten Arcana as a functional glyph icon-set
//       Atlantean Codex → one illuminated drop-cap + ceremonial caps + Order seal
//   - Rethink typography (Cormorant rejected): switch Marcellus / Cinzel / Fraunces.
//
// Switchers (dev-only, bottom center): ?accent= and ?display= .
// Mock data; no Convex. DELETE once chosen → src/styles.css tokens.
import { useState, type CSSProperties, type ReactNode } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

const ACCENTS = {
  verdigris: { name: "Verdigris", accent: "#6fae97", dim: "#3c6b5c", line: "#1e2b27", glow: "rgba(111,174,151,.12)" },
  amethyst: { name: "Tarnished Amethyst", accent: "#9a86c4", dim: "#574a72", line: "#262232", glow: "rgba(154,134,196,.13)" },
  oxblood: { name: "Oxblood", accent: "#b56d60", dim: "#6e3f39", line: "#2c2220", glow: "rgba(181,109,96,.13)" },
  bone: { name: "Bone Gold", accent: "#cdbd94", dim: "#7c7257", line: "#282520", glow: "rgba(205,189,148,.11)" },
} as const
type AccentKey = keyof typeof ACCENTS

const DISPLAYS = {
  marcellus: { name: "Marcellus", stack: "'Marcellus', Georgia, serif" },
  cinzel: { name: "Cinzel", stack: "'Cinzel', Georgia, serif" },
  fraunces: { name: "Fraunces", stack: "'Fraunces', Georgia, serif" },
} as const
type DisplayKey = keyof typeof DISPLAYS

export const Route = createFileRoute("/prototype/visual-identity-2")({
  validateSearch: (s: Record<string, unknown>) => ({
    accent: (Object.keys(ACCENTS).includes(s.accent as string) ? (s.accent as AccentKey) : "verdigris") as AccentKey,
    display: (Object.keys(DISPLAYS).includes(s.display as string) ? (s.display as DisplayKey) : "marcellus") as DisplayKey,
  }),
  component: VisualIdentity,
})

// ── The ten Arcana, drawn as a coherent set of clean geometric line-glyphs ──
// Original interpretations (not book art): each is a single-color 24×24 line
// mark, distinct at 14px, driven by the Arcanum's thematic motif. This IS the
// distinctiveness — Mage's own symbol system used as a functional icon language.
type Arc =
  | "death" | "fate" | "forces" | "life" | "matter"
  | "mind" | "prime" | "space" | "spirit" | "time"

// HYBRID grammar (owner's call): legible geometric skeleton + one calligraphic
// signature each — an inward spiral terminal, a barbed point, or a solid
// punctuating "bindi" dot — so the set reads as Mage brush-runes, not generic
// sacred-geometry, without sacrificing legibility at 14–16px. Motifs per the
// canonical grammar in docs/mage-iconography.md.
const ARCANA: Record<Arc, ReactNode> = {
  // entropy — a barbed hook closing into an inward whirlpool spiral
  death: <><path d="M6 5 L8.4 6 M6 5 L6.6 7.6" /><path d="M6 5 C7 13.5 17.5 15.5 17.5 9.5 C17.5 6 12.5 6 12.5 10 C12.5 12.6 15.6 12.6 15.8 10.4" /></>,
  // destiny — a wishbone fork, its right horn curling to a spiral tail
  fate: <><path d="M12 20 L8.2 8.4 M8.2 8.4 L6.9 9.6 M8.2 8.4 L9.6 9" /><path d="M12 20 L15.4 10.4 C16.2 7.4 12.9 6.9 13.3 9.6" /></>,
  // energy — a tomoe comma swirling around a solid nucleus
  forces: <><path d="M15.2 7 L13.6 5.6 M15.2 7 L17 6.3" /><path d="M15.2 7 C9.5 6.6 6.8 11.6 10.6 14.8 C13.6 17.2 16.8 14.2 15.4 11.4" /><circle cx="12.4" cy="11.4" r="1.7" fill="currentColor" stroke="none" /></>,
  // the vesica seed with a living bindi at its heart
  life: <><path d="M12 4 C6.5 9 6.5 15 12 20 C17.5 15 17.5 9 12 4 Z" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /></>,
  // solid matter — an isometric cube studded on its top face
  matter: <><path d="M12 3 L21 8 V16 L12 21 L3 16 V8 Z" /><path d="M12 3 V11 M12 11 L21 8 M12 11 L3 8" /><circle cx="12" cy="6.6" r="1.1" fill="currentColor" stroke="none" /></>,
  // thought — ripples rising from a single point
  mind: <><circle cx="12" cy="13" r="1.5" fill="currentColor" stroke="none" /><path d="M6.7 13 A5.3 5.3 0 0 1 17.3 13" /><path d="M3.7 13 A8.3 8.3 0 0 1 20.3 13" /></>,
  // the supernal source — a radiant star crowning a looped source-staff
  prime: <><circle cx="12" cy="3.6" r="1.2" fill="currentColor" stroke="none" /><path d="M12 5.4 V6.2 M9.9 3.6 H10.7 M13.3 3.6 H14.1" /><path d="M7 8 H17" /><path d="M12 8 V16" /><path d="M12 16 C9.2 16 9.2 20 12 20 C14.8 20 14.8 16 12 16 Z" /></>,
  // folded space — a square holding a turned square around a focal mote
  space: <><rect x="4" y="4" width="16" height="16" /><path d="M12 4 L20 12 L12 20 L4 12 Z" /><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" /></>,
  // the veil — a gateway with an orbiting soul-mote
  spirit: <><circle cx="11" cy="12" r="7.5" /><path d="M11 4.5 V19.5" /><path d="M4.5 12 H17.5" opacity=".5" /><circle cx="21" cy="6.5" r="1.4" fill="currentColor" stroke="none" /></>,
  // recurrence — an hourglass whose stream curls into a spiral, pivot at now
  time: <><path d="M6.5 4 H17.5 L6.5 20 H17.5" /><path d="M17.5 20 C19.6 20 19.6 17.4 17.8 17.7" /><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" /></>,
}

function Glyph({ arc, className = "", size = 14, style }: { arc: Arc; className?: string; size?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {ARCANA[arc]}
    </svg>
  )
}

// ── The Pentacle: the five Atlantean orders as the app-mark (a clean pentagram
// in its circle). Replaces the plain sigil. Crisp, single stroke.
function Pentacle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round">
      <circle cx="20" cy="20" r="17.5" opacity=".55" />
      <path d="M20 4.5 L25.9 33 L3 15 H37 L14.1 33 Z" opacity=".9" />
    </svg>
  )
}

// ── The Supernal compass — the hero moment. A faint astrolabe behind the
// whiteboard: five Watchtower points around the wheel, degree ticks, concentric
// rings. Crisp thin lines, low opacity — atmosphere that never touches text.
const WATCHTOWERS = [
  { path: "Obrimos", realm: "the Aether" },
  { path: "Mastigos", realm: "Pandemonium" },
  { path: "Moros", realm: "Stygia" },
  { path: "Thyrsus", realm: "the Primal Wild" },
  { path: "Acanthus", realm: "Arcadia" },
]
function SupernalCompass({ className = "" }: { className?: string }) {
  // round trig output so SSR (Node) and client (Chrome) serialize identically —
  // otherwise ULP differences in Math.cos/sin trip a hydration mismatch.
  const r = (n: number) => Math.round(n * 100) / 100
  const cx = 200, cy = 200, R = 168
  const pts = WATCHTOWERS.map((w, i) => {
    const a = (-90 + i * 72) * (Math.PI / 180)
    return { ...w, x: r(cx + R * Math.cos(a)), y: r(cy + R * Math.sin(a)) }
  })
  return (
    <svg viewBox="0 0 400 400" className={className} fill="none" stroke="currentColor">
      <circle cx={cx} cy={cy} r={R} strokeWidth="1" />
      <circle cx={cx} cy={cy} r={R - 22} strokeWidth=".6" opacity=".7" />
      <circle cx={cx} cy={cy} r={64} strokeWidth=".6" opacity=".7" />
      {/* degree ticks around the rim */}
      {Array.from({ length: 72 }).map((_, i) => {
        const a = (i * 5) * (Math.PI / 180)
        const r1 = R, r2 = R - (i % 3 === 0 ? 10 : 5)
        return <line key={i} x1={r(cx + r1 * Math.cos(a))} y1={r(cy + r1 * Math.sin(a))} x2={r(cx + r2 * Math.cos(a))} y2={r(cy + r2 * Math.sin(a))} strokeWidth=".6" opacity=".6" />
      })}
      {/* pentagram binding the five Watchtowers */}
      <path d={`M${pts[0].x} ${pts[0].y} L${pts[2].x} ${pts[2].y} L${pts[4].x} ${pts[4].y} L${pts[1].x} ${pts[1].y} L${pts[3].x} ${pts[3].y} Z`} strokeWidth="1" opacity=".85" />
      {pts.map((p) => (
        <g key={p.path}>
          <line x1={cx} y1={cy} x2={p.x} y2={p.y} strokeWidth=".5" opacity=".4" />
          <circle cx={p.x} cy={p.y} r="3.2" strokeWidth="1" />
        </g>
      ))}
    </svg>
  )
}

const VIDEO = ["Vera (ST)", "Arctus", "Mara", "Cassius"]
const INITIATIVE = [
  { name: "Arctus", tick: 0, you: true, kind: "pc" as const },
  { name: "Ghoul α", tick: 2, kind: "npc" as const },
  { name: "Mara", tick: 3, kind: "pc" as const },
  { name: "Ghoul β", tick: 5, kind: "npc" as const },
  { name: "Cassius", tick: 6, kind: "pc" as const },
]
const LOG = [
  { who: "Vera (ST)", text: "Two ghouls lurch from the vestry, reeking of the Lead Coin.", sys: true },
  { who: "Arctus", text: "Wits + Occult + Prime → 3 successes", roll: true, arc: ["prime"] as Arc[] },
  { who: "Mara", text: "Moving to cover behind the font." },
  { who: "Arctus", text: "Gnosis + Forces (Fireball) → 4 successes", roll: true, arc: ["forces"] as Arc[] },
]

function InitiativeBand() {
  const sorted = [...INITIATIVE].sort((a, b) => a.tick - b.tick)
  return (
    <div className="vi-panel vi-cornered flex items-center gap-4 border-x-0 border-b-0 px-4 py-3">
      <div className="flex shrink-0 flex-col leading-tight">
        <span className="vi-eyebrow">Ticks</span>
        <span className="vi-data text-[11px]" style={{ color: "var(--dim)" }}>turn order</span>
      </div>
      <div className="relative flex flex-1 items-end gap-3 overflow-x-auto">
        {sorted.map((c, i) => (
          <div key={c.name} className="relative flex flex-col items-center">
            {i === 0 && <span className="vi-eyebrow vi-accent mb-0.5">acting</span>}
            <div
              className={`vi-panel vi-data grid size-14 place-items-center overflow-hidden rounded-[2px] text-[11px] font-bold ${c.tick === 0 ? "vi-active" : ""}`}
              style={{
                outline: c.you ? "1px solid var(--accent)" : undefined,
                outlineOffset: "2px",
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
        <span className="vi-data mb-4 ml-2 shrink-0 text-[11px] italic" style={{ color: "var(--dim)" }}>…re-inserts by action cost (ADR-0001)</span>
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
          <button key={t} onClick={() => setTab(t)} className={`vi-btn rounded-[2px] px-3 py-1 text-[12px] ${t === tab ? "vi-active" : ""}`}>{t}</button>
        ))}
        <span className="vi-data ml-auto text-[11px] italic" style={{ color: "var(--dim)" }}>shared whiteboard · theater-of-mind</span>
      </div>
      <div className="vi-panel vi-cornered relative min-h-0 flex-1 overflow-hidden">
        {tab === "Whiteboard" ? (
          <>
            {/* HERO MOMENT — the Supernal compass, faint and crisp, behind content */}
            <SupernalCompass className="pointer-events-none absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 vi-accent" />
            <div className="pointer-events-none absolute inset-0" style={{ opacity: 0.12 }}>
              <svg className="h-full w-full">
                <defs><pattern id="vg2" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M34 0H0V34" fill="none" stroke="var(--ink)" strokeWidth="0.5" /></pattern></defs>
                <rect width="100%" height="100%" fill="url(#vg2)" />
              </svg>
            </div>
            <svg className="absolute inset-0 h-full w-full vi-accent">
              <path d="M120 210 q80 -110 210 -60 t170 80" fill="none" stroke="currentColor" strokeWidth="2" opacity=".6" />
              <text x="285" y="120" fill="var(--dim)" fontSize="12" fontStyle="italic" fontFamily="Manrope">the chapel — ward line</text>
            </svg>
            {[["Arctus", 46, 62], ["Mara", 30, 42], ["α", 55, 34]].map(([l, x, y], i) => (
              <div key={i} className="vi-active vi-data absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[10px] font-bold" style={{ left: `${x}%`, top: `${y}%` }}>{String(l).slice(0, 4)}</div>
            ))}
          </>
        ) : tab === "Character" ? (
          <ArcanaLegend />
        ) : (
          <div className="grid h-full place-items-center text-sm" style={{ color: "var(--dim)" }}>{tab} tab</div>
        )}
      </div>
    </div>
  )
}

// Shows the functional glyph language in one place (stand-in for the sheet's
// Arcana row) — this is the icon set that appears on dice, rolls, and spells.
const ARC_ORDER: { arc: Arc; name: string; dots: number }[] = [
  { arc: "death", name: "Death", dots: 0 }, { arc: "fate", name: "Fate", dots: 1 },
  { arc: "forces", name: "Forces", dots: 3 }, { arc: "life", name: "Life", dots: 0 },
  { arc: "matter", name: "Matter", dots: 1 }, { arc: "mind", name: "Mind", dots: 2 },
  { arc: "prime", name: "Prime", dots: 2 }, { arc: "space", name: "Space", dots: 0 },
  { arc: "spirit", name: "Spirit", dots: 1 }, { arc: "time", name: "Time", dots: 0 },
]
function ArcanaLegend() {
  return (
    <div className="flex h-full flex-col p-6">
      <span className="vi-eyebrow">The Arcana</span>
      <h3 className="vi-h mt-1 text-2xl">Arctus · Obrimos of the Mysterium</h3>
      <div className="mt-5 grid grid-cols-2 gap-x-10 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {ARC_ORDER.map((a) => (
          <div key={a.arc} className="flex items-center gap-3">
            <Glyph arc={a.arc} size={22} className={a.dots ? "vi-accent" : ""} style={{ opacity: a.dots ? 1 : 0.35 }} />
            <div className="flex flex-col leading-tight">
              <span className="text-[13px]" style={{ color: a.dots ? "var(--ink)" : "var(--dim)" }}>{a.name}</span>
              <span className="vi-data text-[10px]" style={{ color: "var(--dim)" }}>{"●".repeat(a.dots)}{"○".repeat(5 - a.dots)}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="vi-data mt-auto text-[11px] italic" style={{ color: "var(--dim)" }}>
        The same glyphs mark every roll, spell, and rote across the app.
      </p>
    </div>
  )
}

function RightRail() {
  const pool: { label: string; arc?: Arc }[] = [
    { label: "Wits 2" }, { label: "Occult 3" }, { label: "Prime 2", arc: "prime" }, { label: "+2 rote" },
  ]
  return (
    <div className="vi-panel flex w-[300px] shrink-0 flex-col border-y-0 border-r-0">
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        <span className="vi-eyebrow">Chronicle</span>
        {LOG.map((l, i) =>
          l.sys ? (
            // illuminated drop-cap — the single Codex flourish, restrained
            <div key={i} className="flex gap-2 py-1" style={{ color: "var(--dim)" }}>
              <span className="vi-h shrink-0 text-[34px] leading-[0.8] vi-accent" style={{ marginTop: "2px" }}>{l.text.charAt(0)}</span>
              <span className="text-[12px] italic">{l.text.slice(1)}</span>
            </div>
          ) : l.roll ? (
            <div key={i} className="vi-panel flex items-center gap-2 rounded-[2px] px-2 py-1.5 text-[12px]">
              {l.arc?.map((a) => <Glyph key={a} arc={a} size={15} className="vi-accent shrink-0" />)}
              <span><b style={{ color: "var(--ink)" }}>{l.who}</b> <span className="vi-accent">{l.text}</span></span>
            </div>
          ) : (
            <div key={i} className="text-[13px]" style={{ color: "var(--ink)" }}><b className="vi-accent">{l.who}</b> {l.text}</div>
          ),
        )}
        {/* Paradox — crisp accented warning, Prime glyph, no glitch */}
        <div className="vi-cornered rounded-[2px] px-2 py-1.5" style={{ border: "1px solid var(--line)", background: "var(--glow)" }}>
          <div className="flex items-center gap-1.5">
            <Glyph arc="prime" size={14} className="vi-accent" />
            <span className="vi-eyebrow vi-accent">Paradox · 2</span>
          </div>
          <div className="vi-h mt-0.5 text-[15px]" style={{ color: "var(--ink)" }}>Reality frays</div>
          <div className="vi-data text-[11px]" style={{ color: "var(--dim)" }}>vulgar magic witnessed by Sleepers</div>
        </div>
      </div>
      {/* instrument-style resource readouts */}
      <div className="flex items-center gap-4 border-t px-3 py-1.5" style={{ borderColor: "var(--line)" }}>
        <span className="vi-data text-[11px]" style={{ color: "var(--dim)" }}>MANA <span style={{ color: "var(--accent)" }}>◆◆◆</span>◇◇</span>
        <span className="vi-data text-[11px]" style={{ color: "var(--dim)" }}>GNOSIS <span style={{ color: "var(--ink)" }}>3</span></span>
        <span className="vi-data text-[11px]" style={{ color: "var(--dim)" }}>WILL <span style={{ color: "var(--ink)" }}>5</span></span>
      </div>
      <div className="border-t p-2" style={{ borderColor: "var(--line)" }}>
        <div className="mb-1 flex items-center justify-between">
          <span className="vi-eyebrow">Dice pool</span>
          <button className="vi-btn vi-active rounded-[2px] px-3 py-0.5 text-[11px]">Roll 7d</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {pool.map((c) => (
            <span key={c.label} className="vi-panel flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ color: "var(--ink)" }}>
              {c.arc && <Glyph arc={c.arc} size={12} className="vi-accent" />}{c.label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t p-2" style={{ borderColor: "var(--line)" }}>
        <span className="vi-accent rounded-[2px] px-1.5 py-0.5 text-[10px]" style={{ border: "1px solid var(--line)" }}>public</span>
        <input placeholder="Speak, or /whisper…" className="flex-1 bg-transparent text-[13px] outline-none" style={{ color: "var(--ink)" }} />
      </div>
    </div>
  )
}

function VisualIdentity() {
  const { accent, display } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [combat, setCombat] = useState(true)
  const a = ACCENTS[accent]

  return (
    <div
      className="vi-root"
      style={{
        ["--accent" as string]: a.accent,
        ["--dim2" as string]: a.dim,
        ["--line" as string]: a.line,
        ["--glow" as string]: a.glow,
        ["--display" as string]: DISPLAYS[display].stack,
      }}
    >
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600&family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Marcellus&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" />
      <style>{CSS}</style>

      <div className="vi-layer">
        <header className="vi-panel flex shrink-0 items-center justify-between border-x-0 border-t-0 px-4 py-2">
          <div className="flex items-center gap-3">
            <Pentacle className="size-7 vi-accent" />
            <h1 className="vi-h text-2xl">The Fall of Arctus</h1>
            <span className="vi-data text-[11px]" style={{ color: "var(--dim)" }}>Mysterium · {a.name}</span>
          </div>
          <div className="flex overflow-hidden rounded-[2px]" style={{ border: "1px solid var(--line)" }}>
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
          <div className="vi-panel vi-data border-x-0 border-b-0 px-4 py-1.5 text-[11px] italic" style={{ color: "var(--dim)" }}>initiative tracker collapsed — no combat in progress</div>
        )}
      </div>

      {/* dev switchers */}
      {!import.meta.env.PROD && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full px-3 py-2 text-white shadow-2xl" style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,.18)" }}>
          <span className="text-[11px] text-neutral-400">accent</span>
          {(Object.keys(ACCENTS) as AccentKey[]).map((k) => (
            <button
              key={k}
              onClick={() => navigate({ search: (p) => ({ ...p, accent: k }) })}
              title={ACCENTS[k].name}
              className={`size-6 rounded-full ${k === accent ? "ring-2 ring-white" : "ring-1 ring-white/30"}`}
              style={{ background: ACCENTS[k].accent }}
            />
          ))}
          <span className="ml-1 h-4 w-px bg-white/20" />
          <span className="text-[11px] text-neutral-400">type</span>
          {(Object.keys(DISPLAYS) as DisplayKey[]).map((k) => (
            <button
              key={k}
              onClick={() => navigate({ search: (p) => ({ ...p, display: k }) })}
              className={`rounded px-2 py-0.5 text-[11px] ${k === display ? "bg-white text-black" : "text-neutral-300 hover:text-white"}`}
              style={{ fontFamily: DISPLAYS[k].stack }}
            >
              {DISPLAYS[k].name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Dark supernal void — a hair of indigo so it reads celestial, not neutral-black.
// No gradients on text, no noise. Corner ticks + etched borders carry the
// "instrument/codex" precision.
const CSS = `
.vi-root{min-height:100vh;height:100vh;display:flex;flex-direction:column;position:relative;overflow:hidden;
  --bg:#08080c;--panel:#0e0d13;--raise:#16141d;--ink:#d7d2e0;--dim:#797488;
  color:var(--ink);
  font-family:'Manrope',ui-sans-serif,system-ui,sans-serif;
  background:
    radial-gradient(120% 90% at 50% -10%, var(--glow), transparent 45%),
    radial-gradient(140% 120% at 50% 120%, rgba(0,0,0,.55), transparent 55%),
    #08080c;
}
.vi-root::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:2;
  box-shadow:inset 0 0 220px 40px rgba(0,0,0,.6)}
.vi-layer{position:relative;z-index:1;display:flex;flex-direction:column;height:100%}
.vi-panel{background:var(--panel);border:1px solid var(--line)}
/* etched corner ticks — precision framing on hero panels, crisp not fuzzy */
.vi-cornered{position:relative}
.vi-cornered::before,.vi-cornered::after{content:'';position:absolute;width:9px;height:9px;pointer-events:none;
  border-color:var(--accent);opacity:.5}
.vi-cornered::before{top:-1px;left:-1px;border-top:1px solid;border-left:1px solid}
.vi-cornered::after{bottom:-1px;right:-1px;border-bottom:1px solid;border-right:1px solid}
.vi-h{font-family:var(--display,'Marcellus'),Georgia,serif;font-weight:500;letter-spacing:.01em;color:var(--ink);margin:0}
.vi-eyebrow{font-family:'JetBrains Mono',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.24em;font-size:9px;color:var(--dim)}
.vi-btn{font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.06em;
  color:var(--ink);background:var(--raise);border:1px solid var(--line)}
.vi-btn:hover{border-color:var(--accent);color:#fff}
.vi-active{background:var(--accent)!important;color:#0a0a0c!important;border-color:var(--accent)!important;
  box-shadow:0 0 14px var(--glow)!important}
.vi-accent{color:var(--accent)}
.vi-data{font-family:'JetBrains Mono',monospace}
`
