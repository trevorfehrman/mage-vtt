import { Match, Schema } from "effect"
import { motion } from "motion/react"
import { entranceSpring } from "#/components/ui/entrance"
import {
  DIAMOND_ROTATION,
  SIZE_LADDER,
  faceLook,
  poolClass,
  poolHasGlyph,
  poolLook,
  shapeClass,
  DieSize,
  FaceRing,
  FaceTone,
  type PoolKind,
} from "./die-look"
import { ArcanaGlyph } from "./ArcanaGlyph"

/**
 * The unified die primitive (MAG-13): one physical diamond that does both of
 * the app's die jobs behind a discriminated `mode` —
 *
 * - `pool` (the old `FeltDie` job): an unrolled die on the felt, valueless,
 *   colored by provenance kind, entering and leaving with the accrete spring;
 * - `face` (the old `Die` job): a rolled face, its tone read from the dice
 *   domain's outcome rules.
 *
 * Both modes share ONE geometry, ONE ghost, and ONE counter-rotation for
 * whatever stands inside the diamond (the Paradox glyph, the face value), so
 * a pool die resolving into a face is the same object changing state. The
 * rules live in `die-look.ts`; this file only lays them out. Built beside
 * `FeltDie`/`Die`; no caller is wired yet (MAG-15/16 do that).
 */

const COUNTER_ROTATE = { transform: `rotate(-${DIAMOND_ROTATION}deg)` } as const
const DIAMOND_STANCE = { transform: `rotate(${DIAMOND_ROTATION}deg)` } as const

/** Pool props carry a function (`onSkim`), so an interface (ADR-0017). */
interface PoolModeProps {
  mode: "pool"
  kind: PoolKind
  title: string
  /** The owner's `useReducedMotion()` — one read per tray, not per die. */
  reduced: boolean | null
  size?: DieSize
  ghost?: boolean
  /** The `layout` reflow glide — on for composing felts, off where the
   * surrounding frame snaps (the live Cast card, pass 3 note 8). */
  glide?: boolean
  onSkim?: (() => void) | undefined
  disabled?: boolean
  /** For `kind: "arcanum"`: which Arcanum's glyph stands inside the die. */
  arcanum?: string | undefined
}

/** Face props are all data, so a Schema (ADR-0017). */
const FaceModeProps = Schema.Struct({
  mode: Schema.Literal("face"),
  v: Schema.Number,
  again: Schema.Number,
  chance: Schema.optional(Schema.Boolean),
  tone: Schema.optional(FaceTone),
  ring: Schema.optional(FaceRing),
  size: Schema.optional(DieSize),
  /** A declared die that never rolled — eaten before the throw. */
  ghost: Schema.optional(Schema.Boolean),
  title: Schema.optional(Schema.String),
})
type FaceModeProps = typeof FaceModeProps.Type

export type UnifiedDieProps = PoolModeProps | FaceModeProps

/**
 * Skimmable dice are buttons; the rest are plain marks — not disabled
 * controls, so their titles stay reachable and nothing pretends to refuse.
 * Render inside an `<AnimatePresence initial={false}>`; presence reaches the
 * inner motion element through context, so exits play from the wrapper's key.
 */
function PoolDie({
  kind,
  title,
  reduced,
  size = "sm",
  ghost = false,
  glide = true,
  onSkim,
  disabled = false,
  arcanum,
}: PoolModeProps) {
  const look = poolLook(kind, ghost, arcanum)
  const anim = {
    layout: !reduced && glide,
    initial: { scale: 0.4, opacity: 0 },
    animate: { scale: 1, opacity: look.opacity ?? 1, rotate: DIAMOND_ROTATION },
    exit: { scale: 0.4, opacity: 0 },
    transition: reduced ? { duration: 0 } : entranceSpring,
  }
  // The die rotates into its diamond stance; the glyph counter-rotates so
  // it stays upright inside it.
  const { opacity: _presence, ...style } = look
  const mark =
    poolHasGlyph(kind) && arcanum !== undefined ? (
      <span
        className="grid place-items-center"
        style={{ ...COUNTER_ROTATE, color: look.border.replace(/^1px (solid|dashed) /, ""), opacity: 0.95 }}
        aria-hidden
      >
        <ArcanaGlyph arcanum={arcanum} size={SIZE_LADDER[size].glyph} />
      </span>
    ) : null
  const shape = `${shapeClass(size)} ${poolClass(kind, ghost, reduced)}`.trimEnd()
  return onSkim === undefined ? (
    <motion.span {...anim} title={title} className={shape} style={style}>
      {mark}
    </motion.span>
  ) : (
    <motion.button
      {...anim}
      onClick={(e) => {
        e.stopPropagation()
        onSkim()
      }}
      disabled={disabled}
      title={title}
      className={`${shape} cursor-pointer`}
      style={style}
    >
      {mark}
    </motion.button>
  )
}

function FaceDie({
  v,
  again,
  chance = false,
  tone,
  ring,
  size = "sm",
  ghost = false,
  title,
}: FaceModeProps) {
  const look = faceLook({ v, again, chance, tone, ring, ghost })
  const shape = shapeClass(size)
  if (ghost) {
    return (
      <span
        aria-hidden
        title={title ?? "Eaten by the containment bet — declared, never rolled"}
        className={shape}
        style={{ ...look, ...DIAMOND_STANCE }}
      />
    )
  }
  return (
    <span
      title={title}
      className={`mv-data ${shape} font-bold ${SIZE_LADDER[size].text}`}
      style={{ ...look, ...DIAMOND_STANCE }}
    >
      <span style={COUNTER_ROTATE}>{v}</span>
    </span>
  )
}

export function UnifiedDie(props: UnifiedDieProps) {
  return Match.value(props).pipe(
    Match.when({ mode: "pool" }, (p) => <PoolDie {...p} />),
    Match.when({ mode: "face" }, (p) => <FaceDie {...p} />),
    Match.exhaustive,
  )
}
