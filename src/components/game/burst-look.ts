import { Array as Arr, Match, Schema } from "effect"
import { BurstDie, Explosion, burstClusters, isDieSuccess } from "#/domain/dice"
import { entranceSpring } from "#/components/ui/entrance"
import { DieSize, FaceRing, SIZE_LADDER, UNSEEN } from "./die-look"

/**
 * The burst's look rules (MAG-18), the pure half: how a felt lays out a roll
 * so every explosion stands beside the trigger that spawned it, and how a
 * child enters. The ORDER is the domain's (`burstClusters`, ADR-0024); this
 * file only adds what a render needs — each die's generation within its
 * cluster, whether it triggered the next, the eaten ghosts trailing the
 * row, the entrance per generation. How a trigger and a child DRESS is
 * `die-look.ts`'s (`BurstDress`): the relationship rides on the dice, not
 * the gap, so it survives a row wrap (owner, 2026-10-23). `BurstFaces.tsx`
 * lays the pixels.
 */

/**
 * The plate (owner's pick, 2026-10-23): a trigger and its children sit on
 * one filled plate that never wraps apart, with a slow fog of the plate's
 * ink drifting behind the dice. The radius and the fog are still being
 * auditioned. The fog burns while fresh and holds still otherwise;
 * ADR-0021 allows ambient motion when it is rare and earned.
 */
export const PlateFog = Schema.Literals(["none", "drift", "flow"])
export type PlateFog = typeof PlateFog.Type
export const Plate = Schema.Struct({
  /** Corner radius in px; "pill" is fully round. */
  radius: Schema.Union([Schema.Number, Schema.Literal("pill")]),
  fog: PlateFog,
})
export type Plate = typeof Plate.Type

/**
 * How far the plate reaches past its dice (owner, 2026-10-23: the dice must
 * stay on the row's grid). A diamond's point overhangs its box by
 * px·(√2−1)/2, so the plate clears the points by 2px — and the plate is
 * pulled out by the same amount (negative margin), so its dice sit exactly
 * where they would bare and the row's height never changes.
 */
export const platePad = (size: DieSize): number =>
  Math.round((SIZE_LADDER[size].px * (Math.SQRT2 - 1)) / 2) + 2

/** The owner's pick (2026-10-23): nearly square — 3px, an echo of the die's own 4px — with the drifting fog. */
export const PLATE: Plate = { radius: 3, fog: "drift" }

/** The row's gap a child springs across — one box and a gap to its left is where its trigger stands. */
const FELT_GAP = 12
/** One beat of the chain: each generation springs out this much later (s). */
export const BURST_BEAT = 0.09

/** The domain's burst die plus what a render needs; `index` stays the
 * row-unique key (an eaten ghost takes the next free positions). */
export const BurstFace = Schema.Struct({
  ...BurstDie.fields,
  kind: Schema.Literals([...BurstDie.fields.kind.literals, "eaten"]),
  /** 0 for a die that rolled in its own right, 1 for its child, 2 for the
   * child's child — the position in the chain, which is also the beat. */
  generation: Schema.Number,
  /** Not (yet) real: eaten before the throw, or a success the bet absorbs. */
  ghost: Schema.Boolean,
  /** The ring its kind wears: a rote reroll's, an explosion's, or none. */
  ring: Schema.optionalKey(FaceRing),
  /** Only a base roll can be the chance die (chance dice never explode). */
  chance: Schema.Boolean,
  /** This die spawned the next die in its cluster. */
  trigger: Schema.Boolean,
})
export type BurstFace = typeof BurstFace.Type

export const BurstInput = Schema.Struct({
  rolls: Schema.Array(Schema.Number),
  roteRerolls: Schema.Array(Schema.Number),
  explosions: Schema.Array(Explosion),
  /** Declared dice that never rolled — the containment bet ate them. */
  eaten: Schema.Number,
  /** Successes the containment bet absorbs: that many ghost from the row's end. */
  contained: Schema.Number,
  /** The base roll was a chance die (only a 10 succeeds; it never explodes). */
  chance: Schema.Boolean,
})
export type BurstInput = typeof BurstInput.Type

/**
 * The burst order with generations: `burstClusters` puts each base die first
 * and its chain behind it, so a die's position in its cluster IS its
 * generation. Legacy or unhonorable explosions come back as single-die
 * clusters (generation 0, no tether) — the inline render they always had.
 * Eaten ghosts trail the whole row. The successes the containment bet
 * absorbs ghost "from the row's end" (ADR-0022, MAG-45) — and the row is
 * the BURST row, the one the eye walks, so the last `contained` successes
 * in this order ghost, misses passed over, a chance die's 10 its only
 * success.
 */
export const burstPlan = ({ rolls, roteRerolls, explosions, eaten, contained, chance }: BurstInput): Array<Array<BurstFace>> => {
  const clusters = burstClusters(rolls, roteRerolls, explosions).map((cluster) =>
    cluster.map((die, generation) => ({ ...die, generation })),
  )
  const absorbed = clusters
    .flat()
    .reduceRight<{ left: number; indices: ReadonlyArray<number> }>(
      ({ left, indices }, die) => {
        const hit = left > 0 && isDieSuccess(die.value, die.kind === "roll" && chance)
        return hit ? { left: left - 1, indices: [...indices, die.index] } : { left, indices }
      },
      { left: contained, indices: [] },
    ).indices
  const faces = clusters.map((cluster) =>
    cluster.map(
      (die, at): BurstFace => ({
        ...die,
        ghost: absorbed.includes(die.index),
        trigger: at < cluster.length - 1,
        ...dressing(die.kind, chance),
      }),
    ),
  )
  const combined = rolls.length + roteRerolls.length + explosions.length
  // makeBy normalizes its count to >= 1, so an empty bet is guarded by hand.
  const ghosts =
    eaten > 0
      ? Arr.makeBy(eaten, (i): Array<BurstFace> => [
          { value: 0, index: combined + i, kind: "eaten", generation: 0, ghost: true, chance: false, trigger: false },
        ])
      : []
  return [...faces, ...ghosts]
}

/** What each kind wears — one dispatch, so a new kind fails to compile here. */
const dressing = (kind: BurstFace["kind"], chance: boolean): { ring?: FaceRing; chance: boolean } =>
  Match.value(kind).pipe(
    Match.when("roll", () => ({ chance })),
    Match.when("rote", () => ({ ring: "rote" as const, chance: false })),
    Match.when("explosion", () => ({ ring: "exp" as const, chance: false })),
    Match.when("eaten", () => ({ chance: false })),
    Match.exhaustive,
  )

const Stance = Schema.Struct({ x: Schema.Number, scale: Schema.Number, opacity: Schema.Number })
const Spring = Schema.Struct({
  type: Schema.Literal("spring"),
  stiffness: Schema.Number,
  damping: Schema.Number,
  mass: Schema.Number,
  delay: Schema.Number,
})
const Still = Schema.Struct({ duration: Schema.Number })

/** What a die hands `motion`: where it starts (or `false`: it stands), where it lands, how. */
export const BurstEntrance = Schema.Struct({
  initial: Schema.Union([Schema.Literal(false), Stance]),
  animate: Stance,
  transition: Schema.Union([Still, Spring]),
})
export type BurstEntrance = typeof BurstEntrance.Type

const STANDING = { x: 0, scale: 1, opacity: 1 } as const

/**
 * The trigger stands where the row put it. A child springs OUT of the die
 * before it — from one box-and-tether to its left, small and unseen, with
 * the felt's accrete spring — each generation one beat after the last, so a
 * chain reads as cause, then effect, then effect's effect. Reduced motion:
 * every die stands at once; the grouping and the tethers still say it.
 */
export const burstEntrance = (generation: number, size: DieSize, reduced: boolean | null): BurstEntrance =>
  generation === 0 || reduced === true
    ? { initial: false, animate: STANDING, transition: { duration: 0 } }
    : {
        initial: { x: -(SIZE_LADDER[size].px + FELT_GAP), ...UNSEEN },
        animate: STANDING,
        transition: { ...entranceSpring, delay: BURST_BEAT * (generation - 1) },
      }
