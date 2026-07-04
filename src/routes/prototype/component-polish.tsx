// PROTOTYPE — throwaway. Answers decision-map ticket `component-polish`.
//
// Takes the LOCKED visual identity (Cinzel display · Manrope body · JetBrains
// Mono data · Verdigris #6fae97 on a dark supernal void · the ten Arcana as a
// functional hybrid glyph set — see docs/visual-identity.md) down to the
// component level. Scope: the CORE PLAY LOOP exemplar, wired as a real
// interaction —
//   toggle a trait on the CharacterSheet → it enters the DicePoolBuilder →
//   Roll → a result card lands in the ActivityLog.
// This settles the shared component language (density, active-states, glyph
// usage, roll readout). ActivityLog depth + whiteboard tools are spawned as
// follow-up tickets. Mock data; no Convex/domain import. DELETE once specced.
import { useState, type ReactNode } from "react"
import { createFileRoute } from "@tanstack/react-router"

// ── Arcana glyph set (hybrid grammar, copied from the visual-identity spec) ──
type Arc =
  | "death" | "fate" | "forces" | "life" | "matter"
  | "mind" | "prime" | "space" | "spirit" | "time"

const ARCANA: Record<Arc, ReactNode> = {
  death: <><path d="M6 5 L8.4 6 M6 5 L6.6 7.6" /><path d="M6 5 C7 13.5 17.5 15.5 17.5 9.5 C17.5 6 12.5 6 12.5 10 C12.5 12.6 15.6 12.6 15.8 10.4" /></>,
  fate: <><path d="M12 20 L8.2 8.4 M8.2 8.4 L6.9 9.6 M8.2 8.4 L9.6 9" /><path d="M12 20 L15.4 10.4 C16.2 7.4 12.9 6.9 13.3 9.6" /></>,
  forces: <><path d="M15.2 7 L13.6 5.6 M15.2 7 L17 6.3" /><path d="M15.2 7 C9.5 6.6 6.8 11.6 10.6 14.8 C13.6 17.2 16.8 14.2 15.4 11.4" /><circle cx="12.4" cy="11.4" r="1.7" fill="currentColor" stroke="none" /></>,
  life: <><path d="M12 4 C6.5 9 6.5 15 12 20 C17.5 15 17.5 9 12 4 Z" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /></>,
  matter: <><path d="M12 3 L21 8 V16 L12 21 L3 16 V8 Z" /><path d="M12 3 V11 M12 11 L21 8 M12 11 L3 8" /><circle cx="12" cy="6.6" r="1.1" fill="currentColor" stroke="none" /></>,
  mind: <><circle cx="12" cy="13" r="1.5" fill="currentColor" stroke="none" /><path d="M6.7 13 A5.3 5.3 0 0 1 17.3 13" /><path d="M3.7 13 A8.3 8.3 0 0 1 20.3 13" /></>,
  prime: <><circle cx="12" cy="3.6" r="1.2" fill="currentColor" stroke="none" /><path d="M12 5.4 V6.2 M9.9 3.6 H10.7 M13.3 3.6 H14.1" /><path d="M7 8 H17" /><path d="M12 8 V16" /><path d="M12 16 C9.2 16 9.2 20 12 20 C14.8 20 14.8 16 12 16 Z" /></>,
  space: <><rect x="4" y="4" width="16" height="16" /><path d="M12 4 L20 12 L12 20 L4 12 Z" /><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" /></>,
  spirit: <><circle cx="11" cy="12" r="7.5" /><path d="M11 4.5 V19.5" /><path d="M4.5 12 H17.5" opacity=".5" /><circle cx="21" cy="6.5" r="1.4" fill="currentColor" stroke="none" /></>,
  time: <><path d="M6.5 4 H17.5 L6.5 20 H17.5" /><path d="M17.5 20 C19.6 20 19.6 17.4 17.8 17.7" /><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" /></>,
}
function Glyph({ arc, size = 14, className = "" }: { arc: Arc; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {ARCANA[arc]}
    </svg>
  )
}

export const Route = createFileRoute("/prototype/component-polish")({ component: ComponentPolish })

// ── Mock character — Arctus, Obrimos of the Mysterium ──
const RULING: Record<string, Arc[]> = {
  Obrimos: ["forces", "prime"], Acanthus: ["time", "fate"], Mastigos: ["space", "mind"],
  Moros: ["matter", "death"], Thyrsus: ["life", "spirit"],
}
const CHAR = {
  name: "Arctus", shadow: "The Unbound Key", path: "Obrimos", order: "Mysterium",
  concept: "Disgraced astronomer", gnosis: 3, virtue: "Hope", vice: "Pride",
  willpower: 5, willCur: 4, mana: 5, manaMax: 12, defense: 3, initiative: 6, speed: 9,
  attrs: {
    Mental: [["Intelligence", 3], ["Wits", 3], ["Resolve", 2]],
    Physical: [["Strength", 2], ["Dexterity", 3], ["Stamina", 2]],
    Social: [["Presence", 2], ["Manipulation", 2], ["Composure", 3]],
  } as Record<string, [string, number][]>,
  skills: {
    Mental: [["Occult", 3], ["Academics", 2], ["Investigation", 2]],
    Physical: [["Athletics", 2], ["Firearms", 1]],
    Social: [["Persuasion", 2], ["Intimidation", 1]],
  } as Record<string, [string, number][]>,
  arcana: [["forces", 3], ["prime", 2], ["matter", 1], ["mind", 1], ["fate", 1]] as [Arc, number][],
  // health track: 7 boxes — one lethal, one bashing, rest empty
  health: ["lethal", "bashing", "empty", "empty", "empty", "empty", "empty"],
}

// ── Pool state ──
type Comp = { key: string; type: string; name: string; dots: number; arc?: Arc }

function ComponentPolish() {
  const [active, setActive] = useState<Record<string, Comp>>({})
  const [modifier, setModifier] = useState(0)
  const [again, setAgain] = useState(10)
  const [rote, setRote] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [log, setLog] = useState<LogEntry[]>(SEED_LOG)
  const [rolling, setRolling] = useState(false)

  const comps = Object.values(active)
  const traitSum = comps.reduce((s, c) => s + c.dots, 0)
  const poolSize = Math.max(0, traitSum + modifier)
  const building = comps.length > 0 || modifier !== 0

  const toggle = (c: Comp) =>
    setActive((prev) => {
      const next = { ...prev }
      if (next[c.key]) delete next[c.key]
      else next[c.key] = c
      return next
    })
  const reset = () => { setActive({}); setModifier(0); setRote(false); setHidden(false); setAgain(10) }

  const roll = () => {
    setRolling(true)
    // client-only (event handler) — Math.random is safe here, never at render
    window.setTimeout(() => {
      const res = rollDice(poolSize, again, rote)
      setLog((l) => {
        const entry: RollLog = {
          kind: "roll", id: `r${l.length}`, who: CHAR.name, hidden,
          comps: comps.map((c) => (c.arc ? { name: c.name, dots: c.dots, arc: c.arc } : { name: c.name, dots: c.dots })),
          modifier, ...res,
        }
        return [...l, entry]
      })
      setRolling(false)
      reset()
    }, 480)
  }

  return (
    <div className="cp-root" style={{ ["--accent" as string]: "#6fae97", ["--dim2" as string]: "#3c6b5c", ["--line" as string]: "#1e2b27", ["--glow" as string]: "rgba(111,174,151,.12)" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" />
      <style>{CSS}</style>

      <div className="cp-layer">
        <header className="cp-panel flex shrink-0 items-center gap-3 border-x-0 border-t-0 px-4 py-2">
          <span className="cp-eyebrow">Component polish</span>
          <span className="cp-data text-[11px]" style={{ color: "var(--dim)" }}>core play loop — toggle traits → build pool → roll → log</span>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* CENTER — the character sheet (traits toggle into the pool) */}
          <div className="min-w-0 flex-1 overflow-y-auto p-4">
            <Sheet active={active} toggle={toggle} disabled={rolling} />
          </div>

          {/* RIGHT RAIL — dice pool (top) + activity log */}
          <div className="cp-panel flex w-[340px] shrink-0 flex-col border-y-0 border-r-0">
            <ActivityLog log={log} rolling={rolling} />
            <DicePool
              comps={comps} poolSize={poolSize} building={building} modifier={modifier}
              setModifier={setModifier} again={again} setAgain={setAgain}
              rote={rote} setRote={setRote} hidden={hidden} setHidden={setHidden}
              onRoll={roll} onReset={reset} onRemove={(k) => toggle(active[k])} rolling={rolling}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────── Character Sheet ──────────────────────────────
function Sheet({ active, toggle, disabled }: { active: Record<string, Comp>; toggle: (c: Comp) => void; disabled: boolean }) {
  const ruling = RULING[CHAR.path] ?? []
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      {/* header */}
      <div className="cp-cornered cp-panel flex items-start justify-between p-4">
        <div>
          <h1 className="cp-h text-3xl leading-none">{CHAR.name}</h1>
          <p className="cp-data mt-1 text-[12px] italic" style={{ color: "var(--dim)" }}>“{CHAR.shadow}”</p>
          <p className="mt-2 text-[13px]" style={{ color: "var(--ink)" }}>
            {CHAR.path} <span style={{ color: "var(--dim)" }}>·</span> {CHAR.order}
            <span className="ml-1 inline-flex translate-y-[3px] gap-1">
              {ruling.map((a) => <Glyph key={a} arc={a} size={15} className="cp-accent" />)}
            </span>
          </p>
          <p className="text-[12px]" style={{ color: "var(--dim)" }}>{CHAR.concept} · {CHAR.virtue}/{CHAR.vice}</p>
        </div>
        {/* resource readouts — instrument style */}
        <div className="grid gap-1 text-right">
          <Resource label="GNOSIS" node={<span className="cp-accent font-semibold">{CHAR.gnosis}</span>} />
          <Resource label="MANA" node={<Pips filled={CHAR.mana} max={10} />} sub={`${CHAR.mana}/${CHAR.manaMax}`} />
          <Resource label="WILL" node={<Pips filled={CHAR.willCur} max={CHAR.willpower} />} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Attributes">
          <div className="grid grid-cols-3 gap-x-4 gap-y-3">
            {Object.entries(CHAR.attrs).map(([col, stats]) => (
              <TraitColumn key={col} label={col} type="attribute" stats={stats} active={active} toggle={toggle} disabled={disabled} />
            ))}
          </div>
        </Section>
        <Section title="Skills">
          <div className="grid grid-cols-3 gap-x-4 gap-y-3">
            {Object.entries(CHAR.skills).map(([col, stats]) => (
              <TraitColumn key={col} label={col} type="skill" stats={stats} active={active} toggle={toggle} disabled={disabled} />
            ))}
          </div>
        </Section>
      </div>

      <Section title="Arcana">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
          {CHAR.arcana.map(([arc, dots]) => {
            const key = `arcanum:${arc}`
            const on = !!active[key]
            const isRuling = ruling.includes(arc)
            return (
              <button
                key={arc} type="button" disabled={disabled}
                onClick={() => toggle({ key, type: "arcanum", name: cap(arc), dots, arc })}
                className={`cp-trait flex items-center gap-2.5 rounded-[3px] px-2 py-1.5 text-left ${on ? "cp-trait-on" : ""}`}
              >
                <Glyph arc={arc} size={19} className={on ? "cp-accent" : ""} />
                <span className="flex-1 text-[13px]" style={{ color: on ? "var(--ink)" : "var(--ink)" }}>
                  {cap(arc)}
                  {isRuling && <span className="cp-accent ml-1" title="Ruling Arcanum">◆</span>}
                </span>
                <Dots current={dots} on={on} />
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Vitals">
        <div className="grid gap-3">
          <div className="flex items-center gap-3">
            <span className="cp-eyebrow w-16">Health</span>
            <div className="flex gap-1">
              {CHAR.health.map((b, i) => (
                <span key={i} className="cp-data grid size-5 place-items-center rounded-[2px] border text-[10px] font-bold"
                  style={{
                    borderColor: b === "empty" ? "var(--line)" : "var(--accent)",
                    background: b === "lethal" ? "var(--glow)" : "transparent",
                    color: "var(--accent)",
                  }}>
                  {b === "bashing" ? "╱" : b === "lethal" ? "✕" : ""}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-6 cp-data text-[12px]">
            <Stat label="Defense" value={CHAR.defense} />
            <Stat label="Initiative" value={CHAR.initiative} />
            <Stat label="Speed" value={CHAR.speed} />
          </div>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="cp-eyebrow">{title}</h3>
        <span className="cp-rule flex-1" />
      </div>
      {children}
    </section>
  )
}
function TraitColumn({ label, type, stats, active, toggle, disabled }: {
  label: string; type: string; stats: [string, number][]; active: Record<string, Comp>; toggle: (c: Comp) => void; disabled: boolean
}) {
  return (
    <div className="grid gap-1">
      <span className="cp-data text-[10px] uppercase tracking-wider" style={{ color: "var(--dim)" }}>{label}</span>
      {stats.map(([name, dots]) => {
        const key = `${type}:${name}`
        const on = !!active[key]
        return (
          <button key={name} type="button" disabled={disabled}
            onClick={() => toggle({ key, type, name, dots })}
            className={`cp-trait flex items-center justify-between gap-2 rounded-[3px] px-2 py-1 text-left ${on ? "cp-trait-on" : ""}`}>
            <span className="text-[12px]">{name}</span>
            <Dots current={dots} on={on} />
          </button>
        )
      })}
    </div>
  )
}

// ────────────────────────────── Dice Pool ──────────────────────────────
function DicePool(p: {
  comps: Comp[]; poolSize: number; building: boolean; modifier: number
  setModifier: (f: (m: number) => number) => void; again: number; setAgain: (n: number) => void
  rote: boolean; setRote: (b: boolean) => void; hidden: boolean; setHidden: (b: boolean) => void
  onRoll: () => void; onReset: () => void; onRemove: (k: string) => void; rolling: boolean
}) {
  const chance = p.building && p.poolSize <= 0
  return (
    <div className="cp-panel border-x-0 border-b-0">
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span className="cp-eyebrow">Dice pool</span>
        <span className="cp-data ml-auto text-[22px] font-bold leading-none" style={{ color: p.building ? "var(--accent)" : "var(--dim)" }}>
          {chance ? "◈" : p.poolSize}
        </span>
        <span className="cp-data text-[10px]" style={{ color: "var(--dim)" }}>{chance ? "chance" : "dice"}</span>
      </div>

      {/* assembled components */}
      <div className="flex min-h-[30px] flex-wrap gap-1 px-3 pt-2">
        {p.comps.length === 0 && <span className="cp-data text-[11px] italic" style={{ color: "var(--dim)" }}>toggle traits on the sheet…</span>}
        {p.comps.map((c) => (
          <button key={c.key} onClick={() => p.onRemove(c.key)} disabled={p.rolling}
            className="cp-chip group flex items-center gap-1 rounded-full py-0.5 pl-1.5 pr-1 text-[11px]">
            {c.arc && <Glyph arc={c.arc} size={12} className="cp-accent" />}
            <span>{c.name}</span>
            <span className="cp-data" style={{ color: "var(--dim)" }}>{c.dots}</span>
            <span className="opacity-40 group-hover:opacity-100">✕</span>
          </button>
        ))}
        {p.modifier !== 0 && (
          <button onClick={() => p.setModifier(() => 0)} className="cp-chip flex items-center gap-1 rounded-full py-0.5 pl-2 pr-1 text-[11px]">
            <span>mod</span><span className="cp-data cp-accent">{p.modifier > 0 ? `+${p.modifier}` : p.modifier}</span><span className="opacity-40">✕</span>
          </button>
        )}
      </div>

      {/* controls */}
      <div className="mt-2 flex items-center gap-3 px-3">
        <span className="cp-data text-[10px] uppercase tracking-wider" style={{ color: "var(--dim)" }}>mod</span>
        <div className="flex items-center gap-1">
          <Step onClick={() => p.setModifier((m) => m - 1)}>−</Step>
          <span className="cp-data w-7 text-center text-[13px] font-bold">{p.modifier > 0 ? `+${p.modifier}` : p.modifier}</span>
          <Step onClick={() => p.setModifier((m) => m + 1)}>+</Step>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {[10, 9, 8].map((n) => (
            <button key={n} onClick={() => p.setAgain(n)} className={`cp-mini ${p.again === n ? "cp-mini-on" : ""}`}>{n}-ag</button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 px-3">
        <Toggle on={p.rote} set={p.setRote} label="Rote" />
        <Toggle on={p.hidden} set={p.setHidden} label="Hidden" />
      </div>

      {/* action */}
      <div className="flex gap-2 p-3">
        <button onClick={p.onRoll} disabled={!p.building || p.rolling}
          className="cp-roll flex-1 rounded-[3px] py-2 text-[13px] disabled:opacity-40">
          {p.rolling ? "Rolling…" : chance ? "Roll chance die" : `Roll ${p.poolSize} dice`}
        </button>
        {p.building && !p.rolling && (
          <button onClick={p.onReset} className="cp-btn rounded-[3px] px-3 text-[12px]">Clear</button>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────── Activity Log ──────────────────────────────
function ActivityLog({ log, rolling }: { log: LogEntry[]; rolling: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--line)" }}>
        <span className="cp-eyebrow">Chronicle</span>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-2 overflow-y-auto p-3">
        {log.map((e, i) =>
          e.kind === "sys" ? (
            i === 0 ? (
              <div key={e.id} className="flex gap-2 py-0.5" style={{ color: "var(--dim)" }}>
                <span className="cp-h shrink-0 text-[32px] leading-[0.8] cp-accent">{e.text.charAt(0)}</span>
                <span className="text-[12px] italic">{e.text.slice(1)}</span>
              </div>
            ) : (
              <div key={e.id} className="text-center text-[11px] italic" style={{ color: "var(--dim)" }}>— {e.text} —</div>
            )
          ) : e.kind === "msg" ? (
            <div key={e.id} className="text-[13px]" style={{ color: "var(--ink)" }}><b className="cp-accent">{e.who}</b> {e.text}</div>
          ) : (
            <RollCard key={e.id} e={e} />
          ),
        )}
        {rolling && (
          <div className="cp-panel flex items-center gap-2 rounded-[3px] px-2.5 py-2 text-[12px]">
            <span className="inline-flex size-2 animate-ping rounded-full" style={{ background: "var(--accent)" }} />
            <span className="cp-accent">casting the dice…</span>
          </div>
        )}
      </div>
    </div>
  )
}
function RollCard({ e }: { e: RollLog }) {
  const exceptional = e.successes >= 5
  const dramatic = e.chance && e.base[0] === 1 && e.successes === 0
  return (
    <div className="cp-cornered cp-panel rounded-[3px] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {e.comps.filter((c) => c.arc).map((c) => <Glyph key={c.name} arc={c.arc!} size={14} className="cp-accent" />)}
          <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>{e.who}</span>
        </div>
        <div className="flex gap-1">
          {dramatic && <Tag kind="bad">Dramatic Failure</Tag>}
          {exceptional && <Tag kind="good">Exceptional</Tag>}
          {e.hidden && <Tag>Hidden</Tag>}
        </div>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="cp-data text-[24px] font-bold leading-none" style={{ color: e.successes > 0 ? "var(--accent)" : "var(--dim)" }}>{e.successes}</span>
        <span className="text-[11px]" style={{ color: "var(--dim)" }}>{e.successes === 1 ? "success" : "successes"} · {e.chance ? "chance die" : `${e.poolSize} dice`}{e.rote ? " · rote" : ""}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {e.base.map((d, i) => <Die key={`b${i}`} v={d} again={e.again} />)}
        {e.rerolls.map((d, i) => <Die key={`r${i}`} v={d} again={e.again} ring="rote" />)}
        {e.explosions.map((d, i) => <Die key={`e${i}`} v={d} again={e.again} ring="exp" />)}
      </div>
      <div className="cp-data mt-1.5 text-[10px]" style={{ color: "var(--dim)" }}>
        {e.comps.map((c) => `${c.name} ${c.dots}`).join(" + ")}{e.modifier ? ` ${e.modifier > 0 ? "+" : ""}${e.modifier}` : ""}
      </div>
    </div>
  )
}
function Die({ v, again, ring }: { v: number; again: number; ring?: "rote" | "exp" }) {
  const success = v >= 8
  return (
    <span className="cp-data grid size-5 place-items-center rounded-[2px] text-[10px] font-bold"
      style={{
        background: success ? "var(--accent)" : "var(--raise)",
        color: success ? "#0a0a0c" : "var(--dim)",
        boxShadow: ring === "rote" ? "0 0 0 1px var(--dim2)" : ring === "exp" ? "0 0 0 1px var(--accent)" : v >= again ? "0 0 0 1px var(--accent)" : undefined,
      }}>
      {v}
    </span>
  )
}

// ── shared bits ──
function Dots({ current, on, max = 5 }: { current: number; on?: boolean; max?: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className="inline-block size-1.5 rounded-full"
          style={{ background: i < current ? (on ? "var(--accent)" : "var(--ink)") : "transparent", boxShadow: i < current ? undefined : "inset 0 0 0 1px var(--line)" }} />
      ))}
    </span>
  )
}
function Pips({ filled, max }: { filled: number; max: number }) {
  return (
    <span className="inline-flex gap-0.5 align-middle">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className="text-[10px]" style={{ color: i < filled ? "var(--accent)" : "var(--line)" }}>◆</span>
      ))}
    </span>
  )
}
function Resource({ label, node, sub }: { label: string; node: ReactNode; sub?: string }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="cp-eyebrow">{label}</span>
      <span className="cp-data text-[12px]">{node}</span>
      {sub && <span className="cp-data text-[10px]" style={{ color: "var(--dim)" }}>{sub}</span>}
    </div>
  )
}
function Stat({ label, value }: { label: string; value: number }) {
  return <span><span style={{ color: "var(--dim)" }}>{label} </span><span style={{ color: "var(--ink)" }}>{value}</span></span>
}
function Step({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className="cp-btn grid size-6 place-items-center rounded-[3px] text-[13px] leading-none">{children}</button>
}
function Toggle({ on, set, label }: { on: boolean; set: (b: boolean) => void; label: string }) {
  return (
    <button onClick={() => set(!on)} className={`cp-mini ${on ? "cp-mini-on" : ""}`}>{label}</button>
  )
}
function Tag({ kind, children }: { kind?: "good" | "bad"; children: ReactNode }) {
  const c = kind === "good" ? "var(--accent)" : kind === "bad" ? "#b56d60" : "var(--dim)"
  return <span className="cp-data rounded-[2px] px-1 py-0.5 text-[9px] uppercase tracking-wide" style={{ border: `1px solid ${c}`, color: c }}>{children}</span>
}

// ── dice mechanics (client-only) ──
function rollDice(pool: number, again: number, rote: boolean) {
  const rd = () => 1 + Math.floor(Math.random() * 10)
  if (pool <= 0) {
    const d = rd()
    return { base: [d], explosions: [] as number[], rerolls: [] as number[], successes: d === 10 ? 1 : 0, poolSize: 0, chance: true, again, rote }
  }
  const base = Array.from({ length: pool }, rd)
  const explosions: number[] = []
  let pending = base.filter((d) => d >= again).length
  let guard = 0
  while (pending > 0 && guard < 60) { const d = rd(); explosions.push(d); if (d >= again) pending++; pending--; guard++ }
  const rerolls: number[] = []
  if (rote) base.forEach((d) => { if (d < 8) rerolls.push(rd()) })
  const succ = (arr: number[]) => arr.filter((d) => d >= 8).length
  return { base, explosions, rerolls, successes: succ(base) + succ(explosions) + succ(rerolls), poolSize: pool, chance: false, again, rote }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// ── log types + seed ──
type SysLog = { kind: "sys"; id: string; text: string }
type MsgLog = { kind: "msg"; id: string; who: string; text: string }
type RollLog = {
  kind: "roll"; id: string; who: string; hidden: boolean; modifier: number
  comps: { name: string; dots: number; arc?: Arc }[]
  base: number[]; explosions: number[]; rerolls: number[]; successes: number; poolSize: number; chance: boolean; again: number; rote: boolean
}
type LogEntry = SysLog | MsgLog | RollLog
const SEED_LOG: LogEntry[] = [
  { kind: "sys", id: "s0", text: "Two ghouls lurch from the vestry, reeking of the Lead Coin." },
  { kind: "msg", id: "m0", who: "Mara", text: "I ward the font before they reach it." },
]

const CSS = `
.cp-root{min-height:100vh;height:100vh;display:flex;flex-direction:column;position:relative;overflow:hidden;
  --bg:#08080c;--panel:#0e0d13;--raise:#16141d;--ink:#d7d2e0;--dim:#797488;
  color:var(--ink);font-family:'Manrope',ui-sans-serif,system-ui,sans-serif;
  background:radial-gradient(120% 90% at 50% -10%, var(--glow), transparent 45%),#08080c;}
.cp-root::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:2;box-shadow:inset 0 0 220px 40px rgba(0,0,0,.55)}
.cp-layer{position:relative;z-index:1;display:flex;flex-direction:column;height:100%}
.cp-panel{background:var(--panel);border:1px solid var(--line)}
.cp-cornered{position:relative}
.cp-cornered::before,.cp-cornered::after{content:'';position:absolute;width:9px;height:9px;pointer-events:none;border-color:var(--accent);opacity:.5}
.cp-cornered::before{top:-1px;left:-1px;border-top:1px solid;border-left:1px solid}
.cp-cornered::after{bottom:-1px;right:-1px;border-bottom:1px solid;border-right:1px solid}
.cp-h{font-family:'Cinzel',Georgia,serif;font-weight:600;letter-spacing:.01em;color:var(--ink);margin:0}
.cp-eyebrow{font-family:'JetBrains Mono',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.22em;font-size:9px;color:var(--dim)}
.cp-data{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums}
.cp-accent{color:var(--accent)}
.cp-rule{height:1px;background:linear-gradient(90deg,var(--line),transparent)}
/* traits — the toggle-into-pool interaction */
.cp-trait{border:1px solid transparent;transition:background .12s,border-color .12s;cursor:pointer}
.cp-trait:hover{background:var(--raise)}
.cp-trait:disabled{opacity:.5;cursor:default}
.cp-trait-on{background:var(--glow)!important;border-color:var(--accent)!important}
.cp-chip{background:var(--raise);border:1px solid var(--line);color:var(--ink);cursor:pointer}
.cp-chip:hover{border-color:var(--accent)}
.cp-btn{background:var(--raise);border:1px solid var(--line);color:var(--ink);cursor:pointer;
  font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.06em}
.cp-btn:hover{border-color:var(--accent);color:#fff}
.cp-mini{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.06em;
  padding:2px 7px;border-radius:3px;background:var(--raise);border:1px solid var(--line);color:var(--dim);cursor:pointer}
.cp-mini:hover{border-color:var(--accent);color:var(--ink)}
.cp-mini-on{background:var(--accent);color:#0a0a0c;border-color:var(--accent)}
.cp-roll{font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.08em;
  background:var(--accent);color:#0a0a0c;border:1px solid var(--accent);cursor:pointer;font-weight:600}
.cp-roll:hover:not(:disabled){box-shadow:0 0 16px var(--glow)}
`
