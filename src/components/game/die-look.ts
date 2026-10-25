import { Match, Schema } from "effect"
import { isDieDramaticFailure, isDieExplosive, isDieSuccess } from "#/domain/dice"
import { arcanumRealm } from "./ArcanaGlyph"

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
/** Where a die is before it lands — small and unseen; the accrete spring brings it in. */
export const UNSEEN = { scale: 0.4, opacity: 0 } as const
const GHOST_OPACITY = 0.45

export const DieSize = Schema.Literals(["sm", "md"])
export type DieSize = typeof DieSize.Type

const SizeRung = Schema.Struct({
  box: Schema.String,
  text: Schema.String,
  glyph: Schema.Number,
  /** The box's side in px — what a burst child travels from (MAG-18). */
  px: Schema.Number,
})

/** One size ladder for both modes. `md` is the vulgar floor — nothing inside
 * one renders under 12px (#114). Glyph and text scale with the box. */
export const SIZE_LADDER: Record<DieSize, typeof SizeRung.Type> = {
  sm: { box: "size-[20px]", text: "text-[10px]", glyph: 12, px: 20 },
  md: { box: "size-[24px]", text: "text-[12px]", glyph: 14, px: 24 },
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

export const PoolKind = Schema.Literals(["sheet", "loose", "arcanum", "highSpeech", "willpower", "paradox", "paradoxBase"])
export type PoolKind = typeof PoolKind.Type

const Ink = Schema.Struct({ border: Schema.String, background: Schema.String })

/** An ink thinned to a percentage over the felt. */
const dilute = (ink: string, pct: number): string => `color-mix(in srgb, ${ink} ${pct}%, transparent)`

/** How deep the Willpower die fills at rest — and how deep any lit die of
 * the mage's fills: the ember's depth is the "come forward" depth. */
const WILL_DEPTH = 45

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
  // The Arcanum's dice: neutral for now (no Arcanum has a canonical hue), the
  // Arcanum's glyph inside says which (felt audition, 2026-10-22).
  arcanum: {
    border: "var(--dim)",
    background: "color-mix(in srgb, var(--ink) 6%, transparent)",
  },
  // High Speech: the Supernal tongue, spoken — white, the one ink that is
  // no identity's (felt audition, 2026-10-22).
  highSpeech: {
    border: "var(--ink)",
    background: "color-mix(in srgb, var(--ink) 22%, transparent)",
  },
  willpower: {
    border: "var(--will)",
    background: dilute("var(--will)", WILL_DEPTH),
  },
  // The Tides' dice: red, the scene's special circumstances (felt audition,
  // 2026-10-22). Reality's section of the felt says whose they are; no glyph.
  // Solid, the die is a HOLE (see `HOLE` below); this ink is its rim and
  // what its ghost is dashed in.
  paradox: {
    border: "var(--paradox)",
    background: "var(--scorch)",
  },
  // Reality's own base dice: Gnosis green, and a hole like the Tides' dice
  // (owner, 2026-10-22 evening: "the green ones should have the hole too").
  paradoxBase: {
    border: "var(--accent)",
    background: "var(--scorch)",
  },
}

/** An Arcanum's dice wear its Supernal realm's metal (Death → Stygia's lead). */
const realmInk = (arcanum: string): typeof Ink.Type => {
  const realm = arcanumRealm(arcanum.toLowerCase())
  return {
    border: `var(--realm-${realm})`,
    background: `color-mix(in srgb, var(--realm-${realm}) 22%, transparent)`,
  }
}

/** Reality's dice are holes (owner's call, 2026-10-22 evening): the only
 * pool dice DARKER than the felt — an opaque scorch, blacker than the void,
 * with the die's own ink burning in from the rim (red for the Tides' dice,
 * verdigris for the Gnosis base). No symbol, same box, same stance; reads as
 * a die first and as a wound in the felt second. The static burn is this
 * inset shadow; `poolClass` adds the slow breathing over it. */
const holeBurn = (ink: string): string => `inset 0 0 3px 1px ${dilute(ink, 70)}`

/** The group-hover glow (the badges work, 2026-10-22 evening; MAG-16 moves
 * it off the old FeltDie): a lit die wears a 1px ring in its own ink and an
 * 8px bloom of it, both OUTSIDE the box so the geometry never moves. */
const litHalo = (ink: string): string => `0 0 0 1px ${ink}, 0 0 8px 1px ${dilute(ink, 70)}`

/** How far the other groups settle back while one is lit — a step, not a fade. */
const SETTLE_OPACITY = 0.4

/** The group hover's other half: while a group is lit (its dice glow,
 * `litHalo`), every other group's dice settle back a step. */
export const settleOpacity = (lit: PoolKind | null, kind: PoolKind): number =>
  lit !== null && lit !== kind ? SETTLE_OPACITY : 1

export const PoolInput = Schema.Struct({
  kind: PoolKind,
  /** The one ghost recipe: a price being weighed, or a die eaten before the throw. */
  ghost: Schema.Boolean,
  /** The die's group is under the pointer (the Cast card's group hover). A
   * ghost never lights — what is not (yet) real has nothing to come forward. */
  lit: Schema.Boolean,
  /** The ghost's ink when it isn't the die's own: the CAUSE of its absence
   * (MAG-49, owner 2026-10-25: "the color of the reason they aren't there"). */
  ghostInk: Schema.optional(Schema.String),
  /** For `kind: "arcanum"`: which Arcanum's realm metal the die wears. */
  arcanum: Schema.optional(Schema.String),
})
export type PoolInput = typeof PoolInput.Type

export const poolLook = ({ kind, ghost, lit, arcanum, ghostInk }: PoolInput): DieLook => {
  const ink = kind === "arcanum" && arcanum !== undefined ? realmInk(arcanum) : POOL_INK[kind]
  if (ghost) return ghostLook(ghostInk ?? ink.border)
  const solid: DieLook = { border: `1px solid ${ink.border}`, background: ink.background }
  return Match.value(kind).pipe(
    // A hole keeps its scorch when lit — the ring and bloom join the burn outside it.
    Match.whenOr("paradox", "paradoxBase", () => ({
      ...solid,
      boxShadow: lit ? `${holeBurn(ink.border)}, ${litHalo(ink.border)}` : holeBurn(ink.border),
    })),
    Match.orElse(() =>
      lit
        ? {
            ...solid,
            background: dilute(ink.border, WILL_DEPTH),
            boxShadow: litHalo(ink.border),
          }
        : solid,
    ),
  )
}

/** The classes a pool die wears beyond its look: a hole names its burn ink
 * (`mv-hole-*` sets `--burn`) and breathes (`mv-hole-breathe`). Ghosts never
 * breathe (a price being weighed is still), a lit hole holds its breath (the
 * glow is the attention), and a reduced-motion owner gets the still burn
 * (the stylesheet also stops it). */
export const poolClass = ({ kind, ghost, lit }: PoolInput, reduced: boolean | null): string => {
  const breathe = ghost || lit || reduced === true ? "" : " mv-hole-breathe"
  return Match.value(kind).pipe(
    Match.when("paradox", () => `mv-hole-paradox${breathe}`),
    Match.when("paradoxBase", () => `mv-hole-base${breathe}`),
    Match.orElse(() => ""),
  )
}

/** Only an Arcanum's dice carry a glyph inside the diamond (the Arcanum's own). */
export const poolHasGlyph = (kind: PoolKind): boolean =>
  Match.value(kind).pipe(
    Match.when("arcanum", () => true),
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
  /** As the pool die's: the ghost wears its cause's ink (MAG-49). */
  ghostInk: Schema.optional(Schema.String),
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

/** The ink a face's ring draws in — and the tint of the plate a burst sits on (MAG-18). */
export const ringInk = (tone: FaceTone | undefined): string => faceInks(tone).ring

/**
 * Every outcome judgment is the domain's (isDieSuccess / isDieDramaticFailure
 * / isDieExplosive); this only maps a judgment to ink. The chance die's 1
 * burns --bad, successes fill, misses keep a faint outline so the row reads
 * as every die thrown, and explosive faces ring outside the box.
 */
export const faceLook = ({ v, again, chance, tone, ring, ghost, ghostInk }: FaceInput): DieLook => {
  const inks = faceInks(tone)
  if (ghost) return ghostLook(ghostInk ?? inks.ring)
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
