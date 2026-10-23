import { Fragment } from "react"
import { Schema } from "effect"
import { motion } from "motion/react"
import { Explosion } from "#/domain/dice"
import { PLATE_RADIUS, burstEntrance, burstPlan, platePad } from "./burst-look"
import { DieSize, FaceTone, ringInk } from "./die-look"
import { UnifiedDie } from "./UnifiedDie"

/**
 * A rolled row drawn in the burst order (MAG-18): every explosion stands
 * beside the trigger that spawned it and springs out of it on arrival,
 * generation by generation. Under any look but `plain`, a trigger and its
 * children sit on one filled plate that never wraps apart (owner,
 * 2026-10-23), with a slow fog of the plate's ink drifting behind the dice
 * while `burning`, held still otherwise. The order is
 * the domain's (`burstClusters`); legacy casts with no recorded parent get
 * the inline render they always had.
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
  /** A chain sits on its plate (the default); false draws the row bare. */
  plated: Schema.optional(Schema.Boolean),
  /** The fog drifts (fresh: the newest roll, a live cast); otherwise it holds still. */
  burning: Schema.optional(Schema.Boolean),
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
  plated = true,
  burning = false,
}: BurstFacesProps) {
  const plan = burstPlan({ rolls, roteRerolls, explosions, eaten, contained, chance })
  const ink = ringInk(tone)
  const live = burning && reduced !== true
  const pad = platePad(size)
  return (
    <div className={`flex flex-wrap items-center content-start ${className ?? ""}`.trimEnd()}>
      {plan.map((cluster) => {
        const chain = cluster.length > 1
        const onPlate = plated && chain
        return (
          <span
            key={cluster[0]!.index}
            data-burst={chain ? "chain" : "one"}
            className={onPlate ? "relative inline-flex items-center" : "contents"}
            style={
              onPlate
                ? {
                    // Flush: the plate clears the dice's points and is pulled
                    // out by the same, so the dice keep the row's grid and
                    // spacing ('gap: inherit') and the row keeps its height.
                    gap: "inherit",
                    padding: pad,
                    margin: -pad,
                    borderRadius: PLATE_RADIUS,
                    background: `color-mix(in srgb, ${ink} 12%, var(--raise))`,
                    boxShadow: `inset 0 1px 0 color-mix(in srgb, white 6%, transparent), 0 1px 3px rgba(0,0,0,.45)`,
                    isolation: "isolate",
                  }
                : undefined
            }
          >
            {onPlate && (
              <span
                aria-hidden
                data-fog
                className={`mv-plate-fog${live ? "" : " mv-burst-still"}`}
                style={{ ["--plate-ink" as string]: ink }}
              />
            )}
            {cluster.map((die) => {
              const entrance = burstEntrance(die.generation, size, reduced)
              return (
                <Fragment key={die.index}>
                  <motion.span
                    data-generation={die.generation}
                    style={{ display: "inline-grid", position: "relative" }}
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
                      ghost={die.ghost}
                      {...(tone !== undefined ? { tone } : {})}
                      {...(die.ring !== undefined ? { ring: die.ring } : {})}
                      {...(die.ghost && die.kind !== "eaten" && ghostTitle !== undefined ? { title: ghostTitle } : {})}
                    />
                  </motion.span>
                </Fragment>
              )
            })}
          </span>
        )
      })}
    </div>
  )
}
