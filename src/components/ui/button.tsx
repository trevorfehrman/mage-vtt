import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "#/lib/utils";

/**
 * Restyled onto the mv language (#72): buttons speak mono-uppercase like the
 * rail's fittings; the default variant is the trigger (mv-roll's verdigris),
 * outline/secondary are the workaday mv-btn, ghost is the tray-handle's
 * whisper. Focus ring comes from the shared [data-slot] rule in styles.css.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[3px] border border-transparent font-mono text-[12px] font-medium tracking-[0.06em] uppercase whitespace-nowrap transition-[background-color,border-color,color,box-shadow] outline-none disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-[var(--bad)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-[var(--accent)] bg-[var(--accent)] font-semibold text-[var(--primary-foreground)] hover:shadow-[0_0_16px_var(--glow)]",
        destructive:
          "border-[var(--bad)] bg-transparent text-[var(--bad)] hover:bg-[color-mix(in_srgb,var(--bad)_12%,transparent)]",
        outline:
          "border-[var(--line)] bg-transparent text-[var(--ink)] hover:border-[var(--accent)]",
        secondary:
          "border-[var(--line)] bg-[var(--raise)] text-[var(--ink)] hover:border-[var(--accent)] hover:text-white",
        ghost:
          "text-[var(--dim)] hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] hover:text-[var(--ink)]",
        link: "font-sans text-[13px] tracking-normal normal-case text-[var(--accent)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3.5 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 px-2 text-[10px] has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1.5 px-3 text-[11px] has-[>svg]:px-2.5",
        lg: "h-9 px-6 has-[>svg]:px-4",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
