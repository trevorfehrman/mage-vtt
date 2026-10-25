import { Schema } from "effect"
import { CharacterSheet } from "#/domain/character"
import { HealthTrack } from "#/domain/damage"
import { containOnTrack, emptyOrdinals, woundPenalty } from "#/domain/health"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "#/components/ui/tooltip"
import { ArcanaGlyph, arcanumTint, isGrossArcanum } from "./ArcanaGlyph"
import { healthBoxGlyph, ResistantDot } from "./HealthGlyphs"
import { Lozenge } from "./Lozenge"

/**
 * The Cast header's pieces (MAG-48, owner 2026-10-24): the caster's
 * depletables ride the live cast's header on every seat — Will · Mana as
 * numerals, the whole health track — and the cast names itself by its mark.
 * The masthead strip steps aside while a cast holds the zone.
 */

const PoolNumeralsProps = Schema.Struct({
  sheet: CharacterSheet,
  pendingMana: Schema.Number,
  pendingWillpower: Schema.Number,
  /** Font size in px; the Cast header's 13 by default. */
  size: Schema.optionalKey(Schema.Number),
})

/** Will · Mana as numerals; a pending spend shows what would be left, in ember. */
export function PoolNumerals({ sheet, pendingMana, pendingWillpower, size = 13 }: typeof PoolNumeralsProps.Type) {
  return (
    <TooltipProvider>
      <span className="mv-data flex items-baseline gap-3 leading-none" style={{ fontSize: size }}>
        <Pool
          label="Willpower"
          color="var(--will)"
          current={sheet.willpowerCurrent}
          max={sheet.willpower}
          pending={pendingWillpower}
        />
        <Pool
          label="Mana"
          color="var(--mana)"
          current={sheet.manaCurrent}
          max={sheet.maxMana}
          pending={pendingMana}
        />
      </span>
    </TooltipProvider>
  )
}

const PoolProps = Schema.Struct({
  label: Schema.String,
  color: Schema.String,
  current: Schema.Number,
  max: Schema.Number,
  pending: Schema.Number,
})

function Pool({ label, color, current, max, pending }: typeof PoolProps.Type) {
  // A pending spend shows what would be left, in ember — no arrow.
  const shown = Math.max(0, current - pending)
  const name = pending > 0 ? `${label} · ${pending} pending` : label
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} aria-label={name} className="flex items-baseline gap-1">
          <span style={{ color }}><Lozenge /></span>
          <span style={{ color: pending > 0 ? "var(--ember)" : "var(--ink)" }}>{shown}</span>
          <span style={{ color: "var(--dim)" }}>/{max}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {name}
      </TooltipContent>
    </Tooltip>
  )
}

/** The whole health track in miniature; boxes being bet ghost in ember. */
const HealthLineProps = Schema.Struct({
  track: HealthTrack,
  ghosts: Schema.Number,
  /** Box edge in px; the Cast header's 14 by default. */
  box: Schema.optionalKey(Schema.Number),
})

export function HealthLine({ track, ghosts, box: edge = 14 }: typeof HealthLineProps.Type) {
  const ordinals = emptyOrdinals(track)
  // The penalty follows the bet (owner, 2026-10-25): the ghosted boxes take
  // Resistant bashing on the Cast, so the number reads as it will be.
  const penalty = woundPenalty(containOnTrack(track, ghosts))
  return (
    <span className="flex items-center gap-1.5" title="Health">
      <span className="flex gap-[3px]" style={{ paddingBottom: 6 }}>
        {track.map((box, i) => {
          const ordinal = ordinals[i] ?? null
          const ghosted = ordinal !== null && ordinal < ghosts
          return (
            <span key={i} className="relative">
              <span
                className="mv-data grid place-items-center rounded-[2px] border font-bold"
                style={{
                  width: edge,
                  height: edge,
                  fontSize: Math.round(edge * 0.64),
                  borderColor: ghosted
                    ? "var(--ember)"
                    : box.severity === "empty"
                      ? "var(--line)"
                      : "var(--accent)",
                  borderStyle: ghosted ? "dashed" : "solid",
                  background:
                    box.severity === "empty" || box.severity === "bashing"
                      ? "transparent"
                      : "var(--glow)",
                  color: ghosted ? "var(--ember)" : "var(--accent)",
                }}
              >
                {ghosted ? "╱" : healthBoxGlyph(box.severity)}
              </span>
              <span className="absolute left-1/2 top-full mt-[1px] flex -translate-x-1/2">
                <ResistantDot resistant={box.resistant} />
              </span>
            </span>
          )
        })}
      </span>
      {penalty < 0 && (
        <span
          className="mv-data text-[12px] leading-none font-bold"
          style={{ color: "var(--bad)", paddingBottom: 6 }}
          title="Wound penalty"
        >
          {penalty}
        </span>
      )}
    </span>
  )
}

/** The level's ink: verdigris that intensifies with the level — dim and
 * flat at 1, full and glowing at 5. The aspect needs no ink of its own: the
 * card only exists for a vulgar cast. */
const levelInk = (level: number) => {
  const l = Math.min(5, Math.max(1, level))
  return {
    color: `color-mix(in srgb, var(--accent) ${40 + l * 12}%, var(--dim))`,
    textShadow: l >= 3 ? `0 0 ${(l - 2) * 5}px var(--glow)` : undefined,
  }
}

/** The cast's mark: the Arcanum's glyph standing for its name, the level in
 * verdigris as intense as the level is high. The glyph names its Arcanum on
 * hover or focus; the level speaks for itself. */
const CastMarkProps = Schema.Struct({ arcanum: Schema.String, level: Schema.Number })

export function CastMark({ arcanum, level }: typeof CastMarkProps.Type) {
  const name = arcanum.charAt(0).toUpperCase() + arcanum.slice(1)
  return (
    <span className="flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="grid place-items-center" style={{ color: arcanumTint(arcanum) }}>
            <ArcanaGlyph
              arcanum={arcanum}
              size={22}
              variant={isGrossArcanum(arcanum) ? "seal" : "line"}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {name}
        </TooltipContent>
      </Tooltip>
      <span className="mv-h text-[20px] leading-none" style={levelInk(level)}>
        {level}
      </span>
    </span>
  )
}
