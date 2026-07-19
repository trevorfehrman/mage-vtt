import type { CharacterSheet } from "#/domain/character"

/**
 * The seat's at-a-glance resources, pinned to the rail foot beside the
 * controls that spend them (owner call 2026-07-08): the rail never disappears,
 * so Mana/Will stay visible even once the center panel grows tabs. These are
 * the live currents; the sheet header holds the ceilings and the health track
 * (vitals folded in, owner call 2026-07-17).
 */
export function ResourceStrip({ character }: { character: CharacterSheet }) {
  return (
    <div
      className="flex items-center justify-between gap-4 border-t px-3 py-2"
      style={{ borderColor: "var(--line)" }}
    >
      {/* Mana is canonically blue (#102): identity hue + mandatory glyph —
          the grammar's growth rule. Will keeps the default ink until its own
          identity question is put to the owner. */}
      <Meter
        label="Mana"
        glyph="◈"
        color="var(--mana)"
        filled={character.manaCurrent}
        max={Math.min(character.maxMana, 10)}
        readout={`${character.manaCurrent}/${character.maxMana}`}
      />
      <Meter
        label="Will"
        filled={character.willpowerCurrent}
        max={character.willpower}
        readout={`${character.willpowerCurrent}/${character.willpower}`}
      />
    </div>
  )
}

function Meter({
  label,
  glyph,
  color = "var(--accent)",
  filled,
  max,
  readout,
}: {
  label: string
  glyph?: string
  color?: string
  filled: number
  max: number
  readout: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="mv-eyebrow">
        {glyph ? (
          <span aria-hidden style={{ color }}>
            {glyph}{" "}
          </span>
        ) : null}
        {label}
      </span>
      <span className="inline-flex gap-[3px]">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className="text-[14px] leading-none"
            style={{ color: i < filled ? color : "var(--line)" }}
          >
            ◆
          </span>
        ))}
      </span>
      <span className="mv-data text-[12px]" style={{ color: "var(--dim)" }}>
        {readout}
      </span>
    </div>
  )
}
