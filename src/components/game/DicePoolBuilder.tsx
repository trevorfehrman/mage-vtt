import { useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { WILLPOWER_BONUS_DICE } from "#/domain/willpower-economy"
import type { CharacterSheet } from "#/domain/character"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#/components/ui/tooltip"
import { pooledDice } from "#/machines/dice-pool"
import type { useDicePool } from "#/hooks/use-dice-pool"

type DicePoolAPI = ReturnType<typeof useDicePool>

const diceLabel = (n: number): string => (n === 1 ? "1 die" : `${n} dice`)

/**
 * The felt (#98, crowned; folded in by #79): a physical tray where dice
 * visibly accrete. Sheet dice land in verdigris, loose dice neutral, Willpower
 * arrives as ember dice — one unified pool, one Roll. Chevron rails feed and
 * skim; the fittings are tray hardware on the lip, never a disclosure.
 *
 * Posture is EXPLICIT (owner call 2026-07-18, amending #104's activity-driven
 * rule): one caret opens and folds the tray, and nothing else does — an empty
 * felt stays open, a built pool survives folding. Folded, the tray is barely
 * there: a slim handle carrying only the caret and the pool count.
 */

/** The loose-dice component — the "Modifier" lie is dead; plain dice say so.
 * One exported sentinel: the feed's breakdown formatting keys off the same
 * predicate, so a rename here can't silently strand it. */
export const LOOSE_DICE = { type: "modifier", name: "Dice" } as const
export const isLooseDice = (c: { type: string; name: string }): boolean =>
  c.type === LOOSE_DICE.type && c.name === LOOSE_DICE.name

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
  const [expanded, setExpanded] = useState(true)
  const building = pool.state === "building"
  const rolling = pool.state === "rolling"
  const canInteract = pool.state === "idle" || building

  const components = pool.context.components
  const looseIndex = components.findIndex(isLooseDice)
  const loose = looseIndex === -1 ? 0 : components[looseIndex]!.dots
  const sheetComponents = components.filter((_, i) => i !== looseIndex)
  const wpDice = pool.context.spendWillpower ? WILLPOWER_BONUS_DICE : 0
  const total = pooledDice(pool.context)

  const setLoose = (next: number) => {
    const clamped = Math.max(0, next)
    if (!canInteract || clamped === loose) return
    if (looseIndex !== -1) pool.removeComponent(looseIndex)
    if (clamped > 0) pool.addComponent({ ...LOOSE_DICE, dots: clamped })
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
  // A plain tween, no bounce (owner call): the tray folds like a drawer.
  const postureTransition = reduced
    ? { duration: 0 }
    : { duration: 0.18, ease: "easeOut" as const }

  // Skimmable dice are buttons; the rest are plain marks — not disabled
  // controls, so their titles stay reachable and nothing pretends to refuse.
  const die = (kind: DieKind, key: string, title: string, onSkim?: () => void) => {
    const look = {
      borderColor: DIE_LOOK[kind].border,
      background: DIE_LOOK[kind].background,
    }
    const anim = {
      layout: !reduced,
      initial: { scale: 0.4, opacity: 0 },
      animate: { scale: 1, opacity: 1, rotate: 45 },
      exit: { scale: 0.4, opacity: 0 },
      transition: dieTransition,
    }
    return onSkim === undefined ? (
      <motion.span
        key={key}
        {...anim}
        title={title}
        className="size-[20px] rounded-[4px] border"
        style={look}
      />
    ) : (
      <motion.button
        key={key}
        {...anim}
        onClick={(e) => {
          e.stopPropagation()
          onSkim()
        }}
        disabled={!canInteract}
        title={title}
        className="size-[20px] cursor-pointer rounded-[4px] border"
        style={look}
      />
    )
  }

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
        {/* One handle, both postures: the thin toggle is the tray's only
            splitter — barely there, the pool count surfacing only when the
            felt is folded over waiting dice. */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mv-handle flex h-[18px] w-full items-center justify-center gap-1.5 leading-none"
          title={expanded ? "Fold the tray away" : "Open the felt"}
          aria-expanded={expanded}
        >
          <span className="mv-data text-[10px]">{expanded ? "⌄" : "⌃"}</span>
          {!expanded && total > 0 && (
            <span
              className="mv-data text-[10px] font-bold"
              style={{ color: "var(--accent)" }}
            >
              {total}
            </span>
          )}
        </button>

        <motion.div
          initial={false}
          animate={{ height: expanded ? "auto" : 0, opacity: expanded ? 1 : 0 }}
          transition={postureTransition}
          className="overflow-hidden"
        >
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
              className="mv-felt relative block min-w-0 cursor-copy rounded-[6px] border p-2 text-left"
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
              {/* the empty hint floats centered over the felt, out of the
                  layout entirely — swept dice exit under it, nothing shifts */}
              <AnimatePresence initial={false}>
                {total === 0 && (
                  <motion.span
                    key="empty-hint"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { duration: 0.15, delay: 0.12 }
                    }
                    className="mv-data pointer-events-none absolute inset-0 grid place-items-center text-[10px]"
                    style={{ color: "var(--dim)" }}
                  >
                    an empty felt rolls a chance die
                  </motion.span>
                )}
              </AnimatePresence>
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

            {/* fittings: the fives under their chevrons; the hardware fills
                the felt's width when the rail affords it (owner call) */}
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
                  className="mv-mini grow whitespace-nowrap disabled:opacity-40"
                  title="Sweep the loose dice off the felt"
                >
                  Sweep
                </button>
                <span className="h-4 w-px" style={{ background: "var(--line)" }} />
                {[10, 9, 8].map((n) => (
                  <button
                    key={n}
                    onClick={() => pool.setAgainThreshold(n)}
                    disabled={!canInteract}
                    className={`mv-mini grow whitespace-nowrap disabled:opacity-40 ${pool.context.againThreshold === n ? "mv-mini-on" : ""}`}
                  >
                    {n}-ag
                  </button>
                ))}
                <button
                  onClick={() => pool.setRoteAction(!pool.context.isRoteAction)}
                  disabled={!canInteract}
                  className={`mv-mini grow whitespace-nowrap disabled:opacity-40 ${pool.context.isRoteAction ? "mv-mini-on" : ""}`}
                >
                  Rote
                </button>
                <button
                  onClick={() =>
                    pool.setVisibility(
                      pool.context.visibility === "hidden" ? "public" : "hidden",
                    )
                  }
                  disabled={!canInteract}
                  className={`mv-mini grow whitespace-nowrap disabled:opacity-40 ${pool.context.visibility === "hidden" ? "mv-mini-on" : ""}`}
                >
                  Hidden
                </button>
                {willpowerGate === null ? (
                  <button
                    onClick={() =>
                      pool.setSpendWillpower(!pool.context.spendWillpower)
                    }
                    disabled={!canInteract}
                    className={`mv-mini grow whitespace-nowrap disabled:opacity-40 ${pool.context.spendWillpower ? "mv-mini-on" : ""}`}
                  >
                    WP +{WILLPOWER_BONUS_DICE}
                  </button>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button aria-disabled className="mv-mini mv-refuse grow whitespace-nowrap">
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

          {/* action — one trigger, full width; the felt itself is the pool's
              editor, so Roll needs no rival */}
          <div className="p-3">
            <button
              onClick={pool.roll}
              disabled={rolling || !canInteract}
              className="mv-roll w-full rounded-[3px] py-2 text-[13px] disabled:opacity-40"
              title={
                total === 0
                  ? "Roll the empty felt — a chance die"
                  : `Roll ${diceLabel(total)}`
              }
            >
              {rolling
                ? "Rolling…"
                : total === 0
                  ? "◈ Roll"
                  : `Roll ${diceLabel(total)}`}
            </button>
          </div>
        </motion.div>

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
