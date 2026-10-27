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
//   A — Line: the keys hang in one line across the section, names in the
//       trait rows' face, dots beneath.
//   B — Cluster: a tighter hang, the marks dominating, names in the small
//       mono face the zone labels use.
import { useState, type ReactNode } from "react"
import { merit, type HeldMerit, type MeritName } from "#/domain/merits"
import type { useDicePool } from "#/hooks/use-dice-pool"
import { DotRating } from "#/components/game/DotRating"

export const MERITS_AUDITION_ORDER = ["off", "A", "B"] as const
export type MeritsAuditionVariant = (typeof MERITS_AUDITION_ORDER)[number]
export const isMeritsAuditionVariant = (v: unknown): v is MeritsAuditionVariant =>
  typeof v === "string" && (MERITS_AUDITION_ORDER as ReadonlyArray<string>).includes(v)

export const AUDITION_VARIANT_NAMES: Record<MeritsAuditionVariant, string> = {
  off: "the branch's own section",
  A: "Keys, in a line — names in the trait face",
  B: "Keys, clustered — the marks dominate",
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

// ── One key on the ring ──────────────────────────────────────────────────────

interface KeyProps {
  h: HeldMerit
  pool: Pool
  canToggle: boolean
  read: boolean
  onRead: () => void
  markSize: number
  nameClass: string
  stem: number
  width: number
}

function Key({ h, pool, canToggle, read, onRead, markSize, nameClass, stem, width }: KeyProps) {
  const mech = mechanicOf(h)
  const turns = mech.kind === "dice" || mech.kind === "purse"
  const lit = mech.kind === "purse" ? spentOf(pool, h) > 0 : isLit(pool, h)
  const onTap = () => {
    onRead()
    if (!turns || !canToggle) return
    if (mech.kind === "dice") toggleDice(pool, h, mech.dice)
    if (mech.kind === "purse") spend(pool, h, (spentOf(pool, h) + 1) % (mech.size + 1))
  }
  const ink = lit ? "var(--ember)" : read ? "var(--ink)" : turns ? "var(--ink)" : "var(--dim)"
  return (
    <button
      type="button"
      onClick={onTap}
      className={`group grid justify-items-center gap-1 text-center ${turns ? "" : "cursor-default"}`}
      style={{ width }}
    >
      {/* the hang: a stem from the ring's line to the mark */}
      <span aria-hidden className="block w-px" style={{ height: stem, background: lit ? "var(--ember)" : "var(--line)" }} />
      <span style={{ color: ink }} className={turns ? "transition-colors group-hover:text-[var(--ink)]" : ""}>
        <Mark name={h.name} size={markSize} turned={lit} />
      </span>
      <span className={`${nameClass} leading-tight`} style={{ color: ink }}>
        {h.name}
        {h.label !== undefined && (
          <span className="block text-[11px] normal-case tracking-normal" style={{ color: "var(--dim)" }}>
            ({h.label})
          </span>
        )}
      </span>
      {mech.kind === "purse" ? (
        <Pips size={mech.size} spent={spentOf(pool, h)} />
      ) : (
        <DotRating current={h.dots} max={Math.max(5, h.dots)} active={lit} />
      )}
    </button>
  )
}

// ── The ring ─────────────────────────────────────────────────────────────────

function Ring({
  held,
  pool,
  canToggle,
  markSize,
  nameClass,
  stem,
  width,
  gap,
}: {
  held: ReadonlyArray<HeldMerit>
  pool: Pool
  canToggle: boolean
  markSize: number
  nameClass: string
  stem: number
  width: number
  gap: string
}) {
  const [reading, setReading] = useState<string | null>(null)
  const readMerit = held.find((h) => keyOf(h) === reading)
  return (
    <div className="grid gap-3">
      {/* the ring: one line the keys hang from */}
      <div className="-mt-2" style={{ height: 1, background: "var(--line)" }} />
      <div className={`-mt-3 flex flex-wrap items-start ${gap}`}>
        {held.map((h) => (
          <Key
            key={keyOf(h)}
            h={h}
            pool={pool}
            canToggle={canToggle}
            read={reading === keyOf(h)}
            onRead={() => setReading(reading === keyOf(h) ? null : keyOf(h))}
            markSize={markSize}
            nameClass={nameClass}
            stem={stem}
            width={width}
          />
        ))}
      </div>
      {/* the caption: the read key's sentence, one line beneath the ring */}
      <p className="min-h-[2.4em] text-[12px] leading-snug" style={{ color: "var(--dim)" }}>
        {readMerit ? merit(readMerit.name).effect : ""}
      </p>
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
  if (variant === "A") {
    return (
      <Ring held={held} pool={pool} canToggle={canToggle} markSize={28} nameClass="text-[13px]" stem={14} width={82} gap="gap-x-0 gap-y-4 justify-between" />
    )
  }
  return (
    <Ring held={held} pool={pool} canToggle={canToggle} markSize={34} nameClass="mv-data text-[9px] uppercase tracking-[0.14em]" stem={10} width={72} gap="gap-x-1 gap-y-3" />
  )
}
