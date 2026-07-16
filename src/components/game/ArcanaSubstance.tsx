import type { ReactNode } from "react"
import {
  DotGrid,
  GemSmoke,
  GodRays,
  GrainGradient,
  LiquidMetal,
  MeshGradient,
  NeuroNoise,
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
  /** Whole-layer CSS motion (reduced-motion gated in styles.css):
   * "turn" rotates slowly (Death); "converge" breathes inward with a
   * slight angular drift (Space — distances shrinking). */
  motion?: "turn" | "converge"
}

const SUBSTANCES: Record<string, SubstanceDef> = {
  // ── Subtle row: the substance radiates out from the glyph ──

  // destiny — truchet pipework: angular silver pathways forever regenerating
  // (owner spec: "the pipe screensaver". SimplexNoise, Swirl, and NeuroNoise
  // all auditioned 2026-07-16 and retired — the last for rendering
  // literally-Mind.)
  fate: {
    placement: "field",
    node: (speed) => (
      <GrainGradient
        colorBack="#0d0f12"
        colors={[REALM_HEX.arcadia, "#7e8896", "#3a4149"]}
        shape="truchet"
        scale={0.16}
        softness={0}
        intensity={0.2}
        noise={1}
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
  // space — the coordinate lattice itself, slowly drawing inward: a static
  // iron dot-grid under a CSS convergence pulse (owner spec: coordinates,
  // relativity graphs, distances shrinking, angular momentum. DotOrbit, the
  // accretion ring, metaballs, and warped checks all retired — the checks
  // dissolve into camo under any distortion.)
  space: {
    placement: "absorb",
    motion: "converge",
    node: () => (
      <DotGrid
        colorBack="#00000000"
        colorFill={REALM_HEX.pandemonium}
        colorStroke="#e0a068"
        size={1.6}
        gapX={18}
        gapY={18}
        strokeWidth={0}
        sizeRange={0.35}
        opacityRange={0.55}
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
