import { useEffect, useState } from "react"
import { Schema } from "effect"
import { motion } from "motion/react"
import { Explosion } from "#/domain/dice"
import { burstEntrance, burstPlan, freshLeft, platePad } from "./burst-look"
import { DieSize, FaceTone, GhostInk, ringInk } from "./die-look"
import { UnifiedDie } from "./UnifiedDie"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "#/components/ui/tooltip"

/**
 * A rolled row drawn in the burst order (MAG-18): every explosion stands
 * beside the trigger that spawned it and springs out of it on arrival,
 * generation by generation. A trigger and its children sit on one filled
 * plate (owner, 2026-10-23) — flush, so its dice keep the row's grid — with
 * a slow fog of the plate's ink drifting behind them while the roll is
 * fresh (`rolledAt`, `FRESH_MS`), held still after. The order is the
 * domain's (`burstClusters`); legacy casts with no recorded parent get the
 * inline render they always had, never plated.
 */
/** What a ghost says under the pointer, and the ink of its cause (MAG-49). */
const GhostMark = Schema.Struct({ says: Schema.String, ink: Schema.optional(GhostInk) })

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
  /** The contained ghosts' tooltip and cause ink (MAG-49). */
  ghostMark: Schema.optional(GhostMark),
  /** Declared dice the containment bet ate: empty ghosts trailing the row. */
  eaten: Schema.optional(Schema.Number),
  /** The eaten ghosts' tooltip and cause ink. */
  eatenMark: Schema.optional(GhostMark),
  /** The row's gap in px — the felt's spacing, which the plate keeps and a child springs across. */
  gap: Schema.optional(Schema.Number),
  /** The row's margin and padding — the caller's felt sets them. */
  className: Schema.optional(Schema.String),
  /** A chain sits on its plate (the default); false draws the row bare. */
  plated: Schema.optional(Schema.Boolean),
  /** When the roll landed (epoch ms): its fog drifts for `FRESH_MS` after. */
  rolledAt: Schema.optional(Schema.Number),
  /** Overrides freshness (the audition's moving/still toggle). */
  burning: Schema.optional(Schema.Boolean),
})
type BurstFacesProps = typeof BurstFacesProps.Type

/**
 * Fresh for `FRESH_MS` after `rolledAt`. Read after mount, never during
 * render: the server's clock and the client's would disagree at hydration.
 */
function useFresh(rolledAt: number | undefined): boolean {
  const [fresh, setFresh] = useState(false)
  useEffect(() => {
    const left = rolledAt === undefined ? 0 : freshLeft(rolledAt, Date.now())
    setFresh(left > 0)
    if (left === 0) return
    const timer = window.setTimeout(() => setFresh(false), left)
    return () => window.clearTimeout(timer)
  }, [rolledAt])
  return fresh
}

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
  ghostMark,
  eaten = 0,
  eatenMark,
  gap = 12,
  className,
  plated = true,
  rolledAt,
  burning,
}: BurstFacesProps) {
  const plan = burstPlan({ rolls, roteRerolls, explosions, eaten, contained, chance })
  const fresh = useFresh(rolledAt)
  // Ghosts light by group under the pointer, like the felt's pool dice
  // (owner, 2026-10-25): the contained ones together, the eaten together.
  const [litGhosts, setLitGhosts] = useState<"contained" | "eaten" | null>(null)
  const live = (burning ?? fresh) && reduced !== true
  const pad = platePad(size)
  return (
    <TooltipProvider>
    <div className={`flex flex-wrap items-center content-start ${className ?? ""}`.trimEnd()} style={{ gap }}>
      {plan.map((cluster) => {
        const chain = cluster.length > 1
        const onPlate = plated && chain
        return (
          <span
            key={cluster[0]!.index}
            data-burst={chain ? "chain" : "one"}
            className={onPlate ? "mv-plate" : "contents"}
            // Flush: the plate clears the dice's points and is pulled out by
            // the same, so its dice keep the row's grid and the row its height.
            style={onPlate ? { padding: pad, margin: -pad, ["--plate-ink" as string]: ringInk(tone) } : undefined}
          >
            {onPlate && <span aria-hidden data-fog className={`mv-plate-fog${live ? "" : " mv-plate-fog-still"}`} />}
            {cluster.map((die) => {
              const entrance = burstEntrance(die.generation, size, gap, reduced)
              const eatenDie = die.kind === "eaten"
              // A ghost says why it isn't there, in a real tooltip (MAG-49).
              const mark = !die.ghost ? undefined : eatenDie ? eatenMark : ghostMark
              const says = mark?.says
              const ink = mark?.ink
              const ghostGroup = eatenDie ? "eaten" : "contained"
              const face = (
                <motion.span
                  key={die.index}
                  {...(says !== undefined
                    ? {
                        tabIndex: 0,
                        onPointerEnter: () => setLitGhosts(ghostGroup),
                        onPointerLeave: () => setLitGhosts(null),
                        onFocus: () => setLitGhosts(ghostGroup),
                        onBlur: () => setLitGhosts(null),
                      }
                    : {})}
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
                    {...(ink !== undefined ? { ghostInk: ink } : {})}
                    lit={die.ghost && litGhosts === ghostGroup}
                  />
                </motion.span>
              )
              return says === undefined ? (
                face
              ) : (
                <Tooltip key={die.index}>
                  <TooltipTrigger asChild>{face}</TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>{says}</TooltipContent>
                </Tooltip>
              )
            })}
          </span>
        )
      })}
    </div>
    </TooltipProvider>
  )
}
