import { useState } from "react"
import { Button } from "#/components/ui/button"
import { Input } from "#/components/ui/input"
import { Label } from "#/components/ui/label"
import { Badge } from "#/components/ui/badge"
import type { useDicePool } from "#/hooks/use-dice-pool"

type DicePoolAPI = ReturnType<typeof useDicePool>

const COMPONENT_TYPES = ["attribute", "skill", "arcanum", "modifier"] as const

export function DiceRoller({ pool }: { pool: DicePoolAPI }) {
  const [name, setName] = useState("")
  const [dots, setDots] = useState(1)
  const [type, setType] = useState<string>("attribute")

  const handleAdd = () => {
    if (!name.trim()) return
    pool.addComponent({ type, name: name.trim(), dots })
    setName("")
    setDots(1)
  }

  return (
    <div className="grid gap-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--kicker)]">
        Dice Pool
      </h2>

      {/* Component input */}
      {(pool.state === "idle" || pool.state === "building") && (
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-2">
          <div className="grid gap-1">
            <Label htmlFor="comp-name" className="text-xs">
              Name
            </Label>
            <Input
              id="comp-name"
              placeholder="Strength"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="h-8 text-sm"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="comp-dots" className="text-xs">
              Dots
            </Label>
            <Input
              id="comp-dots"
              type="number"
              min={-5}
              max={10}
              value={dots}
              onChange={(e) => setDots(Number(e.target.value))}
              className="h-8 w-16 text-sm"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="comp-type" className="text-xs">
              Type
            </Label>
            <select
              id="comp-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              {COMPONENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <Button size="sm" variant="outline" onClick={handleAdd} className="h-8">
            Add
          </Button>
        </div>
      )}

      {/* Current components */}
      {pool.context.components.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pool.context.components.map((c, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="cursor-pointer gap-1 pr-1"
              onClick={() => pool.state === "building" && pool.removeComponent(i)}
            >
              {c.name} {c.dots > 0 ? `+${c.dots}` : c.dots}
              {pool.state === "building" && (
                <span className="ml-0.5 text-muted-foreground">&times;</span>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Pool size + options */}
      {pool.state === "building" && (
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold tabular-nums">
            {pool.context.poolSize}
          </span>
          <span className="text-muted-foreground text-sm">dice</span>

          <div className="ml-auto flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5">
              <select
                value={pool.context.againThreshold}
                onChange={(e) => pool.setAgainThreshold(Number(e.target.value))}
                className="h-7 rounded border border-input bg-background px-1.5 text-xs"
              >
                <option value={10}>10-again</option>
                <option value={9}>9-again</option>
                <option value={8}>8-again</option>
              </select>
            </label>

            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={pool.context.isRoteAction}
                onChange={(e) => pool.setRoteAction(e.target.checked)}
                className="rounded"
              />
              Rote
            </label>

            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={pool.context.visibility === "hidden"}
                onChange={(e) =>
                  pool.setVisibility(e.target.checked ? "hidden" : "public")
                }
                className="rounded"
              />
              Hidden
            </label>
          </div>
        </div>
      )}

      {/* Roll / Reset buttons */}
      <div className="flex gap-2">
        {pool.state === "building" && (
          <>
            <Button onClick={pool.roll} className="flex-1">
              Roll
            </Button>
            <Button variant="ghost" onClick={pool.reset}>
              Clear
            </Button>
          </>
        )}
        {pool.state === "rolling" && (
          <Button disabled className="flex-1">
            Rolling...
          </Button>
        )}
        {pool.state === "complete" && (
          <Button onClick={pool.reset} className="flex-1">
            New Roll
          </Button>
        )}
      </div>

      {/* Error */}
      {pool.context.error && (
        <p className="text-destructive text-sm">{pool.context.error}</p>
      )}
    </div>
  )
}
