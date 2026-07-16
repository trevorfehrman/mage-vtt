import type { ReactNode } from "react"
import {
  GemSmoke,
  GodRays,
  GrainGradient,
  LiquidMetal,
  MeshGradient,
  NeuroNoise,
  SmokeRing,
  Swirl,
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
 * All ten Arcana carry a substance (bench approved 2026-07-16 on Prime +
 * Matter; the other eight follow the research report's mapping). The row
 * grammar decides the placement: Subtle substances radiate from the glyph
 * ("field"), Gross substances flood the tile and gather at the rim while the
 * solid medallion holds against it ("absorb"). Substances run uncut, edge
 * to edge; caption legibility is structural, not tuned — name and dots ride
 * a frosted plate above the shader (styles.css .mv-arcana-caption).
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

interface SubstanceDef {
  /** Both fill the tile behind the glyph. "field" is the emission read
   * (strongest at the glyph, fading outward); "absorb" is the absorption
   * read (masked out of the center — mass gathers toward the rim while the
   * medallion holds the clear middle). */
  placement: "field" | "absorb"
  /** speed is 0 under prefers-reduced-motion — the shader renders one
   * static frame and cancels its rAF loop. */
  node: (speed: number) => ReactNode
}

const SUBSTANCES: Record<string, SubstanceDef> = {
  // ── Subtle row: the substance radiates out from the glyph ──

  // destiny — lunargent strands curving toward the weave's center
  // (SimplexNoise auditioned 2026-07-16: blobs, not threads. If Swirl reads
  // too spiral, next candidates: Voronoi as the web, or React Bits'
  // `Threads` GLSL ported into a custom ShaderMount — research report §2.)
  fate: {
    placement: "field",
    node: (speed) => (
      <Swirl
        colorBack="#0d0f12"
        colors={["#cdd6e2cc"]}
        bandCount={2}
        twist={0.06}
        center={0}
        proportion={0.55}
        softness={0.5}
        noise={0.2}
        noiseFrequency={0.5}
        speed={speed * 0.15}
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
  // entropy — a lead-grey smoke diamond, barely moving, riding high so the
  // caption never interrupts its geometry
  death: {
    placement: "field",
    node: (speed) => (
      <GemSmoke
        colorBack="#00000000"
        colors={[REALM_HEX.stygia, "#4a4f58"]}
        colorInner="#2a2d33"
        size={0.46}
        offsetY={0.14}
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
  // folded space — the accretion ring: rust-lit smoke around a dark hole
  // (DotOrbit auditioned 2026-07-16: too on the nose; owner inspo = the
  // black-hole photographs, and Spirit's old smoke ring re-tinted is that)
  space: {
    placement: "absorb",
    node: (speed) => (
      <SmokeRing
        colorBack="#00000000"
        colors={[REALM_HEX.pandemonium, "#e09a5a"]}
        radius={0.3}
        thickness={0.45}
        noiseScale={1.2}
        innerShape={0.6}
        speed={speed * 0.25}
        width="100%"
        height="100%"
        maxPixelCount={320 * 320}
      />
    ),
  },
  // primal life — a raw grain-flecked green mass, pulsing, not clinical
  // (Metaballs auditioned 2026-07-16: "amoebas or mitosis, too sciency")
  life: {
    placement: "absorb",
    node: (speed) => (
      <GrainGradient
        colorBack="#00000000"
        colors={[REALM_HEX.wild, "#6f7d4c", "#c9d4a4"]}
        shape="blob"
        softness={0.7}
        intensity={0.5}
        noise={0.55}
        speed={speed * 0.4}
        width="100%"
        height="100%"
        maxPixelCount={320 * 320}
      />
    ),
  },
  // solid matter — molten lead flooding the tile, drawn in toward the coin
  matter: {
    placement: "absorb",
    node: (speed) => (
      <LiquidMetal
        shape="circle"
        scale={1.5}
        colorBack="#00000000"
        colorTint={REALM_HEX.stygia}
        repetition={4}
        softness={0.6}
        distortion={0.12}
        contour={0.9}
        shiftRed={0}
        shiftBlue={0}
        speed={speed * 0.4}
        width="100%"
        height="100%"
        maxPixelCount={320 * 320}
      />
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
      {def.node(reduced ? 0 : 1)}
    </span>
  )
}
