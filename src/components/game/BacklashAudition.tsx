import { Array as Arr, Schema } from "effect"
import type { HealthTrack } from "#/domain/damage"
import { containmentOutlook } from "#/domain/cast"
import { emptyOrdinals } from "#/domain/health"
import { resolveParadox } from "#/domain/paradox"
import { healthBoxGlyph, ResistantDot } from "./HealthGlyphs"
import { UnifiedDie } from "./UnifiedDie"
import { Felt } from "./Felt"

/**
 * MAG-49's audition: the backlash step as Paradox against health alone, on
 * the dressing room's `?backlash=` knob (owner, 2026-10-25: "we don't need
 * the felt here", then "maybe i want them on the felt after all but in this
 * case just by themselves? and keep the health bar below the felt"). At this
 * step the Tides, the cast felt and the odds row stand down; the Paradox
 * successes stand alone on a felt, the problems to be dealt with, and the
 * caster's track waits below it, the boxes a click can take marked. No prose
 * (owner: "remove all the prose you're adding everywhere") — the severity
 * word, or the contained mark, is the only word.
 */
export const BacklashVariant = Schema.Literals(["now", "track"])
export type BacklashVariant = typeof BacklashVariant.Type

/** The caster's facts, and the bet. */
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

/** The contained mark (MAG-49): the caster bore it. */
const CONTAINED_MARK = "Borne"

const focusRing = "rounded-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"

/** The successes on the felt, the track below it, targets marked. */
export function BacklashTrack(p: BacklashProps) {
  const interactive = p.onChange !== undefined
  const ordinals = emptyOrdinals(p.track)
  const o = containmentOutlook({
    track: p.track,
    declaredPool: p.declaredPool,
    paradoxSuccesses: p.paradoxSuccesses,
    contained: p.contained,
  })
  // makeBy normalizes its count to >= 1, so no successes is guarded by hand
  const faces = p.paradoxSuccesses > 0 ? Arr.makeBy(p.paradoxSuccesses, (i) => p.successFaces[i] ?? 10) : []
  return (
    <div className="mt-2 grid gap-3">
      <Felt className="flex flex-wrap items-center justify-center gap-4 px-3.5 py-5">
        {faces.map((v, i) => (
          // the last ones taken fade, as the felt ghosts them from the end
          <span key={i} style={{ opacity: i >= faces.length - p.contained ? 0.25 : 1 }}>
            <UnifiedDie mode="face" v={v} again={10} tone="paradox" size="md" />
          </span>
        ))}
      </Felt>
      <div className="flex flex-wrap justify-center gap-[5px]">
        {p.track.map((box, i) => {
          const ordinal = ordinals[i] ?? null
          const taken = ordinal !== null && ordinal < p.contained
          const target = ordinal !== null && !taken && ordinal < p.cap
          const stood = ordinal !== null && !taken && !target
          const fromEnd = p.track.length - i
          const penalty = fromEnd <= 3 ? fromEnd - 4 : null
          const mark = (
            <span
              className="mv-data grid place-items-center rounded-[2px] border font-bold"
              style={{
                width: 26,
                height: 26,
                fontSize: 13,
                borderColor: taken ? "var(--ember)" : target ? "var(--paradox)" : box.severity === "empty" ? "var(--line)" : "var(--accent)",
                borderStyle: taken || target ? "dashed" : "solid",
                background: target
                  ? "color-mix(in srgb, var(--paradox) 10%, transparent)"
                  : box.severity === "empty" || box.severity === "bashing"
                    ? "transparent"
                    : "var(--glow)",
                color: taken ? "var(--ember)" : target ? "var(--paradox)" : "var(--accent)",
                opacity: stood ? 0.35 : 1,
              }}
            >
              {taken ? "╱" : target ? "+" : healthBoxGlyph(box.severity)}
            </span>
          )
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
      {p.paradoxSuccesses > 0 && (
        <span
          className="mv-h justify-self-center uppercase leading-none"
          style={
            o.uncontained > 0
              ? { fontSize: 20, letterSpacing: "0.1em", color: "var(--paradox)", textShadow: "0 0 14px color-mix(in srgb, var(--paradox) 55%, transparent)" }
              : { fontSize: 20, letterSpacing: "0.14em", color: "var(--ember)", textShadow: "0 0 14px color-mix(in srgb, var(--ember) 45%, transparent)" }
          }
        >
          {o.uncontained > 0 ? resolveParadox(o.uncontained).severity : CONTAINED_MARK}
        </span>
      )}
    </div>
  )
}
