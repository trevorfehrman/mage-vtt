import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui";

import { cn } from "#/lib/utils";

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        // A field's label speaks the eyebrow grammar (#72): dim mono
        // uppercase over the ink value it names.
        "flex items-center gap-2 font-mono text-[10px] leading-none tracking-[0.14em] uppercase text-[var(--dim)] select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
