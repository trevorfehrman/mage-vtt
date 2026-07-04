import { useState } from "react"
import { WILLPOWER_BONUS_DICE } from "#/domain/willpower-economy"
import { ArcanaGlyph } from "./ArcanaGlyph"
import type { useDicePool } from "#/hooks/use-dice-pool"

type DicePoolAPI = ReturnType<typeof useDicePool>

/**
 * The pool is the readout (docs/component-polish.md): the sheet toggles traits
 * in, this panel shows the live pool big + mono, the assembled chips, the roll
 * options, and one accent Roll button. Pool of ≤0 rolls a chance die (◈).
 * Clears itself after a roll.
 */
export function DicePoolBuilder({ pool }: { pool: DicePoolAPI }) {
  const [modifier, setModifier] = useState(0)
  const building = pool.state === "building"
  const rolling = pool.state === "rolling"
  const canInteract = pool.state === "idle" || building

  // The Willpower bonus is server-added on roll; mirror it in the readout.
  const displaySize =
    pool.context.poolSize +
    (pool.context.spendWillpower ? WILLPOWER_BONUS_DICE : 0)
  const chance = building && displaySize <= 0

  const handleAddModifier = () => {
    if (modifier === 0) return
    pool.addComponent({ type: "modifier", name: "Modifier", dots: modifier })
    setModifier(0)
  }

  return (
    <div className="border-t" style={{ borderColor: "var(--line)" }}>
      {/* readout */}
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span className="mv-eyebrow">Dice pool</span>
        <span
          className="mv-data ml-auto text-[22px] font-bold leading-none"
          style={{ color: building ? "var(--accent)" : "var(--dim)" }}
        >
          {chance ? "◈" : displaySize}
        </span>
        <span className="mv-data text-[10px]" style={{ color: "var(--dim)" }}>
          {chance ? "chance" : "dice"}
        </span>
      </div>

      {/* assembled components */}
      <div className="flex min-h-[30px] flex-wrap gap-1 px-3 pt-2">
        {pool.context.components.length === 0 && (
          <span className="mv-data text-[11px] italic" style={{ color: "var(--dim)" }}>
            toggle traits on the sheet…
          </span>
        )}
        {pool.context.components.map((c, i) => (
          <button
            key={`${c.type}:${c.name}:${i}`}
            onClick={() => canInteract && pool.removeComponent(i)}
            disabled={!canInteract}
            className="mv-chip group flex items-center gap-1 rounded-full py-0.5 pl-1.5 pr-1 text-[11px]"
          >
            {c.type === "arcanum" && (
              <ArcanaGlyph arcanum={c.name} size={12} className="mv-accent" />
            )}
            <span>{c.name}</span>
            <span className="mv-data" style={{ color: "var(--dim)" }}>
              {c.dots > 0 && c.type === "modifier" ? `+${c.dots}` : c.dots}
            </span>
            <span className="opacity-40 group-hover:opacity-100">✕</span>
          </button>
        ))}
        {pool.context.spendWillpower && (
          <span className="mv-chip flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]">
            <span>Willpower</span>
            <span className="mv-data mv-accent">+{WILLPOWER_BONUS_DICE}</span>
          </span>
        )}
      </div>

      {/* modifier — ADD_COMPONENT is legal from idle too (it starts the pool) */}
      {canInteract && (
        <div className="mt-2 flex items-center gap-3 px-3">
          <span className="mv-data text-[10px] uppercase tracking-wider" style={{ color: "var(--dim)" }}>
            mod
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setModifier((m) => m - 1)}
              className="mv-btn grid size-6 place-items-center rounded-[3px] text-[13px] leading-none"
            >
              −
            </button>
            <span className="mv-data w-7 text-center text-[13px] font-bold">
              {modifier > 0 ? `+${modifier}` : modifier}
            </span>
            <button
              onClick={() => setModifier((m) => m + 1)}
              className="mv-btn grid size-6 place-items-center rounded-[3px] text-[13px] leading-none"
            >
              +
            </button>
            <button
              onClick={handleAddModifier}
              disabled={modifier === 0}
              className="mv-mini ml-1 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* roll options — the machine only accepts SET_* while building */}
      {building && (
        <div className="mt-2 flex flex-wrap items-center gap-2 px-3">
          <div className="flex items-center gap-1">
            {[10, 9, 8].map((n) => (
              <button
                key={n}
                onClick={() => pool.setAgainThreshold(n)}
                className={`mv-mini ${pool.context.againThreshold === n ? "mv-mini-on" : ""}`}
              >
                {n}-ag
              </button>
            ))}
          </div>
          <button
            onClick={() => pool.setRoteAction(!pool.context.isRoteAction)}
            className={`mv-mini ${pool.context.isRoteAction ? "mv-mini-on" : ""}`}
          >
            Rote
          </button>
          <button
            onClick={() => pool.setVisibility(pool.context.visibility === "hidden" ? "public" : "hidden")}
            className={`mv-mini ${pool.context.visibility === "hidden" ? "mv-mini-on" : ""}`}
          >
            Hidden
          </button>
          {pool.canSpendWillpower && (
            <button
              onClick={() => pool.setSpendWillpower(!pool.context.spendWillpower)}
              className={`mv-mini ${pool.context.spendWillpower ? "mv-mini-on" : ""}`}
            >
              Willpower +{WILLPOWER_BONUS_DICE}
            </button>
          )}
        </div>
      )}

      {/* action */}
      <div className="flex gap-2 p-3">
        <button
          onClick={pool.roll}
          disabled={!building || rolling}
          className="mv-roll flex-1 rounded-[3px] py-2 text-[13px] disabled:opacity-40"
        >
          {rolling ? "Rolling…" : chance ? "Roll chance die" : `Roll ${displaySize} dice`}
        </button>
        {building && (
          <button onClick={pool.reset} className="mv-btn rounded-[3px] px-3 text-[12px]">
            Clear
          </button>
        )}
      </div>

      {/* error */}
      {pool.context.error && (
        <p className="px-3 pb-2 text-[12px]" style={{ color: "var(--bad)" }}>
          {pool.context.error}
        </p>
      )}
    </div>
  )
}
