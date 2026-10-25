import { Array as Arr, Schema } from "effect"
import type { HealthTrack } from "#/domain/damage"
import { containmentOutlook } from "#/domain/cast"
import { emptyOrdinals } from "#/domain/health"
import { resolveParadox, type ParadoxSeverity } from "#/domain/paradox"
import { rollOdds } from "#/domain/probability"
import { healthBoxGlyph, ResistantDot } from "./HealthGlyphs"
import { UnifiedDie } from "./UnifiedDie"

/**
 * MAG-49's audition: the backlash step as Paradox against health alone, on
 * the dressing room's `?backlash=` knob. Owner, 2026-10-25: "if all we're
 * trying to focus on here is paradox vs health then why don't we try some
 * auditions just showing that, we don't need the felt here". So in every
 * variant the felt and the odds row stand down at this step; what's left is
 * the red successes, the caster's health, what to click, what the world
 * suffers, and one line for the spell — each loose success costs it a die
 * (p. 129), and so does any wound penalty the containment brings. Containment
 * can fill the track to unconsciousness, never past it (p. 126).
 *
 * - **track** — the red successes, the track right under them, the boxes a
 *   click can take marked as targets and the rest stood down.
 * - **pairs** — each red success a button joined to the box it would fill.
 * - **scales** — the world on one side, the body on the other: a red die
 *   clicked crosses into a box; a filled box clicked sends it back.
 */
export const BacklashVariant = Schema.Literals(["now", "track", "pairs", "scales"])
export type BacklashVariant = typeof BacklashVariant.Type

/** Shared by every variant: the caster's facts, and the bet. */
export interface BacklashProps {
  readonly track: HealthTrack
  readonly declaredPool: number
  readonly paradoxSuccesses: number
  /** the rolled success faces, drawn as the red dice */
  readonly successFaces: ReadonlyArray<number>
  readonly cap: number
  readonly contained: number
  readonly onChange?: ((value: number) => void) | undefined
  readonly disabled?: boolean
}

/** What a loose severity does to the world, in a line (p. 129's table; our words). */
const SEVERITY_SAYS: Record<ParadoxSeverity, string> = {
  none: "",
  havoc: "the spell slips its leash — the Storyteller turns it",
  bedlam: "the mind cracks — a madness takes hold",
  anomaly: "reality warps around the scene",
  branding: "the Abyss marks the caster's body",
  manifestation: "something from the Abyss comes through",
}

/** The contained mark (MAG-49): the caster bore it. */
const CONTAINED_MARK = "Borne"

const pct = (p: number): string => (p <= 0 ? "0%" : p < 0.001 ? "<0.1%" : `${(p * 100).toFixed(1)}%`)
const dice = (n: number): string => (n <= 0 ? "a chance die" : n === 1 ? "1 die" : `${n} dice`)

const outlookAt = (p: BacklashProps, contained: number) =>
  containmentOutlook({
    track: p.track,
    declaredPool: p.declaredPool,
    paradoxSuccesses: p.paradoxSuccesses,
    contained,
  })

/** The red successes, in rolled order; makeBy normalizes to >= 1, so none is guarded. */
const facesOf = (p: BacklashProps): ReadonlyArray<number> =>
  p.paradoxSuccesses > 0 ? Arr.makeBy(p.paradoxSuccesses, (i) => p.successFaces[i] ?? 10) : []

const EYEBROW = { letterSpacing: "0.08em", color: "var(--dim)" } as const

/** The verdict: the loose severity and what it does, or the mark. */
function Verdict({ p }: { p: BacklashProps }) {
  const o = outlookAt(p, p.contained)
  const severity = resolveParadox(o.uncontained).severity
  if (o.uncontained > 0) {
    return (
      <div className="grid justify-items-center gap-0.5 text-center">
        <span
          className="mv-h uppercase leading-none"
          style={{
            fontSize: 20,
            letterSpacing: "0.1em",
            color: "var(--paradox)",
            textShadow: "0 0 14px color-mix(in srgb, var(--paradox) 55%, transparent)",
          }}
        >
          {severity}
        </span>
        <span className="text-[12px] italic" style={{ color: "var(--dim)" }}>
          {SEVERITY_SAYS[severity]}
        </span>
      </div>
    )
  }
  if (p.paradoxSuccesses === 0) {
    return (
      <span className="mv-data text-[12px]" style={{ color: "var(--rail-success)" }}>
        no Paradox — the way to the cast is clear
      </span>
    )
  }
  return (
    <div className="grid justify-items-center gap-0.5 text-center">
      <span
        className="mv-h uppercase leading-none"
        style={{
          fontSize: 20,
          letterSpacing: "0.14em",
          color: "var(--ember)",
          textShadow: "0 0 14px color-mix(in srgb, var(--ember) 45%, transparent)",
        }}
      >
        {CONTAINED_MARK}
      </span>
      <span className="text-[12px] italic" style={{ color: "var(--dim)" }}>
        {o.martyr ? "the world is spared — the caster falls unconscious" : "the world is spared — the body pays"}
      </span>
    </div>
  )
}

/** The spell's side of the trade, in one line: what it will roll, and its odds. */
function SpellLine({ p }: { p: BacklashProps }) {
  const o = outlookAt(p, p.contained)
  return (
    <span className="mv-data text-[12px]" style={{ color: "var(--dim)" }}>
      the spell rolls {dice(o.castPool)} ·{" "}
      <b style={{ color: "var(--rail-success)" }}>{pct(rollOdds(o.castPool).success)}</b>
    </span>
  )
}

/** The caster's state after the bet: the wound penalty, or out. */
function BodyNote({ p }: { p: BacklashProps }) {
  const o = outlookAt(p, p.contained)
  return (
    <span className="mv-data whitespace-nowrap text-[11px]" style={{ color: "var(--bad)" }}>
      {o.martyr ? "unconscious" : o.penaltyAfter < 0 ? `wounds ${o.penaltyAfter}` : ""}
    </span>
  )
}

/** A red success die, as the felt draws it. */
function RedDie({ v, faded = false }: { v: number; faded?: boolean }) {
  return (
    <span style={{ opacity: faded ? 0.3 : 1 }}>
      <UnifiedDie mode="face" v={v} again={10} tone="paradox" size="md" />
    </span>
  )
}

/** One box of the track, sized and marked by its state in the bet. */
function Box({
  severity,
  taken,
  target,
  stood,
  edge,
}: {
  severity: HealthTrack[number]["severity"]
  taken: boolean
  target: boolean
  stood: boolean
  edge: number
}) {
  return (
    <span
      className="mv-data grid place-items-center rounded-[2px] border font-bold"
      style={{
        width: edge,
        height: edge,
        fontSize: Math.round(edge * 0.5),
        borderColor: taken ? "var(--ember)" : target ? "var(--paradox)" : severity === "empty" ? "var(--line)" : "var(--accent)",
        borderStyle: taken || target ? "dashed" : "solid",
        background: target
          ? "color-mix(in srgb, var(--paradox) 10%, transparent)"
          : severity === "empty" || severity === "bashing"
            ? "transparent"
            : "var(--glow)",
        color: taken ? "var(--ember)" : target ? "var(--paradox)" : "var(--accent)",
        opacity: stood ? 0.35 : 1,
      }}
    >
      {taken ? "╱" : target ? "+" : healthBoxGlyph(severity)}
    </span>
  )
}

const focusRing = "rounded-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"

// ── A · track ───────────────────────────────────────────────────────────────

/** The red successes, the track right under them, targets marked. */
export function BacklashTrack(p: BacklashProps) {
  const interactive = p.onChange !== undefined
  const ordinals = emptyOrdinals(p.track)
  const o = outlookAt(p, p.contained)
  const faces = facesOf(p)
  return (
    <div className="mt-2 grid justify-items-center gap-3 py-1">
      <div className="flex flex-wrap justify-center gap-3">
        {faces.map((v, i) => (
          // the last ones taken fade, as the felt ghosts them from the end
          <RedDie key={i} v={v} faded={i >= faces.length - p.contained} />
        ))}
      </div>
      {faces.length > 0 && (
        <span className="mv-data text-[11px] uppercase" style={EYEBROW}>
          {interactive ? "take them on your body" : "the caster's body"}
        </span>
      )}
      <div className="flex flex-wrap justify-center gap-[5px]">
        {p.track.map((box, i) => {
          const ordinal = ordinals[i] ?? null
          const taken = ordinal !== null && ordinal < p.contained
          const target = ordinal !== null && !taken && ordinal < p.cap
          const fromEnd = p.track.length - i
          const penalty = fromEnd <= 3 ? fromEnd - 4 : null
          const mark = <Box severity={box.severity} taken={taken} target={target} stood={ordinal !== null && !taken && !target} edge={26} />
          const title = taken
            ? "Taken — click to let it loose again"
            : target
              ? "Take one Paradox success here as Resistant bashing"
              : ordinal === null
                ? "Already hurt"
                : "Nothing left to take"
          return (
            <span key={i} className="relative flex flex-col items-center" style={{ paddingTop: 15, paddingBottom: 7 }}>
              {penalty !== null && (
                <span
                  className="mv-data absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-[12px] leading-none"
                  style={{ color: o.penaltyAfter === penalty ? "var(--bad)" : "var(--dim)", opacity: o.penaltyAfter === penalty ? 1 : 0.6 }}
                >
                  −{-penalty}
                </span>
              )}
              {interactive && (taken || target) ? (
                <button onClick={() => p.onChange?.(taken ? ordinal : ordinal + 1)} disabled={p.disabled} title={title} className={`cursor-pointer ${focusRing}`}>
                  {mark}
                </button>
              ) : (
                <span title={title}>{mark}</span>
              )}
              <span className="absolute bottom-0 left-1/2 flex -translate-x-1/2">
                <ResistantDot resistant={box.resistant || taken} />
              </span>
            </span>
          )
        })}
      </div>
      {o.martyr && <BodyNote p={p} />}
      <Verdict p={p} />
      <SpellLine p={p} />
    </div>
  )
}

// ── B · pairs ───────────────────────────────────────────────────────────────

/** Each red success a button joined to the box it would fill. */
export function BacklashPairs(p: BacklashProps) {
  const interactive = p.onChange !== undefined
  const faces = facesOf(p)
  return (
    <div className="mt-2 grid justify-items-center gap-3 py-1">
      <div className="flex flex-wrap justify-center gap-2.5">
        {faces.map((v, i) => {
          const taken = i < p.contained
          const room = i < p.cap
          const pair = (
            <span
              className="flex items-center gap-2 rounded-[3px] border px-2.5 py-1.5"
              style={{
                borderColor: taken ? "var(--ember)" : room ? "color-mix(in srgb, var(--paradox) 55%, transparent)" : "var(--line)",
                borderStyle: taken ? "solid" : "dashed",
                opacity: room || taken ? 1 : 0.4,
              }}
            >
              <RedDie v={v} faded={taken} />
              <span className="mv-data text-[13px]" style={{ color: taken ? "var(--ember)" : "var(--dim)" }}>
                →
              </span>
              <Box severity="empty" taken={taken} target={!taken && room} stood={false} edge={22} />
            </span>
          )
          const title = taken
            ? "Taken on the body — click to let it loose again"
            : room
              ? "Take this Paradox success on your body: one box of Resistant bashing"
              : "No room left on the track — this one runs loose"
          return interactive && (taken || room) ? (
            <button key={i} onClick={() => p.onChange?.(taken ? i : i + 1)} disabled={p.disabled} title={title} className={`cursor-pointer ${focusRing}`}>
              {pair}
            </button>
          ) : (
            <span key={i} title={title}>
              {pair}
            </span>
          )
        })}
      </div>
      <span className="flex items-center gap-2">
        <span className="mv-data text-[11px] uppercase" style={EYEBROW}>
          body
        </span>
        <BodyAfter track={p.track} taken={p.contained} edge={16} />
        <BodyNote p={p} />
      </span>
      <Verdict p={p} />
      <SpellLine p={p} />
    </div>
  )
}

// ── C · scales ──────────────────────────────────────────────────────────────

/** The world on one side, the body on the other; a die crosses when clicked. */
export function BacklashScales(p: BacklashProps) {
  const interactive = p.onChange !== undefined
  const faces = facesOf(p)
  // the loose dice stay on the world's side; the taken ones cross over
  const loose = faces.slice(0, faces.length - p.contained)
  const canTake = p.contained < p.cap
  return (
    <div className="mt-2 grid gap-3 py-1">
      <div className="grid items-start gap-2" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
        <div className="grid justify-items-center gap-2">
          <span className="mv-data text-[11px] uppercase" style={EYEBROW}>
            the world
          </span>
          <div className="flex flex-wrap justify-center gap-2.5" style={{ minHeight: 30 }}>
            {loose.map((v, i) =>
              interactive && canTake ? (
                <button
                  key={i}
                  onClick={() => p.onChange?.(p.contained + 1)}
                  disabled={p.disabled}
                  title="Take this one on your body — one box of Resistant bashing"
                  className={`cursor-pointer ${focusRing}`}
                >
                  <RedDie v={v} />
                </button>
              ) : (
                <span key={i} title={canTake ? "A loose Paradox success" : "No room left on the track — this one runs loose"}>
                  <RedDie v={v} />
                </span>
              ),
            )}
          </div>
        </div>
        <span className="mv-data self-center text-[15px]" style={{ color: "var(--dim)" }}>
          ⇄
        </span>
        <div className="grid justify-items-center gap-2">
          <span className="mv-data text-[11px] uppercase" style={EYEBROW}>
            your body
          </span>
          {interactive && p.contained > 0 ? (
            <button
              onClick={() => p.onChange?.(p.contained - 1)}
              disabled={p.disabled}
              title="Let the last one loose again"
              className={`cursor-pointer ${focusRing}`}
            >
              <BodyAfter track={p.track} taken={p.contained} edge={14} />
            </button>
          ) : (
            <BodyAfter track={p.track} taken={p.contained} edge={14} />
          )}
          <BodyNote p={p} />
        </div>
      </div>
      <div className="grid justify-items-center gap-2">
        <Verdict p={p} />
        <SpellLine p={p} />
      </div>
    </div>
  )
}

/** The track as it would stand with `taken` more boxes of Resistant bashing. */
function BodyAfter({ track, taken, edge }: { track: HealthTrack; taken: number; edge: number }) {
  const ordinals = emptyOrdinals(track)
  return (
    <span className="flex gap-[3px]">
      {track.map((box, i) => {
        const ordinal = ordinals[i] ?? null
        return (
          <Box key={i} severity={box.severity} taken={ordinal !== null && ordinal < taken} target={false} stood={false} edge={edge} />
        )
      })}
    </span>
  )
}
