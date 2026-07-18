// PROTOTYPE — throwaway. Answers issue #84's Attributes & Skills redesign
// question: does the synthesis (letterpress attributes vs the written hand,
// Power/Finesse/Resistance rail, "constellation" pool-building — dim the
// field, thread the selected dot ratings) actually read, and does a 2-node
// constellation feel right? Three variants on ?variant=A|B|C:
//   A "Ledger"   — production column layout + left rail, Manrope skills,
//                  thread persists faintly while the pool is built
//   B "Square"   — the attribute block as a literal 3×3 plate (the magic
//                  square made visible), skills listed beneath
//   C "Longhand" — skills wear Spectral (the trained hand in longhand),
//                  thread draws then fades, harder dim
// Mock data only — not wired to Convex. DELETE once a direction is chosen;
// fold the winner into CharacterSheet.
import { useLayoutEffect, useRef, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { DotRating } from "#/components/game/DotRating"
import { ArcanaGlyph } from "#/components/game/ArcanaGlyph"

export const Route = createFileRoute("/prototype/trait-matrix")({
  validateSearch: (s: Record<string, unknown>) => ({
    variant: (["A", "B", "C"].includes(s.variant as string)
      ? (s.variant as string)
      : "A") as "A" | "B" | "C",
  }),
  component: Prototype,
})

// ---------------------------------------------------------------------------
// Mock data (Corvin-shaped)
// ---------------------------------------------------------------------------
type Trait = { id: string; name: string; dots: number }

const CATEGORIES = ["Mental", "Physical", "Social"] as const
const ROWS = ["Power", "Finesse", "Resistance"] as const

/** attributes[category][row] — the magic square: every attribute is the
 * intersection of its category column and its Power/Finesse/Resistance row. */
const ATTRS: Record<(typeof CATEGORIES)[number], Trait[]> = {
  Mental: [
    { id: "a:Intelligence", name: "Intelligence", dots: 3 },
    { id: "a:Wits", name: "Wits", dots: 2 },
    { id: "a:Resolve", name: "Resolve", dots: 3 },
  ],
  Physical: [
    { id: "a:Strength", name: "Strength", dots: 2 },
    { id: "a:Dexterity", name: "Dexterity", dots: 3 },
    { id: "a:Stamina", name: "Stamina", dots: 2 },
  ],
  Social: [
    { id: "a:Presence", name: "Presence", dots: 2 },
    { id: "a:Manipulation", name: "Manipulation", dots: 2 },
    { id: "a:Composure", name: "Composure", dots: 2 },
  ],
}

const SKILLS: Record<(typeof CATEGORIES)[number], Trait[]> = {
  Mental: [
    { id: "s:Academics", name: "Academics", dots: 2 },
    { id: "s:Investigation", name: "Investigation", dots: 2 },
    { id: "s:Medicine", name: "Medicine", dots: 1 },
    { id: "s:Occult", name: "Occult", dots: 3 },
    { id: "s:Science", name: "Science", dots: 3 },
  ],
  Physical: [
    { id: "s:Athletics", name: "Athletics", dots: 2 },
    { id: "s:Brawl", name: "Brawl", dots: 1 },
    { id: "s:Drive", name: "Drive", dots: 1 },
    { id: "s:Larceny", name: "Larceny", dots: 1 },
    { id: "s:Stealth", name: "Stealth", dots: 2 },
  ],
  Social: [
    { id: "s:Empathy", name: "Empathy", dots: 1 },
    { id: "s:Persuasion", name: "Persuasion", dots: 1 },
    { id: "s:Socialize", name: "Socialize", dots: 1 },
    { id: "s:Subterfuge", name: "Subterfuge", dots: 1 },
  ],
}

const ALL_TRAITS = new Map(
  CATEGORIES.flatMap((c) => [...ATTRS[c], ...SKILLS[c]]).map((t) => [t.id, t]),
)

// ---------------------------------------------------------------------------
// Constellation state — selection in click order + measured thread geometry
// ---------------------------------------------------------------------------
type Point = { x: number; y: number }

function useConstellation() {
  const [selected, setSelected] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const anchorRefs = useRef(new Map<string, HTMLElement>())
  const [points, setPoints] = useState<Point[]>([])

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    )

  const registerAnchor = (id: string) => (el: HTMLElement | null) => {
    if (el) anchorRefs.current.set(id, el)
    else anchorRefs.current.delete(id)
  }

  useLayoutEffect(() => {
    const measure = () => {
      const container = containerRef.current
      if (!container) return
      const base = container.getBoundingClientRect()
      setPoints(
        selected.flatMap((id) => {
          const el = anchorRefs.current.get(id)
          if (!el) return []
          const r = el.getBoundingClientRect()
          return [{ x: r.left + r.width / 2 - base.left, y: r.top + r.height / 2 - base.top }]
        }),
      )
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [selected])

  const pool = selected
    .map((id) => ALL_TRAITS.get(id))
    .filter((t): t is Trait => t !== undefined)

  return { selected, toggle, registerAnchor, containerRef, points, pool }
}

/** The sympathetic thread: a slightly sagging bezier through the selected
 * dot clusters, in click order. Re-keyed by selection so the draw replays. */
function Threads({ points, fading }: { points: Point[]; fading: boolean }) {
  if (points.length < 2) return null
  const d = points
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`
      const prev = points[i - 1]
      const sag = Math.min(18, Math.max(8, Math.abs(p.x - prev.x) * 0.06))
      const c1x = prev.x + (p.x - prev.x) / 3
      const c2x = prev.x + ((p.x - prev.x) * 2) / 3
      return `C ${c1x} ${prev.y + sag} ${c2x} ${p.y + sag} ${p.x} ${p.y}`
    })
    .join(" ")
  return (
    <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
      <path
        key={points.map((p) => `${p.x},${p.y}`).join("|")}
        d={d}
        pathLength={1}
        className={fading ? "tm-thread tm-thread-fading" : "tm-thread"}
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Shared row + section pieces
// ---------------------------------------------------------------------------
function TraitRow({
  trait,
  kind,
  on,
  sighting,
  onToggle,
  registerAnchor,
  skillClass,
}: {
  trait: Trait
  kind: "attr" | "skill"
  on: boolean
  sighting: boolean
  onToggle: () => void
  registerAnchor: (id: string) => (el: HTMLElement | null) => void
  skillClass: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`tm-row -mx-2 flex h-7 items-center justify-between gap-2 rounded-[3px] px-2 text-left ${
        on ? "tm-on" : sighting ? "tm-dim" : ""
      }`}
    >
      <span className={kind === "attr" ? "tm-press" : skillClass}>{trait.name}</span>
      <span ref={registerAnchor(trait.id)} className="inline-flex">
        <DotRating current={trait.dots} active={on} />
      </span>
    </button>
  )
}

function SectionHeader({ pool }: { pool: Trait[] }) {
  const dice = pool.reduce((n, t) => n + t.dots, 0)
  return (
    <div className="mb-3 flex items-center gap-2">
      <h3 className="mv-eyebrow">Attributes &amp; Skills</h3>
      <span className="mv-rule flex-1" />
      <span
        className="mv-data text-[11px] tracking-wider"
        style={{ color: pool.length > 0 ? "var(--accent)" : "var(--dim)" }}
      >
        {pool.length > 0
          ? `${dice} DICE · ${pool.map((t) => t.name).join(" + ")}`
          : "CLICK TO BUILD A POOL"}
      </span>
    </div>
  )
}

/** Static context strips so the section is judged against its real
 * neighbors' weight — a title line above, three inert Arcana tiles below. */
function ContextFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-6 py-10">
      <div className="mv-cornered mv-panel flex items-center justify-between p-4">
        <div>
          <h2 className="mv-h text-[30px] leading-none">Tessellate</h2>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--dim)" }}>
            Corvin Ashe &middot; Forensic accountant turned relic hunter
          </p>
        </div>
        <span className="mv-data flex items-baseline gap-2">
          <span className="text-[15px]" style={{ color: "var(--dim)" }}>GNOSIS</span>
          <span className="mv-accent text-[32px] font-semibold">2</span>
        </span>
      </div>
      {children}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="mv-eyebrow">Arcana</h3>
          <span className="mv-rule flex-1" />
        </div>
        <div className="grid grid-cols-5 gap-2 opacity-90">
          {(["prime", "death", "matter"] as const).map((a) => (
            <div
              key={a}
              className="mv-panel relative grid aspect-square place-items-center rounded-[4px]"
            >
              <span style={{ color: a === "prime" ? "var(--realm-aether)" : "var(--realm-stygia)" }}>
                <ArcanaGlyph arcanum={a} size={34} variant={a === "prime" ? "line" : "seal"} />
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Variant A — "Ledger": production columns + left rail, persistent thread
// ---------------------------------------------------------------------------
function VariantA({ skillClass = "tm-hand" }: { skillClass?: string }) {
  const c = useConstellation()
  const sighting = c.selected.length > 0
  return (
    <section>
      <SectionHeader pool={c.pool} />
      <div ref={c.containerRef} className="relative">
        <Threads points={c.points} fading={false} />
        <div className="grid gap-x-6" style={{ gridTemplateColumns: "76px 1fr 1fr 1fr" }}>
          {/* the rail — the square's row names, whispered */}
          <div className="grid content-start gap-1">
            <span className="h-5" />
            {ROWS.map((r) => (
              <span
                key={r}
                className={`tm-rail flex h-7 items-center ${sighting ? "tm-dim" : ""}`}
              >
                {r}
              </span>
            ))}
          </div>
          {CATEGORIES.map((cat) => (
            <div key={cat} className="grid content-start gap-1">
              <span
                className={`mv-data flex h-5 items-center text-[11px] uppercase tracking-wider ${sighting ? "tm-dim" : ""}`}
                style={{ color: "var(--dim)" }}
              >
                {cat}
              </span>
              {ATTRS[cat].map((t) => (
                <TraitRow
                  key={t.id} trait={t} kind="attr"
                  on={c.selected.includes(t.id)} sighting={sighting}
                  onToggle={() => c.toggle(t.id)}
                  registerAnchor={c.registerAnchor} skillClass={skillClass}
                />
              ))}
              <span aria-hidden className="h-2" />
              {SKILLS[cat].map((t) => (
                <TraitRow
                  key={t.id} trait={t} kind="skill"
                  on={c.selected.includes(t.id)} sighting={sighting}
                  onToggle={() => c.toggle(t.id)}
                  registerAnchor={c.registerAnchor} skillClass={skillClass}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Variant B — "Square": the attribute block as a literal 3×3 plate
// ---------------------------------------------------------------------------
function VariantB() {
  const c = useConstellation()
  const sighting = c.selected.length > 0
  return (
    <section>
      <SectionHeader pool={c.pool} />
      <div ref={c.containerRef} className="relative">
        <Threads points={c.points} fading={false} />
        {/* the plate: hairlines from a gap-px grid over --line */}
        <div className="grid gap-x-0" style={{ gridTemplateColumns: "76px 1fr 1fr 1fr" }}>
          <span />
          {CATEGORIES.map((cat) => (
            <span
              key={cat}
              className={`mv-data flex h-6 items-center justify-center text-[11px] uppercase tracking-wider ${sighting ? "tm-dim" : ""}`}
              style={{ color: "var(--dim)" }}
            >
              {cat}
            </span>
          ))}
          {ROWS.map((row, ri) => (
            <>
              <span
                key={row}
                className={`tm-rail flex items-center justify-end pr-3 ${sighting ? "tm-dim" : ""}`}
              >
                {row}
              </span>
              {CATEGORIES.map((cat) => {
                const t = ATTRS[cat][ri]
                const on = c.selected.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => c.toggle(t.id)}
                    className={`tm-cell flex flex-col items-center justify-center gap-1.5 ${
                      on ? "tm-on" : sighting ? "tm-dim" : ""
                    }`}
                  >
                    <span className="tm-press">{t.name}</span>
                    <span ref={c.registerAnchor(t.id)} className="inline-flex">
                      <DotRating current={t.dots} active={on} />
                    </span>
                  </button>
                )
              })}
            </>
          ))}
        </div>
        {/* skills beneath, the learned appendix */}
        <div className="mt-4 grid gap-x-6" style={{ gridTemplateColumns: "76px 1fr 1fr 1fr" }}>
          <span />
          {CATEGORIES.map((cat) => (
            <div key={cat} className="grid content-start gap-1">
              {SKILLS[cat].map((t) => (
                <TraitRow
                  key={t.id} trait={t} kind="skill"
                  on={c.selected.includes(t.id)} sighting={sighting}
                  onToggle={() => c.toggle(t.id)}
                  registerAnchor={c.registerAnchor} skillClass="tm-hand"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Variant C — "Longhand": Spectral skills, transient thread, harder dim
// ---------------------------------------------------------------------------
function VariantC() {
  return (
    <div className="tm-longhand">
      <VariantAWithFade />
    </div>
  )
}

function VariantAWithFade() {
  const c = useConstellation()
  const sighting = c.selected.length > 0
  return (
    <section>
      <SectionHeader pool={c.pool} />
      <div ref={c.containerRef} className="relative">
        <Threads points={c.points} fading={true} />
        <div className="grid gap-x-6" style={{ gridTemplateColumns: "76px 1fr 1fr 1fr" }}>
          <div className="grid content-start gap-1">
            <span className="h-5" />
            {ROWS.map((r) => (
              <span
                key={r}
                className={`tm-rail flex h-7 items-center ${sighting ? "tm-dim" : ""}`}
              >
                {r}
              </span>
            ))}
          </div>
          {CATEGORIES.map((cat) => (
            <div key={cat} className="grid content-start gap-1">
              <span
                className={`mv-data flex h-5 items-center text-[11px] uppercase tracking-wider ${sighting ? "tm-dim" : ""}`}
                style={{ color: "var(--dim)" }}
              >
                {cat}
              </span>
              {ATTRS[cat].map((t) => (
                <TraitRow
                  key={t.id} trait={t} kind="attr"
                  on={c.selected.includes(t.id)} sighting={sighting}
                  onToggle={() => c.toggle(t.id)}
                  registerAnchor={c.registerAnchor} skillClass="tm-spectral"
                />
              ))}
              <span aria-hidden className="h-2" />
              {SKILLS[cat].map((t) => (
                <TraitRow
                  key={t.id} trait={t} kind="skill"
                  on={c.selected.includes(t.id)} sighting={sighting}
                  onToggle={() => c.toggle(t.id)}
                  registerAnchor={c.registerAnchor} skillClass="tm-spectral"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Switcher + route
// ---------------------------------------------------------------------------
const VARIANT_NAME: Record<"A" | "B" | "C", string> = {
  A: "Ledger — rail + persistent thread",
  B: "Square — the 3×3 plate",
  C: "Longhand — Spectral + fading thread",
}

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
      <span className="min-w-[240px] text-center text-[13px]">
        <b>{variant}</b> — {VARIANT_NAME[variant]}
      </span>
      <button onClick={() => go(1)} className="grid size-7 place-items-center rounded-full hover:bg-white/10">→</button>
    </div>
  )
}

function Prototype() {
  const { variant } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const setVariant = (v: "A" | "B" | "C") => navigate({ search: { variant: v } })

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <style>{PROTO_CSS}</style>
      <ContextFrame>
        {variant === "A" && <VariantA />}
        {variant === "B" && <VariantB />}
        {variant === "C" && <VariantC />}
      </ContextFrame>
      <Switcher variant={variant} onSet={setVariant} />
    </div>
  )
}

const PROTO_CSS = `
/* letterpress: struck into the page — dark press above, faint catch-light below */
.tm-press {
  font-family: Manrope, sans-serif;
  font-size: 11.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: #b3adc0;
  text-shadow: 0 -1px 1px rgba(0,0,0,0.85), 0 1px 0 rgba(215,210,224,0.07);
  white-space: nowrap;
}
/* the written hand — same family, sentence case, ordinary weight */
.tm-hand {
  font-family: Manrope, sans-serif;
  font-size: 14px;
  color: var(--ink);
  white-space: nowrap;
}
/* variant C: the hand in longhand */
.tm-spectral {
  font-family: Spectral, serif;
  font-size: 14.5px;
  color: var(--ink);
  white-space: nowrap;
}
.tm-rail {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--dim);
  opacity: 0.75;
  white-space: nowrap;
}
.tm-row { transition: opacity 280ms ease, background 150ms ease; }
.tm-row:hover { background: var(--raise); }
.tm-on .tm-press, .tm-on .tm-hand, .tm-on .tm-spectral { color: var(--ink); text-shadow: none; }
.tm-dim { opacity: 0.22; transition: opacity 280ms ease; }
.tm-longhand .tm-dim { opacity: 0.13; transition: opacity 420ms ease; }
.tm-cell {
  min-height: 56px;
  background: var(--panel);
  border: 1px solid var(--line);
  margin: 0 0 -1px -1px;
  transition: opacity 280ms ease, background 150ms ease;
}
.tm-cell:hover { background: var(--raise); }
.tm-cell.tm-on { background: var(--glow); }
.tm-thread {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1;
  opacity: 0.65;
  filter: drop-shadow(0 0 3px var(--glow));
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: tm-draw 480ms ease-out forwards;
}
.tm-thread-fading { animation: tm-draw 480ms ease-out forwards, tm-fade 500ms ease 1100ms forwards; }
.tm-node { fill: var(--accent); opacity: 0; animation: tm-appear 200ms ease 80ms forwards; }
@keyframes tm-draw { to { stroke-dashoffset: 0; } }
@keyframes tm-fade { to { opacity: 0; } }
@keyframes tm-appear { to { opacity: 0.9; } }
@media (prefers-reduced-motion: reduce) {
  .tm-thread { animation: none; stroke-dashoffset: 0; }
  .tm-thread-fading { animation: none; stroke-dashoffset: 0; opacity: 0.3; }
  .tm-node { animation: none; opacity: 0.9; }
}
`
