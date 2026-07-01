import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#/components/ui/tooltip"

interface PresenceIndicatorProps {
  presenceState: Array<{ userId: string; online: boolean }> | undefined
  members: Array<{
    _id: string
    displayName: string
    userId: string
    role: string
  }>
}

export function PresenceIndicator({
  presenceState,
  members,
}: PresenceIndicatorProps) {
  if (!presenceState || members.length === 0) return null

  const onlineUserIds = new Set(
    presenceState.filter((p) => p.online).map((p) => p.userId),
  )

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {members.map((m) => {
          const isOnline = onlineUserIds.has(m.userId)
          return (
            <Tooltip key={m.userId}>
              <TooltipTrigger asChild>
                <span
                  className={`inline-flex size-2 rounded-full transition-colors ${
                    isOnline
                      ? "bg-emerald-400 shadow-[0_0_4px_theme(colors.emerald.400/50)]"
                      : "bg-muted-foreground/30"
                  }`}
                />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {m.displayName}
                {m.role === "storyteller" ? " (ST)" : ""}
                {isOnline ? "" : " — offline"}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
