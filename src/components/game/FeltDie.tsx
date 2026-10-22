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
 * a physical threat, not a sentence. `paradoxBase` (pass 3, note 6) is
 * reality's own base die — gnosis-green like the sheet's GNOSIS header, the
 * red torn circle inside it — so green base dice + tide tags = the felt's
 * red count, without a badge ever implying the rank. `ghosted` is the #102
 * pending recipe over the die's own identity color (dashed outline +
 * opacity): the price being weighed, visible before it's paid.
 */

export type DieKind = "sheet" | "loose" | "willpower" | "paradox" | "paradoxBase";

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
  // The Tides die comes from circumstance, so it wears the loose die's neutral;
  // the red glyph alone says reality rolls it (provenance grammar, 2026-10-22).
  paradox: {
    border: "var(--dim)",
    background: "color-mix(in srgb, var(--ink) 6%, transparent)",
  },
  paradoxBase: {
    border: "var(--accent)",
    background: "color-mix(in srgb, var(--accent) 22%, transparent)",
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
  glide = true,
  onSkim,
  disabled = false,
}: {
  kind: DieKind;
  title: string;
  /** The owner's `useReducedMotion()` — one read per tray, not per die. */
  reduced: boolean | null;
  ghosted?: boolean;
  /** The `layout` reflow glide. On for the composing felts, where skimming a
   * middle die makes its neighbors slide over. OFF on the live Cast card
   * (pass 3, note 8): there the card's own frame resizes as phases come and
   * go, and it snaps — dice gliding to their new home while the frame snaps
   * read as two animations disagreeing, so the pair now snap together (the
   * entrance/exit springs still play). */
  glide?: boolean;
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
    layout: !reduced && glide,
    initial: { scale: 0.4, opacity: 0 },
    animate: { scale: 1, opacity: ghosted ? 0.45 : 1, rotate: 45 },
    exit: { scale: 0.4, opacity: 0 },
    transition: reduced ? { duration: 0 } : entranceSpring,
  };
  // The die rotates into its diamond stance; the glyph counter-rotates so
  // the tear stays upright inside it.
  const glyph =
    kind === "paradox" || kind === "paradoxBase" ? (
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
