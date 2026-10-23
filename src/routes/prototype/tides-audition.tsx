// The Tides audition (MAG-44, owner's 2026-10-22 late brainstorm): a throwaway
// strip to decide how the cast card's TIDES box carries the NET as a mood —
// "net this is a bad-luck turn" at a glance — before the pills are read.
// Mock data only; never linked from shipping navigation; delete when decided.
//
// Axes on the page:
//   GROUND  — how the box's ground leans (four treatments, one row each)
//   PILLS   — how each circumstance is printed (three registers, a toggle)
//   NET     — whether the eyebrow prints the net beside TIDES (a toggle)
// Every row shows the same eight scenarios, verdigris (ebb) on the LEFT and
// red (flood) on the RIGHT — the owner's "don't make me think" axis — with
// long prose and the worst legibility case (a green pill on a red ground)
// included on purpose.

import { useState, type ReactNode } from "react"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/prototype/tides-audition")({ component: TidesAudition })

type Mod = { source: string; dice: number }
type Scenario = { name: string; mods: ReadonlyArray<Mod> }

const LONG = "The funeral party upstairs is still filing out"

const SCENARIOS: ReadonlyArray<Scenario> = [
  { name: "still", mods: [] },
  { name: "−3", mods: [{ source: "Hallowed ground", dice: -1 }, { source: "Consecrated hour", dice: -2 }] },
  { name: "−1", mods: [{ source: "Hallowed ground", dice: -1 }] },
  { name: "0 contested", mods: [{ source: "Ley line nexus", dice: 1 }, { source: "Hallowed ground", dice: -1 }] },
  {
    name: "0 heavy",
    mods: [
      { source: "Ley line nexus", dice: 2 },
      { source: LONG, dice: 1 },
      { source: "Hallowed ground", dice: -1 },
      { source: "Consecrated hour", dice: -2 },
    ],
  },
  { name: "+1", mods: [{ source: "Ley line nexus", dice: 1 }] },
  { name: "+3", mods: [{ source: "Ley line nexus", dice: 1 }, { source: LONG, dice: 2 }] },
  {
    name: "+4 with an ebb (worst case)",
    mods: [
      { source: "Ley line nexus", dice: 2 },
      { source: LONG, dice: 2 },
      { source: "Abyssal taint", dice: 1 },
      { source: "Hallowed ground", dice: -1 },
    ],
  },
]

const EBB = "var(--accent)"
const FLOOD = "var(--paradox)"
const mix = (ink: string, pct: number) => `color-mix(in srgb, ${ink} ${pct}%, transparent)`
// Verdigris sinks into the void faster than the red (the Willpower lesson):
// at equal alpha the green side reads half as loud, so it gets a boost.
const EBB_BOOST = 1.7
const mixSide = (ink: string, pct: number) =>
  mix(ink, ink === EBB ? Math.min(pct * EBB_BOOST, 40) : pct)
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

const sums = (mods: ReadonlyArray<Mod>) => {
  const ebb = mods.filter((m) => m.dice < 0).reduce((s, m) => s + Math.abs(m.dice), 0)
  const flood = mods.filter((m) => m.dice > 0).reduce((s, m) => s + m.dice, 0)
  return { ebb, flood, net: flood - ebb }
}

// ── GROUND treatments: each returns a CSS background for the box ──
type Ground = { key: string; name: string; note: string; css: (mods: ReadonlyArray<Mod>) => string | undefined }

const GROUNDS: ReadonlyArray<Ground> = [
  {
    key: "advance",
    name: "A · one tide advancing",
    note: "one gradient; the crossover moves with the net, alpha climbs with |net|. Contested reads calm.",
    css: (mods) => {
      const { net } = sums(mods)
      if (mods.length === 0) return undefined
      const x = clamp(50 - net * 9, 4, 96)
      const a = clamp(9 + Math.abs(net) * 2.5, 9, 22)
      return `linear-gradient(90deg, ${mixSide(EBB, a)} 0%, transparent ${x}%, ${mixSide(FLOOD, a)} 100%)`
    },
  },
  {
    key: "flares",
    name: "B · two flares",
    note: "each side flares from its own edge by its own weight. Contested reads tense; net is the brighter side.",
    css: (mods) => {
      const { ebb, flood } = sums(mods)
      if (ebb === 0 && flood === 0) return undefined
      const aE = ebb === 0 ? 0 : clamp(6 + ebb * 4, 6, 24)
      const aF = flood === 0 ? 0 : clamp(6 + flood * 4, 6, 24)
      const reachE = clamp(30 + ebb * 8, 30, 62)
      const reachF = clamp(30 + flood * 8, 30, 62)
      return [
        `linear-gradient(90deg, ${mixSide(EBB, aE)} 0%, transparent ${reachE}%)`,
        `linear-gradient(270deg, ${mixSide(FLOOD, aF)} 0%, transparent ${reachF}%)`,
      ].join(", ")
    },
  },
  {
    key: "hybrid",
    name: "C · hybrid",
    note: "crossover from the net, each side's alpha from its own weight. Contested is tense AND centered.",
    css: (mods) => {
      const { ebb, flood, net } = sums(mods)
      if (ebb === 0 && flood === 0) return undefined
      const x = clamp(50 - net * 9, 4, 96)
      const aE = ebb === 0 ? 0 : clamp(8 + ebb * 3.5, 8, 22)
      const aF = flood === 0 ? 0 : clamp(8 + flood * 3.5, 8, 22)
      return `linear-gradient(90deg, ${mixSide(EBB, aE)} 0%, transparent ${x}%, ${mixSide(FLOOD, aF)} 100%)`
    },
  },
  {
    key: "water",
    name: "D · water level (to rule out)",
    note: "the net fills the box from the floor. Evocative, but the pills sit in it.",
    css: (mods) => {
      const { net } = sums(mods)
      if (net === 0) return undefined
      const h = clamp(Math.abs(net) * 16, 16, 90)
      const ink = net > 0 ? FLOOD : EBB
      return `linear-gradient(0deg, ${mixSide(ink, 20)} 0%, ${mixSide(ink, 10)} ${h}%, transparent ${h + 1}%)`
    },
  },
]

// ── PILL registers ──
type Register = "chips" | "quiet" | "line"
const REGISTERS: ReadonlyArray<{ key: Register; name: string }> = [
  { key: "chips", name: "soft chips (today)" },
  { key: "quiet", name: "ink prose · tinted number" },
  { key: "line", name: "one prose line" },
]

const tintOf = (dice: number, soft: boolean) => {
  const ink = dice < 0 ? EBB : FLOOD
  return soft ? `color-mix(in srgb, ${ink} 58%, var(--dim))` : ink
}
const signed = (dice: number) => (dice < 0 ? `−${Math.abs(dice)}` : `+${dice}`)
// Ebbs first, strongest first; then floods, weakest first — the whole row
// climbs from the deepest green on the left to the deepest red on the right.
const ordered = (mods: ReadonlyArray<Mod>) => Array.from(mods).sort((a, b) => a.dice - b.dice)

function Pills({ mods, register }: { mods: ReadonlyArray<Mod>; register: Register }) {
  const rows = ordered(mods)
  if (register === "line") {
    return (
      <p className="mv-data text-[12px] leading-relaxed" style={{ color: "var(--ink)" }}>
        {rows.map((m, i) => (
          <span key={i}>
            {i > 0 && <span style={{ color: "var(--dim)" }}> · </span>}
            {m.source}{" "}
            <b style={{ color: tintOf(m.dice, false) }}>{signed(m.dice)}</b>
          </span>
        ))}
      </p>
    )
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {rows.map((m, i) => {
        const tint = tintOf(m.dice, true)
        const quiet = register === "quiet"
        return (
          <span
            key={i}
            className="mv-data inline-flex items-stretch overflow-hidden rounded-full border text-[12px] leading-none"
            style={{
              borderColor: quiet ? "var(--line)" : tint,
              color: quiet ? "var(--ink)" : tint,
              background: "var(--panel)",
            }}
          >
            <span className="px-2.5 py-1">{m.source}</span>
            <span
              className="flex items-center whitespace-nowrap border-l px-2 py-1 font-bold"
              style={{
                borderColor: quiet ? "var(--line)" : tint,
                color: tint,
                background: mix(tint, 14),
              }}
            >
              {signed(m.dice)}
            </span>
          </span>
        )
      })}
    </div>
  )
}

function TidesBox({
  mods,
  ground,
  register,
  showNet,
}: {
  mods: ReadonlyArray<Mod>
  ground: Ground
  register: Register
  showNet: boolean
}) {
  const { net } = sums(mods)
  const netInk = net === 0 ? "var(--dim)" : tintOf(net, false)
  return (
    <div
      className="rounded-[6px] border px-3.5 pt-3 pb-3.5"
      style={{
        width: 372,
        borderColor: "var(--line)",
        background: ground.css(mods) ?? "transparent",
      }}
    >
      <div
        className="mv-data flex items-baseline justify-between text-[9px] uppercase tracking-[0.18em]"
        style={{ color: "var(--dim)" }}
      >
        <span>tides</span>
        {showNet && (
          <span className="text-[12px] normal-case tracking-normal" style={{ color: netInk }}>
            {mods.length === 0 ? "still" : `≈ ${net === 0 ? "0" : signed(net)}`}
          </span>
        )}
      </div>
      <div className="mt-2 min-h-[26px]">
        {mods.length === 0 ? (
          <span className="mv-data text-[12px]" style={{ color: "var(--dim)" }}>
            —
          </span>
        ) : (
          <Pills mods={mods} register={register} />
        )}
      </div>
    </div>
  )
}

function Knob({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mv-data rounded-[3px] border px-2 py-1 text-[12px]"
      style={{
        borderColor: on ? "var(--accent)" : "var(--line)",
        color: on ? "var(--accent)" : "var(--dim)",
      }}
    >
      {label}
    </button>
  )
}

function Row({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <div className="flex items-baseline gap-3">
        <h2 className="mv-data text-[12px] uppercase tracking-[0.18em]" style={{ color: "var(--ink)" }}>
          {title}
        </h2>
        <p className="text-[12px]" style={{ color: "var(--dim)" }}>{note}</p>
      </div>
      <div className="flex flex-wrap gap-3">{children}</div>
    </section>
  )
}

function TidesAudition() {
  const [register, setRegister] = useState<Register>("chips")
  const [showNet, setShowNet] = useState(true)
  return (
    <main
      className="min-h-screen px-6 py-6"
      style={{ background: "var(--bg)", color: "var(--ink)" }}
    >
      <header className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2">
        <h1 className="mv-data text-[12px] uppercase tracking-[0.18em]">Tides audition</h1>
        <div className="flex items-center gap-1.5">
          <span className="mv-data text-[12px]" style={{ color: "var(--dim)" }}>pills</span>
          {REGISTERS.map((r) => (
            <Knob key={r.key} on={register === r.key} label={r.name} onClick={() => setRegister(r.key)} />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mv-data text-[12px]" style={{ color: "var(--dim)" }}>eyebrow</span>
          <Knob on={showNet} label="net beside TIDES" onClick={() => setShowNet((v) => !v)} />
        </div>
      </header>
      <div className="grid gap-8">
        {GROUNDS.map((g) => (
          <Row key={g.key} title={g.name} note={g.note}>
            {SCENARIOS.map((s) => (
              <div key={s.name} className="grid gap-1">
                <span className="mv-data text-[9px] uppercase tracking-[0.18em]" style={{ color: "var(--dim)" }}>
                  {s.name}
                </span>
                <TidesBox mods={s.mods} ground={g} register={register} showNet={showNet} />
              </div>
            ))}
          </Row>
        ))}
      </div>
    </main>
  )
}
