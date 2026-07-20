import { isDieDramaticFailure, isDieExplosive, isDieSuccess } from "#/domain/dice"

/**
 * One rolled die face (issue #25's outcome rules, rendered): success faces
 * fill with the success ink, the chance die's 1 burns --bad, and explosive
 * faces ring accent. Extracted from the Chronicle's roll card for the
 * resolution merge (2026-07-19): the resolved Cast card renders the same
 * faces the roll cards do — one grammar for "what the dice showed".
 */
export function Die({
  v,
  again,
  ring,
  chance,
  size = "sm",
  tone,
  diamond = false,
  ghost = false,
}: {
  v: number
  again: number
  ring?: "rote" | "exp"
  chance?: boolean
  /** "md" for vulgar surfaces — nothing inside one renders under 12px (#114). */
  size?: "sm" | "md"
  /** "paradox" for reality's own dice (the Paradox record, 2026-07-19 pass 2):
   * a success there is Paradox landing — more is worse (#114) — so it fills
   * and rings --paradox, never the success green. */
  tone?: "paradox"
  /** Prototype (2026-07-20): render the face as a rotated diamond so the
   * resolved dice keep the felt's d10 stance instead of a square. The box
   * rotates 45°; the number counter-rotates to stay upright. */
  diamond?: boolean
  /** A declared die that never rolled — eaten by the containment bet. Renders
   * as an empty dashed diamond so the felt still shows the whole declared pool
   * (2026-07-20): 1 rolled + N eaten = the Gnosis + Arcanum total. */
  ghost?: boolean
}) {
  const success = isDieSuccess(v, chance ?? false)
  const dramatic = isDieDramaticFailure(v, chance ?? false)
  const successInk = tone === "paradox" ? "var(--paradox)" : "var(--rail-success)"
  const ringInk = tone === "paradox" ? "var(--paradox)" : "var(--accent)"
  if (ghost) {
    return (
      <span
        aria-hidden
        title="Eaten by the containment bet — declared, never rolled"
        className={`grid place-items-center ${
          diamond ? "rounded-[3px]" : "rounded-[2px]"
        } ${size === "md" ? "size-6" : "size-5"}`}
        style={{
          background: "transparent",
          border: "1px dashed var(--dim2)",
          opacity: 0.5,
          transform: diamond ? "rotate(45deg)" : undefined,
        }}
      />
    )
  }
  return (
    <span
      className={`mv-data grid place-items-center font-bold ${
        diamond ? "rounded-[3px]" : "rounded-[2px]"
      } ${size === "md" ? "size-6 text-[12px]" : "size-5 text-[10px]"}`}
      style={{
        background: dramatic ? "var(--bad)" : success ? successInk : "var(--raise)",
        color: dramatic || success ? "#0a0a0c" : "var(--dim)",
        transform: diamond ? "rotate(45deg)" : undefined,
        boxShadow:
          ring === "rote"
            ? "0 0 0 1px var(--dim2)"
            : ring === "exp"
              ? `0 0 0 1px ${ringInk}`
              : isDieExplosive(v, again, chance ?? false)
                ? `0 0 0 1px ${ringInk}`
                : // A miss still shows its shape when it's a felt diamond: a
                  // faint outline (dim red for reality's dice, neutral for the
                  // cast) so the pool reads as every die thrown, not just hits.
                  diamond && !success && !dramatic
                  ? `0 0 0 1px ${
                      tone === "paradox"
                        ? "color-mix(in srgb, var(--paradox) 45%, transparent)"
                        : "var(--dim2)"
                    }`
                  : undefined,
      }}
    >
      <span style={diamond ? { transform: "rotate(-45deg)" } : undefined}>{v}</span>
    </span>
  )
}
