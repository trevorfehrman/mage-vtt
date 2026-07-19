import type * as React from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * The accrete beat (invented on the felt, #79; promoted by #72): the spring
 * a thing lands with when it joins a surface mid-flow — dice on the felt,
 * and whatever accretes next. Pair with `useReducedMotion` → `{ duration: 0 }`.
 */
export const entranceSpring = {
  type: "spring",
  stiffness: 500,
  damping: 30,
  mass: 0.6,
} as const;

/**
 * A feed entry landing (#72's promoted entrance primitive): rises in from
 * below and settles; exits fade. Wrap list items inside an
 * `<AnimatePresence initial={false}>` so history doesn't replay on mount.
 * Reduced motion renders instantly — no rise, no layout shuffle.
 */
export function FeedEntry({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      {...(reduced ? {} : { exit: { opacity: 0 } })}
      transition={
        reduced ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}
