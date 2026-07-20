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
}) {
  const success = isDieSuccess(v, chance ?? false)
  const dramatic = isDieDramaticFailure(v, chance ?? false)
  const successInk = tone === "paradox" ? "var(--paradox)" : "var(--rail-success)"
  const ringInk = tone === "paradox" ? "var(--paradox)" : "var(--accent)"
  return (
    <span
      className={`mv-data grid place-items-center rounded-[2px] font-bold ${
        size === "md" ? "size-6 text-[12px]" : "size-5 text-[10px]"
      }`}
      style={{
        background: dramatic ? "var(--bad)" : success ? successInk : "var(--raise)",
        color: dramatic || success ? "#0a0a0c" : "var(--dim)",
        boxShadow:
          ring === "rote"
            ? "0 0 0 1px var(--dim2)"
            : ring === "exp"
              ? `0 0 0 1px ${ringInk}`
              : isDieExplosive(v, again, chance ?? false)
                ? `0 0 0 1px ${ringInk}`
                : undefined,
      }}
    >
      {v}
    </span>
  )
}
