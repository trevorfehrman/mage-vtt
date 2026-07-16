import type { CharacterSheet } from "#/domain/character"

/**
 * The seat's at-a-glance resources, pinned to the rail foot beside the
 * controls that spend them (owner call 2026-07-08): the rail never disappears,
 * so Mana/Will stay visible even once the center panel grows tabs. The sheet
 * header stays pure identity; Vitals keeps the quiet numeric record.
 */
export function ResourceStrip({ character }: { character: CharacterSheet }) {
  return (
    <div
      className="flex items-center justify-between gap-4 border-t px-3 py-2"
      style={{ borderColor: "var(--line)" }}
    >
      <Meter
        label="Mana"
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
  filled,
  max,
  readout,
}: {
  label: string
  filled: number
  max: number
  readout: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="mv-eyebrow">{label}</span>
      <span className="inline-flex gap-[3px]">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className="text-[14px] leading-none"
            style={{ color: i < filled ? "var(--accent)" : "var(--line)" }}
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
