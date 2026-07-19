import * as React from "react";

import { cn } from "#/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // The styled field (#72): mv-field owns the voice, border, and focus
        // treatment; the shell here is just sizing.
        "mv-field h-8 w-full min-w-0 px-2.5 py-1 text-[12px] selection:bg-[var(--accent)] selection:text-[var(--primary-foreground)] file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-[11px] file:text-[var(--ink)] disabled:pointer-events-none disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
