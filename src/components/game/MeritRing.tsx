// The Merits area (MAG-59; owner's direction 2026-10-27, kinesthetics
// approved on the dressing-room rig): Merits are a **ring of keys**. The
// ring is a wheel at the left — an infinite list, the key in hand always at
// the middle, driven by drag (coasting to land exactly on a key), trackpad
// (the stream drives it directly and it snaps when quiet), mouse notches
// (each pushes a spring-chased target) and the arrow keys. Each key is
// unique by its **mark** (merit-marks.tsx) and hangs verdigris when it has
// something to turn on this table, dim when it only opens things in the
// story, ember when turned. A white **reach** line runs from the ring across
// the gap to the **keyhole** on the **door**'s edge — the key in hand is
// strung on it — and stops short for a story key. The door holds what the
// key opens: the family, the name and dots, the book's sentence, a Fighting
// Style's ladder, and at its foot the act in the game's words only ("+2
// dice", Destiny's pips) — no English hat on what the look already says.
// Clicking the key in hand, or the keyhole, turns it: ember runs down the
// reach, light spills through the door's edge, the key's mark lifts as the
// door's sigil, and the dice land in the pool under the Merit's name.
//
// Key-ness is gestured, never drawn: no teeth, no tags; dots are dots. Every
// constant in the wheel section is an owner-tuned knob from the audition —
// change them with his hand on the rig, one number at a time.
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import {
  animate,
  motion,
  useAnimate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from "motion/react"
import { Match } from "effect"
import {
  diceOf,
  heldName,
  mechanicOf,
  merit,
  meritComponent,
  turns,
  type DerivedNumber,
  type HeldMerit,
  type MeritName,
} from "#/domain/merits"
import { amountAt } from "#/domain/merits"
import { purseComponent } from "#/domain/destiny-economy"
import { Destiny } from "#/domain/quantities"
import type { SheetMark } from "#/domain/flows/hand-edit"
import type { useDicePool } from "#/hooks/use-dice-pool"
import { DotRating } from "./DotRating"
import { Keyhole, Mark } from "./merit-marks"
import { periodic, ringName, wrapIndex, type PurseLevel } from "./merit-ring-look"
import { PurseNumeral } from "./CastHeaderStats"
import { TooltipProvider } from "#/components/ui/tooltip"

export type Pool = ReturnType<typeof useDicePool>

/**
 * The hand on the ring: what the keys may do here. A read-only sheet has no
 * pool — the keys hang and the doors open, nothing turns. The purse's refill
 * is the paper gesture (MAG-67), present on your own sheet.
 */
export interface Hand {
  readonly pool?: Pool | undefined
  /** Destiny's purse: what is left this chapter, and what it holds. */
  readonly destiny: PurseLevel
  readonly onMarkSheet?: ((mark: SheetMark) => Promise<unknown>) | undefined
}

const canToggle = (hand: Hand): boolean =>
  hand.pool !== undefined && (hand.pool.state === "idle" || hand.pool.state === "building")

/** Where the purse component sits in the pool (one purse exists), or −1. */
const purseIndex = (hand: Hand): number =>
  hand.pool?.context.components.findIndex((c) => c.type === "purse") ?? -1

/** Destiny dice staged into this roll: the purse component's dots. */
export const stagedOf = (hand: Hand): number =>
  hand.pool?.context.components[purseIndex(hand)]?.dots ?? 0

/** Stage exactly `dice` from the purse `h` into the pool (none takes them all back). */
export const setStaged = (hand: Hand, h: HeldMerit, dice: number): void => {
  const pool = hand.pool
  if (!pool) return
  const idx = purseIndex(hand)
  if (idx >= 0) pool.removeComponent(idx)
  if (dice > 0) pool.addComponent(purseComponent(h, dice))
}

/** Whether the key is turned: its dice are in the pool, or a pip of its purse is staged. */
export const litOf = (hand: Hand, h: HeldMerit): boolean =>
  Match.value(mechanicOf(h)).pipe(
    Match.tag("dice", () => hand.pool?.isComponentActive("merit", heldName(h)) ?? false),
    Match.tag("purse", () => stagedOf(hand) > 0),
    Match.tag("none", "derived", "gate", () => false),
    Match.exhaustive,
  )

/** Turn the key in hand: dice in or out of the pool; a purse stages one more pip, wrapping to none past what is left. */
export const turnKey = (hand: Hand, h: HeldMerit): void => {
  if (!canToggle(hand)) return
  Match.value(mechanicOf(h)).pipe(
    Match.tag("dice", () => hand.pool?.toggleComponent(meritComponent(h))),
    Match.tag("purse", () => setStaged(hand, h, (stagedOf(hand) + 1) % (hand.destiny.current + 1))),
    Match.tag("none", "derived", "gate", () => undefined),
    Match.exhaustive,
  )
}

/** A key that opens something on this table reaches the lock: it turns, gates a flow, or raises a number. */
const reaches = (h: HeldMerit): boolean =>
  Match.value(mechanicOf(h)).pipe(
    Match.tag("none", () => false),
    Match.tag("dice", "purse", "derived", "gate", () => true),
    Match.exhaustive,
  )

// ── The door's page ──────────────────────────────────────────────────────────

const dots = (n: number) => "•".repeat(n)
export const FAMILY_WORD = { mental: "Mental", physical: "Physical", social: "Social", awakened: "Awakened" } as const
/** The raised number's words at the door's foot, in the book's words: "+2 Initiative", "+1 wound penalty". */
const DERIVED_WORD: Record<DerivedNumber, string> = {
  initiative: "Initiative",
  speed: "Speed",
  size: "Size",
  woundPenalty: "wound penalty",
}

/** The eyebrow: the family. */
function Eyebrow({ name }: { name: MeritName }) {
  return (
    <span className="mv-data text-[9.5px] uppercase tracking-[0.14em]" style={{ color: "var(--dim)" }}>
      {FAMILY_WORD[merit(name).family]}
    </span>
  )
}

/** The ladder: a Fighting Style's rungs, the held ones in ink, the rest dim. */
function Ladder({ h }: { h: HeldMerit }) {
  const tiers = merit(h.name).tiers
  if (tiers === undefined) return null
  return (
    <ol className="grid gap-1.5">
      {tiers.map((t) => {
        const held = t.dots <= h.dots
        return (
          <li
            key={t.dots}
            className="grid grid-cols-[2.6rem_1fr] gap-x-2 text-[11.5px] leading-snug"
            style={{ color: held ? "var(--ink)" : "var(--dim)", opacity: held ? 1 : 0.7 }}
          >
            <span className="mv-data text-[10px] tracking-[0.1em]">{dots(t.dots)}</span>
            <span>
              <span className="mv-h text-[12.5px]">{t.name}</span>
              <span style={{ color: "var(--dim)" }}> — {t.effect}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** The door's page: the eyebrow, the name and its dots, the sentence, the
 * ladder. It scrolls when it is taller than the door. */
function DoorPage({ h, lit }: { h: HeldMerit; lit: boolean }) {
  return (
    <div className="grid content-start gap-2">
      <Eyebrow name={h.name} />
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-2">
          <span className="mv-h text-[18px] leading-none" style={{ color: lit ? "var(--ember)" : "var(--ink)" }}>
            {h.name}
          </span>
          {h.label !== undefined && (
            <span className="text-[12px]" style={{ color: "var(--dim)" }}>
              ({h.label})
            </span>
          )}
        </span>
        <DotRating current={h.dots} max={Math.max(5, h.dots)} active={lit} />
      </div>
      <p className="text-[12px] leading-snug" style={{ color: "var(--dim)" }}>
        {merit(h.name).effect}
      </p>
      <Ladder h={h} />
    </div>
  )
}

/** Destiny's purse at the door's foot (MAG-67; owner 2026-10-28: "we just
 * can't use pips for the points in the purse"): a numeral in the header's
 * grammar — what is left over what it holds, the dice staged into this
 * roll shown as a pending spend in ember — with the + above and − below
 * marking the purse's level (a refill at the chapter, the bane's cost) on
 * your own sheet. The dots at the door's top right are the Merit's rating,
 * as on every door; the purse is this number. */
function PurseFoot({ hand }: { hand: Hand }) {
  return (
    <TooltipProvider>
      <span className="mv-data text-[13px] leading-none" style={{ paddingBlock: 12 }}>
        <PurseNumeral
          label="Destiny"
          color="var(--accent)"
          current={hand.destiny.current}
          max={hand.destiny.capacity}
          pending={stagedOf(hand)}
          onNudge={
            hand.onMarkSheet !== undefined
              ? (next) => void hand.onMarkSheet?.({ destinyCurrent: Destiny.make(next) })
              : undefined
          }
        />
      </span>
    </TooltipProvider>
  )
}

/** The door's act, at its bottom right, in the game's words only: a chip
 * with the dice, lit ember when the key is turned; for a purse, the pips
 * themselves; for a raised number, the number's words in verdigris. A story
 * key has no foot — its page takes the whole door. */
function DoorFoot({ h, hand }: { h: HeldMerit; hand: Hand }) {
  const lit = litOf(hand, h)
  return Match.value(mechanicOf(h)).pipe(
    Match.tag("dice", () => {
      const n = diceOf(h)
      return (
        <button
          type="button"
          disabled={!canToggle(hand)}
          onClick={() => turnKey(hand, h)}
          className={`mv-trait mv-key ${lit ? "mv-trait-on" : ""} mv-data rounded-[3px] px-2.5 py-1.5 text-[12px]`}
          style={{ color: lit ? "var(--ember)" : "var(--ink)", boxShadow: lit ? undefined : "inset 0 0 0 1px var(--line)" }}
        >
          +{n} {n === 1 ? "die" : "dice"}
        </button>
      )
    }),
    Match.tag("purse", () => <PurseFoot hand={hand} />),
    Match.tag("derived", (m) => (
      <span
        className="mv-data rounded-[3px] px-2.5 py-1.5 text-[12px]"
        style={{ color: "var(--accent)", boxShadow: "inset 0 0 0 1px var(--line)" }}
      >
        +{amountAt(m.amount, h.dots)} {DERIVED_WORD[m.number]}
      </span>
    )),
    Match.tag("none", "gate", () => null),
    Match.exhaustive,
  )
}

/** Whether the door has a foot: anything but a story key or a gate (the gate's act is the cast's). */
const hasFoot = (h: HeldMerit): boolean =>
  Match.value(mechanicOf(h)).pipe(
    Match.tag("dice", "purse", "derived", () => true),
    Match.tag("none", "gate", () => false),
    Match.exhaustive,
  )

// ── The wheel: key and door ──────────────────────────────────────────────────
//
// An infinite list. Every key is positioned purely from the wheel's offset
// (a motion value, in rows) by modulo — the marquee pattern: an item's place
// wraps from one end of the period to the other where it cannot be seen, so
// no React state ever decides where a row is, and nothing can be a frame
// out of step. The period is the ring's length (or a few rings' worth when
// the ring is short, so the frame is always full). Landing is Motion's
// inertia with the target snapped to the grid; a wheel notch moves a target
// the wheel chases on a spring, so quick notches accelerate it and it stops
// dead on a key.

const ROW = 36 // one key's height on the wheel
const VISIBLE = 7 // rows in the frame, the key in hand at the middle
// the key in hand stands out: its neighbors give it this much air on each
// side, its mark grows from MARK to MARK_IN_HAND, its name from NAME to
// NAME_IN_HAND — every one of these a function of the wheel's offset, so
// the growth is as continuous as the scroll and never a frame behind it
const PART = 7
/** the keyhole on the door's edge, and how far short of it a still key stops */
export const KEYHOLE = 26
const REACH_SHORT = 22
/** the ring's clasp: the loop on the ring's line where it starts over */
const CLASP = 11
/** the sigil: the key in hand's mark, large and faint, on the door */
const SIGIL = 220
const SIGIL_OPACITY = 0.06
const SIGIL_OPACITY_TURNED = 0.2
/** the hinge: degrees a new page swings in from, about the door's edge */
const HINGE = -16
/** below this wheel speed (rows per second) a key change swings the page at once */
const SWING_SPEED = 3
const MARK = 26
export const MARK_IN_HAND = 36
// keys hang from the ring, so they lag it: while the wheel moves every key
// leans against the motion, pivoting where its stem meets the ring, and
// swings back once it stops. LEAN is degrees per row-per-second of wheel
// speed, capped at LEAN_MAX; zero either to switch it off.
const LEAN = 0.3
const LEAN_MAX = 6
const NAME = 10
export const NAME_IN_HAND = 12.5

function RingKey({
  h,
  position,
  period,
  offset,
  lean,
  hand,
  onTap,
  seam,
}: {
  h: HeldMerit
  /** this copy's home row; copies of one key sit a ring's length apart */
  position: number
  period: number
  offset: MotionValue<number>
  /** the keys' lean against the wheel's motion, degrees */
  lean: MotionValue<number>
  hand: Hand
  onTap: (position: number) => void
  seam: boolean
}) {
  // the row's distance from the middle, wrapped: beyond half a period it
  // comes round the other side — outside the frame, since the period is
  // longer than the frame
  const dist = useTransform(offset, (o) => periodic(period, position - o))
  // how far this row is "in hand": 1 at the middle, 0 a row away
  const lift = useTransform(dist, (d) => Math.max(0, 1 - Math.abs(d)))
  // rows a key or more from the middle step PART aside, so the key in hand
  // has air; a row on its way in slides the same distance it has come
  const y = useTransform(dist, (d) => d * ROW + Math.sign(d) * Math.min(Math.abs(d), 1) * PART)
  const x = useTransform(lift, (l) => l * 12)
  // the key's own tick to the ring fades as it comes to hand: the reach
  // line is the key in hand's stem, and a tick over it would cross it
  const stem = useTransform(lift, (l) => 10 + l * 14)
  const stemMargin = useTransform(stem, (w) => 10 - w)
  const stemOpacity = useTransform(lift, (l) => 1 - l)
  const markSize = useTransform(lift, (l) => MARK + l * (MARK_IN_HAND - MARK))
  const nameSize = useTransform(lift, (l) => NAME + l * (NAME_IN_HAND - NAME))
  const [near, setNear] = useState(Math.abs(dist.get()) < 0.5)
  useMotionValueEvent(dist, "change", (d) => setNear(Math.abs(d) < 0.5))
  const lit = litOf(hand, h)
  const acts = turns(h)
  // a key with something to turn hangs verdigris; a story key hangs dim
  // (ink when in hand); a turned key burns ember
  const ink = lit ? "var(--ember)" : acts ? "var(--accent)" : near ? "var(--ink)" : "var(--dim)"
  return (
    <motion.div className="absolute inset-x-0 top-1/2 -mt-[18px] h-[36px]" style={{ y }}>
      {/* the clasp: where the ring starts over, a loop on the ring's line
          rather than a cut across the row */}
      {seam && (
        <span
          aria-hidden
          className="absolute rounded-full"
          style={{
            left: 6 - CLASP / 2,
            top: -CLASP / 2,
            width: CLASP,
            height: CLASP,
            boxShadow: "inset 0 0 0 1.5px var(--dim)",
            background: "var(--bg)",
          }}
        />
      )}
      <motion.button
        type="button"
        onClick={() => onTap(position)}
        className={`mv-key absolute left-[6px] top-0 flex h-[36px] items-center gap-2 whitespace-nowrap text-left ${acts ? "" : "cursor-default"}`}
        style={{ x, rotate: lean, transformOrigin: "0 50%", color: ink, transition: "color 0.18s ease" }}
      >
        <motion.span
          aria-hidden
          className="block h-px"
          style={{ width: stem, marginLeft: stemMargin, opacity: stemOpacity, background: lit ? "var(--ember)" : "var(--line)" }}
        />
        {/* the mark and the name wear the sheet's background, so a key
            strung on the reach line sits on it rather than behind it */}
        <motion.span
          className="grid shrink-0 place-items-center rounded-full"
          style={{ width: markSize, height: markSize, background: "var(--bg)" }}
        >
          <Mark name={h.name} size="100%" turned={lit} />
        </motion.span>
        <motion.span className="mv-data uppercase tracking-[0.12em]" style={{ fontSize: nameSize, background: "var(--bg)", paddingInline: 3 }}>
          {ringName(h.name)}
          {h.label !== undefined && (
            <span className="normal-case tracking-normal" style={{ color: "var(--dim)" }}>
              {" "}
              ({h.label})
            </span>
          )}
        </motion.span>
      </motion.button>
    </motion.div>
  )
}

function Wheel({ held, hand }: { held: ReadonlyArray<HeldMerit>; hand: Hand }) {
  const reduced = useReducedMotion() ?? false
  const count = held.length
  // enough copies of the ring that the period outruns the frame, so a
  // copy only ever wraps where it cannot be seen
  const copies = Math.max(1, Math.ceil((VISIBLE + 1) / count))
  const period = count * copies
  // the wheel's position, in rows, unbounded
  const offset = useMotionValue(0)
  // the keys' lag: the wheel's speed, as a lean, smoothed on a spring so
  // the keys swing back and settle when the wheel stops. The ring pulls a
  // key up (offset growing), so its free end trails down: a positive turn.
  const velocity = useVelocity(offset)
  const leanRaw = useTransform(velocity, (v) => (reduced ? 0 : Math.max(-LEAN_MAX, Math.min(LEAN_MAX, v * LEAN))))
  const lean = useSpring(leanRaw, { stiffness: 320, damping: 18 })
  const [inHandIndex, setInHandIndex] = useState(0)
  useMotionValueEvent(offset, "change", (o) => {
    const i = wrapIndex(count, Math.round(o))
    if (i !== inHandIndex) setInHandIndex(i)
  })

  // the hinge: the door's page swings in when the key changes — but not
  // for every row a flick sends past the middle (that re-rasterized the
  // page per row and dropped frames), and not when the wheel lands either
  // (the owner, 2026-10-28: the page "refreshed" on settle — the page had
  // already changed in flight, so a swing then is a flash, not a change).
  // Only a change while the wheel is slow swings.
  const [page, swing] = useAnimate()
  const mounted = useRef(false)
  const doSwing = () => {
    if (reduced || !page.current) return
    swing(
      page.current,
      { transformPerspective: 900, rotateY: [HINGE, 0], x: [-4, 0], opacity: [0.3, 1] },
      { duration: 0.22, ease: "easeOut" },
    )
  }
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    if (Math.abs(offset.getVelocity()) < SWING_SPEED) doSwing()
    // the swing is owed to the key change alone
  }, [inHandIndex])

  /** Coast from a velocity (rows per second) and land exactly on a key.
   * animate() skips the inertia when the nominal target equals the current
   * value, so the target is always a row away in the direction of travel. */
  const coast = (v: number) =>
    animate(
      offset,
      offset.get() + (v >= 0 ? 1 : -1),
      reduced
        ? { duration: 0 }
        : { type: "inertia", velocity: v, power: 0.4, timeConstant: 200, modifyTarget: Math.round, restDelta: 0.002 },
    )
  /** Chase a key on a spring: quick pushes move the target further and the
   * wheel accelerates after it; it stops dead on the key. */
  const chase = (target: number) =>
    animate(offset, target, reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30, mass: 0.9 })
  // the target the notches push; it rests on the wheel's own position
  const target = useRef(0)
  const push = (by: number) => {
    const resting = Math.abs(offset.getVelocity()) < 0.05
    target.current = (resting ? Math.round(offset.get()) : target.current) + by
    chase(target.current)
  }

  // the wheel: a non-passive listener, so the page does not scroll with it.
  // A mouse wheel sends notches — whole, large deltas with a gap between
  // them — and each pushes the target one key on. A trackpad sends a stream
  // of small deltas, and macOS keeps the stream going as momentum after the
  // fingers lift; that stream turns the wheel directly, like a drag, with
  // no coast of our own (the OS already supplies one), and the wheel snaps
  // to the nearest key only once the stream has gone quiet.
  const frame = useRef<HTMLDivElement>(null)
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastWheel = useRef(0)
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const now = e.timeStamp
      const gap = now - lastWheel.current
      lastWheel.current = now
      const notch = Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 40 && gap > 80
      if (notch) {
        push(Math.sign(e.deltaY))
        return
      }
      offset.stop()
      offset.set(offset.get() + e.deltaY / ROW)
      if (settling.current) clearTimeout(settling.current)
      settling.current = setTimeout(() => chase(Math.round(offset.get())), 120)
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  })

  // drag: the wheel follows the pointer once it has moved, then coasts
  // with its velocity. The pointer is captured only once a drag is real,
  // so a plain click still reaches the key beneath it.
  const drag = useRef<{ pointerId: number; startY: number; startOffset: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const onPointerDown = (e: React.PointerEvent) => {
    offset.stop()
    suppressClick.current = false
    drag.current = { pointerId: e.pointerId, startY: e.clientY, startOffset: offset.get(), moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dy = d.startY - e.clientY
    if (!d.moved) {
      if (Math.abs(dy) <= 4) return
      d.moved = true
      e.currentTarget.setPointerCapture(d.pointerId)
    }
    offset.set(d.startOffset + dy / ROW)
  }
  const onPointerUp = () => {
    const d = drag.current
    if (!d) return
    drag.current = null
    if (!d.moved) return
    suppressClick.current = true
    coast(offset.getVelocity())
  }
  const onTap = (position: number) => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    const here = Math.round(offset.get())
    if (position !== here) {
      // the short way round the ring
      target.current = here + periodic(count, position - here)
      chase(target.current)
      return
    }
    turnKey(hand, held[wrapIndex(count, position)]!)
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      push(1)
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      push(-1)
    }
  }

  const inHand = held[inHandIndex]!
  const middle = (VISIBLE * ROW) / 2
  return (
    <div className="relative grid grid-cols-[minmax(0,15rem)_1fr] gap-x-8">
      <Reach h={inHand} hand={hand} middle={middle} />
      <div
        ref={frame}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="mv-key relative touch-none select-none overflow-hidden"
        style={{
          height: VISIBLE * ROW,
          cursor: "grab",
          // the wheel's edges fall into the dark
          maskImage: "linear-gradient(to bottom, transparent, black 22%, black 78%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 22%, black 78%, transparent)",
        }}
      >
        {/* the ring's line */}
        <span aria-hidden className="absolute inset-y-0 left-[6px] w-px" style={{ background: "var(--line)" }} />
        {Array.from({ length: copies }, (_, c) =>
          held.map((h, i) => (
            <RingKey
              key={`${heldName(h)}#${c}`}
              h={h}
              position={i + c * count}
              period={period}
              offset={offset}
              lean={lean}
              hand={hand}
              onTap={onTap}
              seam={i === 0}
            />
          )),
        )}
      </div>
      <Door h={inHand} hand={hand} middle={middle} pageRef={page} />
    </div>
  )
}

/** The reach: one line from the ring across the gap to the keyhole; the key
 * in hand is strung on it. A key that opens something on this table reaches
 * the lock; a key that only opens things in the story stops short of it.
 * Turned, ember runs down it from the ring to the lock. Positioned in a
 * `relative` grid of [15rem ring | 2rem gap | door]. */
export function Reach({ h, hand, middle }: { h: HeldMerit; hand: Hand; middle: number }) {
  const reduced = useReducedMotion() ?? false
  const lit = litOf(hand, h)
  return (
    <span
      aria-hidden
      className="absolute left-[6px] h-px"
      style={{
        top: middle,
        width: `calc(15rem + 2rem - 6px - ${reaches(h) ? KEYHOLE / 2 : REACH_SHORT}px)`,
        background: "var(--ink)",
        transition: "width 0.25s ease",
      }}
    >
      <motion.span
        className="absolute inset-0"
        style={{ background: "var(--ember)", transformOrigin: "0 50%", boxShadow: "0 0 6px var(--ember-glow)" }}
        initial={false}
        animate={{ scaleX: lit ? 1 : 0 }}
        transition={reduced ? { duration: 0 } : lit ? { duration: 0.24, ease: "easeOut" } : { duration: 0.18, ease: "easeIn" }}
      />
    </span>
  )
}

/** The door: what the key in hand opens. Its edge is a line broken around
 * the keyhole, and the keyhole is the turn. Light spills through the edge
 * once the key is turned; the door bears the key's mark as its sigil; the
 * page scrolls inside the door's fixed height and fades at its foot while
 * there is more; the act sits at the bottom right. `pageRef` lets the wheel
 * swing the page on its hinge. */
export function Door({
  h,
  hand,
  middle,
  pageRef,
  height = VISIBLE * ROW,
}: {
  h: HeldMerit
  hand: Hand
  /** the keyhole's height from the door's top */
  middle: number
  pageRef?: RefObject<HTMLDivElement | null>
  height?: number
}) {
  const reduced = useReducedMotion() ?? false
  const own = useRef<HTMLDivElement>(null)
  const page = pageRef ?? own
  // whether the page has more below the fold
  const [more, setMore] = useState(false)
  const measure = (el: HTMLElement) => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
  useEffect(() => {
    if (page.current) measure(page.current)
    // re-measured for the page in hand
  }, [h])
  const lit = litOf(hand, h)
  const acts = turns(h)
  // the reach and the keyhole are ink (ember when turned); a still key's
  // line stopping short says it, nothing else fades
  const ink = lit ? "var(--ember)" : "var(--ink)"
  return (
    <div className="relative grid min-w-0 grid-rows-[minmax(0,1fr)_auto] gap-3 pl-6" style={{ height }}>
      {/* light through the door */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(260px 200px at 0 ${middle}px, color-mix(in srgb, var(--ember) 16%, transparent), transparent 70%)`,
        }}
        initial={false}
        animate={{ opacity: lit ? 1 : 0 }}
        transition={reduced ? { duration: 0 } : lit ? { duration: 0.5, delay: 0.2 } : { duration: 0.3 }}
      />
      <span aria-hidden className="absolute left-0 top-0 w-px" style={{ height: middle - KEYHOLE / 2 - 4, background: "var(--line)" }} />
      <span aria-hidden className="absolute left-0 bottom-0 w-px" style={{ top: middle + KEYHOLE / 2 + 4, background: "var(--line)" }} />
      <button
        type="button"
        disabled={!canToggle(hand) || !acts}
        onClick={() => turnKey(hand, h)}
        aria-label={lit ? `Let ${h.name} go` : `Turn ${h.name}`}
        className={`mv-key absolute grid place-items-center ${acts ? "" : "cursor-default"}`}
        style={{ left: -KEYHOLE / 2, top: middle - KEYHOLE / 2, width: KEYHOLE, height: KEYHOLE, color: ink, transition: "color 0.3s" }}
      >
        <Keyhole size={KEYHOLE} lit={lit} />
      </button>
      {/* the sigil: whole, anchored in the bottom-right corner, lifting
          while the key is turned */}
      <span aria-hidden className="pointer-events-none absolute inset-0">
        <span
          className="absolute bottom-0 right-0"
          style={{
            color: lit ? "var(--ember)" : "var(--ink)",
            opacity: lit ? SIGIL_OPACITY_TURNED : SIGIL_OPACITY,
            transition: "color 0.3s, opacity 0.4s",
          }}
        >
          <Mark name={h.name} size={SIGIL} turned={lit} />
        </span>
      </span>
      <div
        ref={page}
        onScroll={(e) => measure(e.currentTarget)}
        className="relative min-h-0 overflow-y-auto pr-2"
        style={{
          transformOrigin: "0 50%",
          perspective: 900,
          maskImage: more ? "linear-gradient(to bottom, black calc(100% - 36px), transparent)" : undefined,
          WebkitMaskImage: more ? "linear-gradient(to bottom, black calc(100% - 36px), transparent)" : undefined,
        }}
      >
        <DoorPage h={h} lit={lit} />
      </div>
      {hasFoot(h) && (
        <div className="relative flex justify-end">
          <DoorFoot h={h} hand={hand} />
        </div>
      )}
    </div>
  )
}

/**
 * The Merits area on the sheet: the ring of keys and the door. Nothing
 * when no Merit is held — the section is absent then.
 */
export function MeritRing({ held, hand }: { held: ReadonlyArray<HeldMerit>; hand: Hand }): ReactNode {
  if (held.length === 0) return null
  return <Wheel held={held} hand={hand} />
}
