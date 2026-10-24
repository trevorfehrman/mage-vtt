import { useState } from "react"
import { seamErrorMessage } from "#/lib/seam-errors"
import { Switch } from "#/components/ui/switch"
import { StatGlyph } from "./ArcanaGlyph"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "#/components/ui/tooltip"

/**
 * The standing tool fact (issue #107): a Magical Tool in hand (Mage p. 91),
 * −1 Paradox die on every vulgar cast. Seated at the corner of the sheet's
 * header (MAG-52): a wand, verdigris in hand and grey set aside, beside a
 * Switch (owner call 2026-07-19: a standing fact should read on/off at a
 * glance). The refusal speaks in place (ADR-0021); without the mutation the
 * wand alone states the fact.
 */
export function ToolSwitch({
  magicalTool,
  onSetMagicalTool,
}: {
  magicalTool: boolean
  onSetMagicalTool?: ((hasMagicalTool: boolean) => Promise<unknown>) | undefined
}) {
  const [error, setError] = useState<string | null>(null)
  // The wand is the label (owner, 2026-10-24): verdigris in hand, grey set
  // aside. The tooltip names it in the book's term and nothing more — the
  // ink already says in hand or not, and the −1 shows up resolved in the
  // dice systems (owner call 2026-07-19).
  const label = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="inline-flex"
            style={{ color: magicalTool ? "var(--accent)" : "var(--dim)" }}
          >
            <StatGlyph stat="wand" size={18} />
            <span className="sr-only">Magical tool {magicalTool ? "in hand" : "set aside"}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          Magical tool
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
  if (onSetMagicalTool === undefined) {
    return label
  }
  return (
    <span className="grid justify-items-start gap-1">
      <label className="flex cursor-pointer items-center gap-1.5">
        {label}
        <Switch
          size="sm"
          checked={magicalTool}
          onCheckedChange={(checked) => {
            setError(null)
            onSetMagicalTool(checked).catch((err) =>
              setError(seamErrorMessage(err)),
            )
          }}
        />
      </label>
      {error && (
        <span className="text-[11px]" style={{ color: "var(--bad)" }}>
          {error}
        </span>
      )}
    </span>
  )
}
