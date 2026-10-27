// PROTOTYPE — the Merits-area audition for MAG-59, second round (2026-10-27).
// The owner's concept: Merits are a ring of keys — each one unique, everyone
// has their own ring, keys are added to it, and keys open things to do. Key-
// ness is gestured, never drawn (no teeth, no tags): the ring is a line the
// Merits hang from; each key is unique by its mark, a line glyph in the
// Arcana glyphs' stroke; turning is the one motion — a key that opens
// something on this table tilts on tap and burns ember, and the dice follow;
// a key that only opens things in the story hangs still; the sentence is a
// caption beneath the ring, one tap away. Dots are dots.
//
// Two renderings, mounted into the real sheet on the dressing room by its
// ?merits= knob (off | A | B) through a clearly-marked prototype slot on
// CharacterSheet. Throwaway: delete with the knob and the slot when the owner
// has picked, and build the winner properly (typed mechanic in the catalog,
// TDD'd leaves). The `-` prefix keeps this out of the route tree.
//
// Fourth round: all the keys at once, hover to bring one to hand, click to
// turn it. The owner: finding the right key must be fast and fluid — flow
// through them on mouse-over, the animation doing work (parting the
// neighbors, lifting the key, naming it) rather than decorating. The key in
// hand shows its sentence and verb beneath, so hovering IS looking it up;
// clicking the key in hand turns it (ember; the dice follow), clicking again
// lets it go. Turned keys stay lit on the ring. Fixed frame, no reflow.
//   A — Spread: the keys laid out along a line with room for every name;
//       hover lifts. (The owner's pick for the foundation, round five.)
//   B — Wheel: the keys on a vertical wheel at the left, drag or scroll it
//       and the key in hand is always the one at the middle, stepping toward
//       the door on the right where its description and verb wait. The
//       wheel is a motion value, so every frame is the compositor's, not
//       React's; it snaps to a key on a spring with the drag's velocity.
import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react"
import { merit, type HeldMerit, type MeritName } from "#/domain/merits"
import type { useDicePool } from "#/hooks/use-dice-pool"
import { DotRating } from "#/components/game/DotRating"

export const MERITS_AUDITION_ORDER = ["off", "A", "B"] as const
export type MeritsAuditionVariant = (typeof MERITS_AUDITION_ORDER)[number]
export const isMeritsAuditionVariant = (v: unknown): v is MeritsAuditionVariant =>
  typeof v === "string" && (MERITS_AUDITION_ORDER as ReadonlyArray<string>).includes(v)

export const AUDITION_VARIANT_NAMES: Record<MeritsAuditionVariant, string> = {
  off: "the branch's own section",
  A: "Spread — every key with room for its name; hover lifts one",
  B: "Wheel — drag or scroll; the key in hand is always at the middle; the door on the right",
}

/** The rig's Arctus holds two more Merits for the audition, so there is
 * something to turn and a purse to spend. */
export const AUDITION_MERITS: ReadonlyArray<HeldMerit> = [
  { name: "High Speech", dots: 1 },
  { name: "Danger Sense", dots: 2 },
  { name: "Destiny", dots: 2 },
  { name: "Status", dots: 1, label: "Mysterium" },
  { name: "Sanctum", dots: 1 },
  { name: "Library", dots: 2 },
  { name: "Occultation", dots: 1 },
  { name: "Contacts", dots: 1 },
]

// ── A stand-in for the typed mechanic the catalog will carry ─────────────────

type Mechanic =
  | { kind: "none" }
  | { kind: "dice"; dice: number }
  | { kind: "purse"; size: number }
  | { kind: "gate" }

const MECHANIC: Partial<Record<MeritName, (dots: number) => Mechanic>> = {
  "Danger Sense": () => ({ kind: "dice", dice: 2 }),
  Status: (dots) => ({ kind: "dice", dice: dots }),
  Allies: (dots) => ({ kind: "dice", dice: dots }),
  Fame: (dots) => ({ kind: "dice", dice: dots }),
  "Striking Looks": (dots) => ({ kind: "dice", dice: dots >= 4 ? 2 : 1 }),
  Destiny: (dots) => ({ kind: "purse", size: dots * 2 }),
  "High Speech": () => ({ kind: "gate" }),
}
const mechanicOf = (h: HeldMerit): Mechanic => MECHANIC[h.name]?.(h.dots) ?? { kind: "none" }

const keyOf = (h: HeldMerit) => `${h.name}${h.label === undefined ? "" : ` (${h.label})`}`

type Pool = ReturnType<typeof useDicePool>

const isLit = (pool: Pool, h: HeldMerit): boolean => pool.isComponentActive("modifier", keyOf(h))
const toggleDice = (pool: Pool, h: HeldMerit, dice: number) =>
  pool.toggleComponent({ type: "modifier", name: keyOf(h), dots: dice })
const spentOf = (pool: Pool, h: HeldMerit): number =>
  pool.context.components.find((c) => c.type === "modifier" && c.name === keyOf(h))?.dots ?? 0
const spend = (pool: Pool, h: HeldMerit, k: number) => {
  const idx = pool.context.components.findIndex((c) => c.type === "modifier" && c.name === keyOf(h))
  if (idx >= 0) pool.removeComponent(idx)
  if (k > 0) pool.addComponent({ type: "modifier", name: keyOf(h), dots: k })
}

// ── The marks: one line glyph per Merit, in the Arcana glyphs' stroke ────────
// (24-box, round caps, a bindi or barb as signature). Eight for the audition;
// the other forty-five are drawn only if the marks carry it.

const MARKS: Partial<Record<MeritName, ReactNode>> = {
  // the Atlantean tongue — a tongue of flame rising from parted lips
  "High Speech": <><path d="M6 15 Q12 20 18 15" /><path d="M12 14.5 C9.8 11.5 13.4 9.4 12 5.6" /><circle cx="12" cy="4" r="1.2" fill="currentColor" stroke="none" /></>,
  // the lidded eye, a barb of warning above it
  "Danger Sense": <><path d="M4 12.5 Q12 5.5 20 12.5 Q12 19.5 4 12.5 Z" /><circle cx="12" cy="12.5" r="1.6" fill="currentColor" stroke="none" /><path d="M12 5.5 V2.6 M12 2.6 L10.8 3.8 M12 2.6 L13.2 3.8" /></>,
  // the compass star, a point of fate at its heart
  Destiny: <><path d="M12 3 L13.5 10.5 L21 12 L13.5 13.5 L12 21 L10.5 13.5 L3 12 L10.5 10.5 Z" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></>,
  // the crest — a chevron over its bar, the standing marked at the peak
  Status: <><path d="M5 16 L12 6.5 L19 16" /><path d="M7.5 19.5 H16.5" /><circle cx="12" cy="4.4" r="1.2" fill="currentColor" stroke="none" /></>,
  // the arch — a doorway over its threshold, a hearth within
  Sanctum: <><path d="M6 20 V11 A6 6 0 0 1 18 11 V20" /><path d="M3.5 20 H20.5" /><circle cx="12" cy="14.5" r="1.3" fill="currentColor" stroke="none" /></>,
  // the stacked tome — its spine and leaves, one leaf turned
  Library: <><path d="M6 5 V19" /><path d="M6 5 H18 M6 9.5 H18 M6 14 H18 M6 18.5 H13" /><circle cx="17" cy="18.5" r="1.1" fill="currentColor" stroke="none" /></>,
  // the eclipse — a disc veiled by a second, the hidden self a sliver
  Occultation: <><circle cx="12" cy="12" r="7" /><path d="M9.5 5.5 A7 7 0 0 1 9.5 18.5" /><circle cx="7.6" cy="12" r="1.1" fill="currentColor" stroke="none" /></>,
  // the web — three knots and the threads between them
  Contacts: <><path d="M6 17 L12 7 L18 17 Z" /><circle cx="6" cy="17" r="1.3" fill="currentColor" stroke="none" /><circle cx="18" cy="17" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="7" r="1.3" fill="currentColor" stroke="none" /></>,
}

function Mark({ name, size, turned }: { name: MeritName; size: number; turned: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{
        transform: turned ? "rotate(-22deg)" : "rotate(0deg)",
        transformOrigin: "50% 50%",
        transition: "transform 0.22s ease, filter 0.3s",
        filter: turned ? "drop-shadow(0 0 5px var(--ember-glow))" : undefined,
      }}
    >
      {MARKS[name] ?? <circle cx="12" cy="12" r="6" />}
    </svg>
  )
}

/** The purse's pips: `size` of them, the first `spent` burning ember. */
function Pips({ size, spent }: { size: number; spent: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: size }, (_, i) => (
        <span
          key={i}
          className="inline-block size-[7px] rounded-full"
          style={{
            background: i < spent ? "var(--ember)" : "transparent",
            boxShadow: i < spent ? undefined : "inset 0 0 0 1px var(--accent)",
          }}
        />
      ))}
    </span>
  )
}

// ── The key in hand: its sentence and its verb ───────────────────────────────

function InHand({ h, pool, canToggle }: { h: HeldMerit; pool: Pool; canToggle: boolean }) {
  const mech = mechanicOf(h)
  const lit = mech.kind === "purse" ? spentOf(pool, h) > 0 : isLit(pool, h)
  return (
    <div className="grid min-h-[76px] content-start gap-2">
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
        {mech.kind === "purse" ? (
          <Pips size={mech.size} spent={spentOf(pool, h)} />
        ) : (
          <DotRating current={h.dots} max={Math.max(5, h.dots)} active={lit} />
        )}
      </div>
      <p className="text-[12px] leading-snug" style={{ color: "var(--dim)" }}>
        {merit(h.name).effect}
      </p>
      {/* the verb — the recitation line's place */}
      {mech.kind === "dice" && (
        <button
          type="button"
          disabled={!canToggle}
          onClick={() => toggleDice(pool, h, mech.dice)}
          className={`mv-trait ${lit ? "mv-trait-on" : ""} flex items-center justify-between rounded-[3px] px-2 py-1 text-left`}
        >
          <span className="text-[13px]">{lit ? "Turned" : "Turn"}</span>
          <span className="mv-data text-[12px]" style={{ color: lit ? "var(--ember)" : "var(--ink)" }}>
            {lit ? "in the pool" : `${mech.dice} ${mech.dice === 1 ? "die" : "dice"}`}
          </span>
        </button>
      )}
      {mech.kind === "purse" && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px]">{spentOf(pool, h) > 0 ? "Turned" : "Turn"}</span>
          <span className="flex gap-1">
            {Array.from({ length: mech.size }, (_, i) => {
              const on = i < spentOf(pool, h)
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!canToggle}
                  onClick={() => spend(pool, h, on && i === spentOf(pool, h) - 1 ? i : i + 1)}
                  className="grid size-[16px] place-items-center rounded-full"
                  title={on ? "Take it back" : `Spend ${i + 1}`}
                >
                  <span
                    className="inline-block size-[9px] rounded-full"
                    style={{ background: on ? "var(--ember)" : "transparent", boxShadow: on ? undefined : "inset 0 0 0 1px var(--accent)" }}
                  />
                </button>
              )
            })}
          </span>
        </div>
      )}
      {mech.kind === "gate" && (
        <span className="text-[11px] italic" style={{ color: "var(--dim)" }}>
          Declared with the cast.
        </span>
      )}
    </div>
  )
}

// ── Flowing through the ring ─────────────────────────────────────────────────

/** Snappy: a stiff spring that settles fast, so hovering across the ring
 * reads as fluid rather than as a sequence of animations. */
const SNAP = { type: "spring", stiffness: 900, damping: 42, mass: 0.6 } as const

const litOf = (pool: Pool, h: HeldMerit) => {
  const mech = mechanicOf(h)
  return mech.kind === "purse" ? spentOf(pool, h) > 0 : isLit(pool, h)
}
const turnsOf = (h: HeldMerit) => {
  const k = mechanicOf(h).kind
  return k === "dice" || k === "purse"
}
const turn = (h: HeldMerit, pool: Pool, canToggle: boolean) => {
  const mech = mechanicOf(h)
  if (!canToggle) return
  if (mech.kind === "dice") toggleDice(pool, h, mech.dice)
  if (mech.kind === "purse") spend(pool, h, (spentOf(pool, h) + 1) % (mech.size + 1))
}

/** How far a neighbor steps aside for the key in hand, by distance. */
const partBy = (distance: number, spread: readonly [number, number, number]) =>
  distance === 0 ? 0 : distance === 1 ? spread[0] : distance === 2 ? spread[1] : spread[2]

function Ring({
  held,
  pool,
  canToggle,
  pitch,
  spread,
  namesAtRest,
}: {
  held: ReadonlyArray<HeldMerit>
  pool: Pool
  canToggle: boolean
  /** horizontal distance between keys at rest */
  pitch: number
  /** how far neighbors part for the key in hand: next, second, further */
  spread: readonly [number, number, number]
  /** names under every key, or only under the one in hand */
  namesAtRest: boolean
}) {
  // the key in hand: the last one hovered (it stays in hand when the
  // pointer leaves, so what was read stays readable)
  const [hand, setHand] = useState<number | null>(null)
  const reduced = useReducedMotion() ?? false
  const inHand = hand === null ? undefined : held[hand]
  const width = (held.length - 1) * pitch + 72 + spread[0] * 2
  return (
    <div className="grid gap-3">
      <div className="relative h-[92px] overflow-visible">
        {/* the ring's line */}
        <span aria-hidden className="absolute inset-x-0 top-[8px] h-px" style={{ background: "var(--line)" }} />
        <div className="absolute top-[8px] left-1/2" style={{ width, marginLeft: -width / 2 }}>
          {held.map((h, i) => {
            const lit = litOf(pool, h)
            const turns = turnsOf(h)
            const isHand = i === hand
            const d = hand === null ? 0 : i - hand
            const x = spread[0] + i * pitch + Math.sign(d) * partBy(Math.abs(d), spread)
            const ink = lit ? "var(--ember)" : isHand || turns ? "var(--ink)" : "var(--dim)"
            return (
              <motion.button
                key={keyOf(h)}
                type="button"
                onMouseEnter={() => setHand(i)}
                onFocus={() => setHand(i)}
                onClick={() => (isHand ? turn(h, pool, canToggle) : setHand(i))}
                className={`absolute top-0 grid w-[72px] justify-items-center gap-1 text-center ${turns ? "" : "cursor-default"}`}
                style={{ color: ink, zIndex: isHand ? 10 : lit ? 5 : 1, transformOrigin: "50% 0%" }}
                initial={false}
                animate={{ x, scale: isHand ? 1.22 : 1, y: isHand ? 2 : 0 }}
                transition={reduced ? { duration: 0 } : SNAP}
              >
                <span aria-hidden className="block w-px" style={{ height: 12, background: lit ? "var(--ember)" : "var(--line)" }} />
                {/* a plate behind the mark so a lifted key covers its neighbors cleanly */}
                <span className="grid place-items-center rounded-full" style={{ background: "var(--panel)", padding: 2 }}>
                  <Mark name={h.name} size={30} turned={lit} />
                </span>
                <motion.span
                  className="mv-data text-[9px] uppercase tracking-[0.12em] leading-tight whitespace-nowrap"
                  animate={{ opacity: namesAtRest || isHand ? 1 : 0 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.08 }}
                >
                  {h.name}
                </motion.span>
              </motion.button>
            )
          })}
        </div>
      </div>
      {inHand ? (
        <InHand h={inHand} pool={pool} canToggle={canToggle} />
      ) : (
        <div className="min-h-[76px]" />
      )}
    </div>
  )
}

// ── The wheel: key and door ──────────────────────────────────────────────────
//
// Motion's own picker recipe (motion.dev/docs/react-transitions, "Inertia"):
// a value decelerates from its release velocity toward a precalculated
// target, and `modifyTarget` snaps that target to the grid — so the wheel
// lands exactly on a key, never between two, and `timeConstant` sets how
// crisply it stops. The ring wraps: every key's distance from the middle is
// taken modulo the ring, so the first key follows the last.

const ROW = 36 // one key's height on the wheel
const VISIBLE = 7 // rows in the frame, the key in hand at the middle
const wrapIndex = (n: number, i: number) => ((i % n) + n) % n
/** Signed distance around the ring, in (-n/2, n/2]. */
const ringDistance = (n: number, d: number) => {
  const w = wrapIndex(n, d)
  return w > n / 2 ? w - n : w
}

/** One key on the wheel: its place is a pure function of the wheel's
 * offset (a motion value, in rows), so scrolling never re-renders it. */
function WheelKey({
  h,
  i,
  count,
  offset,
  lit,
  turns,
  onTap,
}: {
  h: HeldMerit
  i: number
  count: number
  offset: MotionValue<number>
  lit: boolean
  turns: boolean
  onTap: () => void
}) {
  const dist = useTransform(offset, (o) => ringDistance(count, i - o))
  const y = useTransform(dist, (d) => d * ROW)
  // flat (owner, round seven): no drum — nothing scales or recedes, so no
  // key ever lies over another. The key in hand only steps toward the door.
  const x = useTransform(dist, (d) => Math.max(0, 1 - Math.abs(d)) * 12)
  // the seam where a key leaves one edge for the other sits past the frame
  // (±4 rows on an eight-key ring; the frame shows ±3.5), so the column is
  // always full — the mask does the fading at the edges
  const opacity = useTransform(dist, (d) => (Math.abs(d) > 3.75 ? 0 : Math.max(0.2, 1 - Math.abs(d) * 0.2)))
  const stem = useTransform(dist, (d) => 10 + Math.max(0, 1 - Math.abs(d)) * 14)
  const stemMargin = useTransform(stem, (w) => 10 - w)
  const [near, setNear] = useState(false)
  useMotionValueEvent(dist, "change", (d) => setNear(Math.abs(d) < 0.5))
  const ink = lit ? "var(--ember)" : near || turns ? "var(--ink)" : "var(--dim)"
  return (
    <motion.button
      type="button"
      onClick={onTap}
      className={`absolute left-[6px] top-1/2 -mt-[18px] flex h-[36px] items-center gap-2 whitespace-nowrap text-left ${turns ? "" : "cursor-default"}`}
      style={{ y, x, opacity, color: ink }}
    >
      <motion.span aria-hidden className="block h-px" style={{ width: stem, marginLeft: stemMargin, background: lit ? "var(--ember)" : "var(--line)" }} />
      <Mark name={h.name} size={26} turned={lit} />
      <span className="mv-data text-[10px] uppercase tracking-[0.12em]">
        {h.name}
        {h.label !== undefined && <span className="normal-case tracking-normal" style={{ color: "var(--dim)" }}> ({h.label})</span>}
      </span>
    </motion.button>
  )
}

function Wheel({ held, pool, canToggle }: { held: ReadonlyArray<HeldMerit>; pool: Pool; canToggle: boolean }) {
  const reduced = useReducedMotion() ?? false
  const count = held.length
  // the wheel's position, in rows, unbounded: the ring wraps
  const offset = useMotionValue(0)
  const [hand, setHand] = useState(0)
  useMotionValueEvent(offset, "change", (o) => {
    const i = wrapIndex(count, Math.round(o))
    if (i !== hand) setHand(i)
  })

  /** Coast from a velocity (rows per second) and land exactly on a key:
   * Motion's inertia with the target snapped to the grid. */
  const coast = (velocity: number) =>
    animate(offset, offset.get(), reduced
      ? { duration: 0 }
      : { type: "inertia", velocity, power: 0.4, timeConstant: 200, modifyTarget: Math.round, restDelta: 0.002 })
  /** Go straight to a key (a click, an arrow): a short, clicky ease-out. */
  const goTo = (target: number) =>
    animate(offset, target, reduced ? { duration: 0 } : { duration: 0.26, ease: [0.22, 1, 0.36, 1] })
  const step = (by: number) => goTo(Math.round(offset.get()) + by)
  const goToIndex = (i: number) => goTo(offset.get() + ringDistance(count, i - offset.get()))

  // the wheel: a non-passive listener, so the page does not scroll with it.
  // A mouse wheel's notch is a push on a spinning wheel: it adds to the
  // wheel's velocity, so repeated notches accelerate it and it coasts and
  // sticks on a key when the pushing stops (one notch alone lands one key
  // on). A trackpad's fine deltas turn the wheel directly and it coasts to
  // a key when they stop.
  const frame = useRef<HTMLDivElement>(null)
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastNotch = useRef(0)
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const now = Date.now()
      if (Math.abs(e.deltaY) >= 40 && now - lastNotch.current > 40) {
        lastNotch.current = now
        const push = Math.sign(e.deltaY) * 3.2
        const carried = Math.sign(offset.getVelocity()) === Math.sign(push) ? offset.getVelocity() : 0
        coast(carried + push)
        return
      }
      offset.set(offset.get() + e.deltaY / ROW)
      if (settling.current) clearTimeout(settling.current)
      settling.current = setTimeout(() => coast(offset.getVelocity()), 80)
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  })

  // drag: the wheel follows the pointer, then coasts with its velocity
  const drag = useRef<{ startY: number; startOffset: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const onPointerDown = (e: React.PointerEvent) => {
    offset.stop()
    suppressClick.current = false
    drag.current = { startY: e.clientY, startOffset: offset.get(), moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const dy = drag.current.startY - e.clientY
    if (Math.abs(dy) > 4) drag.current.moved = true
    offset.set(drag.current.startOffset + dy / ROW)
  }
  const onPointerUp = () => {
    if (!drag.current) return
    const moved = drag.current.moved
    drag.current = null
    coast(offset.getVelocity())
    if (moved) suppressClick.current = true
  }
  const onTap = (i: number, h: HeldMerit) => {
    if (suppressClick.current) { suppressClick.current = false; return }
    if (i !== hand) { goToIndex(i); return }
    turn(h, pool, canToggle)
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); step(1) }
    if (e.key === "ArrowUp") { e.preventDefault(); step(-1) }
  }

  const inHand = held[hand]!
  return (
    <div className="grid grid-cols-[minmax(0,15rem)_1fr] gap-x-8">
      <div
        ref={frame}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative touch-none select-none overflow-hidden outline-none"
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
        {held.map((h, i) => (
          <WheelKey key={keyOf(h)} h={h} i={i} count={count} offset={offset} lit={litOf(pool, h)} turns={turnsOf(h)} onTap={() => onTap(i, h)} />
        ))}
      </div>
      {/* the door: what the key in hand opens */}
      <div className="min-w-0 border-l pl-6" style={{ borderColor: "var(--line)" }}>
        <InHand h={inHand} pool={pool} canToggle={canToggle} />
      </div>
    </div>
  )
}

export function MeritsAudition({
  variant,
  held,
  pool,
}: {
  variant: Exclude<MeritsAuditionVariant, "off">
  held: ReadonlyArray<HeldMerit>
  pool: Pool
}) {
  const canToggle = pool.state === "idle" || pool.state === "building"
  if (variant === "A") return <Ring held={held} pool={pool} canToggle={canToggle} pitch={82} spread={[8, 3, 0]} namesAtRest />
  return <Wheel held={held} pool={pool} canToggle={canToggle} />
}
