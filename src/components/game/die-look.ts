import { Match, Schema } from "effect"
import { isDieDramaticFailure, isDieExplosive, isDieSuccess } from "#/domain/dice"

/**
 * The unified die's look rules (MAG-13), the pure half: everything about how
 * a die is drawn that is a RULE rather than a render — geometry, provenance
 * inks, outcome tones, the ghost — so `UnifiedDie.tsx` only lays pixels.
 *
 * The owner's four decisions from the 2026-10-22 dressing-room tour, where
 * the old `FeltDie` and `Die` turned out to be two slightly different
 * diamonds:
 *  - radius 4px (the felt's), both modes;
 *  - every die's base outline is a 1px border INSIDE the box, so a pool die
 *    and a rolled face occupy exactly the same pixels; rote/explosion rings
 *    stay an extra box-shadow OUTSIDE it;
 *  - one ghost recipe: dashed in the die's own ink over a transparent body,
 *    45% — a price being weighed and a die eaten before the throw are the
 *    same "not (yet) real" mark;
 *  - the 20/24 ladder stays; callers keep the sizes they pass today.
 */

// --- The one diamond geometry ---

export const DIAMOND_ROTATION = 45
const DIAMOND_RADIUS = "rounded-[4px]"
const GHOST_OPACITY = 0.45

export const DieSize = Schema.Literals(["sm", "md"])
export type DieSize = typeof DieSize.Type

const SizeRung = Schema.Struct({
  box: Schema.String,
  text: Schema.String,
  glyph: Schema.Number,
})

/** One size ladder for both modes. `md` is the vulgar floor — nothing inside
 * one renders under 12px (#114). Glyph and text scale with the box. */
export const SIZE_LADDER: Record<DieSize, typeof SizeRung.Type> = {
  sm: { box: "size-[20px]", text: "text-[10px]", glyph: 12 },
  md: { box: "size-[24px]", text: "text-[12px]", glyph: 14 },
}

/** The box every die stands in: one grid, one radius, the ladder's size. */
export const shapeClass = (size: DieSize): string =>
  `grid ${SIZE_LADDER[size].box} place-items-center ${DIAMOND_RADIUS}`

// --- The look a die wears ---

export const DieLook = Schema.Struct({
  border: Schema.String,
  background: Schema.String,
  color: Schema.optionalKey(Schema.String),
  boxShadow: Schema.optionalKey(Schema.String),
  opacity: Schema.optionalKey(Schema.Number),
})
export type DieLook = typeof DieLook.Type

/** The one ghost recipe (#102's pending grammar). */
const ghostLook = (ink: string): DieLook => ({
  border: `1px dashed ${ink}`,
  background: "transparent",
  opacity: GHOST_OPACITY,
})

// --- Pool mode (the FeltDie job) ---

export const PoolKind = Schema.Literals(["sheet", "loose", "willpower", "paradox", "paradoxBase"])
export type PoolKind = typeof PoolKind.Type

const Ink = Schema.Struct({ border: Schema.String, background: Schema.String })

/** Provenance inks, unchanged from the felt: sheet dice verdigris, loose
 * dice neutral, Willpower ember, Paradox red, reality's base dice the
 * sheet's green with the red torn circle inside (pass 3, note 6). */
const POOL_INK: Record<PoolKind, typeof Ink.Type> = {
  sheet: {
    border: "var(--accent)",
    background: "color-mix(in srgb, var(--accent) 22%, transparent)",
  },
  loose: {
    border: "var(--dim)",
    background: "color-mix(in srgb, var(--ink) 6%, transparent)",
  },
  willpower: {
    border: "var(--ember)",
    background: "var(--ember-glow)",
  },
  // The Tides die comes from circumstance, so it wears the loose die's neutral;
  // the red glyph alone says reality rolls it (provenance grammar, 2026-10-22).
  paradox: {
    border: "var(--dim)",
    background: "color-mix(in srgb, var(--ink) 6%, transparent)",
  },
  paradoxBase: {
    border: "var(--accent)",
    background: "color-mix(in srgb, var(--accent) 22%, transparent)",
  },
}

export const poolLook = (kind: PoolKind, ghost: boolean): DieLook =>
  ghost
    ? ghostLook(POOL_INK[kind].border)
    : { border: `1px solid ${POOL_INK[kind].border}`, background: POOL_INK[kind].background }

/** Only reality's dice carry the torn-circle glyph inside the diamond. */
export const poolHasGlyph = (kind: PoolKind): boolean =>
  Match.value(kind).pipe(
    Match.when("paradox", () => true),
    Match.when("paradoxBase", () => true),
    Match.orElse(() => false),
  )

// --- Face mode (the Die job) ---

export const FaceTone = Schema.Literals(["paradox"])
export type FaceTone = typeof FaceTone.Type
export const FaceRing = Schema.Literals(["rote", "exp"])
export type FaceRing = typeof FaceRing.Type

export const FaceInput = Schema.Struct({
  v: Schema.Number,
  again: Schema.Number,
  chance: Schema.Boolean,
  /** "paradox" for reality's own dice: a success there is Paradox landing —
   * more is worse (#114) — so it fills and rings --paradox, never the
   * success green. */
  tone: Schema.optional(FaceTone),
  ring: Schema.optional(FaceRing),
  ghost: Schema.Boolean,
})
export type FaceInput = typeof FaceInput.Type

/** The ink a value wears on a filled face (the void, so the digit reads). */
const FILLED_INK = "var(--primary-foreground)"

/** The face's own inks: what a success fills with, what a ring draws in. */
const faceInks = (tone: FaceTone | undefined) =>
  Match.value(tone).pipe(
    Match.when("paradox", () => ({
      success: "var(--paradox)",
      ring: "var(--paradox)",
      miss: "color-mix(in srgb, var(--paradox) 45%, transparent)",
    })),
    Match.orElse(() => ({
      success: "var(--rail-success)",
      ring: "var(--accent)",
      miss: "var(--dim2)",
    })),
  )

/**
 * Every outcome judgment is the domain's (isDieSuccess / isDieDramaticFailure
 * / isDieExplosive); this only maps a judgment to ink. The chance die's 1
 * burns --bad, successes fill, misses keep a faint outline so the row reads
 * as every die thrown, and explosive faces ring outside the box.
 */
export const faceLook = ({ v, again, chance, tone, ring, ghost }: FaceInput): DieLook => {
  const inks = faceInks(tone)
  if (ghost) return ghostLook(inks.ring)
  const body = Match.value(v).pipe(
    Match.when(
      (x: number) => isDieDramaticFailure(x, chance),
      () => ({ border: "1px solid var(--bad)", background: "var(--bad)", color: FILLED_INK }),
    ),
    Match.when(
      (x: number) => isDieSuccess(x, chance),
      () => ({ border: `1px solid ${inks.success}`, background: inks.success, color: FILLED_INK }),
    ),
    Match.orElse(() => ({
      border: `1px solid ${inks.miss}`,
      background: "var(--raise)",
      color: "var(--dim)",
    })),
  )
  const halo = Match.value(ring).pipe(
    Match.when("rote", () => "0 0 0 1px var(--dim2)"),
    Match.when("exp", () => `0 0 0 1px ${inks.ring}`),
    Match.orElse(() => (isDieExplosive(v, again, chance) ? `0 0 0 1px ${inks.ring}` : undefined)),
  )
  return halo === undefined ? body : { ...body, boxShadow: halo }
}
