import type { ReactNode } from "react"
import { GodRays, LiquidMetal } from "@paper-design/shaders-react"
import { useReducedMotion } from "motion/react"

/**
 * The substance layer of the Arcana material system (#84 audition, research:
 * docs/research/2026-07-16-arcana-shine-library-survey.md §1). The CSS
 * material is the idle body on all ten tiles; a substance shader is the lit
 * soul, mounted ONLY while its tile is lit so concurrent WebGL contexts stay
 * bounded (Chromium caps 16 desktop / 8 Android). The 0.45s fade-in rides the
 * same beat as the bloom and covers context-create + compile latency.
 *
 * BENCH (2026-07-16): two contrasting substances only — Prime (Subtle,
 * emission: God Rays radiating from the glyph) and Matter (Gross, absorption:
 * molten lead flooding the tile, masked out of the center so it gathers at
 * the rim while the medallion holds the clear middle). The other eight keep
 * pure CSS until the owner rules on these. Caption legibility is structural,
 * not tuned: every substance is masked out of the caption band (styles.css
 * .mv-substance-field / -absorb), so shaders can go loud above it.
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
        maxPixelCount={200 * 200}
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
        maxPixelCount={200 * 200}
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
