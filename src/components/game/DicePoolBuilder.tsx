import { useState } from "react"
import { ChevronDown, ChevronUp, Minus, Plus, X } from "lucide-react"
import { Button } from "#/components/ui/button"
import { Badge } from "#/components/ui/badge"
import { Switch } from "#/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "#/components/ui/collapsible"
import { WILLPOWER_BONUS_DICE } from "#/domain/willpower-economy"
import type { useDicePool } from "#/hooks/use-dice-pool"

type DicePoolAPI = ReturnType<typeof useDicePool>

export function DicePoolBuilder({ pool }: { pool: DicePoolAPI }) {
  const [modifier, setModifier] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const hasComponents = pool.context.components.length > 0
  const canInteract = pool.state === "idle" || pool.state === "building"
  // The bonus is server-added on roll; mirror it in the displayed size.
  const displaySize =
    pool.context.poolSize +
    (pool.context.spendWillpower ? WILLPOWER_BONUS_DICE : 0)

  const handleAddModifier = () => {
    if (modifier === 0) return
    pool.addComponent({ type: "modifier", name: "Modifier", dots: modifier })
    setModifier(0)
  }

  // Auto-expand when components are added, auto-collapse when empty
  const showExpanded = isExpanded || pool.state === "building"

  return (
    <Collapsible
      open={showExpanded}
      onOpenChange={setIsExpanded}
      className="border-t border-[var(--line)]"
    >
      {/* Always-visible header: pool size + component badges */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className="cursor-pointer shrink-0"
          >
            {showExpanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronUp className="size-3.5" />
            )}
          </Button>
        </CollapsibleTrigger>

        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--kicker)] shrink-0">
          Dice Pool
        </h2>

        {hasComponents && (
          <>
            <span className="text-lg font-bold tabular-nums ml-1">
              {displaySize}
            </span>

            {/* Inline component badges in collapsed mode */}
            <div className="flex flex-wrap gap-1 flex-1 min-w-0">
              {pool.context.components.map((c, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="cursor-pointer gap-0.5 text-[10px] pr-1"
                  onClick={() => canInteract && pool.removeComponent(i)}
                >
                  {c.name}
                  {canInteract && (
                    <X className="size-2.5 text-muted-foreground" />
                  )}
                </Badge>
              ))}
            </div>

            {/* Always-visible clear */}
            {canInteract && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={pool.reset}
                className="cursor-pointer shrink-0 text-muted-foreground hover:text-foreground"
                title="Clear pool (Esc)"
              >
                <X className="size-3.5" />
              </Button>
            )}
          </>
        )}
      </div>

      {/* Expandable section: modifier, options, actions */}
      <CollapsibleContent>
        <div className="grid gap-4 px-3 pb-3">
          {/* Modifier stepper */}
          {canInteract && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground shrink-0">
                Modifier
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setModifier((m) => m - 1)}
                  className="cursor-pointer"
                >
                  <Minus className="size-3.5" />
                </Button>
                <span className="w-8 text-center text-sm font-bold tabular-nums">
                  {modifier >= 0 ? `+${modifier}` : modifier}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setModifier((m) => m + 1)}
                  className="cursor-pointer"
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
              <Button
                size="xs"
                variant="outline"
                onClick={handleAddModifier}
                disabled={modifier === 0}
                className="cursor-pointer text-xs"
              >
                Add
              </Button>
            </div>
          )}

          {/* Options row */}
          {pool.state === "building" && (
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <Select
                value={String(pool.context.againThreshold)}
                onValueChange={(v) => pool.setAgainThreshold(Number(v))}
              >
                <SelectTrigger
                  size="sm"
                  className="h-8 text-xs w-auto cursor-pointer"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10-again</SelectItem>
                  <SelectItem value="9">9-again</SelectItem>
                  <SelectItem value="8">8-again</SelectItem>
                </SelectContent>
              </Select>

              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  size="sm"
                  checked={pool.context.isRoteAction}
                  onCheckedChange={(v) => pool.setRoteAction(v)}
                />
                <span>Rote</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  size="sm"
                  checked={pool.context.visibility === "hidden"}
                  onCheckedChange={(v) =>
                    pool.setVisibility(v ? "hidden" : "public")
                  }
                />
                <span>Hidden</span>
              </label>

              {pool.canSpendWillpower && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch
                    size="sm"
                    checked={pool.context.spendWillpower}
                    onCheckedChange={(v) => pool.setSpendWillpower(v)}
                  />
                  <span>Willpower +{WILLPOWER_BONUS_DICE}</span>
                </label>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {pool.state === "building" && (
              <>
                <Button
                  onClick={pool.roll}
                  className="flex-1 cursor-pointer h-9"
                >
                  Roll {displaySize} dice
                </Button>
                <Button
                  variant="ghost"
                  onClick={pool.reset}
                  className="cursor-pointer"
                >
                  Clear
                </Button>
              </>
            )}
            {pool.state === "rolling" && (
              <Button disabled className="flex-1 h-9 animate-pulse">
                Rolling...
              </Button>
            )}
            {pool.state === "complete" && (
              <Button
                onClick={pool.reset}
                className="flex-1 cursor-pointer h-9"
              >
                New Roll
              </Button>
            )}
          </div>

          {/* Error */}
          {pool.context.error && (
            <p className="text-destructive text-sm">{pool.context.error}</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
