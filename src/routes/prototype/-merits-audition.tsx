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
// Third round: fingering through the keys. One key is in hand at a time;
// the others sit to either side, smaller and dim; sliding through them
// (click, drag, wheel, arrow keys) is the kinesthetic act of picking the
// right key. The key in hand shows its sentence and its verb beneath — the
// Rote Book's "the verb lives on the page" — and tapping the key in hand
// turns it (ember; the dice follow); tapping again lets it go. Turned keys
// stay lit wherever they sit on the ring. A fixed frame, so flipping never
// reflows the sheet (the book's rule).
//   A — In hand: a straight strip, the key in hand risen at the center.
//   B — Fan: the keys splayed on an arc as if the ring were held up, the key
//       in hand at the crown.
import { useRef, useState, type ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"
import { merit, type HeldMerit, type MeritName } from "#/domain/merits"
import type { useDicePool } from "#/hooks/use-dice-pool"
import { DotRating } from "#/components/game/DotRating"

export const MERITS_AUDITION_ORDER = ["off", "A", "B"] as const
export type MeritsAuditionVariant = (typeof MERITS_AUDITION_ORDER)[number]
export const isMeritsAuditionVariant = (v: unknown): v is MeritsAuditionVariant =>
  typeof v === "string" && (MERITS_AUDITION_ORDER as ReadonlyArray<string>).includes(v)

export const AUDITION_VARIANT_NAMES: Record<MeritsAuditionVariant, string> = {
  off: "the branch's own section",
  A: "In hand — a strip, the key in hand risen at the center",
  B: "Fan — the keys splayed on an arc, the key in hand at the crown",
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

// ── Fingering through the ring ───────────────────────────────────────────────

const SPRING = { type: "spring", stiffness: 420, damping: 34 } as const

function useHand(count: number) {
  const [hand, setHand] = useState(0)
  const step = (d: number) => setHand((i) => Math.max(0, Math.min(count - 1, i + d)))
  const wheelAt = useRef(0)
  const onWheel = (e: React.WheelEvent) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    const now = Date.now()
    if (Math.abs(d) < 8 || now - wheelAt.current < 180) return
    wheelAt.current = now
    step(d > 0 ? 1 : -1)
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); step(1) }
    if (e.key === "ArrowLeft") { e.preventDefault(); step(-1) }
  }
  return { hand, setHand, step, onWheel, onKeyDown }
}

const litOf = (pool: Pool, h: HeldMerit) => {
  const mech = mechanicOf(h)
  return mech.kind === "purse" ? spentOf(pool, h) > 0 : isLit(pool, h)
}
const turnsOf = (h: HeldMerit) => {
  const k = mechanicOf(h).kind
  return k === "dice" || k === "purse"
}

/** Tap the key in hand to turn it; tap any other key to bring it to hand. */
const tapKey = (i: number, hand: number, setHand: (i: number) => void, h: HeldMerit, pool: Pool, canToggle: boolean) => {
  if (i !== hand) { setHand(i); return }
  const mech = mechanicOf(h)
  if (!canToggle) return
  if (mech.kind === "dice") toggleDice(pool, h, mech.dice)
  if (mech.kind === "purse") spend(pool, h, (spentOf(pool, h) + 1) % (mech.size + 1))
}

// A — the strip
const KEY_W = 84
function Strip({ held, pool, canToggle }: { held: ReadonlyArray<HeldMerit>; pool: Pool; canToggle: boolean }) {
  const { hand, setHand, step, onWheel, onKeyDown } = useHand(held.length)
  const reduced = useReducedMotion() ?? false
  const inHand = held[hand]!
  return (
    <div className="grid gap-3">
      <div
        tabIndex={0}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        className="relative h-[112px] overflow-hidden rounded-[3px] outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
      >
        {/* the ring's line, behind the keys */}
        <span aria-hidden className="absolute inset-x-0 top-[10px] h-px" style={{ background: "var(--line)" }} />
        <motion.div
          className="absolute top-[10px] left-1/2 flex items-start"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          onDragEnd={(_, info) => {
            const by = Math.round(-info.offset.x / KEY_W) || (Math.abs(info.velocity.x) > 300 ? (info.velocity.x < 0 ? 1 : -1) : 0)
            step(by)
          }}
          animate={{ x: -(hand + 0.5) * KEY_W }}
          transition={reduced ? { duration: 0 } : SPRING}
        >
          {held.map((h, i) => {
            const lit = litOf(pool, h)
            const turns = turnsOf(h)
            const isHand = i === hand
            const ink = lit ? "var(--ember)" : isHand ? "var(--ink)" : turns ? "var(--ink)" : "var(--dim)"
            return (
              <motion.button
                key={keyOf(h)}
                type="button"
                onClick={() => tapKey(i, hand, setHand, h, pool, canToggle)}
                className="grid shrink-0 justify-items-center gap-1 text-center"
                style={{ width: KEY_W, color: ink, transformOrigin: "50% 0%" }}
                animate={{ scale: isHand ? 1 : 0.8, opacity: isHand ? 1 : lit ? 0.9 : 0.6, y: isHand ? 4 : 0 }}
                transition={reduced ? { duration: 0 } : SPRING}
              >
                <span aria-hidden className="block w-px" style={{ height: isHand ? 18 : 12, background: lit ? "var(--ember)" : "var(--line)" }} />
                <Mark name={h.name} size={34} turned={lit} />
                <span className="mv-data text-[9px] uppercase tracking-[0.12em] leading-tight whitespace-nowrap">{h.name}</span>
              </motion.button>
            )
          })}
        </motion.div>
      </div>
      <InHand h={inHand} pool={pool} canToggle={canToggle} />
    </div>
  )
}

// B — the fan
const FAN_STEP = 9 // degrees between keys
const FAN_RADIUS = 480
function Fan({ held, pool, canToggle }: { held: ReadonlyArray<HeldMerit>; pool: Pool; canToggle: boolean }) {
  const { hand, setHand, step, onWheel, onKeyDown } = useHand(held.length)
  const reduced = useReducedMotion() ?? false
  const inHand = held[hand]!
  return (
    <div className="grid gap-2">
      <div
        tabIndex={0}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        className="relative h-[150px] overflow-hidden rounded-[3px] outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
      >
        <motion.div
          className="absolute inset-0"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          onDragEnd={(_, info) => {
            const by = Math.round(-info.offset.x / 70) || (Math.abs(info.velocity.x) > 300 ? (info.velocity.x < 0 ? 1 : -1) : 0)
            step(by)
          }}
        >
          {held.map((h, i) => {
            const lit = litOf(pool, h)
            const turns = turnsOf(h)
            const isHand = i === hand
            const ink = lit ? "var(--ember)" : isHand ? "var(--ink)" : turns ? "var(--ink)" : "var(--dim)"
            return (
              <motion.button
                key={keyOf(h)}
                type="button"
                onClick={() => tapKey(i, hand, setHand, h, pool, canToggle)}
                className="absolute left-1/2 top-[14px] grid justify-items-center gap-1 text-center"
                style={{ width: 90, marginLeft: -45, color: ink, transformOrigin: `50% ${FAN_RADIUS}px` }}
                animate={{
                  rotate: (i - hand) * FAN_STEP,
                  opacity: Math.abs(i - hand) > 3 ? 0 : isHand ? 1 : lit ? 0.9 : 0.6,
                }}
                transition={reduced ? { duration: 0 } : SPRING}
              >
                {/* the scale pivots on the key itself, not the ring's center */}
                <motion.span
                  className="grid justify-items-center gap-1"
                  style={{ transformOrigin: "50% 0%" }}
                  animate={{ scale: isHand ? 1 : 0.8, y: isHand ? -6 : 0 }}
                  transition={reduced ? { duration: 0 } : SPRING}
                >
                  <Mark name={h.name} size={34} turned={lit} />
                  <span className="mv-data text-[9px] uppercase tracking-[0.12em] leading-tight whitespace-nowrap">{h.name}</span>
                </motion.span>
              </motion.button>
            )
          })}
        </motion.div>
      </div>
      <InHand h={inHand} pool={pool} canToggle={canToggle} />
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
  if (variant === "A") return <Strip held={held} pool={pool} canToggle={canToggle} />
  return <Fan held={held} pool={pool} canToggle={canToggle} />
}
