import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card"
import { Badge } from "#/components/ui/badge"
import { Link } from "@tanstack/react-router"

export function SessionList() {
  const sessions = useQuery(api.sessions.listMine)

  if (sessions === undefined) {
    return <p className="text-muted-foreground text-sm">Loading sessions...</p>
  }

  if (sessions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No sessions yet. Create one or join with an invite code.
      </p>
    )
  }

  return (
    <div className="grid gap-3">
      {sessions.map((session) => (
        <Link
          key={session._id}
          to="/sessions/$sessionId"
          params={{ sessionId: session._id }}
          className="no-underline"
        >
          <Card className="cursor-pointer transition-colors hover:border-[var(--lagoon-deep)]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">{session.name}</CardTitle>
              <div className="flex gap-2">
                <Badge variant="outline">{session.myRole}</Badge>
                <Badge
                  variant={session.status === "active" ? "default" : "secondary"}
                >
                  {session.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-xs">
                Invite: {session.inviteCode}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
