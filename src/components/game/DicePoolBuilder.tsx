import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { WILLPOWER_BONUS_DICE } from "#/domain/willpower-economy"
import type { CharacterSheet } from "#/domain/character"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#/components/ui/tooltip"
import type { useDicePool } from "#/hooks/use-dice-pool"

type DicePoolAPI = ReturnType<typeof useDicePool>

const diceLabel = (n: number): string => (n === 1 ? "1 die" : `${n} dice`)

/**
 * The felt (#98, crowned; folded in by #79): a physical tray where dice
 * visibly accrete. Sheet dice land in verdigris, loose dice neutral, Willpower
 * arrives as ember dice — one unified pool, one Roll. Chevron rails feed and
 * skim; the fittings are tray hardware on the lip, never a disclosure.
 *
 * Postures (#104), activity-driven: LIP at rest (thin; one gesture still
 * rolls — the empty tray's roll is the chance die), BUILDING while dice
 * accrete, back to lip on execution (a roll consumes the pool, as today).
 */

/** The loose-dice component — the "Modifier" lie is dead; plain dice say so. */
const LOOSE_TYPE = "modifier" as const
const LOOSE_NAME = "Dice"

type DieKind = "sheet" | "loose" | "willpower"

const DIE_LOOK: Record<DieKind, { border: string; background: string }> = {
  sheet: {
    border: "var(--accent)",
    background: "color-mix(in srgb, var(--accent) 22%, transparent)",
  },
  loose: {
    border: "var(--dim)",
    background: "color-mix(in srgb, var(--ink) 6%, transparent)",
  },
  willpower: {
    border: "var(--ember)",
    background: "var(--ember-glow)",
  },
}

export function DicePoolBuilder({
  pool,
  character,
}: {
  pool: DicePoolAPI
  /** Funds the Willpower gate's reason; absent = sheetless seat. */
  character?: CharacterSheet | undefined
}) {
  const reduced = useReducedMotion()
  const building = pool.state === "building"
  const rolling = pool.state === "rolling"
  const open = building || rolling
  const canInteract = pool.state === "idle" || building

  const components = pool.context.components
  const looseIndex = components.findIndex(
    (c) => c.type === LOOSE_TYPE && c.name === LOOSE_NAME,
  )
  const loose = looseIndex === -1 ? 0 : components[looseIndex]!.dots
  const sheetComponents = components.filter((_, i) => i !== looseIndex)
  const sheetDots = sheetComponents.reduce((s, c) => s + c.dots, 0)
  const wpDice = pool.context.spendWillpower ? WILLPOWER_BONUS_DICE : 0
  const total = sheetDots + loose + wpDice

  const setLoose = (next: number) => {
    const clamped = Math.max(0, next)
    if (!canInteract || clamped === loose) return
    if (looseIndex !== -1) pool.removeComponent(looseIndex)
    if (clamped > 0)
      pool.addComponent({ type: LOOSE_TYPE, name: LOOSE_NAME, dots: clamped })
  }

  // The gate speaks at the control that refuses (#79's tooltip pattern).
  const willpowerGate = !pool.canSpendWillpower
    ? "Willpower is a spend — it needs your sheet to fund it."
    : character !== undefined &&
        character.willpowerCurrent < 1 &&
        !pool.context.spendWillpower
      ? "No Willpower left to spend."
      : null

  const dieTransition = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 500, damping: 30, mass: 0.6 }
  const postureTransition = reduced
    ? { duration: 0 }
    : { duration: 0.16, ease: "easeOut" as const }

  const die = (kind: DieKind, key: string, title: string, onSkim?: () => void) => (
    <motion.button
      key={key}
      layout={!reduced}
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, rotate: 45 }}
      exit={{ scale: 0.4, opacity: 0 }}
      transition={dieTransition}
      onClick={(e) => {
        e.stopPropagation()
        onSkim?.()
      }}
      disabled={onSkim === undefined || !canInteract}
      title={title}
      className="size-[20px] rounded-[4px] border"
      style={{
        borderColor: DIE_LOOK[kind].border,
        background: DIE_LOOK[kind].background,
        cursor: onSkim ? "pointer" : "default",
      }}
    />
  )

  const sheetDice = sheetComponents.flatMap((c) =>
    Array.from({ length: c.dots }, (_, i) =>
      die("sheet", `s:${c.type}:${c.name}:${i}`, `${c.name} — toggle it off on the sheet`),
    ),
  )
  const looseDice = Array.from({ length: loose }, (_, i) =>
    die("loose", `l:${i}`, "A loose die — tap to take it back", () =>
      setLoose(loose - 1),
    ),
  )
  const willpowerDice = Array.from({ length: wpDice }, (_, i) =>
    die(
      "willpower",
      `w:${i}`,
      "Willpower — one point, precommitted and blind; Paradox can eat these like any others",
    ),
  )

  const lineage =
    sheetComponents.length > 0
      ? sheetComponents.map((c) => c.name).join(" + ")
      : null

  return (
    <TooltipProvider>
      <div className="border-t" style={{ borderColor: "var(--line)" }}>
        <AnimatePresence initial={false} mode="wait">
          {open ? (
            <motion.div
              key="building"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={postureTransition}
              className="overflow-hidden"
            >
              {/* readout */}
              <div className="flex items-center gap-2 px-3 pt-2.5">
                <span className="mv-eyebrow">The felt</span>
                <span
                  className="mv-data ml-auto text-[22px] font-bold leading-none"
                  style={{ color: "var(--accent)" }}
                >
                  {total}
                </span>
                <span className="mv-data text-[10px]" style={{ color: "var(--dim)" }}>
                  {total === 1 ? "die" : "dice"}
                </span>
              </div>

              {/* the felt, flanked by its rails: ‹/−5 skim off the left,
                  ›/+5 feed on from the right; fittings keep to the felt's
                  own column and wrap when the rail thins (#98) */}
              <div
                className="mx-3 mt-2 grid gap-1.5"
                style={{ gridTemplateColumns: "2rem minmax(0,1fr) 2rem" }}
              >
                <button
                  onClick={() => setLoose(loose - 1)}
                  disabled={loose === 0 || !canInteract}
                  className="mv-btn w-8 rounded-[6px] text-[20px] leading-none disabled:opacity-30"
                  title="Skim a die off the felt"
                >
                  ‹
                </button>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setLoose(loose + 1)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setLoose(loose + 1)
                    }
                  }}
                  className="mv-felt block min-w-0 cursor-copy rounded-[6px] border p-2 text-left"
                  style={{
                    borderColor: "var(--line)",
                    background: "color-mix(in srgb, var(--accent) 6%, transparent)",
                    minHeight: 64,
                  }}
                  title="Tap the felt to add a die"
                >
                  <span className="flex max-h-44 flex-wrap gap-2.5 overflow-y-auto p-1">
                    <AnimatePresence initial={false}>
                      {sheetDice}
                      {willpowerDice}
                      {looseDice}
                    </AnimatePresence>
                  </span>
                </div>
                <button
                  onClick={() => setLoose(loose + 1)}
                  disabled={!canInteract}
                  className="mv-btn w-8 rounded-[6px] text-[20px] leading-none disabled:opacity-30"
                  title="Feed a die onto the felt"
                >
                  ›
                </button>

                {/* the lineage caption: one quiet line under the felt column */}
                {lineage && (
                  <p
                    className="mv-data text-[10px]"
                    style={{ color: "var(--dim)", gridColumn: "2" }}
                  >
                    <span style={{ color: "var(--accent)" }}>◆</span> {lineage},
                    from the sheet
                  </p>
                )}

                {/* fittings: the fives under their chevrons, hardware under the felt */}
                <button
                  onClick={() => setLoose(loose - 5)}
                  disabled={loose === 0 || !canInteract}
                  className="mv-mini w-8 self-start px-0 text-center disabled:opacity-40"
                  style={{ gridColumn: "1" }}
                  title="Skim five dice off"
                >
                  −5
                </button>
                <div className="min-w-0" style={{ gridColumn: "2" }}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setLoose(0)}
                      disabled={loose === 0 || !canInteract}
                      className="mv-mini disabled:opacity-40"
                      title="Sweep the loose dice off the felt"
                    >
                      Sweep
                    </button>
                    <span className="h-4 w-px" style={{ background: "var(--line)" }} />
                    {[10, 9, 8].map((n) => (
                      <button
                        key={n}
                        onClick={() => building && pool.setAgainThreshold(n)}
                        className={`mv-mini ${pool.context.againThreshold === n ? "mv-mini-on" : ""}`}
                      >
                        {n}-ag
                      </button>
                    ))}
                    <button
                      onClick={() => building && pool.setRoteAction(!pool.context.isRoteAction)}
                      className={`mv-mini ${pool.context.isRoteAction ? "mv-mini-on" : ""}`}
                    >
                      Rote
                    </button>
                    <button
                      onClick={() =>
                        building &&
                        pool.setVisibility(
                          pool.context.visibility === "hidden" ? "public" : "hidden",
                        )
                      }
                      className={`mv-mini ${pool.context.visibility === "hidden" ? "mv-mini-on" : ""}`}
                    >
                      Hidden
                    </button>
                    {willpowerGate === null ? (
                      <button
                        onClick={() =>
                          building &&
                          pool.setSpendWillpower(!pool.context.spendWillpower)
                        }
                        className={`mv-mini ${pool.context.spendWillpower ? "mv-mini-on" : ""}`}
                      >
                        WP +{WILLPOWER_BONUS_DICE}
                      </button>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button aria-disabled className="mv-mini mv-refuse">
                            WP +{WILLPOWER_BONUS_DICE}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">{willpowerGate}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setLoose(loose + 5)}
                  disabled={!canInteract}
                  className="mv-mini w-8 self-start px-0 text-center disabled:opacity-40"
                  style={{ gridColumn: "3" }}
                  title="Feed five dice on"
                >
                  +5
                </button>
              </div>

              {/* action */}
              <div className="flex gap-2 p-3">
                <button
                  onClick={pool.roll}
                  disabled={!building}
                  className="mv-roll flex-1 rounded-[3px] py-2 text-[13px] disabled:opacity-40"
                >
                  {rolling ? "Rolling…" : `Roll ${diceLabel(total)}`}
                </button>
                <button
                  onClick={pool.reset}
                  disabled={!building}
                  className="mv-btn rounded-[3px] px-3 text-[12px] disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="lip"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={postureTransition}
              className="overflow-hidden"
            >
              {/* THE LIP (#104): the tray at rest — thin, and still a tray.
                  The felt shows as a sliver; one gesture still rolls (the
                  empty tray's roll is the chance die). A designed state,
                  not an apology. */}
              <div className="flex items-center gap-1.5 px-3 py-2">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setLoose(1)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setLoose(1)
                    }
                  }}
                  className="mv-felt flex h-8 min-w-0 flex-1 cursor-copy items-center rounded-[6px] border px-2.5"
                  style={{
                    borderColor: "var(--line)",
                    background: "color-mix(in srgb, var(--accent) 6%, transparent)",
                  }}
                  title="Tap the felt to add a die"
                >
                  <span
                    className="mv-data text-[10px]"
                    style={{ color: "var(--dim)" }}
                  >
                    the felt is bare — tap for dice
                  </span>
                </div>
                <button
                  onClick={() => setLoose(1)}
                  className="mv-btn h-8 w-8 rounded-[6px] text-[20px] leading-none"
                  title="Feed a die onto the felt"
                >
                  ›
                </button>
                <button
                  onClick={pool.roll}
                  className="mv-roll h-8 rounded-[3px] px-3 text-[12px]"
                  title="Roll the empty tray — a chance die"
                >
                  ◈ Roll
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* error — the seam's refusal, spoken under the tray */}
        {pool.context.error && (
          <p className="px-3 pb-2 text-[12px]" style={{ color: "var(--bad)" }}>
            {pool.context.error}
          </p>
        )}
      </div>
    </TooltipProvider>
  )
}
