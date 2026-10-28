// PROTOTYPE RIG — the Merit keys gallery (MAG-66): every Merit in the
// catalog as it will look on the ring and in the door, beside its mark at
// both sizes. The worksheet for the marks campaign (MAG-68): a Merit with
// no mark shows the fallback circle, so the gaps are plain. Mock holdings,
// one plausible per Merit; never linked from shipping navigation.
//
// Knobs: ?turned=true shows every card turned (one shared dice pool, every
// turnable key toggled into it); ?family=mental|physical|social|awakened.
import { useEffect, useRef } from "react"
import { createFileRoute } from "@tanstack/react-router"
import type { Id } from "../../../convex/_generated/dataModel"
import { useDicePool } from "#/hooks/use-dice-pool"
import { ArcanaGlyph, OrderGlyph, PathGlyph, StatGlyph, ViceGlyph, VirtueGlyph } from "#/components/game/ArcanaGlyph"
import { MERIT_NAMES, merit, type HeldMerit, type MeritFamily, type MeritName } from "#/domain/merits"
import {
  Door,
  KEYHOLE,
  MARKS,
  MARK_IN_HAND,
  Mark,
  NAME_IN_HAND,
  Reach,
  keyOf,
  litOf,
  mechanicOf,
  ringName,
  spend,
  spentOf,
  toggleDice,
  turnsOf,
  type Pool,
} from "./-merits-audition"

const FAMILIES = ["all", "mental", "physical", "social", "awakened"] as const
type FamilyKnob = (typeof FAMILIES)[number]
const isFamily = (v: unknown): v is FamilyKnob =>
  typeof v === "string" && (FAMILIES as ReadonlyArray<string>).includes(v)

export const Route = createFileRoute("/prototype/merit-keys")({
  validateSearch: (search: Record<string, unknown>) => ({
    turned: search.turned === true || search.turned === "true",
    family: isFamily(search.family) ? search.family : ("all" as FamilyKnob),
  }),
  component: Gallery,
})

const SESSION_ID = "proto-merit-keys" as Id<"sessions">

// ── The sample: one plausible holding per Merit ──────────────────────────────

const LABELS: Partial<Record<MeritName, string>> = {
  Language: "Latin",
  "Fighting Finesse": "Rapier",
  "Quick Draw": "Pistol",
  Allies: "Police",
  Retainer: "Driver",
  Status: "Mysterium",
  Artifact: "The Lantern",
  "Enhanced Item": "Coat",
  "Imbued Item": "Ring",
  "Sleepwalker Retainer": "Ines",
  Thrall: "Vey",
}

/** A holding a dot or two into the Merit's range, so ladders show a rung
 * held and a rung not. */
const sampleDots = (name: MeritName): number => {
  const r = merit(name).rating
  if (r._tag === "fixed") return r.dots
  if (r._tag === "range") return Math.min(r.max, r.min + 1)
  if (r._tag === "either") return r.low
  return r.min
}

const SAMPLE: ReadonlyArray<HeldMerit> = MERIT_NAMES.map((name) => ({
  name,
  dots: sampleDots(name),
  ...(LABELS[name] === undefined ? {} : { label: LABELS[name] }),
}))

const FAMILY_TITLE: Record<MeritFamily, string> = {
  mental: "Mental",
  physical: "Physical",
  social: "Social",
  awakened: "Awakened",
}

// ── The lineup: every glyph the app already draws, beside the drawn marks ────
// A new mark must not collide with any of these (MAG-68): the open book was
// the Mysterium's before it was Encyclopedic Knowledge's.

const ARCANA = ["death", "fate", "forces", "life", "matter", "mind", "prime", "space", "spirit", "time"] as const
const PATHS = ["acanthus", "mastigos", "moros", "obrimos", "thyrsus"] as const
const ORDERS = ["adamantine arrow", "guardians of the veil", "mysterium", "silver ladder", "free council"] as const
const VIRTUES = ["charity", "faith", "fortitude", "hope", "justice", "prudence", "temperance"] as const
const VICES = ["envy", "gluttony", "greed", "lust", "pride", "wrath", "sloth"] as const
const STATS = ["defense", "initiative", "speed", "wand"] as const

function LineupItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="grid justify-items-center gap-1 text-center" style={{ width: 76 }}>
      <span className="grid size-[30px] place-items-center">{children}</span>
      <span className="mv-data text-[8px] uppercase tracking-[0.08em] leading-tight" style={{ color: "var(--dim)" }}>
        {label}
      </span>
    </span>
  )
}

function Lineup() {
  const drawn = MERIT_NAMES.filter((n) => MARKS[n] !== undefined)
  const row = (title: string, items: React.ReactNode) => (
    <div className="grid grid-cols-[6rem_1fr] items-start gap-3">
      <span className="mv-data pt-2 text-[9px] uppercase tracking-[0.14em]" style={{ color: "var(--dim)" }}>
        {title}
      </span>
      <div className="flex flex-wrap gap-y-2">{items}</div>
    </div>
  )
  return (
    <section className="grid gap-2 rounded-[4px] px-4 py-3" style={{ background: "var(--panel)", color: "var(--ink)" }}>
      {row("Arcana", ARCANA.map((a) => <LineupItem key={a} label={a}><ArcanaGlyph arcanum={a} size={26} /></LineupItem>))}
      {row("Paths", PATHS.map((a) => <LineupItem key={a} label={a}><PathGlyph path={a} size={26} /></LineupItem>))}
      {row("Orders", ORDERS.map((a) => <LineupItem key={a} label={a}><OrderGlyph order={a} size={26} /></LineupItem>))}
      {row("Virtues", VIRTUES.map((a) => <LineupItem key={a} label={a}><VirtueGlyph virtue={a} size={26} /></LineupItem>))}
      {row("Vices", VICES.map((a) => <LineupItem key={a} label={a}><ViceGlyph vice={a} size={26} /></LineupItem>))}
      {row("Stats", STATS.map((a) => <LineupItem key={a} label={a}><StatGlyph stat={a} size={26} /></LineupItem>))}
      <span aria-hidden className="my-1 h-px" style={{ background: "var(--line)" }} />
      {row("Marks", drawn.map((n) => <LineupItem key={n} label={ringName(n)}><Mark name={n} size={26} turned={false} /></LineupItem>))}
    </section>
  )
}

// ── A card: the key in hand, the reach, the door ─────────────────────────────

const CARD = 252
const MIDDLE = CARD / 2

/** The key as it hangs in hand on the ring: a stub of the ring's line, the
 * mark at its in-hand size, the short name. Static — the wheel's sizes
 * without the wheel. */
function KeyInHand({ h, pool }: { h: HeldMerit; pool: Pool }) {
  const lit = litOf(pool, h)
  const turns = turnsOf(h)
  const ink = lit ? "var(--ember)" : turns ? "var(--accent)" : "var(--ink)"
  return (
    <div className="relative" style={{ height: CARD }}>
      <span aria-hidden className="absolute inset-y-0 left-[6px] w-px" style={{ background: "var(--line)" }} />
      <div className="absolute left-[18px] flex items-center gap-2 whitespace-nowrap" style={{ top: MIDDLE - 18, height: 36, color: ink }}>
        <span className="grid shrink-0 place-items-center rounded-full" style={{ width: MARK_IN_HAND, height: MARK_IN_HAND, background: "var(--bg)" }}>
          <Mark name={h.name} size="100%" turned={lit} />
        </span>
        <span className="mv-data uppercase tracking-[0.12em]" style={{ fontSize: NAME_IN_HAND, background: "var(--bg)", paddingInline: 3 }}>
          {ringName(h.name)}
          {h.label !== undefined && <span className="normal-case tracking-normal" style={{ color: "var(--dim)" }}> ({h.label})</span>}
        </span>
      </div>
      {/* the mark again, small, as every other key on the ring sees it */}
      <span aria-hidden className="absolute left-[18px] flex items-center gap-2" style={{ bottom: 10, color: MARKS[h.name] === undefined ? "var(--dim)" : ink, opacity: 0.8 }}>
        <Mark name={h.name} size={26} turned={lit} />
        <span className="mv-data text-[9px] uppercase tracking-[0.12em]" style={{ color: "var(--dim)" }}>
          {MARKS[h.name] === undefined ? "no mark yet" : "at 26"}
        </span>
      </span>
    </div>
  )
}

function Card({ h, pool, canToggle }: { h: HeldMerit; pool: Pool; canToggle: boolean }) {
  return (
    <div className="relative grid grid-cols-[minmax(0,15rem)_1fr] gap-x-8 rounded-[4px] px-4 py-3" style={{ background: "var(--panel)" }}>
      <Reach h={h} pool={pool} middle={MIDDLE + 12} />
      <KeyInHand h={h} pool={pool} />
      <Door h={h} pool={pool} canToggle={canToggle} middle={MIDDLE} height={CARD} />
    </div>
  )
}

// ── The gallery ──────────────────────────────────────────────────────────────

function Gallery() {
  const { turned, family } = Route.useSearch()
  const navigate = Route.useNavigate()
  const pool = useDicePool(SESSION_ID)
  const canToggle = pool.state === "idle" || pool.state === "building"

  // the turned knob: every turnable key into the one shared pool, a purse
  // one pip spent; off takes them all back. The ref guards StrictMode's
  // double-run of the effect, which toggled every key twice.
  const applied = useRef<boolean | null>(null)
  useEffect(() => {
    if (applied.current === turned) return
    applied.current = turned
    SAMPLE.forEach((h) => {
      const mech = mechanicOf(h)
      if (mech.kind === "dice" && litOf(pool, h) !== turned) toggleDice(pool, h, mech.dice)
      if (mech.kind === "purse" && (spentOf(pool, h) > 0) !== turned) spend(pool, h, turned ? 1 : 0)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turned])

  const shown = family === "all" ? SAMPLE : SAMPLE.filter((h) => merit(h.name).family === family)
  const families: ReadonlyArray<MeritFamily> = family === "all" ? ["mental", "physical", "social", "awakened"] : [family]
  const drawn = MERIT_NAMES.filter((n) => MARKS[n] !== undefined).length

  return (
    <div className="min-h-screen px-8 py-6" style={{ background: "var(--bg)", color: "var(--ink)" }}>
      <div className="grid gap-8" style={{ maxWidth: 1180, marginInline: "auto" }}>
        <header className="flex flex-wrap items-baseline justify-between gap-4">
          <div className="grid gap-1">
            <h1 className="mv-h text-[22px] leading-none">Merit keys</h1>
            <p className="text-[12px]" style={{ color: "var(--dim)" }}>
              Every Merit as key and door. {drawn} of {MERIT_NAMES.length} marks drawn; the rest show the fallback. The keyhole at {KEYHOLE}px.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => void navigate({ search: (prev) => ({ ...prev, turned: !turned }), replace: true })}
              className={`mv-trait ${turned ? "mv-trait-on" : ""} mv-data rounded-[3px] px-2.5 py-1`}
              style={{ color: turned ? "var(--ember)" : "var(--ink)", boxShadow: turned ? undefined : "inset 0 0 0 1px var(--line)" }}
            >
              {turned ? "all turned" : "all still"}
            </button>
            <span className="mx-1 h-[12px] w-px" style={{ background: "var(--line)" }} />
            {FAMILIES.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => void navigate({ search: (prev) => ({ ...prev, family: f }), replace: true })}
                className="mv-data rounded-[3px] px-2 py-1 uppercase tracking-[0.1em]"
                style={{ color: f === family ? "var(--ink)" : "var(--dim)", boxShadow: f === family ? "inset 0 0 0 1px var(--accent)" : undefined }}
              >
                {f}
              </button>
            ))}
          </div>
        </header>
        <Lineup />
        {families.map((f) => (
          <section key={f} className="grid gap-3">
            <h2 className="mv-data text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--dim)" }}>
              {FAMILY_TITLE[f]} · {shown.filter((h) => merit(h.name).family === f).length}
            </h2>
            <div className="grid gap-4">
              {shown
                .filter((h) => merit(h.name).family === f)
                .map((h) => (
                  <Card key={keyOf(h)} h={h} pool={pool} canToggle={canToggle} />
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
