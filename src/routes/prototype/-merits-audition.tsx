// PROTOTYPE — the Merits-area audition for MAG-59 (2026-10-27). Three
// structurally different Merits sections, mounted into the real sheet on the
// dressing room by its ?merits= knob (off | A | B | C). Throwaway: delete when
// the owner has picked, and rebuild the winner properly (typed mechanic in the
// catalog, TDD'd leaves). The `-` prefix keeps this out of the route tree.
//
// The question: how does the Merits area, without explanation, (1) show which
// Merits activate and which don't, (2) activate one with a tap so its dice
// land in the pool under its name, (3) open what each one does, and (4) carry
// Destiny's purse of pips?
//
//   A — Drawers: uniform rows; tap a row and it opens beneath to its sentence
//       and, if it has one, its verb (the Rote Book's "the verb lives on the
//       page"). Nothing activates from the closed row.
//   B — Two shelves: the Merits that act are trait-style toggle rows with the
//       sentence always under the name; the rest are a dim inline run of
//       names, each tapped to read its sentence in a caption line.
//   C — Gloss tiles: every Merit is a small tile with its sentence always
//       visible; a tile that acts has a body (panel + border) and lights
//       ember when tapped; a tile that doesn't is bare text on the sky.
import { useState, type ReactNode } from "react"
import { merit, type HeldMerit, type MeritName } from "#/domain/merits"
import type { useDicePool } from "#/hooks/use-dice-pool"
import { DotRating } from "#/components/game/DotRating"

export const MERITS_AUDITION_ORDER = ["off", "A", "B", "C"] as const
export type MeritsAuditionVariant = (typeof MERITS_AUDITION_ORDER)[number]
export const isMeritsAuditionVariant = (v: unknown): v is MeritsAuditionVariant =>
  typeof v === "string" && (MERITS_AUDITION_ORDER as ReadonlyArray<string>).includes(v)

export const AUDITION_VARIANT_NAMES: Record<MeritsAuditionVariant, string> = {
  off: "the branch's own section",
  A: "Drawers — uniform rows; the verb lives inside the opened row",
  B: "Two shelves — acting Merits as toggle rows; the rest a dim run of names",
  C: "Gloss tiles — sentence at rest; a tile that acts has a body",
}

/** The rig's Arctus holds two more Merits for the audition, so there is
 * something to activate and a purse to spend. */
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

interface VariantProps {
  held: ReadonlyArray<HeldMerit>
  pool: Pool
  canToggle: boolean
}

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

/** The purse: `size` pips, the first `spent` burning ember. Tap the nth pip
 * to spend n; tap the last lit one to take it back. */
function Pips({
  size,
  spent,
  onSpend,
  disabled,
}: {
  size: number
  spent: number
  onSpend: (k: number) => void
  disabled: boolean
}) {
  return (
    <span className="flex items-center gap-1">
      {Array.from({ length: size }, (_, i) => {
        const lit = i < spent
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onSpend(lit && i === spent - 1 ? i : i + 1)}
            className="grid size-[14px] place-items-center rounded-full disabled:opacity-50"
            title={lit ? "Take it back" : `Spend ${i + 1}`}
          >
            <span
              className="inline-block size-[9px] rounded-full"
              style={{
                background: lit ? "var(--ember)" : "transparent",
                boxShadow: lit ? "0 0 6px var(--ember-glow)" : "inset 0 0 0 1px var(--accent)",
              }}
            />
          </button>
        )
      })}
    </span>
  )
}

function Name({ h, lit }: { h: HeldMerit; lit?: boolean }) {
  return (
    <span className="flex min-w-0 items-baseline gap-1.5">
      <span className="whitespace-nowrap text-[14px]" style={{ color: lit ? "var(--ember)" : "var(--ink)" }}>
        {h.name}
      </span>
      {h.label !== undefined && (
        <span className="truncate text-[12px]" style={{ color: "var(--dim)" }}>
          ({h.label})
        </span>
      )}
    </span>
  )
}

function Sentence({ h, className = "" }: { h: HeldMerit; className?: string }) {
  return (
    <p className={`text-[12px] leading-snug ${className}`} style={{ color: "var(--dim)" }}>
      {merit(h.name).effect}
    </p>
  )
}

// ── A — Drawers ──────────────────────────────────────────────────────────────

function Drawers({ held, pool, canToggle }: VariantProps) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="-mx-2 grid gap-0.5">
      {held.map((h) => {
        const key = keyOf(h)
        const mech = mechanicOf(h)
        const isOpen = open === key
        const lit = isLit(pool, h)
        return (
          <div key={key} className="rounded-[3px]" style={isOpen ? { background: "var(--raise)" } : undefined}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : key)}
              className="mv-sky-row flex w-full items-center justify-between gap-2 rounded-[3px] px-2 py-1 text-left"
            >
              <Name h={h} lit={lit} />
              <DotRating current={h.dots} max={Math.max(5, h.dots)} active={lit} />
            </button>
            {isOpen && (
              <div className="grid gap-2 px-2 pb-2 pt-0.5">
                <Sentence h={h} />
                {mech.kind === "dice" && (
                  <button
                    type="button"
                    disabled={!canToggle}
                    onClick={() => toggleDice(pool, h, mech.dice)}
                    className={`mv-trait ${lit ? "mv-trait-on" : ""} flex items-center justify-between rounded-[3px] px-2 py-1 text-left`}
                  >
                    <span className="text-[13px]">{lit ? "In the pool" : "Add to the pool"}</span>
                    <span className="mv-data text-[12px]" style={{ color: lit ? "var(--ember)" : "var(--ink)" }}>
                      {mech.dice} {mech.dice === 1 ? "die" : "dice"}
                    </span>
                  </button>
                )}
                {mech.kind === "purse" && (
                  <div className="flex items-center justify-between gap-3 px-1">
                    <span className="mv-eyebrow">This session</span>
                    <Pips size={mech.size} spent={spentOf(pool, h)} onSpend={(k) => spend(pool, h, k)} disabled={!canToggle} />
                  </div>
                )}
                {mech.kind === "gate" && (
                  <span className="text-[11px] italic" style={{ color: "var(--dim)" }}>
                    Declared with the cast.
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── B — Two shelves ──────────────────────────────────────────────────────────

function Shelves({ held, pool, canToggle }: VariantProps) {
  const acting = held.filter((h) => {
    const k = mechanicOf(h).kind
    return k === "dice" || k === "purse"
  })
  const record = held.filter((h) => !acting.includes(h))
  const [shown, setShown] = useState<string | null>(null)
  const shownMerit = record.find((h) => keyOf(h) === shown)
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        {acting.map((h) => {
          const mech = mechanicOf(h)
          const lit = isLit(pool, h)
          if (mech.kind === "purse") {
            return (
              <div key={keyOf(h)} className="-mx-2 grid gap-0.5 rounded-[3px] px-2 py-1">
                <span className="flex items-center justify-between gap-2">
                  <Name h={h} lit={spentOf(pool, h) > 0} />
                  <Pips size={mech.size} spent={spentOf(pool, h)} onSpend={(k) => spend(pool, h, k)} disabled={!canToggle} />
                </span>
                <Sentence h={h} className="text-[11px]" />
              </div>
            )
          }
          return (
            <button
              key={keyOf(h)}
              type="button"
              disabled={!canToggle}
              onClick={() => mech.kind === "dice" && toggleDice(pool, h, mech.dice)}
              className={`mv-trait ${lit ? "mv-trait-on" : ""} -mx-2 grid gap-0.5 rounded-[3px] px-2 py-1 text-left`}
            >
              <span className="flex items-center justify-between gap-2">
                <Name h={h} lit={lit} />
                <DotRating current={h.dots} max={Math.max(5, h.dots)} active={lit} />
              </span>
              <Sentence h={h} className="text-[11px]" />
            </button>
          )
        })}
      </div>
      <div className="grid gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {record.map((h) => {
            const on = shown === keyOf(h)
            return (
              <button
                key={keyOf(h)}
                type="button"
                onClick={() => setShown(on ? null : keyOf(h))}
                className="flex items-baseline gap-1.5 text-left text-[13px]"
                style={{ color: on ? "var(--ink)" : "var(--dim)" }}
              >
                <span className="whitespace-nowrap">
                  {h.name}
                  {h.label !== undefined && <span className="text-[11px]"> ({h.label})</span>}
                </span>
                <DotRating current={h.dots} max={h.dots} color={on ? "var(--ink)" : "var(--dim)"} className="translate-y-[-1px]" />
              </button>
            )
          })}
        </div>
        {shownMerit && <Sentence h={shownMerit} />}
      </div>
    </div>
  )
}

// ── C — Gloss tiles ──────────────────────────────────────────────────────────

function Tiles({ held, pool, canToggle }: VariantProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {held.map((h) => {
        const mech = mechanicOf(h)
        const lit = isLit(pool, h)
        const head = (right: ReactNode) => (
          <span className="flex items-center justify-between gap-2">
            <Name h={h} lit={lit || (mech.kind === "purse" && spentOf(pool, h) > 0)} />
            {right}
          </span>
        )
        if (mech.kind === "dice") {
          return (
            <button
              key={keyOf(h)}
              type="button"
              disabled={!canToggle}
              onClick={() => toggleDice(pool, h, mech.dice)}
              className={`mv-trait ${lit ? "mv-trait-on" : ""} grid content-start gap-1 rounded-[4px] p-3 text-left`}
              style={{ background: "var(--panel)", borderColor: "var(--line)" }}
            >
              {head(<DotRating current={h.dots} max={Math.max(5, h.dots)} active={lit} />)}
              <Sentence h={h} className="text-[11px]" />
            </button>
          )
        }
        if (mech.kind === "purse") {
          return (
            <div
              key={keyOf(h)}
              className="grid content-start gap-1 rounded-[4px] p-3"
              style={{ background: "var(--panel)", border: "1px solid var(--line)" }}
            >
              {head(<Pips size={mech.size} spent={spentOf(pool, h)} onSpend={(k) => spend(pool, h, k)} disabled={!canToggle} />)}
              <Sentence h={h} className="text-[11px]" />
            </div>
          )
        }
        return (
          <div key={keyOf(h)} className="grid content-start gap-1 rounded-[4px] border border-transparent p-3">
            {head(<DotRating current={h.dots} max={Math.max(5, h.dots)} />)}
            <Sentence h={h} className="text-[11px]" />
          </div>
        )
      })}
    </div>
  )
}

// ── The switch ───────────────────────────────────────────────────────────────

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
  const props = { held, pool, canToggle }
  if (variant === "A") return <Drawers {...props} />
  if (variant === "B") return <Shelves {...props} />
  return <Tiles {...props} />
}
