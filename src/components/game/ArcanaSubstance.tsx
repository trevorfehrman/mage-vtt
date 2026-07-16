import type { ReactNode } from "react"
import {
  DotOrbit,
  GemSmoke,
  GodRays,
  LiquidMetal,
  Metaballs,
  NeuroNoise,
  SmokeRing,
  Spiral,
  Warp,
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

  // destiny — KNOWN GAP: no catalog shader reads as the weave's threads
  // (SimplexNoise auditioned 2026-07-16 and rendered as blobs, not threads).
  // The right substance is React Bits' `Threads` GLSL ported into a custom
  // ShaderMount (research report §2) — until then Fate stays pure CSS, which
  // also keeps one lit CSS-only tile on the wall for comparison.
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
  // the veil — a mossy smoke ring breathing around the gateway glyph
  spirit: {
    placement: "field",
    node: (speed) => (
      <SmokeRing
        colorBack="#00000000"
        colors={[REALM_HEX.wild, "#c3cba0"]}
        radius={0.32}
        thickness={0.55}
        noiseScale={1.4}
        innerShape={0.4}
        speed={speed * 0.35}
        width="100%"
        height="100%"
        maxPixelCount={320 * 320}
      />
    ),
  },
  // entropy — a lead-grey smoke veil, barely moving
  death: {
    placement: "field",
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
  // recurrence — a lunargent spiral turning slow around the still coin
  time: {
    placement: "absorb",
    node: (speed) => (
      <Spiral
        colorBack="#00000000"
        colorFront={REALM_HEX.arcadia}
        density={0.5}
        strokeWidth={0.2}
        strokeTaper={0.4}
        distortion={0.12}
        softness={0.1}
        speed={speed * 0.25}
        width="100%"
        height="100%"
        maxPixelCount={320 * 320}
      />
    ),
  },
  // folded space — sparse iron sparks orbiting cell centers, a starfield ring
  space: {
    placement: "absorb",
    node: (speed) => (
      <DotOrbit
        colorBack="#00000000"
        colors={[REALM_HEX.pandemonium, "#d9a06a", "#6a4a3a"]}
        size={0.28}
        sizeRange={0.5}
        spreading={0.7}
        speed={speed * 0.35}
        width="100%"
        height="100%"
        maxPixelCount={320 * 320}
      />
    ),
  },
  // the vesica seed — gooey stone-green mass merging and dividing at the rim
  life: {
    placement: "absorb",
    node: (speed) => (
      <Metaballs
        colorBack="#00000000"
        colors={[REALM_HEX.wild, "#7a8657", "#b9c48f"]}
        count={6}
        size={0.72}
        speed={speed * 0.35}
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
