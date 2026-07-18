// PROTOTYPE — throwaway. Round 2 of #84's Attributes & Skills redesign: the
// NIGHT SKY audition. The owner's insight: this is the sheet's only
// containerless section — every neighbor is a made object (panel, tiles,
// book) occluding the void, and here the void shows through. The center
// panel's verdigris dark IS the night sky; traits float on the naked
// firmament, and the mage's mundane rolls read their own stars.
// Three sky engines under identical content, ?variant=A|B|C:
//   A "Fixed Stars" — CSS/SVG static field; twinkles ONLY while a pool
//                     is building (event-driven, doctrine-clean)
//   B "Galaxy"      — custom GLSL starfield on ShaderMount (ambient WebGL,
//                     doctrine suspended for audition; repulsion-free)
//   C "Aurora"      — blurred verdigris ribbons, slow ambient drift,
//                     intensifying while building; faint stars beneath
// All three carry the METEOR system: on pool completion a shooting star
// crosses the section — trajectory DETERMINISTIC by category permutation
// (enters over the attribute's column, exits toward the skill's column;
// attr+attr = shallow high arc), magnitude from dice count, jitter random.
// Mock data only — not wired to Convex. DELETE once a sky is chosen.
// (Round 1 — letterpress/thread/dim, all three variants rejected 2026-07-17 —
// preserved for the capture ritual in the session scratchpad.)
import { useEffect, useRef, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ShaderMount } from "@paper-design/shaders-react"
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
type Category = "Mental" | "Physical" | "Social"

const CATEGORIES: Category[] = ["Mental", "Physical", "Social"]

const ATTRS: Record<Category, Trait[]> = {
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

const SKILLS: Record<Category, Trait[]> = {
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

const CATEGORY_OF = new Map<string, number>(
  CATEGORIES.flatMap((c, i) =>
    [...ATTRS[c], ...SKILLS[c]].map((t): [string, number] => [t.id, i]),
  ),
)

// ---------------------------------------------------------------------------
// Deterministic PRNG (seeded, SSR-stable star placement / repeatable jitter)
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The fixed stars — one seed, forever. ~7% verdigris, the rest ink-white. */
const STARS = (() => {
  const rnd = mulberry32(1904)
  return Array.from({ length: 110 }, (_, i) => ({
    id: i,
    x: rnd() * 100,
    y: rnd() * 100,
    r: 0.4 + rnd() * 0.9,
    o: 0.10 + rnd() * 0.38,
    verdigris: rnd() < 0.07,
    delay: rnd() * 4,
    dur: 1.4 + rnd() * 1.9,
  }))
})()

// ---------------------------------------------------------------------------
// The meteor system — trajectory from the pool's category permutation
// ---------------------------------------------------------------------------
type Meteor = {
  id: number
  x0: number
  y0: number
  x1: number
  y1: number
  tail: number
  peak: number
  dur: number
}

const COL_CENTER = [0.18, 0.5, 0.82] // fraction of sky width per category lane

function meteorFor(
  pool: Trait[],
  fireCount: number,
  w: number,
  h: number,
): Meteor | null {
  if (pool.length < 2) return null
  const [first, second] = pool
  const rnd = mulberry32(9000 + fireCount)
  const jitter = () => (rnd() - 0.5) * 0.16 * w
  const colA = CATEGORY_OF.get(first.id) ?? 0
  const colB = CATEGORY_OF.get(second.id) ?? 0
  const bothAttrs = first.id.startsWith("a:") && second.id.startsWith("a:")
  const dice = pool.reduce((n, t) => n + t.dots, 0)

  const x0 = COL_CENTER[colA] * w + jitter()
  const x1 = COL_CENTER[colB] * w + jitter()
  // attr+skill dives the full sky; attr+attr skims high and shallow
  const y0 = -10
  const y1 = bothAttrs ? h * (0.28 + rnd() * 0.14) : h + 10
  return {
    id: fireCount,
    x0,
    y0,
    x1: colA === colB ? x1 + (rnd() < 0.5 ? -1 : 1) * 0.08 * w : x1,
    y1,
    tail: 56 + dice * 14,
    peak: Math.min(0.95, 0.5 + dice * 0.05),
    dur: 900 + rnd() * 320,
  }
}

function MeteorLayer({ meteors }: { meteors: Meteor[] }) {
  return (
    <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-visible">
      {meteors.map((m) => (
        <MeteorLine key={m.id} m={m} />
      ))}
    </svg>
  )
}

/** One streak. SMIL was tried and cut — a dynamically mounted <animate>
 * resolves begin="0s" against the SVG's document timeline, so it mounts
 * already-finished and invisible. CSS keyframes couldn't interpolate the
 * calc()'d offsets either. What works: mount at the start offset, force a
 * reflow, then transition concrete pixel values. */
function MeteorLine({ m }: { m: Meteor }) {
  const ref = useRef<SVGLineElement | null>(null)
  const len = Math.hypot(m.x1 - m.x0, m.y1 - m.y0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    void el.getBoundingClientRect() // commit the start state before transitioning
    el.style.transition = [
      `stroke-dashoffset ${m.dur}ms cubic-bezier(0.2, 0.4, 0.6, 1)`,
      `opacity ${Math.round(m.dur * 0.3)}ms ease ${Math.round(m.dur * 0.7)}ms`,
    ].join(", ")
    el.style.strokeDashoffset = `${-m.tail}`
    el.style.opacity = "0"
  }, [m])

  return (
    <line
      ref={ref}
      x1={m.x0}
      y1={m.y0}
      x2={m.x1}
      y2={m.y1}
      className="sky-meteor"
      strokeDasharray={`${m.tail} ${len + m.tail}`}
      style={{ strokeDashoffset: len + m.tail, opacity: m.peak }}
    />
  )
}

// ---------------------------------------------------------------------------
// Sky engines
// ---------------------------------------------------------------------------
function FixedStars({
  building,
  dense = true,
  pulse = 0,
}: {
  building: boolean
  dense?: boolean
  /** increments per trait toggle — remounts the field so the ignition
   * flare replays: every click, the sky visibly answers */
  pulse?: number
}) {
  const stars = dense ? STARS : STARS.filter((s) => s.id % 3 === 0)
  return (
    <svg
      key={pulse}
      className={`absolute inset-0 h-full w-full ${building ? "sky-building" : ""}`}
      preserveAspectRatio="none"
    >
      {stars.map((s) => (
        <circle
          key={s.id}
          cx={`${s.x}%`}
          cy={`${s.y}%`}
          r={s.r}
          className="sky-star"
          style={
            {
              fill: s.verdigris ? "var(--accent)" : "var(--ink)",
              opacity: s.o,
              "--base-o": s.o,
              "--tw-delay": `${s.delay}s`,
              "--tw-dur": `${s.dur}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </svg>
  )
}

/** Galaxy: three parallax star layers + a whisper of nebula, hand-rolled
 * GLSL on the app's existing ShaderMount (no new deps; repulsion-free —
 * fixed stars don't dodge). Ambient by design: that's what's on trial. */
const GALAXY_FRAG = /* glsl */ `#version 300 es
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec4 u_color;
uniform float u_intensity;
out vec4 fragColor;

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 ip = floor(p); vec2 fp = fract(p);
  float a = hash12(ip); float b = hash12(ip + vec2(1., 0.));
  float c = hash12(ip + vec2(0., 1.)); float d = hash12(ip + vec2(1., 1.));
  vec2 t = smoothstep(0., 1., fp);
  return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}
float layer(vec2 uv, float scale, float t, float seed, float density) {
  vec2 gp = uv * scale;
  vec2 ip = floor(gp); vec2 fp = fract(gp);
  float h = hash12(ip + seed);
  float exist = step(h, density);
  vec2 pos = .15 + .7 * vec2(hash12(ip + seed + 11.3), hash12(ip + seed + 23.7));
  float d = length(fp - pos);
  float tw = .62 + .38 * sin(t * (.4 + h * 1.6) + h * 43.);
  return exist * exp(-d * d * (240. + h * 500.)) * tw;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.y;
  float t = u_time;
  float s = 0.;
  s += layer(uv + vec2(t * .0016, 0.), 26., t, 2., .10) * .45;
  s += layer(uv + vec2(t * .0034, 0.), 14., t, 6., .09) * .75;
  s += layer(uv + vec2(t * .006, 0.), 7., t, 9., .07) * 1.05;
  float neb = vnoise(uv * 2.6 + t * .008) * vnoise(uv * 6.1 - t * .006);
  vec3 col = u_color.rgb * s * u_intensity + vec3(.435, .682, .592) * neb * neb * .10;
  float a = clamp(max(col.r, max(col.g, col.b)), 0., 1.);
  fragColor = vec4(min(col, vec3(1.)), a);
}
`
const STARLIGHT_VEC4 = [0.843, 0.824, 0.878, 1] // --ink as vec4

function GalaxySky({ reduced, building }: { reduced: boolean; building: boolean }) {
  return (
    <ShaderMount
      fragmentShader={GALAXY_FRAG}
      uniforms={{ u_color: STARLIGHT_VEC4, u_intensity: building ? 1.2 : 0.85 }}
      speed={reduced ? 0 : 1}
      width="100%"
      height="100%"
      maxPixelCount={860 * 560}
    />
  )
}

/** C, round 2 — the ribbons-over-the-section were too occlusive (owner).
 * The aurora retreats to where the app's glow already lives: a corner
 * wash far from the traits, rippling on a minutes-slow cycle. The section
 * itself keeps only a thinned static starfield. */
function AuroraCorner({ building }: { building: boolean }) {
  return (
    <div
      aria-hidden
      className={`sky-aurora-corner ${building ? "sky-building" : ""}`}
    >
      <div className="sky-aurora-wash sky-aurora-wash-1" />
      <div className="sky-aurora-wash sky-aurora-wash-2" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// The section under audition
// ---------------------------------------------------------------------------
function TraitMatrix({ variant }: { variant: "A" | "B" | "C" }) {
  const [selected, setSelected] = useState<string[]>([])
  const [meteors, setMeteors] = useState<Meteor[]>([])
  const fireCount = useRef(0)
  const skyRef = useRef<HTMLDivElement | null>(null)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  const pool = selected
    .map((id) => ALL_TRAITS.get(id))
    .filter((t): t is Trait => t !== undefined)
  const building = pool.length > 0
  const dice = pool.reduce((n, t) => n + t.dots, 0)

  const fire = (p: Trait[]) => {
    const el = skyRef.current
    if (!el || reduced) return
    const { width, height } = el.getBoundingClientRect()
    fireCount.current += 1
    const m = meteorFor(p, fireCount.current, width, height)
    if (!m) return
    setMeteors((prev) => [...prev, m])
    setTimeout(() => setMeteors((prev) => prev.filter((x) => x.id !== m.id)), 1600)
  }

  const [pulse, setPulse] = useState(0)

  const toggle = (id: string) => {
    setPulse((n) => n + 1)
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
      if (next.length === 2 && prev.length === 1) {
        const p = next
          .map((tid) => ALL_TRAITS.get(tid))
          .filter((t): t is Trait => t !== undefined)
        // fire on the completed pair — the sky answers the roll taking shape
        queueMicrotask(() => fire(p))
      }
      return next
    })
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="mv-eyebrow">Attributes &amp; Skills</h3>
        <span className="mv-rule flex-1" />
        {pool.length >= 2 && (
          <button
            type="button"
            onClick={() => fire(pool)}
            title="cast — the same lane falls again, new jitter"
            className="mv-data rounded-[3px] border px-2 py-0.5 text-[11px] tracking-wider hover:bg-[var(--raise)]"
            style={{ color: "var(--accent)", borderColor: "var(--line)" }}
          >
            CAST ✦
          </button>
        )}
        <span
          className="mv-data text-[11px] tracking-wider"
          style={{ color: building ? "var(--accent)" : "var(--dim)" }}
        >
          {building
            ? `${dice} DICE · ${pool.map((t) => t.name).join(" + ")}`
            : "CLICK TO BUILD A POOL"}
        </span>
      </div>

      {/* the open sky — no container; the void shows through here and
          nowhere else. The sky layer overshoots vertically so meteors
          enter from above the content, and a mask feathers its edges. */}
      <div className="relative">
        {variant === "C" && <AuroraCorner building={building} />}
        <div ref={skyRef} aria-hidden className="sky-layer">
          {variant === "A" && <FixedStars building={building} pulse={pulse} />}
          {variant === "B" && <GalaxySky reduced={reduced} building={building} />}
          {variant === "C" && (
            <FixedStars building={building} dense={false} pulse={pulse} />
          )}
          <MeteorLayer meteors={meteors} />
        </div>

        {/* variant B rides the Arcana caption trick: a lit-only dark halo
            hugging each row's own shapes + brightened empty dot rings, so
            text and ratings hold against the running galaxy */}
        <div
          className={`relative z-10 grid grid-cols-3 gap-x-6 ${
            variant === "B" ? "sky-halo" : ""
          }`}
        >
          {CATEGORIES.map((cat) => (
            <div key={cat} className="grid content-start gap-1">
              <span
                className="mv-data flex h-5 items-center text-[11px] uppercase tracking-wider"
                style={{ color: "var(--dim)" }}
              >
                {cat}
              </span>
              {ATTRS[cat].map((t) => (
                <TraitButton
                  key={t.id}
                  trait={t}
                  on={selected.includes(t.id)}
                  onToggle={() => toggle(t.id)}
                />
              ))}
              <span aria-hidden className="h-2" />
              {SKILLS[cat].map((t) => (
                <TraitButton
                  key={t.id}
                  trait={t}
                  on={selected.includes(t.id)}
                  onToggle={() => toggle(t.id)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function TraitButton({
  trait,
  on,
  onToggle,
}: {
  trait: Trait
  on: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`sky-row -mx-2 flex h-7 items-center justify-between gap-2 rounded-[3px] px-2 text-left ${
        on ? "sky-row-on" : ""
      }`}
    >
      <span className="whitespace-nowrap text-[14px]" style={{ color: "var(--ink)" }}>
        {trait.name}
      </span>
      <DotRating current={trait.dots} active={on} />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Context frame — real neighbor weight above and below
// ---------------------------------------------------------------------------
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
// Switcher + route
// ---------------------------------------------------------------------------
const VARIANT_NAME: Record<"A" | "B" | "C", string> = {
  A: "Fixed Stars — CSS, twinkle on build",
  B: "Galaxy — GLSL ambient",
  C: "Aurora — ribbons + faint stars",
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
      <span className="min-w-[250px] text-center text-[13px]">
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
        {/* key remounts the section per variant so sky engines swap clean */}
        <TraitMatrix key={variant} variant={variant} />
      </ContextFrame>
      <Switcher variant={variant} onSet={setVariant} />
    </div>
  )
}

const PROTO_CSS = `
.sky-layer {
  position: absolute;
  left: -12px;
  right: -12px;
  top: -28px;
  bottom: -16px;
  mask-image: linear-gradient(to bottom, transparent, black 34px, black calc(100% - 26px), transparent),
              linear-gradient(to right, transparent, black 26px, black calc(100% - 26px), transparent);
  mask-composite: intersect;
}
.sky-row { transition: background 150ms ease; }
.sky-row:hover { background: color-mix(in oklab, var(--raise) 72%, transparent); }
.sky-row-on { background: color-mix(in oklab, var(--glow) 80%, transparent); }

/* A — the fixed stars: still at rest. Every click remounts the field, so
 * the one-shot ignition flare replays (last animation wins during its run),
 * then the twinkle breathes for as long as the pool is building. */
.sky-star { transition: opacity 400ms ease; }
.sky-building .sky-star {
  animation:
    sky-twinkle var(--tw-dur) ease-in-out var(--tw-delay) infinite alternate,
    sky-ignite 520ms ease-out;
}
@keyframes sky-twinkle {
  from { opacity: calc(var(--base-o) * 0.30); }
  to   { opacity: calc(var(--base-o) * 2.1); }
}
@keyframes sky-ignite {
  0%   { opacity: calc(var(--base-o) * 2.8); }
  100% { opacity: var(--base-o); }
}

/* B — the Arcana caption trick, ported: lit-only dark halo hugging each
 * row's own shapes (styles.css .mv-arcana-lit .mv-arcana-caption), and
 * brightened empty dot rings via --mv-dot-ring */
.sky-halo .sky-row {
  filter: drop-shadow(0 0 2px rgba(8, 8, 10, 0.95)) drop-shadow(0 0 5px rgba(8, 8, 10, 0.75))
    drop-shadow(0 2px 9px rgba(8, 8, 10, 0.55));
}
.sky-halo { --mv-dot-ring: color-mix(in srgb, var(--ink) 42%, transparent); }

/* C — the aurora retreats to the corner where the app's glow already
 * lives, and ripples: two verdigris washes drifting out of phase,
 * minutes-slow, brightening while a pool builds */
.sky-aurora-corner {
  position: fixed;
  top: 0;
  right: 0;
  width: 55vw;
  height: 46vh;
  pointer-events: none;
  z-index: 0;
  opacity: 0.75;
  transition: opacity 1200ms ease;
}
.sky-building.sky-aurora-corner { opacity: 1; }
.sky-aurora-wash {
  position: absolute;
  inset: -20%;
  background: radial-gradient(70% 60% at 78% 6%, var(--glow), transparent 62%);
  animation: sky-aurora-drift 34s ease-in-out infinite alternate;
}
.sky-aurora-wash-2 {
  background: radial-gradient(52% 44% at 62% 12%, rgba(111, 174, 151, 0.09), transparent 58%);
  animation-duration: 47s;
  animation-delay: -21s;
}
@keyframes sky-aurora-drift {
  0%   { transform: translate(0, 0) scale(1); }
  50%  { transform: translate(-2.5%, 1.8%) scale(1.07) skewX(-2deg); }
  100% { transform: translate(1.5%, -1.2%) scale(0.98) skewX(1.5deg); }
}

/* the meteor: a dash segment racing the line entry → exit (SMIL-driven) */
.sky-meteor {
  stroke: var(--ink);
  stroke-width: 1.8;
  stroke-linecap: round;
  fill: none;
  filter: drop-shadow(0 0 5px var(--accent));
}
@media (prefers-reduced-motion: reduce) {
  .sky-building .sky-star, .sky-aurora-wash { animation: none; }
  .sky-meteor { display: none; }
}
`
