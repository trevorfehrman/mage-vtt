import type * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#/components/ui/tooltip";
import { cn } from "#/lib/utils";

interface GateButtonProps extends React.ComponentProps<"button"> {
  /** The reason the control refuses right now, or null when it consents. */
  gate: string | null;
  /** Which side the reason surfaces on. */
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Every gate explains itself (ADR-0021; promoted from the felt's Willpower
 * fitting, #79 → #72): while `gate` is non-null the control dims like
 * disabled but keeps pointer events, so the reason surfaces in a tooltip at
 * the control that refuses — never silence. The click is withheld, not the
 * explanation. With `gate: null` this is a plain button.
 */
export function GateButton({
  gate,
  side = "top",
  className,
  onClick,
  disabled,
  ...props
}: GateButtonProps) {
  if (gate === null) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={className}
        {...props}
      />
    );
  }
  // Mechanically inert wins over the gate: a truly disabled control goes
  // quiet (no tooltip fires on a disabled button) — the reason only matters
  // while the control could otherwise be pressed.
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-disabled
            disabled={disabled}
            className={cn("mv-refuse", className)}
            {...props}
          />
        </TooltipTrigger>
        <TooltipContent side={side}>{gate}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
