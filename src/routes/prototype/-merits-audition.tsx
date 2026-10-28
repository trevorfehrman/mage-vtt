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
  useAnimate,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
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
  { name: "Fighting Style: Boxing", dots: 2 },
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
export const mechanicOf = (h: HeldMerit): Mechanic => MECHANIC[h.name]?.(h.dots) ?? { kind: "none" }

export const keyOf = (h: HeldMerit) => `${h.name}${h.label === undefined ? "" : ` (${h.label})`}`
/** The name on the ring: short, the door says the whole of it. A name
 * over fifteen characters would run off the ring's column into the lock. */
const SHORT_NAMES: Partial<Record<MeritName, string>> = {
  "Encyclopedic Knowledge": "Encyclopedia",
  "Holistic Awareness": "Holistic",
  "Sleepwalker Retainer": "Sleepwalker",
  "Natural Immunity": "Immunity",
  "Toxin Resistance": "Toxins",
  "Fighting Finesse": "Finesse",
  "Fighting Style: Boxing": "Boxing",
  "Fighting Style: Kung Fu": "Kung Fu",
  "Fighting Style: Two Weapons": "Two Weapons",
}
export const ringName = (name: MeritName) => SHORT_NAMES[name] ?? name

export type Pool = ReturnType<typeof useDicePool>

const isLit = (pool: Pool, h: HeldMerit): boolean => pool.isComponentActive("modifier", keyOf(h))
export const toggleDice = (pool: Pool, h: HeldMerit, dice: number) =>
  pool.toggleComponent({ type: "modifier", name: keyOf(h), dots: dice })
export const spentOf = (pool: Pool, h: HeldMerit): number =>
  pool.context.components.find((c) => c.type === "modifier" && c.name === keyOf(h))?.dots ?? 0
export const spend = (pool: Pool, h: HeldMerit, k: number) => {
  const idx = pool.context.components.findIndex((c) => c.type === "modifier" && c.name === keyOf(h))
  if (idx >= 0) pool.removeComponent(idx)
  if (k > 0) pool.addComponent({ type: "modifier", name: keyOf(h), dots: k })
}

// ── The marks: one line glyph per Merit, in the Arcana glyphs' stroke ────────
// (24-box, round caps, a bindi or barb as signature). Eight for the audition;
// the other forty-five are drawn only if the marks carry it.

export const MARKS: Partial<Record<MeritName, ReactNode>> = {
  // ── Mental (MAG-68, batch 1) ──
  // the plumb line — a bar, a string, the bob hanging true
  "Common Sense": <><path d="M7.5 4 H16.5" /><path d="M12 4 V15.5" /><circle cx="12" cy="17.6" r="1.6" fill="currentColor" stroke="none" /></>,
  // the knot in the thread — a line with one loop tied in it, so it is not forgotten
  "Eidetic Memory": <><path d="M3 13 H8.6 M15.4 13 H20" /><circle cx="12" cy="13" r="3.4" /><circle cx="21" cy="13" r="1.3" fill="currentColor" stroke="none" /></>,
  // the ring of facts — many small things that together make a whole
  // (the open book was the Mysterium's, the whorl was Forces'; the lineup rule)
  "Encyclopedic Knowledge": <><circle cx="12.0" cy="5.0" r="1.25" fill="currentColor" stroke="none" /><circle cx="16.9" cy="7.1" r="1.25" fill="currentColor" stroke="none" /><circle cx="19.0" cy="12.0" r="1.25" fill="currentColor" stroke="none" /><circle cx="16.9" cy="16.9" r="1.25" fill="currentColor" stroke="none" /><circle cx="12.0" cy="19.0" r="1.25" fill="currentColor" stroke="none" /><circle cx="7.1" cy="16.9" r="1.25" fill="currentColor" stroke="none" /><circle cx="5.0" cy="12.0" r="1.25" fill="currentColor" stroke="none" /><circle cx="7.1" cy="7.1" r="1.25" fill="currentColor" stroke="none" /></>,
  // the sprig — a stem, two leaves, the bud
  "Holistic Awareness": <><path d="M12 20.5 V8" /><path d="M12 15 Q7.5 14.5 6.5 10" /><path d="M12 11.5 Q16.5 11 17.5 6.5" /><circle cx="12" cy="5.4" r="1.4" fill="currentColor" stroke="none" /></>,
  // the spoken line — one breath of speech, from its first word
  Language: <><path d="M4.5 12 C7 7 10 7 12 12 S17 17 19.5 12" /><circle cx="4" cy="12" r="1.3" fill="currentColor" stroke="none" /></>,
  // the still pool — a round undisturbed over its waterline, the mind at its center
  "Meditative Mind": <><circle cx="12" cy="10" r="6" /><path d="M4 20 H20" /><circle cx="12" cy="10" r="1.3" fill="currentColor" stroke="none" /></>,
  // ── Awakened and others ──
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
  // the guard — a chevron brought down, the blow landed beneath it
  "Fighting Style: Boxing": <><path d="M5.5 7.5 L12 14 L18.5 7.5" /><path d="M12 14 V19.5" /><circle cx="12" cy="4.4" r="1.2" fill="currentColor" stroke="none" /></>,
  // the web — three knots and the threads between them
  Contacts: <><path d="M6 17 L12 7 L18 17 Z" /><circle cx="6" cy="17" r="1.3" fill="currentColor" stroke="none" /><circle cx="18" cy="17" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="7" r="1.3" fill="currentColor" stroke="none" /></>,
}

export function Mark({ name, size, turned }: { name: MeritName; size: number | "100%"; turned: boolean }) {
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
        transform: turned ? "rotate(22deg)" : "rotate(0deg)",
        transformOrigin: "50% 50%",
        transition: "transform 0.3s cubic-bezier(.34,1.56,.64,1), filter 0.3s",
        filter: turned ? "drop-shadow(0 0 5px var(--ember-glow))" : undefined,
      }}
    >
      {MARKS[name] ?? <circle cx="12" cy="12" r="6" />}
    </svg>
  )
}

/** The keyhole: the one iconic shape, a round over a tapered slot, in the
 * marks' stroke. Lit, the round fills ember and glows — the key is turned. */
function Keyhole({ size, lit }: { size: number; lit: boolean }) {
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
      style={{ filter: lit ? "drop-shadow(0 0 5px var(--ember-glow))" : undefined, transition: "filter 0.3s" }}
    >
      <path d="M14.3 12.3 L16 20 H8 L9.7 12.3 A4.6 4.6 0 1 1 14.3 12.3 Z" />
      <motion.circle
        cx="12"
        cy="8.6"
        r="1.6"
        fill="currentColor"
        stroke="none"
        style={{ transformOrigin: "12px 8.6px", transformBox: "fill-box" }}
        initial={false}
        animate={{ scale: lit ? 1 : 0, opacity: lit ? 1 : 0 }}
        transition={lit ? { type: "spring", stiffness: 700, damping: 16, delay: 0.22 } : { duration: 0.15 }}
      />
    </svg>
  )
}

// ── The key in hand: its sentence and its verb ───────────────────────────────

const dots = (n: number) => "•".repeat(n)
const FAMILY_WORD = { mental: "Mental", physical: "Physical", social: "Social", awakened: "Awakened" } as const

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
          <li key={t.dots} className="grid grid-cols-[2.6rem_1fr] gap-x-2 text-[11.5px] leading-snug" style={{ color: held ? "var(--ink)" : "var(--dim)", opacity: held ? 1 : 0.7 }}>
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
function DoorPage({ h, pool }: { h: HeldMerit; pool: Pool }) {
  const lit = litOf(pool, h)
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

/** The door's act, at its bottom right: a chip with the dice, lit ember
 * when the key is turned; for a purse, the pips themselves. Only a key that
 * turns has one; a still key's page takes the whole door. */
function DoorFoot({ h, pool, canToggle }: { h: HeldMerit; pool: Pool; canToggle: boolean }) {
  const mech = mechanicOf(h)
  const lit = litOf(pool, h)
  if (mech.kind === "dice") {
    return (
      <button
        type="button"
        disabled={!canToggle}
        onClick={() => toggleDice(pool, h, mech.dice)}
        className={`mv-trait ${lit ? "mv-trait-on" : ""} mv-data rounded-[3px] px-2.5 py-1.5 text-[12px]`}
        style={{ color: lit ? "var(--ember)" : "var(--ink)", boxShadow: lit ? undefined : "inset 0 0 0 1px var(--line)" }}
      >
        +{mech.dice} {mech.dice === 1 ? "die" : "dice"}
      </button>
    )
  }
  if (mech.kind === "purse") {
    const spent = spentOf(pool, h)
    return (
      <span className="flex gap-1 py-1.5">
        {Array.from({ length: mech.size }, (_, i) => {
          const on = i < spent
          return (
            <button
              key={i}
              type="button"
              disabled={!canToggle}
              onClick={() => spend(pool, h, on && i === spent - 1 ? i : i + 1)}
              className="grid size-[18px] place-items-center rounded-full"
            >
              <span
                className="inline-block size-[10px] rounded-full"
                style={{ background: on ? "var(--ember)" : "transparent", boxShadow: on ? "0 0 6px var(--ember-glow)" : "inset 0 0 0 1px var(--accent)" }}
              />
            </button>
          )
        })}
      </span>
    )
  }
  return null
}

// ── Flowing through the ring ─────────────────────────────────────────────────

/** Snappy: a stiff spring that settles fast, so hovering across the ring
 * reads as fluid rather than as a sequence of animations. */
const SNAP = { type: "spring", stiffness: 900, damping: 42, mass: 0.6 } as const

export const litOf = (pool: Pool, h: HeldMerit) => {
  const mech = mechanicOf(h)
  return mech.kind === "purse" ? spentOf(pool, h) > 0 : isLit(pool, h)
}
export const turnsOf = (h: HeldMerit) => {
  const k = mechanicOf(h).kind
  return k === "dice" || k === "purse"
}
export const turn = (h: HeldMerit, pool: Pool, canToggle: boolean) => {
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
        <div className="grid gap-3">
          <DoorPage h={inHand} pool={pool} />
          <div className="flex justify-end">
            <DoorFoot h={inHand} pool={pool} canToggle={canToggle} />
          </div>
        </div>
      ) : (
        <div className="min-h-[76px]" />
      )}
    </div>
  )
}

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
const wrapIndex = (n: number, i: number) => ((i % n) + n) % n
/** Signed distance of a position from the offset, wrapped into one period. */
const periodic = (period: number, d: number) => {
  const w = ((d + period / 2) % period + period) % period
  return w - period / 2
}

function RingKey({
  h,
  position,
  period,
  offset,
  lean,
  pool,
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
  pool: Pool
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
  const lit = litOf(pool, h)
  const turns = turnsOf(h)
  // a key with something to turn hangs verdigris; a story key hangs dim
  // (ink when in hand); a turned key burns ember
  const ink = lit ? "var(--ember)" : turns ? "var(--accent)" : near ? "var(--ink)" : "var(--dim)"
  return (
    <motion.div className="absolute inset-x-0 top-1/2 -mt-[18px] h-[36px]" style={{ y }}>
      {/* the clasp: where the ring starts over, a loop on the ring's line
          rather than a cut across the row */}
      {seam && (
        <span
          aria-hidden
          className="absolute rounded-full"
          style={{ left: 6 - CLASP / 2, top: -CLASP / 2, width: CLASP, height: CLASP, boxShadow: "inset 0 0 0 1.5px var(--dim)", background: "var(--bg)" }}
        />
      )}
      <motion.button
        type="button"
        onClick={() => onTap(position)}
        className={`absolute left-[6px] top-0 flex h-[36px] items-center gap-2 whitespace-nowrap text-left ${turns ? "" : "cursor-default"}`}
        style={{ x, rotate: lean, transformOrigin: "0 50%", color: ink }}
      >
        <motion.span aria-hidden className="block h-px" style={{ width: stem, marginLeft: stemMargin, opacity: stemOpacity, background: lit ? "var(--ember)" : "var(--line)" }} />
        {/* the mark and the name wear the sheet's background, so a key
            strung on the reach line sits on it rather than behind it */}
        <motion.span className="grid shrink-0 place-items-center rounded-full" style={{ width: markSize, height: markSize, background: "var(--bg)" }}>
          <Mark name={h.name} size="100%" turned={lit} />
        </motion.span>
        <motion.span className="mv-data uppercase tracking-[0.12em]" style={{ fontSize: nameSize, background: "var(--bg)", paddingInline: 3 }}>
          {ringName(h.name)}
          {h.label !== undefined && <span className="normal-case tracking-normal" style={{ color: "var(--dim)" }}> ({h.label})</span>}
        </motion.span>
      </motion.button>
    </motion.div>
  )
}

function Wheel({ held, pool, canToggle }: { held: ReadonlyArray<HeldMerit>; pool: Pool; canToggle: boolean }) {
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
  const [hand, setHand] = useState(0)
  useMotionValueEvent(offset, "change", (o) => {
    const i = wrapIndex(count, Math.round(o))
    if (i !== hand) setHand(i)
  })

  // the hinge: the door's page swings in when the key changes — but not
  // for every row a flick sends past the middle (that re-rasterized the
  // page per row and dropped frames). A change while the wheel is slow
  // swings at once; a change at speed owes a swing, paid when the wheel
  // lands.
  const [page, swing] = useAnimate()
  const owed = useRef(false)
  const mounted = useRef(false)
  const doSwing = () => {
    if (reduced || !page.current) return
    swing(page.current, { transformPerspective: 900, rotateY: [HINGE, 0], x: [-4, 0], opacity: [0.3, 1] }, { duration: 0.22, ease: "easeOut" })
  }
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (Math.abs(offset.getVelocity()) < SWING_SPEED) doSwing()
    else owed.current = true
  }, [hand])
  const land = () => {
    const o = offset.get()
    if (Math.abs(o - Math.round(o)) > 0.01) return
    if (owed.current) { owed.current = false; doSwing() }
  }

  /** Coast from a velocity (rows per second) and land exactly on a key. */
  const coast = (velocity: number) =>
    animate(offset, offset.get() + (velocity >= 0 ? 1 : -1), reduced
      ? { duration: 0 }
      : { type: "inertia", velocity, power: 0.4, timeConstant: 200, modifyTarget: Math.round, restDelta: 0.002 }).then(land)
  /** Chase a key on a spring: quick pushes move the target further and the
   * wheel accelerates after it; it stops dead on the key. */
  const chase = (target: number) =>
    animate(offset, target, reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30, mass: 0.9 }).then(land)
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
      const now = Date.now()
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
    if (suppressClick.current) { suppressClick.current = false; return }
    const here = Math.round(offset.get())
    if (position !== here) {
      // the short way round the ring
      target.current = here + periodic(count, position - here)
      chase(target.current)
      return
    }
    turn(held[wrapIndex(count, position)]!, pool, canToggle)
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); push(1) }
    if (e.key === "ArrowUp") { e.preventDefault(); push(-1) }
  }

  const inHand = held[hand]!
  const middle = (VISIBLE * ROW) / 2
  return (
    <div className="relative grid grid-cols-[minmax(0,15rem)_1fr] gap-x-8">
      <Reach h={inHand} pool={pool} middle={middle} />
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
        {Array.from({ length: copies }, (_, c) =>
          held.map((h, i) => (
            <RingKey
              key={`${keyOf(h)}#${c}`}
              h={h}
              position={i + c * count}
              period={period}
              offset={offset}
              lean={lean}
              pool={pool}
              onTap={onTap}
              seam={i === 0}
            />
          )),
        )}
      </div>
      <Door h={inHand} pool={pool} canToggle={canToggle} middle={middle} pageRef={page} />
    </div>
  )
}

/** The reach: one line from the ring across the gap to the keyhole; the key
 * in hand is strung on it. A key that opens something on this table reaches
 * the lock; a key that only opens things in the story stops short of it.
 * Turned, ember runs down it from the ring to the lock. Positioned in a
 * `relative` grid of [15rem ring | 2rem gap | door]. */
export function Reach({ h, pool, middle }: { h: HeldMerit; pool: Pool; middle: number }) {
  const reduced = useReducedMotion() ?? false
  const lit = litOf(pool, h)
  const reaches = turnsOf(h) || mechanicOf(h).kind === "gate"
  return (
    <span
      aria-hidden
      className="absolute left-[6px] h-px"
      style={{
        top: middle,
        width: `calc(15rem + 2rem - 6px - ${reaches ? KEYHOLE / 2 : REACH_SHORT}px)`,
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
  pool,
  canToggle,
  middle,
  pageRef,
  height = VISIBLE * ROW,
}: {
  h: HeldMerit
  pool: Pool
  canToggle: boolean
  /** the keyhole's height from the door's top */
  middle: number
  pageRef?: React.RefObject<HTMLDivElement | null>
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
  }, [h])
  const lit = litOf(pool, h)
  const turns = turnsOf(h)
  // the reach and the keyhole are ink (ember when turned); a still key's
  // line stopping short says it, nothing else fades
  const ink = lit ? "var(--ember)" : "var(--ink)"
  return (
    <div className="relative grid min-w-0 grid-rows-[minmax(0,1fr)_auto] gap-3 pl-6" style={{ height }}>
      {/* light through the door */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(260px 200px at 0 ${middle}px, color-mix(in srgb, var(--ember) 16%, transparent), transparent 70%)` }}
        initial={false}
        animate={{ opacity: lit ? 1 : 0 }}
        transition={reduced ? { duration: 0 } : lit ? { duration: 0.5, delay: 0.2 } : { duration: 0.3 }}
      />
      <span aria-hidden className="absolute left-0 top-0 w-px" style={{ height: middle - KEYHOLE / 2 - 4, background: "var(--line)" }} />
      <span aria-hidden className="absolute left-0 bottom-0 w-px" style={{ top: middle + KEYHOLE / 2 + 4, background: "var(--line)" }} />
      <button
        type="button"
        disabled={!canToggle || !turns}
        onClick={() => turn(h, pool, canToggle)}
        aria-label={lit ? `Let ${h.name} go` : `Turn ${h.name}`}
        className={`absolute grid place-items-center ${turns ? "" : "cursor-default"}`}
        style={{ left: -KEYHOLE / 2, top: middle - KEYHOLE / 2, width: KEYHOLE, height: KEYHOLE, color: ink, transition: "color 0.3s" }}
      >
        <Keyhole size={KEYHOLE} lit={lit} />
      </button>
      {/* the sigil: whole, anchored in the bottom-right corner, lifting
          while the key is turned */}
      <span aria-hidden className="pointer-events-none absolute inset-0">
        <span
          className="absolute bottom-0 right-0"
          style={{ color: lit ? "var(--ember)" : "var(--ink)", opacity: lit ? SIGIL_OPACITY_TURNED : SIGIL_OPACITY, transition: "color 0.3s, opacity 0.4s" }}
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
        <DoorPage h={h} pool={pool} />
      </div>
      {turns && (
        <div className="relative flex justify-end">
          <DoorFoot h={h} pool={pool} canToggle={canToggle} />
        </div>
      )}
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
