import type { ComponentProps } from "react"
import { cn } from "#/lib/utils"

/**
 * The bordered felt panel (MAG-12): the caster's tray, the declaration felt,
 * the Cast card. (A Chronicle roll card's row is a felt too, but bare — no
 * panel.) Its border, accent wash and radius are `.mv-felt` in styles.css,
 * its keyboard ring the grouped focus-ring rule there. A site brings only its
 * own layout through `className`, never a style: `.mv-felt` is unlayered, so
 * a site's border, radius or background utility silently loses — restyling
 * the felt is one edit, in one place.
 */
export function Felt({ className, ...props }: Omit<ComponentProps<"div">, "style">) {
  return <div className={cn("mv-felt", className)} {...props} />
}
