import type { KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { WILLPOWER_BONUS_DICE } from "#/domain/willpower-economy";
import { skillDisplayName, specialtyComponent, type CharacterSheet } from "#/domain/character";
import { GateButton } from "#/components/ui/gate-button";
import { UnifiedDie } from "./UnifiedDie";
import { Felt } from "./Felt";
import { DieRows, DieStack } from "./DieStack";
import type { PoolKind } from "./die-look";
import { pooledDice } from "#/machines/dice-pool";
import type { useDicePool } from "#/hooks/use-dice-pool";
import { useTrayForm } from "#/hooks/use-instrument-form";
import { flipInstrumentForm } from "./instrument-form";
import { OPTION_WORDS, trayOptionWords } from "./tray-form";

type DicePoolAPI = ReturnType<typeof useDicePool>;

const diceLabel = (n: number): string => (n === 1 ? "1 die" : `${n} dice`);

/**
 * The felt (#98, crowned; folded in by #79): a physical tray where dice
 * visibly accrete. Sheet dice land in verdigris, loose dice neutral, Willpower
 * arrives as ember dice — one unified pool, one Roll. Chevron rails feed and
 * skim; the fittings are tray hardware on the lip, never a disclosure.
 *
 * Two forms, the viewer's choice (MAG-47, owner call 2026-10-23: "much of
 * the time i do not need all these controls"). This reverses 2026-07-19's
 * ALWAYS OPEN, which had itself reversed 2026-07-18's caret: the caret hid
 * the tray behind a disclosure, while the **shrunk** form still composes
 * and rolls. It is one line on the tall tray's own columns — ‹ · the felt
 * (count, the options a throw carries, Roll) · › — so the rails stand
 * still when the tray opens. The **tall** form is every control: the felt
 * holds a fixed two-row height with its lineage in the tray's own gutter,
 * no layout shift as dice or provenance arrive. The grip on the top edge
 * flips between them, in the same place in both; the choice is remembered
 * per viewer (`use-instrument-form`) and nothing flips it on its own. The roll
 * zone is still one instrument: replaced in place when a dice system takes
 * the stage, nothing else shares the slot.
 */

/** The loose-dice component — the "Modifier" lie is dead; plain dice say so.
 * One exported sentinel: the feed's breakdown formatting keys off the same
 * predicate, so a rename here can't silently strand it. */
export const LOOSE_DICE = { type: "modifier", name: "Dice" } as const;
export const isLooseDice = (c: { type: string; name: string }): boolean =>
  c.type === LOOSE_DICE.type && c.name === LOOSE_DICE.name;

export function DicePoolBuilder({
  pool,
  character,
}: {
  pool: DicePoolAPI;
  /** Funds the Willpower gate's reason; absent = sheetless seat. */
  character?: CharacterSheet | undefined;
}) {
  const reduced = useReducedMotion();
  const [form, setForm] = useTrayForm();
  const building = pool.state === "building";
  const rolling = pool.state === "rolling";
  const canInteract = pool.state === "idle" || building;

  const components = pool.context.components;
  const looseIndex = components.findIndex(isLooseDice);
  const loose = looseIndex === -1 ? 0 : components[looseIndex]!.dots;
  const sheetComponents = components.filter((_, i) => i !== looseIndex);
  const wpDice = pool.context.spendWillpower ? WILLPOWER_BONUS_DICE : 0;
  const total = pooledDice(pool.context);

  const setLoose = (next: number) => {
    const clamped = Math.max(0, next);
    if (!canInteract || clamped === loose) return;
    if (looseIndex !== -1) pool.removeComponent(looseIndex);
    if (clamped > 0) pool.addComponent({ ...LOOSE_DICE, dots: clamped });
  };

  // The gate speaks at the control that refuses (#79's tooltip pattern).
  const willpowerGate = !pool.canSpendWillpower
    ? "Willpower is a spend — it needs your sheet to fund it."
    : character !== undefined &&
        character.willpowerCurrent < 1 &&
        !pool.context.spendWillpower
      ? "No Willpower left to spend."
      : null;

  const die = (
    kind: PoolKind,
    key: string,
    title: string,
    onSkim?: () => void,
  ) => (
    <UnifiedDie
      key={key}
      mode="pool"
      kind={kind}
      title={title}
      reduced={reduced}
      onSkim={onSkim}
      disabled={!canInteract}
    />
  );

  const sheetDice = sheetComponents.flatMap((c) =>
    Array.from({ length: c.dots }, (_, i) =>
      die(
        "sheet",
        `s:${c.type}:${c.name}:${i}`,
        `${c.name} — toggle it off on the sheet`,
      ),
    ),
  );
  const looseDice = Array.from({ length: loose }, (_, i) =>
    die("loose", `l:${i}`, "A loose die — tap to take it back", () =>
      setLoose(loose - 1),
    ),
  );
  const willpowerDice = Array.from({ length: wpDice }, (_, i) =>
    die(
      "willpower",
      `w:${i}`,
      "Willpower — one point, precommitted and blind; Paradox can eat these like any others",
    ),
  );

  const lineage =
    sheetComponents.length > 0
      ? sheetComponents.map((c) => c.name).join(" + ")
      : null;

  // One rail pair, one felt tap, one Roll trigger: the strip and the tall
  // tray wear the same controls, sized for their form.
  const rail = (dir: "skim" | "feed", size: string) =>
    dir === "skim" ? (
      <button
        onClick={() => setLoose(loose - 1)}
        disabled={loose === 0 || !canInteract}
        className={`mv-btn ${size} rounded-[6px] text-[20px] leading-none disabled:opacity-30`}
        title="Skim a die off the felt"
      >
        ‹
      </button>
    ) : (
      <button
        onClick={() => setLoose(loose + 1)}
        disabled={!canInteract}
        className={`mv-btn ${size} rounded-[6px] text-[20px] leading-none disabled:opacity-30`}
        title="Feed a die onto the felt"
      >
        ›
      </button>
    );
  const feltTap = {
    role: "button",
    tabIndex: 0,
    title: "Tap the felt to add a die",
    onClick: () => setLoose(loose + 1),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setLoose(loose + 1);
      }
    },
  } as const;
  const rollTrigger = {
    onClick: pool.roll,
    disabled: rolling || !canInteract,
    title:
      total === 0
        ? "Roll the empty felt — a chance die"
        : `Roll ${diceLabel(total)}`,
  };
  const tall = form === "tall";
  const grip = tall ? "Shrink the tray" : "Show every option";

  return (
    <div className="relative border-t" style={{ borderColor: "var(--line)" }}>
      {/* the grip: a drawer handle on the tray's top edge, the same place in
          both forms */}
      <button
        onClick={() => setForm(flipInstrumentForm(form))}
        className="mv-grip"
        title={grip}
        aria-label={grip}
        aria-expanded={tall}
      >
        <span className="mv-grip-bar" />
      </button>
      {!tall ? (
        // the strip: ‹ the felt › and Roll at the far right (owner,
        // 2026-10-24), the trigger where the message box's Send stands
        <div
          className="mx-3 grid items-center gap-1.5 py-2"
          style={{ gridTemplateColumns: "2rem minmax(0,1fr) 2rem auto" }}
        >
          {rail("skim", "h-8")}
          <Felt
            {...feltTap}
            className="flex h-8 min-w-0 cursor-copy items-center justify-between"
          >
            {/* the dice themselves, stacking as they crowd; the count is
                Roll's (owner, 2026-10-25) */}
            {total === 0 ? (
              <span
                className="mv-data whitespace-nowrap px-2.5 text-[13px]"
                style={{ color: "var(--dim)" }}
              >
                chance die
              </span>
            ) : (
              <DieStack size="sm">
                {sheetDice}
                {willpowerDice}
                {looseDice}
              </DieStack>
            )}
            {trayOptionWords(pool.context).length > 0 && (
              <span
                className="mv-data shrink-0 px-2.5 text-[10px] uppercase"
                style={{ letterSpacing: "0.06em", color: "var(--dim)" }}
              >
                {trayOptionWords(pool.context).join(" · ")}
              </span>
            )}
          </Felt>
          {rail("feed", "h-8")}
          <button
            {...rollTrigger}
            className="mv-roll h-8 shrink-0 rounded-[3px] text-[12px] disabled:opacity-40"
            style={{ minWidth: 76, padding: "0 10px" }}
          >
            {rolling ? "Rolling…" : total === 0 ? "Roll" : `Roll ${total}`}
          </button>
        </div>
      ) : (
        <>
          {/* the felt, flanked by its rails: ‹/−5 skim off the left,
              ›/+5 feed on from the right; fittings keep to the felt's
              own column and wrap when the rail thins (#98) */}
          <div
            className="mx-3 mt-2 grid gap-1.5"
            style={{ gridTemplateColumns: "2rem minmax(0,1fr) 2rem" }}
          >
            {rail("skim", "w-8")}
            <Felt
              {...feltTap}
              className="relative block min-w-0 cursor-copy px-2 pt-2 pb-1 text-left"
            >
              {/* fixed two-row height — no shift as dice arrive; past two
                  rows the last place reads "+N" (owner, 2026-10-25) */}
              <span className="flex h-[58px]">
                <DieRows size="sm" rows={2}>
                  {sheetDice}
                  {willpowerDice}
                  {looseDice}
                </DieRows>
              </span>
              {/* the gutter — the lineage in the tray's own frame, no shift
                  when it arrives */}
              <p
                className="mv-data h-[13px] truncate px-1 text-[10px] leading-none"
                style={{ color: "var(--dim)" }}
              >
                {lineage ?? ""}
              </p>
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
                    className="mv-empty pointer-events-none absolute inset-0"
                  >
                    an empty felt rolls a chance die
                  </motion.span>
                )}
              </AnimatePresence>
            </Felt>
            {rail("feed", "w-8")}

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
                <span
                  className="h-4 w-px"
                  style={{ background: "var(--line)" }}
                />
                {[10, 9, 8].map((n) => (
                  <button
                    key={n}
                    onClick={() => pool.setAgainThreshold(n)}
                    disabled={!canInteract}
                    className={`mv-mini grow whitespace-nowrap disabled:opacity-40 ${pool.context.againThreshold === n ? "mv-mini-on" : ""}`}
                  >
                    {OPTION_WORDS.again(n)}
                  </button>
                ))}
                <button
                  onClick={() => pool.setRoteAction(!pool.context.isRoteAction)}
                  disabled={!canInteract}
                  className={`mv-mini grow whitespace-nowrap disabled:opacity-40 ${pool.context.isRoteAction ? "mv-mini-on" : ""}`}
                >
                  {OPTION_WORDS.rote}
                </button>
                {/* Skill Specialties (MAG-58): one chip per specialty whose
                    skill is in the pool — the +1 the player arms when the
                    roll falls inside it; the sheet only names it */}
                {(character?.specialties ?? [])
                  .filter((sp) => pool.isComponentActive("skill", skillDisplayName(sp.skill)))
                  .map((sp) => {
                    const component = specialtyComponent(sp);
                    const on = pool.isComponentActive(component.type, component.name);
                    return (
                      <button
                        key={sp.skill}
                        onClick={() => pool.toggleComponent(component)}
                        disabled={!canInteract}
                        className={`mv-mini grow whitespace-nowrap disabled:opacity-40 ${on ? "mv-mini-on" : ""}`}
                        title="Specialty · +1 die"
                      >
                        {sp.label} +1
                      </button>
                    );
                  })}
                <button
                  onClick={() =>
                    pool.setVisibility(
                      pool.context.visibility === "hidden"
                        ? "public"
                        : "hidden",
                    )
                  }
                  disabled={!canInteract}
                  className={`mv-mini grow whitespace-nowrap disabled:opacity-40 ${pool.context.visibility === "hidden" ? "mv-mini-on" : ""}`}
                >
                  {OPTION_WORDS.hidden}
                </button>
                <GateButton
                  gate={willpowerGate}
                  onClick={() =>
                    pool.setSpendWillpower(!pool.context.spendWillpower)
                  }
                  disabled={!canInteract}
                  className={`mv-mini grow whitespace-nowrap disabled:opacity-40 ${pool.context.spendWillpower ? "mv-mini-on" : ""}`}
                >
                  {OPTION_WORDS.willpower}
                </GateButton>
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
              {...rollTrigger}
              className="mv-roll w-full rounded-[3px] py-2 text-[13px] disabled:opacity-40"
            >
              {rolling
                ? "Rolling…"
                : total === 0
                  ? "Roll a chance die"
                  : `Roll ${diceLabel(total)}`}
            </button>
          </div>
        </>
      )}

      {/* error — the seam's refusal, spoken under the tray */}
      {pool.context.error && (
        <p className="px-3 pb-2 text-[12px]" style={{ color: "var(--bad)" }}>
          {pool.context.error}
        </p>
      )}
    </div>
  );
}
