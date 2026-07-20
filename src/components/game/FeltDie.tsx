import { motion } from "motion/react";
import { entranceSpring } from "#/components/ui/entrance";
import { ParadoxGlyph } from "./ParadoxGlyph";

/**
 * The felt's die (extracted from the DicePoolBuilder for issue #107): one
 * physical mark, shared by the plain tray and the declaration felt so both
 * postures speak the same provenance grammar — sheet dice verdigris, loose
 * dice neutral, Willpower ember. `paradox` (the 2026-07-19 polish pass) is
 * the die reality rolls back: --paradox red with the torn-circle glyph
 * inside the diamond — it stands on the felt beneath the declared pool as
 * a physical threat, not a sentence. `ghosted` is the #102 pending recipe
 * over the die's own identity color (dashed outline + opacity): the price
 * being weighed, visible before it's paid.
 */

export type DieKind = "sheet" | "loose" | "willpower" | "paradox";

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
  paradox: {
    border: "var(--paradox)",
    background: "color-mix(in srgb, var(--paradox) 16%, transparent)",
  },
};

/**
 * Skimmable dice are buttons; the rest are plain marks — not disabled
 * controls, so their titles stay reachable and nothing pretends to refuse.
 * Render inside an `<AnimatePresence initial={false}>`; presence reaches the
 * inner motion element through context, so exits play from the wrapper's key.
 */
export function FeltDie({
  kind,
  title,
  reduced,
  ghosted = false,
  onSkim,
  disabled = false,
}: {
  kind: DieKind;
  title: string;
  /** The owner's `useReducedMotion()` — one read per tray, not per die. */
  reduced: boolean | null;
  ghosted?: boolean;
  onSkim?: (() => void) | undefined;
  disabled?: boolean;
}) {
  const look = ghosted
    ? {
        border: `1px dashed ${DIE_LOOK[kind].border}`,
        background: "transparent",
      }
    : {
        border: `1px solid ${DIE_LOOK[kind].border}`,
        background: DIE_LOOK[kind].background,
      };
  const anim = {
    layout: !reduced,
    initial: { scale: 0.4, opacity: 0 },
    animate: { scale: 1, opacity: ghosted ? 0.45 : 1, rotate: 45 },
    exit: { scale: 0.4, opacity: 0 },
    transition: reduced ? { duration: 0 } : entranceSpring,
  };
  // The die rotates into its diamond stance; the glyph counter-rotates so
  // the tear stays upright inside it.
  const glyph =
    kind === "paradox" ? (
      <span
        className="grid place-items-center"
        style={{ transform: "rotate(-45deg)" }}
        aria-hidden
      >
        <ParadoxGlyph size={12} title="" />
      </span>
    ) : null;
  return onSkim === undefined ? (
    <motion.span
      {...anim}
      title={title}
      className="grid size-[20px] place-items-center rounded-[4px]"
      style={look}
    >
      {glyph}
    </motion.span>
  ) : (
    <motion.button
      {...anim}
      onClick={(e) => {
        e.stopPropagation();
        onSkim();
      }}
      disabled={disabled}
      title={title}
      className="grid size-[20px] cursor-pointer place-items-center rounded-[4px]"
      style={look}
    >
      {glyph}
    </motion.button>
  );
}
