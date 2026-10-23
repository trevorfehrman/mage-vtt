import { motion } from "motion/react";
import { entranceSpring } from "#/components/ui/entrance";
import { ArcanaGlyph, arcanumRealm } from "./ArcanaGlyph";

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

export type DieKind = "sheet" | "loose" | "arcanum" | "highSpeech" | "willpower" | "paradox" | "paradoxBase";

const DIE_LOOK: Record<DieKind, { border: string; background: string }> = {
  sheet: {
    border: "var(--accent)",
    background: "color-mix(in srgb, var(--accent) 22%, transparent)",
  },
  loose: {
    border: "var(--dim)",
    background: "color-mix(in srgb, var(--ink) 6%, transparent)",
  },
  // The Arcanum's dice: neutral for now (no Arcanum has a canonical hue), the
  // Arcanum's glyph inside says which (felt audition, 2026-10-22).
  arcanum: {
    border: "var(--dim)",
    background: "color-mix(in srgb, var(--ink) 6%, transparent)",
  },
  // High Speech: the Supernal tongue, spoken — white, the one ink that is
  // no identity's (felt audition, 2026-10-22).
  highSpeech: {
    border: "var(--ink)",
    background: "color-mix(in srgb, var(--ink) 22%, transparent)",
  },
  willpower: {
    border: "var(--will)",
    background: "color-mix(in srgb, var(--will) 45%, transparent)",
  },
  // The Tides' dice: red, the scene's special circumstances (felt audition,
  // 2026-10-22). Reality's section of the felt says whose they are; no glyph.
  // Solid, the die is a hole — opaque scorch, red burning in from the rim —
  // see die-look.ts (the two tables move together until MAG-16).
  paradox: {
    border: "var(--paradox)",
    background: "var(--scorch)",
  },
  // Reality's base dice: Gnosis green, and a hole too (owner, 2026-10-22 evening).
  paradoxBase: {
    border: "var(--accent)",
    background: "var(--scorch)",
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
  title = "",
  reduced,
  ghosted = false,
  glide = true,
  onSkim,
  disabled = false,
  arcanum,
  lit = false,
}: {
  kind: DieKind;
  /** The die's native title; the card's dice use a Tooltip instead and omit it. */
  title?: string;
  /** For `kind: "arcanum"`: which Arcanum's glyph stands inside the die. */
  arcanum?: string | undefined;
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
  /** The die's group is under the pointer: it glows in its own ink. */
  lit?: boolean;
}) {
  // An Arcanum's dice wear its Supernal realm's metal (Death → Stygia's lead,
  // Forces → Aether's gold): the realm tokens the chips already spoke.
  const ink =
    kind === "arcanum" && arcanum !== undefined
      ? {
          border: `var(--realm-${arcanumRealm(arcanum.toLowerCase())})`,
          background: `color-mix(in srgb, var(--realm-${arcanumRealm(arcanum.toLowerCase())}) 22%, transparent)`,
        }
      : DIE_LOOK[kind];
  const look = ghosted
    ? { border: `1px dashed ${ink.border}`, background: "transparent" }
    : kind === "paradox" || kind === "paradoxBase"
      ? {
          border: `1px solid ${ink.border}`,
          background: ink.background,
          boxShadow: lit
            ? `inset 0 0 3px 1px color-mix(in srgb, ${ink.border} 70%, transparent), 0 0 0 1px ${ink.border}, 0 0 8px 1px color-mix(in srgb, ${ink.border} 70%, transparent)`
            : `inset 0 0 3px 1px color-mix(in srgb, ${ink.border} 70%, transparent)`,
        }
      : lit
        ? {
            border: `1px solid ${ink.border}`,
            background: `color-mix(in srgb, ${ink.border} 45%, transparent)`,
            boxShadow: `0 0 0 1px ${ink.border}, 0 0 8px 1px color-mix(in srgb, ${ink.border} 70%, transparent)`,
          }
        : { border: `1px solid ${ink.border}`, background: ink.background };
  const breathe =
    kind === "paradox" || kind === "paradoxBase"
      ? ` ${kind === "paradox" ? "mv-hole-paradox" : "mv-hole-base"}${!ghosted && !lit && reduced !== true ? " mv-hole-breathe" : ""}`
      : "";
  const anim = {
    layout: !reduced && glide,
    initial: { scale: 0.4, opacity: 0 },
    animate: { scale: 1, opacity: ghosted ? 0.45 : 1, rotate: 45 },
    exit: { scale: 0.4, opacity: 0 },
    transition: reduced ? { duration: 0 } : entranceSpring,
  };
  // The die rotates into its diamond stance; the glyph counter-rotates so
  // it stays upright inside it.
  const mark =
    kind === "arcanum" && arcanum !== undefined ? (
      <span
        className="grid place-items-center"
        style={{ transform: "rotate(-45deg)", color: ink.border, opacity: 0.95 }}
        aria-hidden
      >
        <ArcanaGlyph arcanum={arcanum} size={12} />
      </span>
    ) : null;
  return onSkim === undefined ? (
    <motion.span
      {...anim}
      title={title}
      className={`grid size-[20px] place-items-center rounded-[4px]${breathe}`}
      style={{ ...look, transition: "box-shadow 160ms, background 160ms" }}
    >
      {mark}
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
      className={`grid size-[20px] cursor-pointer place-items-center rounded-[4px]${breathe}`}
      style={{ ...look, transition: "box-shadow 160ms, background 160ms" }}
    >
      {mark}
    </motion.button>
  );
}
