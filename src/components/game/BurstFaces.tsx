import { Fragment } from "react"
import { Schema } from "effect"
import { motion } from "motion/react"
import { Explosion } from "#/domain/dice"
import { burstEntrance, burstPlan, tetherPx } from "./burst-look"
import { DieSize, FaceTone, ringInk } from "./die-look"
import { UnifiedDie } from "./UnifiedDie"

/**
 * A rolled row drawn in the burst order (MAG-18): every explosion stands
 * beside the trigger that spawned it, tethered by a hairline in the
 * trigger's ink, and springs out of it on arrival — generation by
 * generation, so a ten-again reads as cause and effect on every seat. The
 * Chronicle's roll cards and the Cast card's two resolved rows all draw
 * through here; the rules are `burst-look.ts`'s and the order is the
 * domain's (`burstClusters`). Legacy casts with no recorded parent get the
 * inline render they always had — single dice, no tether, no motion.
 */
const BurstFacesProps = Schema.Struct({
  rolls: Schema.Array(Schema.Number),
  roteRerolls: Schema.Array(Schema.Number),
  explosions: Schema.Array(Explosion),
  again: Schema.Number,
  /** The row was a chance die: only the base roll can be one (chance dice never explode). */
  chance: Schema.optional(Schema.Boolean),
  tone: Schema.optional(FaceTone),
  size: Schema.optional(DieSize),
  /** The owner's `useReducedMotion()`. */
  reduced: Schema.NullOr(Schema.Boolean),
  /** Successes the containment bet absorbs: ghosted from the row's end. */
  contained: Schema.optional(Schema.Number),
  ghostTitle: Schema.optional(Schema.String),
  /** Declared dice the containment bet ate: empty ghosts trailing the row. */
  eaten: Schema.optional(Schema.Number),
  /** The row's gap and padding — the caller's felt sets them. */
  className: Schema.optional(Schema.String),
})
type BurstFacesProps = typeof BurstFacesProps.Type

export function BurstFaces({
  rolls,
  roteRerolls,
  explosions,
  again,
  chance = false,
  tone,
  size = "sm",
  reduced,
  contained = 0,
  ghostTitle,
  eaten = 0,
  className,
}: BurstFacesProps) {
  const plan = burstPlan({ rolls, roteRerolls, explosions, eaten, contained, chance })
  const ink = ringInk(tone)
  const tether = tetherPx(size)
  return (
    <div className={`flex flex-wrap content-start ${className ?? ""}`.trimEnd()}>
      {plan.map((cluster) => (
        <span
          key={cluster[0]!.index}
          data-burst={cluster.length > 1 ? "chain" : "one"}
          className="inline-flex items-center"
        >
          {cluster.map((die) => {
            const entrance = burstEntrance(die.generation, size, reduced)
            const eatenDie = die.kind === "eaten"
            const ghost = die.ghost
            return (
              <Fragment key={die.index}>
                {die.generation > 0 && (
                  <span
                    aria-hidden
                    data-tether
                    style={{ width: tether, height: 1, background: ink, flex: "none" }}
                  />
                )}
                <motion.span
                  data-generation={die.generation}
                  style={{ display: "inline-grid" }}
                  initial={entrance.initial}
                  animate={entrance.animate}
                  transition={entrance.transition}
                >
                  <UnifiedDie
                    mode="face"
                    v={die.value}
                    again={again}
                    chance={die.chance}
                    size={size}
                    ghost={ghost}
                    {...(tone !== undefined ? { tone } : {})}
                    {...(die.ring !== undefined ? { ring: die.ring } : {})}
                    {...(ghost && !eatenDie && ghostTitle !== undefined ? { title: ghostTitle } : {})}
                  />
                </motion.span>
              </Fragment>
            )
          })}
        </span>
      ))}
    </div>
  )
}
