import type { ReactNode } from "react"
import {
  GemSmoke,
  GodRays,
  GrainGradient,
  LiquidMetal,
  MeshGradient,
  NeuroNoise,
  ShaderMount,
  Warp,
  Water,
} from "@paper-design/shaders-react"
import { useReducedMotion } from "motion/react"

/**
 * The substance layer of the Arcana material system (#84 audition, research:
 * docs/research/2026-07-16-arcana-shine-library-survey.md §1). The CSS
 * material is the idle body on all ten tiles; a substance shader is the lit
 * soul, mounted ONLY while its tile is lit so concurrent WebGL contexts stay
 * bounded (Chromium caps 16 desktop / 8 Android). The 0.45s fade-in rides the
 * same beat as the bloom and covers context-create + compile latency.
 *
 * All ten Arcana carry a substance, each auditioned and locked by the owner
 * (2026-07-16, #84): eight from the Paper Shaders catalog, two custom GLSL
 * (Fate's branching paths, Space's gravity well). The row grammar decides
 * the placement: Subtle substances radiate from the glyph ("field"), Gross
 * substances flood the tile while the solid medallion holds against it
 * ("absorb"). Substances run uncut, edge to edge; caption legibility is
 * structural, not tuned — while lit, a dark drop-shadow halo hugs the
 * caption's own shapes (styles.css .mv-arcana-caption).
 */

/** Mirror of the --realm-* tokens (styles.css ~42): shader colors are WebGL
 * uniforms, not CSS paint, so var(--tile) can't reach them. */
const REALM_HEX = {
  aether: "#d3b46a",
  arcadia: "#cdd6e2",
  pandemonium: "#b4693c",
  wild: "#9aa471",
  stygia: "#868e9c",
} as const

/* ── Custom GLSL (ShaderMount conventions: GLSL ES 3.00, u_time seconds and
 * u_resolution px provided by the mount, premultiplied-alpha output) ── */

/** Fate: a network of jagged light-paths, crossing and forever re-routing.
 * Noise/fbm machinery ported from React Bits' Lightning (MIT + Commons
 * Clause, vendoring permitted), extended from one bolt to three crossing
 * bolts so the paths branch instead of snaking. */
const FATE_PATHS_FRAG = /* glsl */ `#version 300 es
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec4 u_color;
uniform float u_intensity;
out vec4 fragColor;

float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
mat2 rot(float th) { float c = cos(th); float s = sin(th); return mat2(c, -s, s, c); }
float vnoise(vec2 p) {
  vec2 ip = floor(p); vec2 fp = fract(p);
  float a = hash12(ip); float b = hash12(ip + vec2(1., 0.));
  float c = hash12(ip + vec2(0., 1.)); float d = hash12(ip + vec2(1., 1.));
  vec2 t = smoothstep(0., 1., fp);
  return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}
float fbm(vec2 p) {
  float v = 0.; float amp = .5;
  for (int i = 0; i < 6; i++) { v += amp * vnoise(p); p = rot(.45) * p * 2.; amp *= .5; }
  return v;
}
float bolt(vec2 uv, float seed, float t) {
  vec2 p = uv;
  p += 2. * fbm(p * 1.8 + seed + .6 * t) - 1.;
  float d = abs(p.x);
  float flicker = .55 + .45 * hash11(floor(t * 2.) + seed);
  return .04 * flicker / (d + .02);
}
void main() {
  vec2 uv = (2. * gl_FragCoord.xy - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float t = u_time;
  float g = bolt(uv, 1.7, t);
  g += bolt(rot(2.094) * uv + vec2(.35, -.2), 4.3, t * .85);
  g += bolt(rot(-2.094) * uv + vec2(-.3, .25), 7.9, t * 1.15);
  vec3 col = u_color.rgb * min(g, 2.5) * u_intensity;
  float a = clamp(max(col.r, max(col.g, col.b)), 0., 1.);
  fragColor = vec4(min(col, vec3(1.)), a);
}
`

/** Space: the spacetime graph itself — a coordinate grid compressed toward
 * a central mass and differentially dragged around it (inner space rotates
 * faster than outer: angular momentum, distances shrinking near the well). */
const SPACE_WELL_FRAG = /* glsl */ `#version 300 es
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec4 u_color;
uniform float u_intensity;
out vec4 fragColor;

mat2 rot(float th) { float c = cos(th); float s = sin(th); return mat2(c, -s, s, c); }
void main() {
  vec2 uv = (2. * gl_FragCoord.xy - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float r = length(uv);
  float ang = u_time * .05 * (1.2 / (r + .35));
  vec2 p = rot(ang) * uv;
  p *= 1. + .85 * exp(-r * 2.2);
  vec2 gp = p * 5.;
  vec2 aa = max(fwidth(gp), vec2(1e-4));
  vec2 gd = abs(fract(gp - .5) - .5) / aa;
  float line = 1. - min(min(gd.x, gd.y), 1.);
  float glow = .35 + .65 * exp(-r * 1.8);
  float a = clamp(line * glow * u_intensity, 0., 1.) * u_color.a;
  fragColor = vec4(u_color.rgb * a, a);
}
`

/** Shader colors are WebGL uniforms: [r,g,b,a] in 0–1, premultiply-ready. */
const LUNARGENT_VEC4 = [0.804, 0.839, 0.886, 1]
const IRON_VEC4 = [0.706, 0.412, 0.235, 1]

interface SubstanceDef {
  /** Both fill the tile behind the glyph. "field" is the emission read
   * (strongest at the glyph, fading outward); "absorb" is the absorption
   * read (masked out of the center — mass gathers toward the rim while the
   * medallion holds the clear middle). */
  placement: "field" | "absorb"
  /** speed is 0 under prefers-reduced-motion — the shader renders one
   * static frame and cancels its rAF loop. */
  node: (speed: number) => ReactNode
  /** Whole-layer CSS motion (reduced-motion gated in styles.css):
   * "turn" rotates slowly (Death); "converge" breathes inward with a
   * slight angular drift (Space — distances shrinking). */
  motion?: "turn" | "converge"
}

const SUBSTANCES: Record<string, SubstanceDef> = {
  // ── Subtle row: the substance radiates out from the glyph ──

  // destiny — a web of jagged silver paths, crossing and forever re-routing
  // (custom GLSL; SimplexNoise, Swirl, NeuroNoise, and truchet all
  // auditioned 2026-07-16 and retired — blobs, snakes, or literally-Mind)
  fate: {
    placement: "field",
    node: (speed) => (
      <ShaderMount
        fragmentShader={FATE_PATHS_FRAG}
        uniforms={{ u_color: LUNARGENT_VEC4, u_intensity: 0.85 }}
        speed={speed * 0.3}
        width="100%"
        height="100%"
        maxPixelCount={320 * 320}
      />
    ),
  },
  // thought — glowing web-lines of rusted iron firing behind the ripples
  mind: {
    placement: "field",
    node: (speed) => (
      <NeuroNoise
        colorBack="#00000000"
        colorMid="#5c3a24"
        colorFront={REALM_HEX.pandemonium}
        brightness={0.25}
        contrast={0.45}
        scale={0.5}
        speed={speed * 0.35}
        width="100%"
        height="100%"
        maxPixelCount={320 * 320}
      />
    ),
  },
  // the numinous — aurora curtains flowing slow across the veil
  spirit: {
    placement: "field",
    node: (speed) => (
      <MeshGradient
        colors={["#0a0c09", REALM_HEX.wild, "#e3ecd2", "#22291d"]}
        distortion={0.8}
        swirl={0.5}
        grainMixer={0.3}
        grainOverlay={0.15}
        speed={speed * 0.25}
        width="100%"
        height="100%"
        maxPixelCount={320 * 320}
      />
    ),
  },
  // entropy — the full smoke diamond, turning imperceptibly slow (owner
  // call: geometry restored, rotation instead of retreat from the caption)
  death: {
    placement: "field",
    motion: "turn",
    node: (speed) => (
      <GemSmoke
        colorBack="#00000000"
        colors={[REALM_HEX.stygia, "#4a4f58"]}
        colorInner="#2a2d33"
        size={0.62}
        innerDistortion={0.2}
        outerDistortion={0.35}
        innerGlow={0.25}
        outerGlow={0.3}
        speed={speed * 0.25}
        width="100%"
        height="100%"
        maxPixelCount={320 * 320}
      />
    ),
  },
  // the supernal source — light rays breathing out from the glyph's center
  prime: {
    placement: "field",
    node: (speed) => (
      <GodRays
        colorBack="#00000000"
        colorBloom={REALM_HEX.aether}
        colors={[REALM_HEX.aether, "#efe6c8"]}
        intensity={0.38}
        density={0.28}
        spotty={0.24}
        midSize={0.16}
        midIntensity={0.32}
        bloom={0.45}
        speed={speed * 0.5}
        width="100%"
        height="100%"
        maxPixelCount={320 * 320}
      />
    ),
  },
  // ── Gross row: the substance floods the tile and gathers at the rim ──

  // energy — molten gold turbulence licking in from the edges
  forces: {
    placement: "absorb",
    node: (speed) => (
      <Warp
        colors={["#0d0b08", REALM_HEX.aether, "#8a6a2a"]}
        distortion={0.3}
        swirl={0.8}
        swirlIterations={8}
        softness={0.35}
        scale={0.7}
        speed={speed * 0.6}
        width="100%"
        height="100%"
        maxPixelCount={320 * 320}
      />
    ),
  },
  // recurrence — lunargent water, the same wave always returning
  // (Spiral auditioned 2026-07-16: "too on the nose, very twilight zone")
  time: {
    placement: "absorb",
    node: (speed) => (
      <Water
        colorBack="#00000000"
        colorHighlight={REALM_HEX.arcadia}
        highlights={0.5}
        layering={0.5}
        caustic={0.6}
        waves={0.4}
        size={0.6}
        speed={speed * 0.3}
        width="100%"
        height="100%"
        maxPixelCount={320 * 320}
      />
    ),
  },
  // space — the spacetime graph: an iron coordinate grid compressed toward
  // the coin's mass, inner space dragged around it faster than outer
  // (custom GLSL; DotOrbit, accretion ring, metaballs, warped checks, and
  // the zooming dot-grid all auditioned 2026-07-16 and retired)
  space: {
    placement: "absorb",
    node: (speed) => (
      <ShaderMount
        fragmentShader={SPACE_WELL_FRAG}
        uniforms={{ u_color: IRON_VEC4, u_intensity: 0.8 }}
        speed={speed}
        width="100%"
        height="100%"
        maxPixelCount={320 * 320}
      />
    ),
  },
  // primal life — emergence: grain-flecked green bursting outward from the
  // seed in expanding rings (owner: "it's a bursting forth" — the blob and
  // the metaballs both read as biology-textbook, retired)
  life: {
    placement: "absorb",
    node: (speed) => (
      <GrainGradient
        colorBack="#1c2315"
        colors={["#d8e3b4", REALM_HEX.wild, "#3a4426"]}
        shape="ripple"
        softness={0.6}
        intensity={0.6}
        noise={0.5}
        speed={speed * 0.45}
        width="100%"
        height="100%"
        maxPixelCount={320 * 320}
      />
    ),
  },
  // solid matter — molten LEAD, not mercury (owner tweak): darker tint,
  // fewer/softer stripes, and a brightness burn-down on the whole layer so
  // the chrome whites go matte
  matter: {
    placement: "absorb",
    node: (speed) => (
      <span
        style={{
          position: "absolute",
          inset: 0,
          filter: "brightness(0.72) contrast(0.94) saturate(0.9)",
        }}
      >
        <LiquidMetal
          shape="circle"
          scale={1.5}
          colorBack="#00000000"
          colorTint="#565c66"
          repetition={3}
          softness={0.8}
          distortion={0.12}
          contour={0.9}
          shiftRed={0}
          shiftBlue={0}
          speed={speed * 0.35}
          width="100%"
          height="100%"
          maxPixelCount={320 * 320}
        />
      </span>
    ),
  },
}

/** True when an Arcanum has a substance — lets the tile drop redundant CSS
 * effects (the specular glint) while the shader is the lit surface. */
export const hasSubstance = (arcanum: string): boolean =>
  arcanum.toLowerCase() in SUBSTANCES

/** Mount inside a lit tile, between the bloom and the glyph. Renders nothing
 * for Arcana still on pure CSS. */
export function ArcanaSubstance({ arcanum }: { arcanum: string }) {
  const reduced = useReducedMotion()
  const def = SUBSTANCES[arcanum.toLowerCase()]
  if (!def) return null
  return (
    <span
      aria-hidden
      className={`mv-arcana-substance ${
        def.placement === "absorb" ? "mv-substance-absorb" : "mv-substance-field"
      }`}
    >
      {def.motion ? (
        <span
          className={
            def.motion === "turn" ? "mv-substance-rotate" : "mv-substance-converge"
          }
        >
          {def.node(reduced ? 0 : 1)}
        </span>
      ) : (
        def.node(reduced ? 0 : 1)
      )}
    </span>
  )
}
