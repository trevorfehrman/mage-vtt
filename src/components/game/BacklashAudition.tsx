import { Array as Arr, Schema } from "effect"
import type { HealthTrack } from "#/domain/damage"
import { containmentOutlook } from "#/domain/cast"
import { emptyOrdinals } from "#/domain/health"
import { resolveParadox, type ParadoxSeverity } from "#/domain/paradox"
import { rollOdds } from "#/domain/probability"
import { healthBoxGlyph, ResistantDot } from "./HealthGlyphs"
import { UnifiedDie } from "./UnifiedDie"

/**
 * MAG-49's audition: the backlash step, three ways beside today's track, on
 * the dressing room's `?backlash=` knob. The caster weighs their body against
 * the world: how much health they have, how many Paradox successes are loose,
 * and what to click to take one on. Owner, 2026-10-25: the boxes sit "very
 * far away" from the red dice, "if they click on a valid square it works but
 * if they don't just nothing happens", and the consequences want grounding
 * with the caster. Containment can fill the track to unconsciousness, never
 * past it (PRD #39 story 25; the owner kept that).
 *
 * - **beside** — the track moves under the red dice, the boxes a click can
 *   reach marked as targets, the rest stood down.
 * - **pairs** — each loose Paradox success is its own button, its face
 *   paired with the box it would fill; the track watches beside them.
 * - **ledger** — one row per choice (take 0, 1, 2…), in the mitigation
 *   table's register: health after, wounds, cast dice, success, what the
 *   world suffers.
 */
export const BacklashVariant = Schema.Literals(["track", "beside", "pairs", "ledger"])
export type BacklashVariant = typeof BacklashVariant.Type

/** Shared by every variant: the caster's facts, and the bet. */
export interface BacklashProps {
  readonly track: HealthTrack
  readonly declaredPool: number
  readonly paradoxSuccesses: number
  /** the rolled success faces, for the pairs' red dice */
  readonly successFaces: ReadonlyArray<number>
  readonly cap: number
  readonly contained: number
  readonly onChange?: ((value: number) => void) | undefined
  readonly disabled?: boolean
}

/** What a loose severity does to the world, in a line (Mage p. 127, our words). */
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
const dice = (n: number): string => (n <= 0 ? "chance die" : n === 1 ? "1 die" : `${n} dice`)

const outlookAt = (p: BacklashProps, contained: number) =>
  containmentOutlook({
    track: p.track,
    declaredPool: p.declaredPool,
    paradoxSuccesses: p.paradoxSuccesses,
    contained,
  })

/** The verdict line: the loose severity and what it does, or the mark. */
function Verdict({ uncontained, taken }: { uncontained: number; taken: number }) {
  const severity = resolveParadox(uncontained).severity
  if (uncontained > 0) {
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
  if (taken === 0) return null
  return (
    <span
      className="mv-h uppercase leading-none"
      style={{
        fontSize: 20,
        letterSpacing: "0.14em",
        color: "var(--ember)",
        textShadow: "0 0 14px color-mix(in srgb, var(--ember) 45%, transparent)",
      }}
      title="Every Paradox success taken on the caster's body as Resistant bashing"
    >
      {CONTAINED_MARK}
    </span>
  )
}

/** The cost of the current bet, in one line under the boxes. */
function CostLine({ p }: { p: BacklashProps }) {
  const o = outlookAt(p, p.contained)
  const odds = rollOdds(o.castPool).success
  return (
    <span className="mv-data text-center text-[12px]" style={{ color: "var(--dim)" }}>
      {o.damage > 0 && (
        <span style={{ color: "var(--ember)" }}>
          −{o.damage} health{o.martyr ? " · unconscious" : ""}
          {o.newPenalty < 0 ? ` · wounds ${o.penaltyAfter}` : ""}
          {" · "}
        </span>
      )}
      cast {dice(o.castPool)} · <b style={{ color: "var(--rail-success)" }}>{pct(odds)}</b>
    </span>
  )
}

// ── A · beside ──────────────────────────────────────────────────────────────

/** The track under the red dice, every box saying what it is to a click. */
export function BacklashBeside(p: BacklashProps) {
  const interactive = p.onChange !== undefined
  const ordinals = emptyOrdinals(p.track)
  const o = outlookAt(p, p.contained)
  return (
    <div className="grid justify-items-center gap-2 px-3.5 pb-3">
      {p.paradoxSuccesses > 0 && (
        <span className="mv-data text-[11px] uppercase" style={{ letterSpacing: "0.08em", color: "var(--dim)" }}>
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
          const lastEmpty = ordinal !== null && ordinal === ordinals.filter((x) => x !== null).length - 1
          const mark = (
            <span
              className="mv-data grid place-items-center rounded-[2px] border font-bold"
              style={{
                width: 26,
                height: 26,
                fontSize: 13,
                borderColor: taken ? "var(--ember)" : target ? "var(--paradox)" : box.severity === "empty" ? "var(--line)" : "var(--accent)",
                borderStyle: taken || target ? "dashed" : "solid",
                background: target ? "color-mix(in srgb, var(--paradox) 10%, transparent)" : box.severity === "empty" || box.severity === "bashing" ? "transparent" : "var(--glow)",
                color: taken ? "var(--ember)" : target ? "var(--paradox)" : "var(--accent)",
                opacity: ordinal !== null && !taken && !target ? 0.35 : 1,
              }}
            >
              {taken ? "╱" : target ? "+" : healthBoxGlyph(box.severity)}
            </span>
          )
          const title = taken
            ? "Taken — click to release it"
            : target
              ? `Take one Paradox success here as Resistant bashing${lastEmpty ? " — your last box: unconscious" : ""}`
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
                <button
                  onClick={() => p.onChange?.(taken ? ordinal : ordinal + 1)}
                  disabled={p.disabled}
                  title={title}
                  className="cursor-pointer rounded-[2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
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
      <CostLine p={p} />
      <Verdict uncontained={o.uncontained} taken={p.contained} />
    </div>
  )
}

// ── B · pairs ───────────────────────────────────────────────────────────────

/** Each loose success a button, its face paired with the box it would fill. */
export function BacklashPairs(p: BacklashProps) {
  const interactive = p.onChange !== undefined
  const o = outlookAt(p, p.contained)
  // makeBy normalizes its count to >= 1: no successes, no pairs
  const faces = p.paradoxSuccesses > 0 ? Arr.makeBy(p.paradoxSuccesses, (i) => p.successFaces[i] ?? 10) : []
  return (
    <div className="grid justify-items-center gap-2.5 px-3.5 pb-3">
      <div className="flex flex-wrap justify-center gap-2">
        {faces.map((v, i) => {
          const taken = i < p.contained
          const room = i < p.cap
          const pair = (
            <span
              className="flex items-center gap-1.5 rounded-[3px] border px-2 py-1"
              style={{
                borderColor: taken ? "var(--ember)" : room ? "color-mix(in srgb, var(--paradox) 55%, transparent)" : "var(--line)",
                borderStyle: taken ? "solid" : "dashed",
                opacity: room || taken ? 1 : 0.4,
              }}
            >
              <span style={{ opacity: taken ? 0.35 : 1 }}>
                <UnifiedDie mode="face" v={v} again={10} tone="paradox" size="sm" />
              </span>
              <span className="mv-data text-[12px]" style={{ color: taken ? "var(--ember)" : "var(--dim)" }}>
                →
              </span>
              <span
                className="mv-data grid place-items-center rounded-[2px] border font-bold"
                style={{
                  width: 18,
                  height: 18,
                  fontSize: 11,
                  borderColor: taken ? "var(--ember)" : "var(--line)",
                  borderStyle: taken ? "solid" : "dashed",
                  color: "var(--ember)",
                }}
              >
                {taken ? "╱" : ""}
              </span>
            </span>
          )
          const title = taken
            ? "Taken on the body — click to let it loose again"
            : room
              ? "Take this Paradox success on your body: one box of Resistant bashing"
              : "No room left on the track — this one runs loose"
          return interactive && (taken || room) ? (
            <button
              key={i}
              onClick={() => p.onChange?.(taken ? i : i + 1)}
              disabled={p.disabled}
              title={title}
              className="cursor-pointer rounded-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
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
        <span className="mv-data text-[11px] uppercase" style={{ letterSpacing: "0.08em", color: "var(--dim)" }}>
          body
        </span>
        <BodyAfter track={p.track} taken={p.contained} />
        <span className="mv-data text-[11px]" style={{ color: "var(--bad)" }}>
          {o.martyr ? "unconscious" : o.penaltyAfter < 0 ? `${o.penaltyAfter}` : ""}
        </span>
      </span>
      <CostLine p={p} />
      <Verdict uncontained={o.uncontained} taken={p.contained} />
    </div>
  )
}

// ── C · ledger ──────────────────────────────────────────────────────────────

/** The track as it would stand with `taken` more boxes of Resistant bashing —
 * no penalty of its own; the row says the penalty after. */
function BodyAfter({ track, taken }: { track: HealthTrack; taken: number }) {
  const ordinals = emptyOrdinals(track)
  return (
    <span className="flex gap-[3px]">
      {track.map((box, i) => {
        const ordinal = ordinals[i] ?? null
        const ghosted = ordinal !== null && ordinal < taken
        return (
          <span
            key={i}
            className="mv-data grid place-items-center rounded-[2px] border font-bold"
            style={{
              width: 12,
              height: 12,
              fontSize: 8,
              borderColor: ghosted ? "var(--ember)" : box.severity === "empty" ? "var(--line)" : "var(--accent)",
              borderStyle: ghosted ? "dashed" : "solid",
              background: box.severity === "empty" || box.severity === "bashing" ? "transparent" : "var(--glow)",
              color: ghosted ? "var(--ember)" : "var(--accent)",
            }}
          >
            {ghosted ? "╱" : healthBoxGlyph(box.severity)}
          </span>
        )
      })}
    </span>
  )
}

const LEDGER_GRID = "grid items-center gap-2 rounded-[2px] px-1.5 py-1 text-left text-[12px]"
// inline: a new file's arbitrary classes may not reach a running dev server
const LEDGER_COLUMNS = { gridTemplateColumns: "2.4rem 8.4rem 4.4rem 1fr" }

/** One row per choice, the mitigation table's register. */
export function BacklashLedger(p: BacklashProps) {
  const interactive = p.onChange !== undefined
  const rows = Arr.makeBy(p.cap + 1, (n) => ({ n, o: outlookAt(p, n) }))
  return (
    <div className="mt-2 grid gap-1 py-1">
      <span className={`mv-data ${LEDGER_GRID}`} style={{ ...LEDGER_COLUMNS, color: "var(--dim)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        <span>take</span>
        <span>your body</span>
        <span>cast</span>
        <span>the world</span>
      </span>
      {rows.map(({ n, o }) => {
        const here = n === p.contained
        const severity = resolveParadox(o.uncontained).severity
        const cells = (
          <>
            <span style={{ color: here ? "var(--ink)" : undefined }}>{n === 0 ? "none" : n}</span>
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <BodyAfter track={p.track} taken={n} />
              <span className="text-[11px]" style={{ color: "var(--bad)" }}>
                {o.martyr ? "out" : o.penaltyAfter < 0 ? `${o.penaltyAfter}` : ""}
              </span>
            </span>
            <span>
              {dice(o.castPool)}{" "}
              <b style={{ color: "var(--rail-success)" }}>{pct(rollOdds(o.castPool).success)}</b>
            </span>
            {o.uncontained > 0 ? (
              <b className="uppercase" title={SEVERITY_SAYS[severity]} style={{ color: "var(--paradox)", letterSpacing: "0.06em" }}>
                {severity}
              </b>
            ) : (
              <b className="uppercase" style={{ color: "var(--ember)", letterSpacing: "0.1em" }}>
                {CONTAINED_MARK}
              </b>
            )}
          </>
        )
        return interactive ? (
          <button
            key={n}
            onClick={() => p.onChange?.(n)}
            disabled={p.disabled}
            className={`mv-data ${LEDGER_GRID} disabled:opacity-40`}
            style={{
              ...LEDGER_COLUMNS,
              border: here ? "1px solid var(--accent)" : "1px solid transparent",
              color: here ? "var(--ink)" : "var(--dim)",
            }}
          >
            {cells}
          </button>
        ) : (
          <span
            key={n}
            className={`mv-data ${LEDGER_GRID}`}
            style={{ ...LEDGER_COLUMNS, border: here ? "1px solid var(--line)" : "1px solid transparent", color: "var(--dim)" }}
          >
            {cells}
          </span>
        )
      })}
      {/* the chosen row's consequence, said once */}
      <span className="min-h-[16px] px-1.5 text-[12px] italic" style={{ color: "var(--dim)" }}>
        {(() => {
          const o = outlookAt(p, p.contained)
          const severity = resolveParadox(o.uncontained).severity
          return o.uncontained > 0
            ? `${severity}: ${SEVERITY_SAYS[severity]}`
            : o.martyr
              ? "borne — and the caster falls unconscious (the Storyteller adjudicates)"
              : "borne — the world is spared, the body pays"
        })()}
      </span>
      {p.paradoxSuccesses > p.cap && (
        <span className="text-[12px] italic" style={{ color: "var(--dim)" }}>
          {p.paradoxSuccesses - p.cap} more can't be taken — the track is full
        </span>
      )}
    </div>
  )
}
