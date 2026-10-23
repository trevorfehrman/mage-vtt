import { Fragment } from "react"
import { Match, Schema } from "effect"
import { motion } from "motion/react"
import { Explosion } from "#/domain/dice"
import { BurstLook, burstEntrance, burstPlan } from "./burst-look"
import { DieSize, FaceTone, ringInk } from "./die-look"
import { UnifiedDie } from "./UnifiedDie"

/**
 * A rolled row drawn in the burst order (MAG-18): every explosion stands
 * beside the trigger that spawned it and springs out of it on arrival,
 * generation by generation. Under any look but `plain`, a trigger and its
 * children sit on one filled plate that never wraps apart (owner,
 * 2026-10-23), and the plate may carry an effect — a beam running its edge,
 * sparkles round the trigger, a heat shimmer, burst rays behind it. Effects
 * burn while `burning` and settle to a still state otherwise. The order is
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
  /** How a burst presents (the lineup; `plain` until the owner picks). */
  look: Schema.optional(BurstLook),
  /** The effect animates (fresh); otherwise it holds its still state. */
  burning: Schema.optional(Schema.Boolean),
})
type BurstFacesProps = typeof BurstFacesProps.Type

/** Four sparkle seats around the trigger, as % of its box, with staggered beats. */
const SPARKLES = [
  { top: "-30%", left: "60%", delay: "0s", size: 9 },
  { top: "70%", left: "-35%", delay: "0.7s", size: 7 },
  { top: "95%", left: "75%", delay: "1.3s", size: 8 },
  { top: "5%", left: "-25%", delay: "1.9s", size: 6 },
] as const

/** A twelve-point starburst, as an SVG polygon around (50,50). */
const RAYS = Array.from({ length: 24 }, (_, i) => {
  const r = i % 2 === 0 ? 50 : 30
  const a = (Math.PI * 2 * i) / 24
  return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`
}).join(" ")

function TriggerEffect({ look, ink, burning }: { look: BurstLook; ink: string; burning: boolean }) {
  const anim = burning ? "" : " mv-burst-still"
  return Match.value(look).pipe(
    Match.when("sparkles", () => (
      <>
        {SPARKLES.map((s, i) => (
          <svg
            key={i}
            aria-hidden
            viewBox="0 0 10 10"
            width={s.size}
            height={s.size}
            className={`mv-burst-sparkle${anim}`}
            style={{ position: "absolute", top: s.top, left: s.left, color: ink, animationDelay: s.delay, pointerEvents: "none" }}
          >
            <path d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z" fill="currentColor" />
          </svg>
        ))}
      </>
    )),
    Match.when("shimmer", () => (
      <span
        aria-hidden
        className={`mv-burst-shimmer${anim}`}
        style={{
          position: "absolute",
          inset: "-55%",
          borderRadius: "9999px",
          background: `radial-gradient(circle, color-mix(in srgb, ${ink} 55%, transparent) 0%, transparent 65%)`,
          zIndex: -1,
          pointerEvents: "none",
        }}
      />
    )),
    Match.when("rays", () => (
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className={`mv-burst-rays${anim}`}
        style={{ position: "absolute", inset: "-70%", zIndex: -1, pointerEvents: "none" }}
      >
        <polygon points={RAYS} fill={`color-mix(in srgb, ${ink} 40%, transparent)`} />
      </svg>
    )),
    Match.orElse(() => null),
  )
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
  ghostTitle,
  eaten = 0,
  className,
  look = "plain",
  burning = false,
}: BurstFacesProps) {
  const plan = burstPlan({ rolls, roteRerolls, explosions, eaten, contained, chance })
  const ink = ringInk(tone)
  const plated = look !== "plain"
  const live = burning && reduced !== true
  return (
    <div className={`flex flex-wrap items-center content-start ${className ?? ""}`.trimEnd()}>
      {plan.map((cluster) => {
        const chain = cluster.length > 1
        const onPlate = plated && chain
        return (
          <span
            key={cluster[0]!.index}
            data-burst={chain ? "chain" : "one"}
            className={onPlate ? "relative inline-flex items-center gap-3 rounded-full px-2.5 py-1.5" : "contents"}
            style={
              onPlate
                ? {
                    background: `color-mix(in srgb, ${ink} 16%, var(--raise))`,
                    boxShadow: `inset 0 1px 0 color-mix(in srgb, white 6%, transparent), 0 1px 3px rgba(0,0,0,.45)`,
                    isolation: "isolate",
                  }
                : undefined
            }
          >
            {onPlate && look === "beam" && (
              <span
                aria-hidden
                className={`mv-burst-beam${live ? "" : " mv-burst-still"}`}
                style={{ ["--beam-ink" as string]: ink }}
              />
            )}
            {cluster.map((die) => {
              const entrance = burstEntrance(die.generation, size, reduced)
              const isTrigger = onPlate && die.generation === 0
              return (
                <Fragment key={die.index}>
                  <motion.span
                    data-generation={die.generation}
                    style={{ display: "inline-grid", position: "relative" }}
                    initial={entrance.initial}
                    animate={entrance.animate}
                    transition={entrance.transition}
                  >
                    {isTrigger && <TriggerEffect look={look} ink={ink} burning={live} />}
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
