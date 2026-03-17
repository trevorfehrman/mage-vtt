import { Badge } from "#/components/ui/badge"

interface Member {
  _id: string
  displayName: string
  role: "storyteller" | "player"
  userId: string
}

export function PlayerList({ members }: { members: Member[] }) {
  return (
    <div className="grid gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--kicker)]">
        Players
      </h2>
      {members.map((m) => (
        <div
          key={m._id}
          className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm"
        >
          <span>{m.displayName}</span>
          {m.role === "storyteller" && (
            <Badge variant="outline" className="text-[10px]">
              ST
            </Badge>
          )}
        </div>
      ))}
    </div>
  )
}
