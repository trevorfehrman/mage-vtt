import { useEffect, useRef, useState } from "react"
import { ShaderMount } from "@paper-design/shaders-react"
import { useReducedMotion } from "motion/react"
import type { PoolComponentInput } from "#/domain/dice"
import type { useDicePool } from "#/hooks/use-dice-pool"

type DicePoolAPI = ReturnType<typeof useDicePool>

/**
 * The night sky (#84; ADR-0021, 2026-07-18 amendment), in two layers:
 *
 * `SheetSky` — the firmament. A GLSL galaxy filling the center panel behind
 * the sheet: it runs everywhere a container isn't. Every made object (title
 * card, Arcana tiles, Rote book — all solid `--panel` surfaces) occludes it;
 * Attributes & Skills is the sheet's ONE containerless section, so only
 * there does the void show through unobstructed — the mage's mundane traits
 * are the stars they were born under, and a mundane roll reads their own
 * chart. This is the app's one ambient canvas: a single WebGL context on
 * the same ShaderMount the Arcana substances use (it pauses offscreen;
 * `speed 0` under reduced motion renders one static frame and cancels the
 * rAF loop).
 *
 * `TraitSky` — the meteors, anchored to the trait matrix. One fires on the
 * pool machine's building → rolling transition: it marks the roll, not the
 * selection. Its lane is DETERMINISTIC from the pool's category permutation
 * — it enters over the attribute's column and exits toward the skill's;
 * attr+attr pairs skim high and shallow; dice count sets tail length and
 * peak opacity; only the jitter within the lane varies (seeded,
 * repeatable). Mood stays on the sheet — the chronicle rail/feed is the
 * crunch zone and gets none of this (owner rule).
 */

// ---------------------------------------------------------------------------
// The galaxy — three parallax star layers + a whisper of nebula, hand-rolled
// GLSL (ShaderMount conventions: GLSL ES 3.00, u_time seconds and
// u_resolution px provided by the mount, premultiplied-alpha output).
// Repulsion-free: fixed stars don't dodge the pointer. Every aesthetic knob
// is a uniform so the dev tweak panel can tune the sky live; shipped values
// live in SKY_DEFAULTS.
// ---------------------------------------------------------------------------
const GALAXY_FRAG = /* glsl */ `#version 300 es
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec4 u_color;
uniform float u_intensity;
uniform float u_density;
uniform float u_scale;
uniform float u_sharp;
uniform float u_twinkle;
uniform float u_drift;
uniform float u_nebula;
uniform float u_pixelRatio;
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
  float tw = mix(1., .62 + .38 * sin(t * (.4 + h * 1.6) + h * 43.), u_twinkle);
  return exist * exp(-d * d * (240. + h * 500.) * u_sharp) * tw;
}
void main() {
  // Fixed CSS-pixel basis, not buffer-relative: a bigger panel shows MORE
  // sky, not bigger stars (420 ≈ the prototype section's height, so the
  // shipped look matches the approved audition). u_pixelRatio is the
  // mount's buffer-to-CSS render scale — dividing it out keeps star size
  // constant when maxPixelCount rescales the buffer.
  vec2 uv = gl_FragCoord.xy / (420. * u_pixelRatio);
  float t = u_time;
  float s = 0.;
  s += layer(uv + vec2(t * .0016 * u_drift, 0.), 26. * u_scale, t, 2., .10 * u_density) * .45;
  s += layer(uv + vec2(t * .0034 * u_drift, 0.), 14. * u_scale, t, 6., .09 * u_density) * .75;
  s += layer(uv + vec2(t * .006 * u_drift, 0.), 7. * u_scale, t, 9., .07 * u_density) * 1.05;
  float neb = vnoise(uv * 2.6 + t * .008 * u_drift) * vnoise(uv * 6.1 - t * .006 * u_drift);
  vec3 col = u_color.rgb * s * u_intensity + vec3(.435, .682, .592) * neb * neb * .10 * u_nebula;
  float a = clamp(max(col.r, max(col.g, col.b)), 0., 1.);
  fragColor = vec4(min(col, vec3(1.)), a);
}
`

/** Shader colors are WebGL uniforms, not CSS paint: --ink mixed 70% toward
 * verdigris (#6fae97) — the stars burn in the app's own patina
 * (owner audition 2026-07-18, "crank it up" from 30%). Pure ink was
 * [0.843, 0.824, 0.878]. */
const STARLIGHT_VEC4 = [0.557, 0.724, 0.678, 1]

/** The galaxy's aesthetic knobs — each maps 1:1 onto a shader uniform (1 =
 * the value the owner promoted from the prototype), except the two intensity
 * stops. Tuned live via the dev panel; bake approved values here. */
type SkyParams = {
  /** star population, all three layers */
  density: number
  /** grid frequency — more, smaller cells (star count vs. spacing) */
  scale: number
  /** gaussian falloff multiplier — higher = tinier, harder stars */
  sharp: number
  /** twinkle depth, 0 = steady burn */
  twinkle: number
  /** parallax drift speed multiplier */
  drift: number
  /** nebula wash strength */
  nebula: number
  /** u_intensity at rest */
  rest: number
  /** u_intensity while a pool is building */
  build: number
}

/** Owner-tuned 2026-07-18 (live eye-tour): a sparser field, a fainter
 * nebula — the sky recedes behind the sheet instead of competing with it. */
const SKY_DEFAULTS: SkyParams = {
  density: 0.55,
  scale: 1,
  sharp: 1,
  twinkle: 1,
  drift: 1,
  nebula: 0.5,
  rest: 0.85,
  build: 1.2,
}

/** Dev-only seam between the tweak panel (lives with the firmament) and the
 * meteor field (lives with the trait matrix): the test button broadcasts,
 * the field listens. Production never dispatches it. */
const SKY_TEST_EVENT = "mv-sky-test-meteor"
const handledTestEvents = new WeakSet<Event>()

// ---------------------------------------------------------------------------
// The firmament
// ---------------------------------------------------------------------------

interface SheetSkyProps {
  /**
   * The session's pool controller — the whole sky brightens while a pool is
   * building, whichever surface built it. Absent, the sky rests.
   */
  pool?: DicePoolAPI | undefined
}

export function SheetSky({ pool }: SheetSkyProps) {
  const reduced = useReducedMotion() ?? false
  const building = pool?.state === "building"
  const [params, setParams] = useState<SkyParams>(SKY_DEFAULTS)

  return (
    <>
      <div aria-hidden className="mv-sky">
        <ShaderMount
          fragmentShader={GALAXY_FRAG}
          uniforms={{
            u_color: STARLIGHT_VEC4,
            u_intensity: building ? params.build : params.rest,
            u_density: params.density,
            u_scale: params.scale,
            u_sharp: params.sharp,
            u_twinkle: params.twinkle,
            u_drift: params.drift,
            u_nebula: params.nebula,
          }}
          speed={reduced ? 0 : 1}
          width="100%"
          height="100%"
          maxPixelCount={1920 * 1080}
        />
      </div>
      {import.meta.env.DEV && (
        <SkyTweakPanel
          params={params}
          onChange={setParams}
          onTest={() => window.dispatchEvent(new CustomEvent(SKY_TEST_EVENT))}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// The meteor system
// ---------------------------------------------------------------------------

/** Seeded PRNG — the lane is law, the jitter within it repeatable. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

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

/** Fraction of sky width at each category column's center. */
const COL_CENTER = [0.18, 0.5, 0.82]

/** The visible sky's bounds in meteor-field coordinates — meteors originate
 * past one edge and exit past the other (owner rule 2026-07-18). */
type SkyRect = { left: number; top: number; right: number; bottom: number }

/** Slab-extend the lane's anchor segment to `margin` px beyond the visible
 * sky on both ends, so the streak is born off-screen and dies off-screen.
 * Degenerate lanes (no rect intersection) keep their anchors. */
function extendToRect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  rect: SkyRect,
  margin: number,
) {
  const dx = bx - ax
  const dy = by - ay
  const seg = Math.hypot(dx, dy) || 1
  let tMin = -Infinity
  let tMax = Infinity
  if (dx !== 0) {
    const t1 = (rect.left - ax) / dx
    const t2 = (rect.right - ax) / dx
    tMin = Math.max(tMin, Math.min(t1, t2))
    tMax = Math.min(tMax, Math.max(t1, t2))
  }
  if (dy !== 0) {
    const t1 = (rect.top - ay) / dy
    const t2 = (rect.bottom - ay) / dy
    tMin = Math.max(tMin, Math.min(t1, t2))
    tMax = Math.min(tMax, Math.max(t1, t2))
  }
  if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || tMax < tMin) {
    return { x0: ax, y0: ay, x1: bx, y1: by }
  }
  const mt = margin / seg
  return {
    x0: ax + dx * (tMin - mt),
    y0: ay + dy * (tMin - mt),
    x1: ax + dx * (tMax + mt),
    y1: ay + dy * (tMax + mt),
  }
}

/** The lane core: the anchor segment runs over column A toward column B
 * across the trait field, then extends past the visible sky's edges —
 * every meteor enters from off-screen and exits off-screen. attr+attr
 * crosses shallow and high instead of diving; dice count sets tail length
 * and peak opacity; the seed varies the streak within its lane. */
function meteorLane(
  colA: number,
  colB: number,
  bothAttrs: boolean,
  dice: number,
  seed: number,
  w: number,
  h: number,
  sky: SkyRect,
): Meteor {
  const rnd = mulberry32(9000 + seed)
  const jitter = () => (rnd() - 0.5) * 0.16 * w
  let ax = COL_CENTER[colA] * w + jitter()
  let bx = COL_CENTER[colB] * w + jitter()
  let ay: number
  let by: number
  if (bothAttrs) {
    // a shallow high crossing — mostly lateral, always falling a little
    ay = h * (0.18 + rnd() * 0.14)
    by = ay + h * (0.06 + rnd() * 0.12)
    if (colA === colB) bx = ax + (rnd() < 0.5 ? -1 : 1) * 0.35 * w
  } else {
    // the full dive over the field
    ay = 0
    by = h
    if (colA === colB) bx += (rnd() < 0.5 ? -1 : 1) * 0.08 * w
  }
  const ends = extendToRect(ax, ay, bx, by, sky, 60)
  const len = Math.hypot(ends.x1 - ends.x0, ends.y1 - ends.y0)
  return {
    id: seed,
    ...ends,
    tail: 56 + dice * 14,
    // quiet by decree (owner, 2026-07-18, dialed twice): the streak is a
    // passing omen, not a firework — length carries the magnitude, not
    // brightness
    peak: Math.min(0.38, 0.16 + dice * 0.025),
    // real-shooting-star fast (owner, same night): constant blink-speed —
    // duration scales with the crossing so long lanes don't dawdle
    dur: len / (4.5 + rnd() * 1.5),
  }
}

/** Map a real pool onto a lane. Mundane pools are 1–2 traits (verified:
 * 3-trait pools are rote-only and flow through the book); a single-trait
 * roll falls within its own column. Non-trait components (modifiers,
 * willpower) count toward magnitude but don't steer. */
function meteorFor(
  components: readonly PoolComponentInput[],
  columnOf: Record<string, number>,
  poolSize: number,
  seed: number,
  w: number,
  h: number,
  sky: SkyRect,
): Meteor | null {
  const traits = components.filter(
    (c) => c.type === "attribute" || c.type === "skill",
  )
  const first = traits[0]
  if (first === undefined) return null
  const second = traits[1] ?? first
  return meteorLane(
    columnOf[first.name] ?? 1,
    columnOf[second.name] ?? 1,
    first.type === "attribute" && second.type === "attribute",
    poolSize,
    seed,
    w,
    h,
    sky,
  )
}

/** One streak. SMIL is a trap for dynamically mounted animations — a mounted
 * <animate> resolves begin="0s" against the SVG's document timeline, so it
 * arrives already-finished and invisible; CSS keyframes can't interpolate
 * calc()'d custom-property dashoffsets either. What works: mount at the start
 * offset, force a reflow, then transition concrete pixel values.
 *
 * The dash GAP must exceed the whole travel distance (len + 2·tail): a
 * shorter gap repeats the pattern within the line, and a second phantom
 * dash rides in behind the real one — the "meteors fire twice" bug
 * (owner-caught 2026-07-18; a prototype-era artifact). One dash, one pass:
 * in at the start offset `tail`, out past the far end at `-(len + tail)`. */
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
    el.style.strokeDashoffset = `${-(len + m.tail)}`
    el.style.opacity = "0"
  }, [m])

  // Not a flat white line (owner, 2026-07-18): brightness is shaped along
  // the flight path — the streak materializes out of nothing, flares past
  // mid-flight, and dies before the exit, like the real thing. The gradient
  // is fixed to the lane (userSpaceOnUse), so the racing dash inherits the
  // local brightness wherever it is.
  const gid = `mv-meteor-grad-${m.id}`
  return (
    <g>
      <defs>
        <linearGradient
          id={gid}
          gradientUnits="userSpaceOnUse"
          x1={m.x0}
          y1={m.y0}
          x2={m.x1}
          y2={m.y1}
        >
          <stop offset="0" stopColor="var(--ink)" stopOpacity="0" />
          <stop offset="0.55" stopColor="var(--ink)" stopOpacity="1" />
          <stop offset="1" stopColor="var(--ink)" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <line
        ref={ref}
        x1={m.x0}
        y1={m.y0}
        x2={m.x1}
        y2={m.y1}
        className="mv-sky-meteor"
        strokeDasharray={`${m.tail} ${len + 2 * m.tail}`}
        style={{
          stroke: `url(#${gid})`,
          strokeDashoffset: m.tail,
          opacity: m.peak,
        }}
      />
    </g>
  )
}

// ---------------------------------------------------------------------------
// The meteor field over the trait matrix
// ---------------------------------------------------------------------------

interface TraitSkyProps {
  /**
   * The sheet's pool controller. Absent (read-only sheets) no meteor ever
   * fires — the firmament above still holds the section.
   */
  pool?: DicePoolAPI | undefined
  /** Category column (0 mental · 1 physical · 2 social) per trait display
   * name — the meteor's lane map, derived from the character's own sheet. */
  traitColumns: Record<string, number>
}

export function TraitSky({ pool, traitColumns }: TraitSkyProps) {
  const reduced = useReducedMotion() ?? false
  const skyRef = useRef<HTMLDivElement | null>(null)
  const [meteors, setMeteors] = useState<Meteor[]>([])
  const fireCount = useRef(0)

  const launch = (m: Meteor | null) => {
    if (!m) return
    setMeteors((prev) => [...prev, m])
    setTimeout(() => setMeteors((prev) => prev.filter((x) => x.id !== m.id)), 1600)
  }

  // The visible sky in field coordinates: the center panel's box, which is
  // where the firmament clips — meteors are born and die past its edges.
  const skyBounds = (el: HTMLDivElement): SkyRect => {
    const field = el.getBoundingClientRect()
    const panel = el
      .closest('[data-slot="resizable-panel"]')
      ?.getBoundingClientRect()
    if (!panel) {
      return { left: 0, top: 0, right: field.width, bottom: field.height }
    }
    return {
      left: panel.left - field.left,
      top: panel.top - field.top,
      right: panel.right - field.left,
      bottom: panel.bottom - field.top,
    }
  }

  // The meteor marks the roll: fire on the machine's building → rolling
  // transition, while the consumed pool's components are still in context.
  const poolRef = useRef(pool)
  poolRef.current = pool
  const prevState = useRef(pool?.state)
  useEffect(() => {
    const p = poolRef.current
    const el = skyRef.current
    if (
      p !== undefined &&
      el !== null &&
      !reduced &&
      p.state === "rolling" &&
      prevState.current === "building"
    ) {
      const { width, height } = el.getBoundingClientRect()
      fireCount.current += 1
      launch(
        meteorFor(
          p.context.components,
          traitColumns,
          p.context.poolSize,
          fireCount.current,
          width,
          height,
          skyBounds(el),
        ),
      )
    }
    prevState.current = p?.state
  }, [pool?.state])

  // Dev-only: the tweak panel's lane test — no real roll needed; cycles the
  // permutations deterministically. The WeakSet dedupes per event: a stale
  // HMR listener or a double mount can't double-fire the streak.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const onTest = (e: Event) => {
      if (handledTestEvents.has(e)) return
      handledTestEvents.add(e)
      const el = skyRef.current
      if (!el) return
      const { width, height } = el.getBoundingClientRect()
      fireCount.current += 1
      const n = fireCount.current
      launch(
        meteorLane(
          n % 3,
          (n * 2 + 1) % 3,
          n % 4 === 0,
          4 + (n % 6),
          n,
          width,
          height,
          skyBounds(el),
        ),
      )
    }
    window.addEventListener(SKY_TEST_EVENT, onTest)
    return () => window.removeEventListener(SKY_TEST_EVENT, onTest)
  }, [])

  return (
    <div ref={skyRef} aria-hidden className="mv-sky-meteors">
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        {meteors.map((m) => (
          <MeteorLine key={m.id} m={m} />
        ))}
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dev tweak panel — the owner's tuning bench for the eye-tour. DEV-only;
// approved values get baked into SKY_DEFAULTS and this panel stays dormant.
// ---------------------------------------------------------------------------

const SKY_RANGES: Record<keyof SkyParams, [min: number, max: number, step: number]> = {
  density: [0.2, 2.5, 0.05],
  scale: [0.5, 2, 0.05],
  sharp: [0.3, 3, 0.05],
  twinkle: [0, 1, 0.05],
  drift: [0, 4, 0.1],
  nebula: [0, 3, 0.05],
  rest: [0, 2, 0.05],
  build: [0, 2, 0.05],
}

function SkyTweakPanel({
  params,
  onChange,
  onTest,
}: {
  params: SkyParams
  onChange: (p: SkyParams) => void
  onTest: () => void
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="tune the sky (dev)"
        className="mv-mini fixed bottom-4 right-4 z-50"
      >
        sky ✦
      </button>
    )
  }

  return (
    <div
      className="mv-panel fixed bottom-4 right-4 z-50 grid w-64 gap-2 rounded-[4px] border p-3"
      style={{ borderColor: "var(--line)" }}
    >
      <div className="flex items-center justify-between">
        <span className="mv-eyebrow">Sky (dev)</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mv-mini"
        >
          close
        </button>
      </div>
      {(Object.keys(SKY_RANGES) as (keyof SkyParams)[]).map((key) => {
        const [min, max, step] = SKY_RANGES[key]
        return (
          <label key={key} className="grid gap-0.5">
            <span className="mv-data flex justify-between text-[10px] uppercase tracking-wider" style={{ color: "var(--dim)" }}>
              <span>{key}</span>
              <span style={{ color: "var(--ink)" }}>{params[key].toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={params[key]}
              onChange={(e) =>
                onChange({ ...params, [key]: Number(e.target.value) })
              }
            />
          </label>
        )
      })}
      <div className="flex gap-2">
        <button type="button" onClick={onTest} className="mv-mini flex-1">
          ☄ test meteor
        </button>
        <button
          type="button"
          onClick={() => onChange(SKY_DEFAULTS)}
          className="mv-mini"
        >
          reset
        </button>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(JSON.stringify(params, null, 2))
          }}
          className="mv-mini"
        >
          copy
        </button>
      </div>
    </div>
  )
}
